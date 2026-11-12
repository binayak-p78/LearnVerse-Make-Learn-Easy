import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SliderField } from "@/components/ui/Field";
import { gaussian, originFit, roundTo } from "../fit";
import { Meter } from "../Meter";
import type { ExperimentDef, SimulationProps } from "../types";

interface Truth {
  R: number;
}

const SUPPLY = 6;

export function Circuit({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 320 200" className="w-full rounded-lg bg-surface-2 text-ink" role="img" aria-label={caption}>
      <g fill="none" stroke="currentColor" strokeWidth="1.8">{children}</g>
    </svg>
  );
}

const MIN_RHEOSTAT = 2;
const MAX_RHEOSTAT = 42;

function OhmSim({ truth, bench, onRecord }: SimulationProps<Truth>) {
  const [position, setPosition] = useState(50);
  const rheostat = MIN_RHEOSTAT + (MAX_RHEOSTAT - MIN_RHEOSTAT) * (1 - position / 100);
  const current = SUPPLY / (truth.R + rheostat);
  // Fresh meter jitter each time the rheostat moves
  const noise = useMemo(() => ({ i: gaussian(0.002), v: gaussian(0.015) }), [position]);
  const ammeter = bench.read("ammeter", current + noise.i);
  const voltmeter = bench.read("voltmeter", current * truth.R + noise.v);

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <Circuit caption="Resistor in series with an ammeter and rheostat; voltmeter across the resistor">
        <path d="M40 150 V40 H130" />
        <rect x="130" y="30" width="60" height="20" />
        <text x="138" y="25" fill="currentColor" stroke="none" fontSize="11">R = ?</text>
        <path d="M190 40 H280 V95" />
        <circle cx="280" cy="110" r="15" />
        <text x="275" y="115" fill="currentColor" stroke="none" fontSize="13">A</text>
        <path d="M280 125 V150 H210" />
        <rect x="150" y="140" width="60" height="20" />
        <path d={`M${150 + position * 0.6} 132 l-5 -8 h10 z`} fill="currentColor" />
        <text x="152" y="178" fill="currentColor" stroke="none" fontSize="11">rheostat</text>
        <path d="M150 150 H70" />
        <path d="M70 140 V160 M62 145 V155" />
        <path d="M62 150 H40" />
        <path d="M130 40 V80 H145 M190 40 V80 H175" />
        <circle cx="160" cy="80" r="15" />
        <text x="155" y="85" fill="currentColor" stroke="none" fontSize="13">V</text>
      </Circuit>
      <div className="space-y-4">
        <SliderField label="Rheostat slider" unit="%" value={position} min={0} max={100} onChange={setPosition} />
        <div className="grid grid-cols-2 gap-2">
          <Meter label="Voltmeter" value={voltmeter} unit="V" />
          <Meter label="Ammeter" value={ammeter} unit="A" digits={3} />
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => onRecord({ V: voltmeter, I: ammeter })}>
          Record reading
        </Button>
        <p className="text-xs text-muted">The resistor's value is hidden. Find it from the slope of the V–I graph.</p>
      </div>
    </div>
  );
}

export const ohms: ExperimentDef<Truth> = {
  id: "ohms-law",
  title: "Ohm's Law",
  minReadings: 3,
  columns: [
    { key: "V", label: "V (V)", digits: 2 },
    { key: "I", label: "I (A)", digits: 3 },
    { key: "ratio", label: "V / I (Ω)", digits: 2 },
  ],
  instruments: [
    { key: "voltmeter", label: "Voltmeter", unit: "V", fields: ["V"], leastCount: 0.01, maxZeroError: 0.2, analog: true, digits: 2 },
    { key: "ammeter", label: "Ammeter", unit: "A", fields: ["I"], leastCount: 0.005, maxZeroError: 0.02, analog: true, digits: 3 },
  ],
  graph: { x: "I", y: "V", xLabel: "I (A)", yLabel: "V (V)", fit: "origin" },
  sweep: (t) => ({ field: "V", label: "voltage V (V)", min: (SUPPLY * t.R) / (t.R + MAX_RHEOSTAT), max: (SUPPLY * t.R) / (t.R + MIN_RHEOSTAT) }),
  target: { symbol: "R", label: "Resistance", unit: "Ω", value: (t) => t.R },
  setup: () => ({ R: roundTo(4.7 + Math.random() * 7, 0.1) }),
  Simulation: OhmSim,
  derive: (raw) => ({ ...raw, ratio: Number(raw.V) / Number(raw.I) }),
  results: (rows, truth) => {
    const fit = originFit(rows.map((r) => Number(r.I)), rows.map((r) => Number(r.V)));
    return fit ? [{ label: "Resistance from the slope", symbol: "R", value: fit.slope, unit: "Ω", expected: truth.R, expectedLabel: "true value" }] : [];
  },
};
