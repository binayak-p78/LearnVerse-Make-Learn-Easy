import { CircleDot, Download, FilePlus2, LayoutGrid, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Button } from "@/components/ui/Button";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { ApiError } from "@/services/api";
import type { ModuleKey } from "@/services/progressStore";
import { exportDocument, importDocument, listExamples, loadExample } from "./api";
import { DiagramEditor, type Selection } from "./editor/DiagramEditor";
import { MachinePanel, removeState } from "./editor/MachinePanel";
import { defaultTransition, TransitionTable } from "./editor/TransitionTable";
import { blankMachine, nextId } from "./engine/machine";
import type { FiniteMachine, Kind, Machine, SimulationResult } from "./engine/types";
import { validate } from "./engine/validate";
import { SimulationPanel } from "./sim/SimulationPanel";
import { useAutomata, type Workspace } from "./store";
import { ConversionTools } from "./tools/ConversionTools";

interface Props {
  workspace: Workspace;
  kinds: Kind[];
  title: string;
  description: string;
  module: ModuleKey;
}

const logicKey = (m: Machine) => JSON.stringify({ ...m, states: m.states.map((s) => s.id) });

function circleLayout(machine: Machine): Machine {
  const n = machine.states.length;
  const radius = Math.max(120, n * 38);
  return {
    ...machine,
    states: machine.states.map((s, i) => {
      const angle = Math.PI + (2 * Math.PI * i) / Math.max(1, n);
      return { ...s, x: Math.round(radius + 80 + radius * Math.cos(angle)), y: Math.round(radius + 60 + radius * Math.sin(angle)) };
    }),
  } as Machine;
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

export function Workbench({ workspace, kinds, title, description, module }: Props) {
  useTrackVisit(title, module);
  const machine = useAutomata((s) => s.machines[workspace]);
  const revision = useAutomata((s) => s.revision[workspace]);
  const setStoreMachine = useAutomata((s) => s.setMachine);
  const loadStoreMachine = useAutomata((s) => s.loadMachine);
  const [selection, setSelection] = useState<Selection>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [notice, setNotice] = useState<{ tone: "danger" | "success" | "warning"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const setMachine = useCallback((m: Machine) => setStoreMachine(workspace, m), [setStoreMachine, workspace]);
  const loadMachine = useCallback(
    (m: Machine) => {
      loadStoreMachine(workspace, m);
      setSelection(null);
    },
    [loadStoreMachine, workspace],
  );

  const report = useMemo(() => validate(machine), [machine]);
  const logic = logicKey(machine);
  useEffect(() => {
    setResult(null);
    setStepIndex(0);
  }, [logic]);

  const examples = useAsync(async () => {
    const lists = await Promise.all(kinds.map((k) => listExamples(k)));
    return { source: lists.every((l) => l.source === "server") ? "server" : "offline", items: lists.flatMap((l) => l.items) };
  }, [kinds.join()]);

  const { activeStates, activeTransitions } = useMemo(() => {
    const states = new Set<string>();
    const transitions = new Set<string>();
    const step = result?.steps[stepIndex];
    if (step) {
      if ("states" in step) {
        step.states.forEach((s) => states.add(s));
        if (stepIndex > 0) step.transitionIds.forEach((t) => transitions.add(t));
      } else {
        states.add(step.state);
        if (step.transitionId) transitions.add(step.transitionId);
      }
    }
    return { activeStates: states, activeTransitions: transitions };
  }, [result, stepIndex]);

  const onMove = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      const current = useAutomata.getState().machines[workspace];
      setMachine({ ...current, states: current.states.map((s) => (positions.has(s.id) ? { ...s, ...positions.get(s.id)! } : s)) } as Machine);
    },
    [setMachine, workspace],
  );

  const onConnect = useCallback(
    (from: string, to: string) => {
      const current = useAutomata.getState().machines[workspace];
      const t = defaultTransition(current, from, to);
      setMachine({ ...current, transitions: [...current.transitions, t] } as Machine);
      setSelection({ type: "transition", id: t.id });
    },
    [setMachine, workspace],
  );

  const addState = useCallback(
    (x?: number, y?: number) => {
      const current = useAutomata.getState().machines[workspace];
      const id = nextId("q", current.states.map((s) => s.id));
      const last = current.states.at(-1);
      const state = { id, label: id, x: x ?? (last ? last.x + 160 : 120), y: y ?? (last ? last.y : 160) };
      setMachine({ ...current, states: [...current.states, state], start: current.start || id } as Machine);
      setSelection({ type: "state", id });
    },
    [setMachine, workspace],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    const current = useAutomata.getState().machines[workspace];
    if (selection.type === "state") setMachine(removeState(current, selection.id));
    else setMachine({ ...current, transitions: current.transitions.filter((t) => t.id !== selection.id) } as Machine);
    setSelection(null);
  }, [selection, setMachine, workspace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      }
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection]);

  const onPickExample = async (id: string) => {
    try {
      loadMachine(await loadExample(id));
      setNotice(null);
    } catch (e) {
      setNotice({ tone: "danger", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const onExport = async () => {
    try {
      download(`${machine.id || machine.kind}.json`, await exportDocument(machine));
    } catch (e) {
      setNotice({ tone: "danger", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const onImport = async (file: File) => {
    try {
      const { machine: imported, validation } = await importDocument(JSON.parse(await file.text()));
      if (!kinds.includes(imported.kind)) {
        setNotice({ tone: "warning", text: `That file holds a ${imported.kind.toUpperCase()}; open it from the matching simulator.` });
        return;
      }
      loadMachine(imported);
      setNotice(
        validation.valid
          ? { tone: "success", text: `Imported “${imported.name}”.` }
          : { tone: "warning", text: `Imported “${imported.name}” with ${validation.errors.length} problem(s); see Checks.` },
      );
    } catch (e) {
      const message = e instanceof SyntaxError ? "That file is not valid JSON." : e instanceof ApiError ? e.message : String(e);
      setNotice({ tone: "danger", text: message });
    }
  };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={<BookmarkButton title={title} module={module} />}
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <SelectField label="Load an example" className="w-full sm:w-72" value="" onChange={(e) => e.target.value && onPickExample(e.target.value)}>
          <option value="">{examples.loading ? "Loading…" : "Choose an example…"}</option>
          {examples.data?.items.map((x) => (
            <option key={x.id} value={x.id}>
              {kinds.length > 1 ? `${x.kind.toUpperCase()}: ` : ""}{x.name}
            </option>
          ))}
        </SelectField>
        <Button icon={<FilePlus2 size={16} />} onClick={() => loadMachine({ ...blankMachine(kinds[0]), id: `my-${kinds[0]}-${Date.now().toString(36)}` })}>
          New
        </Button>
        <Button icon={<Upload size={16} />} onClick={() => fileInput.current?.click()}>
          Import
        </Button>
        <Button icon={<Download size={16} />} onClick={onExport}>
          Export JSON
        </Button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ""; }} />
        {examples.data && (
          <Badge tone={examples.data.source === "server" ? "success" : "neutral"}>
            {examples.data.source === "server" ? "API connected" : "Offline mode"}
          </Badge>
        )}
      </div>

      {notice && (
        <div className="mb-4">
          <Notice tone={notice.tone} action={<Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>}>
            {notice.text}
          </Notice>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="State diagram"
              subtitle="Drag states to arrange. Drag from a state's dot to draw a transition."
              actions={
                <>
                  <Button size="sm" icon={<CircleDot size={14} />} onClick={() => addState()}>Add state</Button>
                  <Button size="sm" icon={<LayoutGrid size={14} />} onClick={() => loadMachine(circleLayout(machine))}>Arrange</Button>
                  <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={deleteSelection} disabled={!selection}>Delete</Button>
                </>
              }
            />
            <div className="p-3">
              <DiagramEditor
                machine={machine}
                revision={revision}
                onMove={onMove}
                onConnect={onConnect}
                onAddState={addState}
                selection={selection}
                onSelect={setSelection}
                activeStates={activeStates}
                activeTransitions={activeTransitions}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Simulate" subtitle={machine.kind === "pda" ? "Nondeterministic branches are searched breadth-first." : machine.kind === "nfa" ? "Every active state is highlighted at each step." : undefined} />
            <SimulationPanel
              machine={machine}
              valid={report.valid}
              result={result}
              stepIndex={stepIndex}
              onRun={(_, r) => setResult(r)}
              onStep={setStepIndex}
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Machine" />
            <MachinePanel machine={machine} onChange={setMachine} selection={selection} onSelect={setSelection} kinds={kinds} />
          </Card>

          <Card>
            <CardHeader
              title="Checks"
              actions={report.valid ? <Badge tone="success">Valid</Badge> : <Badge tone="danger">{report.errors.length} error(s)</Badge>}
            />
            <ul className="max-h-60 space-y-1.5 overflow-y-auto p-4 text-xs">
              {report.errors.length + report.warnings.length === 0 && <li className="text-muted">No problems found.</li>}
              {[...report.errors.map((i) => ({ ...i, tone: "danger" as const })), ...report.warnings.map((i) => ({ ...i, tone: "warning" as const }))].map((issue, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-2 py-1.5 text-left ${issue.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}
                    onClick={() => {
                      if (!issue.ref) return;
                      if (machine.states.some((s) => s.id === issue.ref)) setSelection({ type: "state", id: issue.ref });
                      else if (machine.transitions.some((t) => t.id === issue.ref)) setSelection({ type: "transition", id: issue.ref });
                    }}
                  >
                    <span className="font-mono font-semibold">{issue.code}</span> {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {(machine.kind === "dfa" || machine.kind === "nfa") && (
            <Card>
              <CardHeader title="Conversions" subtitle="Subset construction and Hopcroft minimization" />
              <ConversionTools
                machine={machine}
                valid={report.valid}
                onOpen={(dfa: FiniteMachine) => {
                  loadMachine(dfa);
                  setNotice({ tone: "success", text: `Loaded “${dfa.name}”. Your previous machine was replaced; use Export to keep copies.` });
                }}
              />
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Transition table" subtitle={`${machine.transitions.length} transition(s). Edit any cell; changes update the diagram.`} />
        <TransitionTable machine={machine} onChange={setMachine} selection={selection} onSelect={setSelection} activeTransitions={activeTransitions} />
      </Card>
    </>
  );
}
