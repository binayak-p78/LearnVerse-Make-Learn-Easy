import examplesFile from "@shared/automata/examples.json";
import { FiniteAutomaton } from "./finite";
import { PushdownAutomaton } from "./pda";
import { TuringMachine } from "./turing";
import {
  EPSILON,
  type Kind,
  type Machine,
  SCHEMA_VERSION,
  type SimulationResult,
  type State,
  type Transition,
} from "./types";

export interface ExampleCase {
  input: string;
  accepted: boolean;
  output?: string;
}

export interface Example {
  machine: Machine;
  cases: ExampleCase[];
}

const EPSILON_ALIASES = new Set(["", "e", "eps", "epsilon", "λ"]);
export const normalizeSymbol = (value: string) => (EPSILON_ALIASES.has(value) ? EPSILON : value);

// Fills defaults so API payloads and imported JSON become complete machines
export function normalizeMachine(raw: unknown): Machine {
  const m = raw as Partial<Machine> & { kind: Kind };
  const states = (m.states ?? []).map((s: Partial<State>) => ({
    id: String(s.id),
    label: s.label ?? "",
    x: s.x ?? 0,
    y: s.y ?? 0,
  }));
  const base = {
    id: m.id ?? "untitled",
    name: m.name ?? "Untitled",
    description: m.description ?? "",
    alphabet: [...(m.alphabet ?? [])],
    states,
    start: m.start ?? "",
    accept: [...(m.accept ?? [])],
  };
  const transitions = (m.transitions ?? []) as Transition[];
  switch (m.kind) {
    case "dfa":
    case "nfa":
      return { ...base, kind: m.kind, transitions: transitions.map((t) => ({ id: t.id, from: t.from, to: t.to, read: normalizeSymbol(t.read) })) };
    case "pda": {
      const p = m as Partial<Extract<Machine, { kind: "pda" }>>;
      return {
        ...base,
        kind: "pda",
        stackAlphabet: [...(p.stackAlphabet ?? [])],
        initialStack: p.initialStack ?? "Z",
        acceptMode: p.acceptMode ?? "final",
        transitions: (p.transitions ?? []).map((t) => ({
          id: t.id, from: t.from, to: t.to,
          read: normalizeSymbol(t.read), pop: normalizeSymbol(t.pop ?? EPSILON), push: normalizeSymbol(t.push ?? EPSILON),
        })),
      };
    }
    case "tm": {
      const t = m as Partial<Extract<Machine, { kind: "tm" }>>;
      return {
        ...base,
        kind: "tm",
        tapeAlphabet: [...(t.tapeAlphabet ?? [])],
        blank: t.blank ?? "_",
        transitions: (t.transitions ?? []).map((r) => ({ id: r.id, from: r.from, to: r.to, read: r.read, write: r.write, move: r.move })),
      };
    }
  }
}

export const EXAMPLES: Example[] = examplesFile.examples.map((e) => ({
  machine: normalizeMachine(e.machine),
  cases: e.cases,
}));

export const examplesOf = (kinds: Kind[]) => EXAMPLES.filter((e) => kinds.includes(e.machine.kind));

export function simulate(machine: Machine, input: string, maxSteps = 2000): SimulationResult {
  switch (machine.kind) {
    case "dfa":
    case "nfa":
      return new FiniteAutomaton(machine).simulate(input);
    case "pda":
      return new PushdownAutomaton(machine).simulate(input, maxSteps);
    case "tm":
      return new TuringMachine(machine).simulate(input, maxSteps);
  }
}

export function nextId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let i = 0; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`;
}

export function blankMachine(kind: Kind): Machine {
  const base = { id: `my-${kind}`, name: `My ${kind.toUpperCase()}`, description: "", states: [{ id: "q0", label: "q0", x: 150, y: 180 }], start: "q0", accept: [] };
  switch (kind) {
    case "dfa":
    case "nfa":
      return { ...base, kind, alphabet: ["a", "b"], transitions: [] };
    case "pda":
      return { ...base, kind, alphabet: ["a", "b"], stackAlphabet: ["A", "Z"], initialStack: "Z", acceptMode: "final", transitions: [] };
    case "tm":
      return { ...base, kind, alphabet: ["0", "1"], tapeAlphabet: ["0", "1", "_"], blank: "_", transitions: [] };
  }
}

export function toDocument(machine: Machine) {
  return { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), machine };
}

export function transitionLabel(t: Transition, kind: Kind): string {
  if (kind === "pda") {
    const p = t as Extract<Transition, { pop: string }>;
    return `${p.read}, ${p.pop} → ${p.push}`;
  }
  if (kind === "tm") {
    const r = t as Extract<Transition, { move: string }>;
    return `${r.read} → ${r.write}, ${r.move}`;
  }
  return t.read;
}
