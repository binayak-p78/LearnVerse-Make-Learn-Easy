import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented, SliderField } from "@/components/ui/Field";
import { gaussian, mean, roundTo } from "../fit";
import { Meter } from "../Meter";
import type { ExperimentDef, ResultLine, Row, SimulationProps } from "../types";

interface Truth {
  R1: number;
  R2: number;
}

type Config = "R1" | "R2" | "series" | "parallel";

const equivalent = (t: Truth, c: Config) =>
  c === "R1" ? t.R1 : c === "R2" ? t.R2 : c === "series" ? t.R1 + t.R2 : (t.R1 * t.R2) / (t.R1 + t.R2);

function Diagram({ config }: { config: Config }) {
  return (
    <svg viewBox="0 0 320 160" className="w-full rounded-lg bg-surface-2 text-ink" role="img" aria-label={`Resistors connected: ${config}`}>
      <g fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M30 130 V40 H70 M250 40 H290 V130 H190 M130 130 H30" />
        <path d="M140 120 V140 M150 125 V135" />
        <text x="122" y="155" fill="currentColor" stroke="none" fontSize="10">battery</text>
        {config === "parallel" ? (
          <>
            <path d="M70 40 V20 H120 M180 20 H250 V40 M70 40 V60 H120 M180 60 H250 V40" />
            <rect x="120" y="12" width="60" height="16" />
            <rect x="120" y="52" width="60" height="16" />
            <text x="140" y="9" fill="currentColor" stroke="none" fontSize="10">R₁</text>
            <text x="140" y="82" fill="currentColor" stroke="none" fontSize="10">R₂</text>
          </>
        ) : config === "series" ? (
          <>
            <path d="M70 40 H85 M145 40 H175 M235 40 H250" />
            <rect x="85" y="32" width="60" height="16" />
            <rect x="175" y="32" width="60" height="16" />
            <text x="108" y="27" fill="currentColor" stroke="none" fontSize="10">R₁</text>
            <text x="198" y="27" fill="currentColor" stroke="none" fontSize="10">R₂</text>
          </>
        ) : (
          <>
            <path d="M70 40 H130 M190 40 H250" />
            <rect x="130" y="32" width="60" height="16" />
            <text x="152" y="27" fill="currentColor" stroke="none" fontSize="10">{config === "R1" ? "R₁" : "R₂"}</text>
          </>
        )}
      </g>
    </svg>
  );
}

function SeriesParallelSim({ truth, onRecord }: SimulationProps<Truth>) {
  const [config, setConfig] = useState<Config>("R1");
  const [voltage, setVoltage] = useState(3);
  const req = equivalent(truth, config);
  const noise = useMemo(() => gaussian(0.004), [config, voltage]);
  const current = roundTo(voltage / req + noise, 0.002);

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <Diagram config={config} />
      <div className="space-y-4">
        <Segmented label="Connection" value={config} onChange={setConfig} options={[
          { value: "R1", label: "R₁ only" },
          { value: "R2", label: "R₂ only" },
          { value: "series", label: "Series" },
          { value: "parallel", label: "Parallel" },
        ]} />
        <SliderField label="Supply voltage" unit="V" value={voltage} min={1} max={6} step={0.1} onChange={setVoltage} />
        <div className="grid grid-cols-2 gap-2">
          <Meter label="Voltmeter" value={voltage} unit="V" />
          <Meter label="Ammeter" value={current} unit="A" digits={3} />
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => onRecord({ config, V: voltage, I: current, R: voltage / current })}>
          Record reading
        </Button>
      </div>
    </div>
  );
}

const measured = (rows: Row[], config: Config) => mean(rows.filter((r) => r.config === config).map((r) => Number(r.R)));

export const seriesParallel: ExperimentDef<Truth> = {
  id: "series-parallel",
  title: "Series and Parallel",
  minReadings: 4,
  columns: [
    { key: "config", label: "Connection" },
    { key: "V", label: "V (V)", digits: 2 },
    { key: "I", label: "I (A)", digits: 3 },
    { key: "R", label: "V / I (Ω)", digits: 2 },
  ],
  setup: () => ({ R1: 2 + Math.floor(Math.random() * 10), R2: 3 + Math.floor(Math.random() * 15) }),
  Simulation: SeriesParallelSim,
  results: (rows) => {
    const r1 = measured(rows, "R1");
    const r2 = measured(rows, "R2");
    const out: ResultLine[] = [];
    const rs = measured(rows, "series");
    const rp = measured(rows, "parallel");
    if (Number.isFinite(r1) && Number.isFinite(r2)) {
      if (Number.isFinite(rs)) out.push({ label: "Series, measured vs R₁ + R₂", symbol: "R_s", value: rs, unit: "Ω", expected: r1 + r2, expectedLabel: "R₁ + R₂ (measured)" });
      if (Number.isFinite(rp)) out.push({ label: "Parallel, measured vs R₁R₂/(R₁ + R₂)", symbol: "R_p", value: rp, unit: "Ω", expected: (r1 * r2) / (r1 + r2), expectedLabel: "formula (measured R₁, R₂)" });
    }
    return out;
  },
};
