import { BatteryCharging, Plus, Square, TimerReset } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { gaussian, linearFit, roundTo } from "../fit";
import { Meter } from "../Meter";
import type { ExperimentDef, SimulationProps } from "../types";

interface Truth {
  R: number;
  C: number;
  V0: number;
}

type Phase = "idle" | "charging" | "charged" | "discharging";

const tau = (t: Truth) => (t.R * 1e3 * t.C * 1e-6);

function RCSim({ truth, onRecord }: SimulationProps<Truth>) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [voltage, setVoltage] = useState(0);
  const [clock, setClock] = useState(0);
  const start = useRef({ v: 0 });
  const T = tau(truth);

  const clockRef = useRef(0);
  clockRef.current = clock;

  useAnimationLoop(phase === "charging" || phase === "discharging", (dt) => {
    const next = clockRef.current + dt;
    setClock(next);
    if (phase === "charging") {
      const v = truth.V0 - (truth.V0 - start.current.v) * Math.exp(-next / T);
      setVoltage(v);
      if (truth.V0 - v < 0.01) setPhase("charged");
    } else {
      const v = start.current.v * Math.exp(-next / T);
      setVoltage(v);
      if (v < 0.05) setPhase("idle");
    }
  });

  const begin = (next: Phase) => {
    start.current.v = voltage;
    setClock(0);
    setPhase(next);
  };

  const reading = roundTo(voltage + gaussian(0.005), 0.01);
  const level = voltage / truth.V0;

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <svg viewBox="0 0 320 200" className="w-full rounded-lg bg-surface-2 text-ink" role="img" aria-label={`Capacitor at ${voltage.toFixed(2)} volts`}>
        <g fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M40 150 V50 H110" />
          <rect x="110" y="40" width="60" height="20" />
          <text x="112" y="32" fill="currentColor" stroke="none" fontSize="11">R = {truth.R} kΩ</text>
          <path d="M170 50 H240 V85 M225 85 H255 M225 95 H255 M240 95 V150 H40" />
          <text x="258" y="94" fill="currentColor" stroke="none" fontSize="11">{truth.C} µF</text>
          <rect x="268" y="110" width="14" height="60" />
        </g>
        <rect x="269" y={170 - 59 * level} width="12" height={59 * level} className="fill-accent" />
        <text x="20" y="190" fontSize="11" className="fill-muted">Supply V₀ = {truth.V0} V; τ = RC is to be found</text>
      </svg>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Meter label="Voltmeter across C" value={reading} unit="V" />
          <Meter label={phase === "discharging" ? "Time since discharge" : "Stopwatch"} value={phase === "discharging" ? clock : null} unit="s" digits={1} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<BatteryCharging size={16} />} onClick={() => begin("charging")} disabled={phase === "charging" || phase === "charged"}>
            {phase === "charging" ? "Charging…" : phase === "charged" ? "Fully charged" : "Charge"}
          </Button>
          <Button variant="primary" icon={<TimerReset size={16} />} onClick={() => begin("discharging")} disabled={phase !== "charged"}>
            Discharge and start stopwatch
          </Button>
          <Button icon={<Plus size={16} />} disabled={phase !== "discharging"} onClick={() => onRecord({ t: roundTo(clock, 0.1), V: reading, lnV: Math.log(reading) })}>
            Record reading
          </Button>
          {phase === "discharging" && (
            <Button variant="ghost" icon={<Square size={14} />} onClick={() => setPhase("idle")}>Stop</Button>
          )}
        </div>
        <p className="text-xs text-muted">Charge fully, start discharging, then record the voltage every second or two.</p>
      </div>
    </div>
  );
}

export const rc: ExperimentDef<Truth> = {
  id: "rc-circuit",
  title: "RC Circuit",
  minReadings: 4,
  columns: [
    { key: "t", label: "t (s)", digits: 1 },
    { key: "V", label: "V_C (V)", digits: 2 },
    { key: "lnV", label: "ln V_C", digits: 3 },
  ],
  graph: { x: "t", y: "lnV", xLabel: "t (s)", yLabel: "ln V_C", fit: "linear" },
  setup: () => ({ R: [10, 22, 47][Math.floor(Math.random() * 3)], C: [100, 220][Math.floor(Math.random() * 2)], V0: 9 }),
  Simulation: RCSim,
  results: (rows, truth) => {
    const valid = rows.filter((r) => Number(r.V) > 0);
    const fit = linearFit(valid.map((r) => Number(r.t)), valid.map((r) => Number(r.lnV)));
    if (!fit || fit.slope >= 0) return [];
    return [{ label: "Time constant from the slope", symbol: "τ", value: -1 / fit.slope, unit: "s", expected: tau(truth), expectedLabel: "RC" }];
  },
};
