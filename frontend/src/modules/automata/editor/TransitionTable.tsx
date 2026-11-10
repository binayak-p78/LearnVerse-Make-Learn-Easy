import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { nextId } from "../engine/machine";
import { EPSILON, type Machine, type Transition } from "../engine/types";
import type { Selection } from "./DiagramEditor";

const cell = "h-8 w-full min-w-[64px] rounded-md border border-line bg-surface px-1.5 font-mono text-xs";

function SymbolSelect({ value, options, onChange, label }: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  const list = options.includes(value) ? options : [value, ...options];
  return (
    <select aria-label={label} className={cell} value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function defaultTransition(machine: Machine, from: string, to: string): Transition {
  const id = nextId("t", machine.transitions.map((t) => t.id));
  switch (machine.kind) {
    case "dfa":
    case "nfa":
      return { id, from, to, read: machine.alphabet[0] ?? EPSILON };
    case "pda":
      return { id, from, to, read: machine.alphabet[0] ?? EPSILON, pop: EPSILON, push: EPSILON };
    case "tm": {
      const symbol = machine.tapeAlphabet[0] ?? machine.blank;
      return { id, from, to, read: symbol, write: symbol, move: "R" };
    }
  }
}

export function TransitionTable({
  machine,
  onChange,
  selection,
  onSelect,
  activeTransitions,
}: {
  machine: Machine;
  onChange: (machine: Machine) => void;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  activeTransitions: Set<string>;
}) {
  const stateIds = machine.states.map((s) => s.id);
  const selectedRow = useRef<HTMLTableRowElement>(null);
  const selectedId = selection?.type === "transition" ? selection.id : null;

  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const update = (id: string, patch: Partial<Transition>) =>
    onChange({ ...machine, transitions: machine.transitions.map((t) => (t.id === id ? { ...t, ...patch } : t)) } as Machine);
  const remove = (id: string) => onChange({ ...machine, transitions: machine.transitions.filter((t) => t.id !== id) } as Machine);
  const add = () => {
    const from = selection?.type === "state" ? selection.id : machine.start || stateIds[0];
    if (!from) return;
    const t = defaultTransition(machine, from, from);
    onChange({ ...machine, transitions: [...machine.transitions, t] } as Machine);
    onSelect({ type: "transition", id: t.id });
  };

  const readOptions =
    machine.kind === "tm"
      ? machine.tapeAlphabet
      : machine.kind === "dfa"
        ? machine.alphabet
        : [...machine.alphabet, EPSILON];

  const headers = ["Id", "From", "To", "Read"];
  if (machine.kind === "pda") headers.push("Pop", "Push");
  if (machine.kind === "tm") headers.push("Write", "Move");

  return (
    <div>
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-surface text-left text-xs text-muted">
            <tr>
              {headers.map((h) => (
                <th key={h} className="border-b border-line px-2 py-2 font-medium">{h}</th>
              ))}
              <th className="border-b border-line px-2 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {machine.transitions.length === 0 && (
              <tr>
                <td colSpan={headers.length + 1} className="px-2 py-6 text-center text-sm text-muted">
                  No transitions yet. Drag from a state's dot to another state, or press “Add transition”.
                </td>
              </tr>
            )}
            {machine.transitions.map((t) => {
              const selected = t.id === selectedId;
              const active = activeTransitions.has(t.id);
              return (
                <tr
                  key={t.id}
                  ref={selected ? selectedRow : undefined}
                  onClick={() => onSelect({ type: "transition", id: t.id })}
                  className={active ? "bg-accent-soft" : selected ? "bg-surface-2" : ""}
                >
                  <td className="border-b border-line px-2 py-1.5 font-mono text-xs text-muted">{t.id}</td>
                  <td className="border-b border-line px-2 py-1.5">
                    <SymbolSelect label={`From state of ${t.id}`} value={t.from} options={stateIds} onChange={(from) => update(t.id, { from })} />
                  </td>
                  <td className="border-b border-line px-2 py-1.5">
                    <SymbolSelect label={`To state of ${t.id}`} value={t.to} options={stateIds} onChange={(to) => update(t.id, { to })} />
                  </td>
                  <td className="border-b border-line px-2 py-1.5">
                    <SymbolSelect label={`Read symbol of ${t.id}`} value={t.read} options={readOptions} onChange={(read) => update(t.id, { read })} />
                  </td>
                  {machine.kind === "pda" && "pop" in t && (
                    <>
                      <td className="border-b border-line px-2 py-1.5">
                        <SymbolSelect label={`Pop symbol of ${t.id}`} value={t.pop} options={[...machine.stackAlphabet, EPSILON]} onChange={(pop) => update(t.id, { pop })} />
                      </td>
                      <td className="border-b border-line px-2 py-1.5">
                        <input
                          aria-label={`Push string of ${t.id}`}
                          className={cell}
                          value={t.push}
                          onChange={(e) => update(t.id, { push: e.target.value.trim() || EPSILON })}
                          title="Symbols to push; the leftmost ends up on top. Use ε to push nothing."
                        />
                      </td>
                    </>
                  )}
                  {machine.kind === "tm" && "move" in t && (
                    <>
                      <td className="border-b border-line px-2 py-1.5">
                        <SymbolSelect label={`Write symbol of ${t.id}`} value={t.write} options={machine.tapeAlphabet} onChange={(write) => update(t.id, { write })} />
                      </td>
                      <td className="border-b border-line px-2 py-1.5">
                        <SymbolSelect label={`Head move of ${t.id}`} value={t.move} options={["L", "R", "S"]} onChange={(move) => update(t.id, { move: move as "L" | "R" | "S" })} />
                      </td>
                    </>
                  )}
                  <td className="border-b border-line px-2 py-1.5 text-right">
                    <IconButton size="sm" variant="ghost" label={`Delete ${t.id}`} icon={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); remove(t.id); }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-3 py-2">
        <Button size="sm" icon={<Plus size={14} />} onClick={add} disabled={stateIds.length === 0}>
          Add transition
        </Button>
      </div>
    </div>
  );
}
