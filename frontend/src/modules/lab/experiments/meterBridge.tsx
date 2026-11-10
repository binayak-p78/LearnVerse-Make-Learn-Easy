import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, SliderField } from "@/components/ui/Field";
import { mean, roundTo } from "../fit";
import { Meter } from "../Meter";
import type { ExperimentDef, SimulationProps } from "../types";

interface Truth {
  X: number;
}

const BOX = [1, 2, 3, 4, 5, 6, 8, 10];

function BridgeSim({ truth, onRecord }: SimulationProps<Truth>) {
  const [R, setR] = useState(4);
  const [l, setL] = useState(30);
  const balance = (100 * R) / (R + truth.X);
  const deflection = Math.max(-30, Math.min(30, (l - balance) * 2.5));
  const nulled = Math.abs(deflection) < 0.6;
  const angle = (deflection / 30) * 60;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <svg viewBox="0 0 520 190" className="w-full rounded-lg bg-surface-2 text-ink" role="img" aria-label={`Galvanometer deflection ${deflection.toFixed(1)} divisions`}>
          <g fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="40" y="30" width="80" height="22" />
            <text x="50" y="22" fill="currentColor" stroke="none" fontSize="11">R = {R} Ω (box)</text>
            <rect x="400" y="30" width="80" height="22" />
            <text x="410" y="22" fill="currentColor" stroke="none" fontSize="11">X = ? (wire)</text>
            <path d="M120 41 H400 M40 41 H20 V150 H40 M480 41 H500 V150 H480" />
            <line x1="40" y1="150" x2="480" y2="150" strokeWidth="4" className="stroke-warning" />
            <path d="M260 41 V70" />
            <circle cx="260" cy="88" r="18" />
            <path d={`M260 88 L${260 + 14 * Math.sin((angle * Math.PI) / 180)} ${88 - 14 * Math.cos((angle * Math.PI) / 180)}`} className={nulled ? "stroke-success" : "stroke-danger"} strokeWidth="2.5" />
            <path d={`M260 106 L${40 + 4.4 * l} 146`} strokeDasharray="4 3" />
          </g>
          <path d={`M${40 + 4.4 * l} 146 l-6 -10 h12 z`} className="fill-accent" />
          {[0, 25, 50, 75, 100].map((cm) => (
            <text key={cm} x={36 + 4.4 * cm} y="172" fontSize="10" className="fill-muted">{cm}</text>
          ))}
          <text x="248" y="128" fontSize="11" className="fill-muted">G</text>
        </svg>
        <SliderField label="Jockey position l" unit="cm" value={l} min={1} max={99} step={0.1} onChange={(v) => setL(roundTo(v, 0.1))} format={(v) => v.toFixed(1)} />
      </div>
      <div className="space-y-3">
        <SelectField label="Resistance from box R" value={R} onChange={(e) => setR(Number(e.target.value))}>
          {BOX.map((r) => <option key={r} value={r}>{r} Ω</option>)}
        </SelectField>
        <Meter label="Galvanometer" value={deflection} unit="div" digits={1} />
        <p className={`text-xs ${nulled ? "text-success" : "text-muted"}`}>{nulled ? "Null point found." : "Slide the jockey until the needle reads zero."}</p>
        <Button variant="primary" icon={<Plus size={16} />} disabled={!nulled} onClick={() => onRecord({ R, l, X: (R * (100 - l)) / l })}>
          Record null point
        </Button>
      </div>
    </div>
  );
}

export const meterBridge: ExperimentDef<Truth> = {
  id: "meter-bridge",
  title: "Meter Bridge",
  minReadings: 3,
  columns: [
    { key: "R", label: "R (Ω)", digits: 1 },
    { key: "l", label: "l (cm)", digits: 1 },
    { key: "X", label: "X = R(100 − l)/l (Ω)", digits: 3 },
  ],
  setup: () => ({ X: roundTo(2 + Math.random() * 7, 0.1) }),
  Simulation: BridgeSim,
  results: (rows, truth) => [
    { label: "Mean unknown resistance", symbol: "X", value: mean(rows.map((r) => Number(r.X))), unit: "Ω", expected: truth.X, expectedLabel: "true value" },
  ],
};
