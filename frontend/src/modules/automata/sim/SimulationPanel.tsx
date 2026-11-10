import { ChevronFirst, ChevronLast, Pause, Play, StepBack, StepForward } from "lucide-react";
import { useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { SliderField, TextField } from "@/components/ui/Field";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { simulate } from "../engine/machine";
import type { Machine, SimulationResult } from "../engine/types";
import { InputTrack, StackView, TapeView } from "./views";

export function stepDescription(result: SimulationResult, index: number): string {
  switch (result.kind) {
    case "dfa":
    case "nfa": {
      const step = result.steps[index];
      const set = step.states.length ? `{${step.states.join(", ")}}` : "∅";
      return step.symbol === null ? `Start in ${set}` : `Read '${step.symbol}' → ${set}`;
    }
    case "pda": {
      const step = result.steps[index];
      return `State ${step.state}, read ${step.inputIndex} symbol(s), stack ${step.stack.join("") || "empty"}`;
    }
    case "tm": {
      const step = result.steps[index];
      return `State ${step.state}, head at ${step.head}`;
    }
  }
}

export function SimulationPanel({
  machine,
  valid,
  result,
  stepIndex,
  onRun,
  onStep,
}: {
  machine: Machine;
  valid: boolean;
  result: SimulationResult | null;
  stepIndex: number;
  onRun: (input: string, result: SimulationResult) => void;
  onStep: (index: number) => void;
}) {
  const [input, setInput] = useState("");
  const [ranInput, setRanInput] = useState("");
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(2);
  const [batch, setBatch] = useState("");
  const elapsed = useRef(0);
  const last = result ? result.steps.length - 1 : 0;
  const atEnd = result !== null && stepIndex >= last;

  const alphabet = new Set(machine.alphabet);
  const invalidSymbol = [...input].find((c) => !alphabet.has(c));

  const run = (start: boolean) => {
    const next = simulate(machine, input, 5000);
    setRanInput(input);
    onRun(input, next);
    onStep(0);
    elapsed.current = 0;
    setPlaying(start);
  };

  useAnimationLoop(playing && result !== null, (dt) => {
    elapsed.current += dt;
    if (elapsed.current < 1 / rate) return;
    elapsed.current = 0;
    if (stepIndex >= last) {
      setPlaying(false);
      return false;
    }
    onStep(stepIndex + 1);
  });

  const step = result?.steps[stepIndex];
  const consumed = step && "inputIndex" in step ? step.inputIndex : 0;
  const previousStack = result?.kind === "pda" && stepIndex > 0 ? result.steps[stepIndex - 1].stack : undefined;

  const batchRows = batch
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, 40)
    .map((line) => {
      const word = line === "ε" ? "" : line;
      const bad = [...word].some((c) => !alphabet.has(c));
      return { line, result: bad || !valid ? null : simulate(machine, word, 5000) };
    });

  return (
    <div className="space-y-4 p-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(true);
        }}
      >
        <TextField
          label="Input string"
          className="min-w-[180px] flex-1 font-mono"
          value={input}
          placeholder="leave empty for ε"
          onChange={(e) => setInput(e.target.value)}
          aria-invalid={Boolean(invalidSymbol)}
        />
        <Button type="submit" variant="primary" icon={<Play size={16} />} disabled={!valid || Boolean(invalidSymbol)}>
          Run
        </Button>
        <Button onClick={() => run(false)} disabled={!valid || Boolean(invalidSymbol)}>
          Step through
        </Button>
      </form>
      {invalidSymbol && <p className="text-xs text-danger">'{invalidSymbol}' is not in the alphabet {"{"}{machine.alphabet.join(", ")}{"}"}.</p>}
      {!valid && <p className="text-xs text-warning">Fix the errors listed under “Checks” before running.</p>}

      {result && step && (
        <div className="space-y-4 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center gap-1">
            <IconButton size="sm" label="First step" icon={<ChevronFirst size={16} />} onClick={() => { setPlaying(false); onStep(0); }} />
            <IconButton size="sm" label="Previous step" icon={<StepBack size={16} />} onClick={() => { setPlaying(false); onStep(Math.max(0, stepIndex - 1)); }} disabled={stepIndex === 0} />
            <IconButton size="sm" variant="primary" label={playing ? "Pause" : "Play"} icon={playing ? <Pause size={16} /> : <Play size={16} />}
              onClick={() => { if (atEnd) onStep(0); setPlaying((p) => !p); }} />
            <IconButton size="sm" label="Next step" icon={<StepForward size={16} />} onClick={() => { setPlaying(false); onStep(Math.min(last, stepIndex + 1)); }} disabled={atEnd} />
            <IconButton size="sm" label="Last step" icon={<ChevronLast size={16} />} onClick={() => { setPlaying(false); onStep(last); }} />
            <span className="ml-2 text-xs tabular-nums text-muted">Step {stepIndex} / {last}</span>
            <div className="ml-auto w-40">
              <SliderField label="Speed" unit="/s" value={rate} min={0.5} max={12} step={0.5} onChange={setRate} />
            </div>
          </div>

          {result.kind !== "tm" && <InputTrack input={ranInput} index={consumed} />}
          {result.kind === "tm" && machine.kind === "tm" && <TapeView step={result.steps[stepIndex]} blank={machine.blank} />}

          <div className="flex flex-wrap items-start gap-4">
            {result.kind === "pda" && <StackView stack={result.steps[stepIndex].stack} previous={previousStack} />}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm" aria-live="polite">{stepDescription(result, stepIndex)}</p>
              {atEnd && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={result.accepted ? "success" : result.halted ? "danger" : "warning"}>
                    {result.accepted ? "Accepted" : result.halted ? "Rejected" : "Did not halt"}
                  </Badge>
                  <span className="text-xs text-muted">{result.reason}</span>
                </div>
              )}
              {atEnd && result.kind === "tm" && (
                <p className="text-xs">Tape output: <span className="font-mono font-semibold">{result.output || "(blank)"}</span></p>
              )}
              {result.kind === "pda" && (
                <p className="text-xs text-muted">
                  Explored {result.explored} configuration{result.explored === 1 ? "" : "s"} breadth-first; showing the {result.accepted ? "accepting" : "furthest"} branch.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <details className="rounded-lg border border-line">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Test many strings at once</summary>
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          <textarea
            aria-label="Strings to test, one per line"
            className="min-h-[120px] rounded-lg border border-line bg-surface p-2 font-mono text-sm"
            placeholder={"one string per line\nε for the empty string"}
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
          />
          <ul className="space-y-1 text-sm">
            {batchRows.map(({ line, result: r }, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2 py-1">
                <span className="truncate font-mono">{line}</span>
                {r ? (
                  <Badge tone={r.accepted ? "success" : "danger"}>{r.accepted ? "accept" : r.halted ? "reject" : "loops?"}</Badge>
                ) : (
                  <Badge tone="warning">invalid</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
