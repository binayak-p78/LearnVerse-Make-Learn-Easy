import { ArrowRight, Shrink, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/Card";
import { ApiError } from "@/services/api";
import { convertToDfa, type MinimizeResult, minimizeDfa, type Source } from "../api";
import type { ConvertResult, FiniteMachine } from "../engine/types";

export function ConversionTools({ machine, valid, onOpen }: { machine: FiniteMachine; valid: boolean; onOpen: (dfa: FiniteMachine) => void }) {
  const [converted, setConverted] = useState<{ source: Source; result: ConvertResult }>();
  const [minimized, setMinimized] = useState<MinimizeResult>();
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConverted(undefined);
    setMinimized(undefined);
    setError(undefined);
  }, [machine]);

  const attempt = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await job();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", String(e), 0));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<Wand2 size={14} />} disabled={!valid || busy}
          onClick={() => attempt(async () => { setMinimized(undefined); setConverted(await convertToDfa(machine)); })}>
          NFA → DFA (subset construction)
        </Button>
        <Button size="sm" icon={<Shrink size={14} />} disabled={!valid || busy || machine.kind !== "dfa"}
          title={machine.kind !== "dfa" ? "Convert to a DFA first" : undefined}
          onClick={() => attempt(async () => { setConverted(undefined); setMinimized(await minimizeDfa(machine)); })}>
          Minimize DFA
        </Button>
      </div>

      {error && (
        <Notice tone={error.code === "OFFLINE" ? "warning" : "danger"} title={error.code === "OFFLINE" ? "Needs the backend" : "Could not complete"}>
          {error.code === "OFFLINE" ? "Minimization runs on the server (Hopcroft's algorithm). Start the backend and retry." : error.message}
        </Notice>
      )}

      {converted && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {converted.result.dfa.states.length} DFA states from {machine.states.length} {machine.kind.toUpperCase()} states
            </p>
            <Badge tone={converted.source === "server" ? "accent" : "neutral"}>{converted.source === "server" ? "computed by API" : "computed offline"}</Badge>
          </div>
          <div className="max-h-56 overflow-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-2 text-left text-muted">
                <tr><th className="px-2 py-1.5">From</th><th className="px-2">Symbol</th><th className="px-2">To</th><th className="px-2">Subset</th></tr>
              </thead>
              <tbody className="font-mono">
                {converted.result.steps.map((s, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-2 py-1">{s.from}</td>
                    <td className="px-2">{s.symbol}</td>
                    <td className="px-2">{s.to}{s.isNew && <span className="ml-1 text-accent">new</span>}</td>
                    <td className="px-2">{s.targetSet.length ? `{${s.targetSet.join(",")}}` : "∅"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" variant="primary" icon={<ArrowRight size={14} />} onClick={() => onOpen(converted.result.dfa)}>
            Open the DFA in the editor
          </Button>
        </div>
      )}

      {minimized && (
        <div className="space-y-2 text-sm">
          <p className="font-medium">
            {machine.states.length} → {minimized.dfa.states.length} states
          </p>
          <ul className="space-y-1 text-xs">
            {minimized.partitions.map((block, i) => (
              <li key={i} className="rounded-md bg-surface-2 px-2 py-1 font-mono">m{i} = {"{"}{block.join(", ")}{"}"}</li>
            ))}
          </ul>
          {minimized.removedUnreachable.length > 0 && (
            <p className="text-xs text-muted">Removed unreachable: {minimized.removedUnreachable.join(", ")}</p>
          )}
          {minimized.addedTrap && <p className="text-xs text-muted">Added a trap state ∅ to make the DFA complete.</p>}
          <Button size="sm" variant="primary" icon={<ArrowRight size={14} />} onClick={() => onOpen(minimized.dfa)}>
            Open the minimal DFA
          </Button>
        </div>
      )}
    </div>
  );
}
