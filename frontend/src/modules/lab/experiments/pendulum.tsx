import { Timer } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SliderField } from "@/components/ui/Field";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { gaussian, originFit, roundTo } from "../fit";
import { Meter } from "../Meter";
import type { ExperimentDef, SimulationProps } from "../types";

interface Truth {
  g: number;
}

const AMPLITUDE = (8 * Math.PI) / 180;

const MIN_LENGTH = 20;
const MAX_LENGTH = 150;

function PendulumSim({ truth, bench, onRecord }: SimulationProps<Truth>) {
  const [lengthCm, setLengthCm] = useState(80);
  const [last, setLast] = useState<number | null>(null);
  const [theta, setTheta] = useState(AMPLITUDE);
  const clock = useRef(0);
  // The slider is the scale reading; a zero error makes the real length differ
  const actualCm = Math.max(1, bench.actual("scale", lengthCm));
  const period = 2 * Math.PI * Math.sqrt(actualCm / 100 / truth.g);

  useAnimationLoop(true, (dt) => {
    clock.current += dt;
    setTheta(AMPLITUDE * Math.cos((2 * Math.PI * clock.current) / period));
  });

  const scale = 1.6;
  const pivot = { x: 160, y: 16 };
  const bob = { x: pivot.x + Math.sin(theta) * actualCm * scale, y: pivot.y + Math.cos(theta) * actualCm * scale };

  const time20 = () => {
    // Stopwatch reaction error of about ±0.15 s on the total time
    const measured = 20 * period + gaussian(0.15);
    setLast(measured);
    onRecord({ L: lengthCm, t20: roundTo(measured, 0.01) });
  };

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <svg viewBox="0 0 320 270" className="w-full rounded-lg bg-surface-2" role="img" aria-label={`Pendulum of length ${lengthCm} centimetres swinging`}>
        <rect x="100" y="6" width="120" height="10" rx="2" className="fill-muted" />
        <line x1={pivot.x} y1={pivot.y} x2={bob.x} y2={bob.y} className="stroke-ink" strokeWidth="1.5" />
        <line x1={pivot.x} y1={pivot.y} x2={pivot.x} y2={pivot.y + actualCm * scale + 16} className="stroke-muted" strokeDasharray="3 4" />
        <circle cx={bob.x} cy={bob.y} r="12" className="fill-accent" />
      </svg>
      <div className="space-y-4">
        <SliderField label="Effective length L (scale reading)" unit="cm" value={lengthCm} min={MIN_LENGTH} max={MAX_LENGTH} step={0.5} onChange={setLengthCm} />
        <div className="grid grid-cols-2 gap-2">
          <Meter label="Last 20 oscillations" value={last} unit="s" />
          <Meter label="Period T" value={last === null ? null : last / 20} unit="s" digits={3} />
        </div>
        <Button variant="primary" icon={<Timer size={16} />} onClick={time20}>
          Time 20 oscillations and record
        </Button>
        <p className="text-xs text-muted">
          {bench.mode === "mystery" ? "You are on an unknown planet. " : ""}Take readings at five or more lengths spread across the range.
        </p>
      </div>
    </div>
  );
}

export const pendulum: ExperimentDef<Truth> = {
  id: "simple-pendulum",
  title: "Simple Pendulum",
  minReadings: 3,
  columns: [
    { key: "L", label: "L (cm)", digits: 1 },
    { key: "t20", label: "t for 20 osc. (s)", digits: 2 },
    { key: "T", label: "T (s)", digits: 3 },
    { key: "T2", label: "T² (s²)", digits: 3 },
  ],
  instruments: [
    { key: "scale", label: "Metre scale", unit: "cm", fields: ["L"], leastCount: 0.1, maxZeroError: 1, analog: true, digits: 1 },
  ],
  graph: { x: "T2", y: "L", xLabel: "T² (s²)", yLabel: "L (cm)", fit: "origin" },
  sweep: () => ({ field: "L", label: "length L (cm)", min: MIN_LENGTH, max: MAX_LENGTH }),
  target: { symbol: "g", label: "Acceleration due to gravity", unit: "m/s²", value: (t) => t.g },
  // Mystery mode swings the pendulum on an unknown planet
  setup: (mode) => ({ g: mode === "mystery" ? roundTo(1.6 + Math.random() * 23.4, 0.01) : 9.81 }),
  Simulation: PendulumSim,
  derive: (raw) => {
    const T = Number(raw.t20) / 20;
    return { ...raw, T, T2: T * T };
  },
  results: (rows, truth) => {
    const fit = originFit(rows.map((r) => Number(r.T2)), rows.map((r) => Number(r.L) / 100));
    if (!fit) return [];
    return [{ label: "Acceleration due to gravity", symbol: "g", value: 4 * Math.PI ** 2 * fit.slope, unit: "m/s²", expected: truth.g, expectedLabel: truth.g === 9.81 ? "standard value" : "true value" }];
  },
};
