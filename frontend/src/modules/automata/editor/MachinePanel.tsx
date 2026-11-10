import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented, SelectField, TextField } from "@/components/ui/Field";
import type { Machine } from "../engine/types";
import type { Selection } from "./DiagramEditor";

const toList = (text: string) => [...new Set(text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];

function SymbolListField({ label, value, onCommit, hint }: { label: string; value: string[]; onCommit: (list: string[]) => void; hint?: string }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <div>
      <TextField
        label={label}
        value={text}
        className="font-mono"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(toList(text))}
        onKeyDown={(e) => e.key === "Enter" && onCommit(toList(text))}
      />
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function renameState(machine: Machine, from: string, to: string): Machine {
  const swap = (id: string) => (id === from ? to : id);
  return {
    ...machine,
    states: machine.states.map((s) => (s.id === from ? { ...s, id: to, label: s.label === from ? to : s.label } : s)),
    transitions: machine.transitions.map((t) => ({ ...t, from: swap(t.from), to: swap(t.to) })),
    start: swap(machine.start),
    accept: machine.accept.map(swap),
  } as Machine;
}

export function removeState(machine: Machine, id: string): Machine {
  const states = machine.states.filter((s) => s.id !== id);
  return {
    ...machine,
    states,
    transitions: machine.transitions.filter((t) => t.from !== id && t.to !== id),
    start: machine.start === id ? (states[0]?.id ?? "") : machine.start,
    accept: machine.accept.filter((a) => a !== id),
  } as Machine;
}

function StateEditor({ machine, id, onChange, onRenamed }: { machine: Machine; id: string; onChange: (m: Machine) => void; onRenamed: (id: string) => void }) {
  const state = machine.states.find((s) => s.id === id);
  const [draftId, setDraftId] = useState(id);
  const [error, setError] = useState("");
  useEffect(() => {
    setDraftId(id);
    setError("");
  }, [id]);
  if (!state) return null;

  const commitId = () => {
    const next = draftId.trim();
    if (next === id) return;
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(next)) return setError("Use letters, digits, _ or -.");
    if (machine.states.some((s) => s.id === next)) return setError("That id is taken.");
    setError("");
    onChange(renameState(machine, id, next));
    onRenamed(next);
  };
  const isAccept = machine.accept.includes(id);

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected state</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <TextField label="Id" value={draftId} className="font-mono" onChange={(e) => setDraftId(e.target.value)} onBlur={commitId}
            onKeyDown={(e) => e.key === "Enter" && commitId()} aria-invalid={Boolean(error)} />
          {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
        </div>
        <TextField label="Label" value={state.label} maxLength={32}
          onChange={(e) => onChange({ ...machine, states: machine.states.map((s) => (s.id === id ? { ...s, label: e.target.value } : s)) } as Machine)} />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="start-state" checked={machine.start === id} onChange={() => onChange({ ...machine, start: id })} />
          Start state
        </label>
        {!(machine.kind === "pda" && machine.acceptMode === "empty") && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isAccept}
              onChange={() => onChange({ ...machine, accept: isAccept ? machine.accept.filter((a) => a !== id) : [...machine.accept, id] })} />
            Accept state
          </label>
        )}
      </div>
      <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => onChange(removeState(machine, id))}>
        Delete state
      </Button>
    </div>
  );
}

export function MachinePanel({
  machine,
  onChange,
  selection,
  onSelect,
  kinds,
}: {
  machine: Machine;
  onChange: (m: Machine) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
  kinds: Machine["kind"][];
}) {
  return (
    <div className="space-y-4 p-4">
      {kinds.length > 1 && (machine.kind === "dfa" || machine.kind === "nfa") && (
        <Segmented
          label="Automaton type"
          value={machine.kind}
          onChange={(kind) => onChange({ ...machine, kind })}
          options={[{ value: "dfa", label: "DFA" }, { value: "nfa", label: "NFA (ε allowed)" }]}
        />
      )}
      <TextField label="Name" value={machine.name} maxLength={80} onChange={(e) => onChange({ ...machine, name: e.target.value })} />
      <SymbolListField label={machine.kind === "pda" || machine.kind === "tm" ? "Input alphabet Σ" : "Alphabet Σ"} value={machine.alphabet}
        onCommit={(alphabet) => onChange({ ...machine, alphabet })} hint="Single characters, separated by commas." />

      {machine.kind === "pda" && (
        <>
          <SymbolListField label="Stack alphabet Γ" value={machine.stackAlphabet} onCommit={(stackAlphabet) => onChange({ ...machine, stackAlphabet })} />
          <div className="grid grid-cols-2 gap-2">
            <SelectField label="Initial stack symbol" value={machine.initialStack} onChange={(e) => onChange({ ...machine, initialStack: e.target.value })}>
              {[...new Set([machine.initialStack, ...machine.stackAlphabet])].map((s) => <option key={s}>{s}</option>)}
            </SelectField>
            <SelectField label="Accept by" value={machine.acceptMode} onChange={(e) => onChange({ ...machine, acceptMode: e.target.value as "final" | "empty" })}>
              <option value="final">Final state</option>
              <option value="empty">Empty stack</option>
            </SelectField>
          </div>
        </>
      )}

      {machine.kind === "tm" && (
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <SymbolListField label="Tape alphabet Γ" value={machine.tapeAlphabet} onCommit={(tapeAlphabet) => onChange({ ...machine, tapeAlphabet })} />
          <TextField label="Blank" value={machine.blank} maxLength={1} className="font-mono"
            onChange={(e) => e.target.value && onChange({ ...machine, blank: e.target.value })} />
        </div>
      )}

      {selection?.type === "state" ? (
        <StateEditor machine={machine} id={selection.id} onChange={onChange} onRenamed={(id) => onSelect({ type: "state", id })} />
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-xs text-muted">
          Select a state to rename it or mark it as start or accept. Double-click empty space to add a state.
        </p>
      )}
    </div>
  );
}
