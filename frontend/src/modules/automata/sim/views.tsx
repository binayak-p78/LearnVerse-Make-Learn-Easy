import { useEffect, useRef } from "react";
import type { TMStep } from "../engine/types";

export function InputTrack({ input, index }: { input: string; index: number }) {
  const symbols = [...input];
  if (symbols.length === 0) {
    return <p className="font-mono text-sm text-muted">ε (empty input)</p>;
  }
  return (
    <div className="flex flex-wrap gap-1" aria-label={`Input, ${index} of ${symbols.length} symbols read`}>
      {symbols.map((symbol, i) => (
        <span
          key={i}
          className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 font-mono text-sm transition-colors ${
            i < index
              ? "border-line bg-surface-2 text-muted line-through decoration-muted/50"
              : i === index
                ? "border-accent bg-accent-soft font-semibold text-accent"
                : "border-line bg-surface"
          }`}
        >
          {symbol}
        </span>
      ))}
    </div>
  );
}

export function StackView({ stack, previous }: { stack: string[]; previous?: string[] }) {
  const grew = previous ? stack.length > previous.length : false;
  return (
    <div className="flex flex-col items-center">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Top</p>
      <div
        className="flex min-h-[120px] w-24 flex-col-reverse justify-end overflow-y-auto rounded-b-lg border-2 border-t-0 border-ink/60 p-1.5"
        aria-label={`Stack, top first: ${stack.join(" ") || "empty"}`}
        role="list"
      >
        {[...stack].reverse().map((symbol, fromBottom) => {
          const isTop = fromBottom === stack.length - 1;
          return (
            <div
              key={`${fromBottom}-${symbol}`}
              role="listitem"
              className={`mb-1 flex h-8 items-center justify-center rounded-md font-mono text-sm font-semibold ${
                isTop ? "bg-accent text-on-accent" : "bg-surface-2"
              } ${isTop && grew ? "animate-[pushIn_220ms_ease-out]" : ""}`}
            >
              {symbol}
            </div>
          );
        })}
        {stack.length === 0 && <p className="py-4 text-center text-xs text-muted">empty</p>}
      </div>
      <style>{"@keyframes pushIn{from{transform:translateY(-14px);opacity:0}to{transform:none;opacity:1}}"}</style>
    </div>
  );
}

const PAD_CELLS = 6;

export function TapeView({ step, blank }: { step: TMStep; blank: string }) {
  const headRef = useRef<HTMLDivElement>(null);
  const low = Math.min(step.tapeOffset, step.head) - PAD_CELLS;
  const high = Math.max(step.tapeOffset + step.tape.length - 1, step.head) + PAD_CELLS;
  const cells: { position: number; symbol: string }[] = [];
  for (let p = low; p <= high; p++) {
    const i = p - step.tapeOffset;
    cells.push({ position: p, symbol: i >= 0 && i < step.tape.length ? step.tape[i] : blank });
  }

  useEffect(() => {
    headRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [step.head]);

  return (
    <div className="overflow-x-auto pb-2" aria-label={`Tape with head at position ${step.head} reading ${step.tape[step.head - step.tapeOffset] ?? blank}`}>
      <div className="flex w-max gap-0.5 px-2 pt-6">
        <span className="flex h-11 items-center px-1 text-muted">⋯</span>
        {cells.map(({ position, symbol }) => {
          const isHead = position === step.head;
          return (
            <div key={position} ref={isHead ? headRef : undefined} className="relative">
              {isHead && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-accent" aria-hidden>
                  ▼
                </span>
              )}
              <div
                className={`flex h-11 w-10 items-center justify-center rounded-md border-2 font-mono text-base transition-colors ${
                  isHead ? "border-accent bg-accent-soft font-bold text-accent" : symbol === blank ? "border-line text-muted/60" : "border-line bg-surface"
                }`}
              >
                {symbol}
              </div>
              <span className="mt-0.5 block text-center text-[9px] text-muted/70">{position}</span>
            </div>
          );
        })}
        <span className="flex h-11 items-center px-1 text-muted">⋯</span>
      </div>
    </div>
  );
}
