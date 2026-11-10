import { api, ApiError, type Schemas, unwrap } from "@/services/api";
import { nfaToDfa } from "./engine/finite";
import { EXAMPLES, normalizeMachine, toDocument } from "./engine/machine";
import { type ConvertResult, type FiniteMachine, type Kind, type Machine, SCHEMA_VERSION, type ValidationReport } from "./engine/types";
import { validate } from "./engine/validate";

export type Source = "server" | "offline";

const offline = (e: unknown) => e instanceof ApiError && e.code === "OFFLINE";

export interface ExampleSummary {
  id: string;
  name: string;
  description: string;
  kind: Kind;
}

export async function listExamples(kind: Kind): Promise<{ source: Source; items: ExampleSummary[] }> {
  try {
    const items = await unwrap(api.GET("/api/automata/examples", { params: { query: { kind } } }));
    return { source: "server", items };
  } catch (e) {
    if (!offline(e)) throw e;
    const items = EXAMPLES.filter((x) => x.machine.kind === kind).map(({ machine: m }) => ({ id: m.id, name: m.name, description: m.description, kind: m.kind }));
    return { source: "offline", items };
  }
}

export async function loadExample(id: string): Promise<Machine> {
  try {
    const example = await unwrap(api.GET("/api/automata/examples/{example_id}", { params: { path: { example_id: id } } }));
    return normalizeMachine(example.machine);
  } catch (e) {
    const local = EXAMPLES.find((x) => x.machine.id === id);
    if (offline(e) && local) return structuredClone(local.machine);
    throw e;
  }
}

export async function convertToDfa(machine: FiniteMachine): Promise<{ source: Source; result: ConvertResult }> {
  try {
    const body = await unwrap(api.POST("/api/automata/convert/nfa-to-dfa", { body: { machine } }));
    return {
      source: "server",
      result: {
        dfa: normalizeMachine(body.dfa) as FiniteMachine,
        mapping: body.mapping,
        steps: body.steps.map((s) => ({ from: s.from, symbol: s.symbol, to: s.to, targetSet: s.targetSet, isNew: s.isNew })),
      },
    };
  } catch (e) {
    if (!offline(e)) throw e;
    return { source: "offline", result: nfaToDfa(machine) };
  }
}

export interface MinimizeResult {
  dfa: FiniteMachine;
  partitions: string[][];
  removedUnreachable: string[];
  addedTrap: boolean;
}

export async function minimizeDfa(machine: FiniteMachine): Promise<MinimizeResult> {
  const body = await unwrap(api.POST("/api/automata/minimize", { body: { machine } }));
  return { ...body, dfa: normalizeMachine(body.dfa) as FiniteMachine };
}

export async function exportDocument(machine: Machine): Promise<Schemas["MachineDocument-Output"] | ReturnType<typeof toDocument>> {
  try {
    return await unwrap(api.POST("/api/automata/export", { body: { machine } }));
  } catch (e) {
    if (!offline(e)) throw e;
    return toDocument(machine);
  }
}

export async function importDocument(raw: unknown): Promise<{ machine: Machine; validation: ValidationReport; source: Source }> {
  const doc = raw as { schemaVersion?: number; machine?: unknown };
  const document = doc && typeof doc === "object" && "machine" in doc ? doc : { schemaVersion: SCHEMA_VERSION, machine: raw };
  try {
    const body = await unwrap(api.POST("/api/automata/import", { body: document as Schemas["MachineDocument-Input"] }));
    return { machine: normalizeMachine(body.machine), validation: body.validation, source: "server" };
  } catch (e) {
    if (!offline(e)) throw e;
    if ((document.schemaVersion ?? SCHEMA_VERSION) !== SCHEMA_VERSION) {
      throw new ApiError("UNSUPPORTED_VERSION", `Schema version ${document.schemaVersion} is not supported.`, 400);
    }
    const machine = normalizeMachine(document.machine);
    return { machine, validation: validate(machine), source: "offline" };
  }
}
