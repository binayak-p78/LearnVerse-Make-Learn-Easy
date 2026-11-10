import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Card";
import { SliderField } from "@/components/ui/Field";
import { gaussian, mean, roundTo } from "../fit";
import { Meter } from "../Meter";
import type { ExperimentDef, SimulationProps } from "../types";

interface Truth {
  f: number;
}

const AXIS = 110;
const LENS_X = 300;
const OBJECT_H = 40;

function LensSim({ truth, onRecord }: SimulationProps<Truth>) {
  const [u, setU] = useState(Math.round(truth.f * 2.5));
  const real = u > truth.f + 0.5;
  const exactV = real ? (u * truth.f) / (u - truth.f) : Number.POSITIVE_INFINITY;
  // Parallax error when locating the image needle
  const parallax = useMemo(() => gaussian(0.25), [u]);
  const v = real ? roundTo(exactV + parallax, 0.1) : null;

  const scale = Math.min(270 / u, real ? 270 / exactV : 4, 4);
  const ox = LENS_X - u * scale;
  const ix = LENS_X + exactV * scale;
  const ih = -OBJECT_H * (exactV / u);
  const fx = truth.f * scale;

  return (
    <div className="space-y-4">
      <svg viewBox="0 0 600 220" className="w-full rounded-lg bg-surface-2 text-ink" role="img" aria-label={`Ray diagram: object at ${u} cm${v ? `, image at ${v} cm` : ""}`}>
        <line x1="0" y1={AXIS} x2="600" y2={AXIS} className="stroke-muted" strokeDasharray="4 4" />
        <ellipse cx={LENS_X} cy={AXIS} rx="8" ry="70" className="fill-accent/15 stroke-accent" strokeWidth="1.5" />
        {[-1, 1].map((s) => (
          <g key={s}>
            <circle cx={LENS_X + s * fx} cy={AXIS} r="3" className="fill-muted" />
            <text x={LENS_X + s * fx - 4} y={AXIS + 18} fontSize="11" className="fill-muted">F</text>
          </g>
        ))}
        <line x1={ox} y1={AXIS} x2={ox} y2={AXIS - OBJECT_H} className="stroke-ink" strokeWidth="3" />
        <path d={`M${ox - 6} ${AXIS - OBJECT_H + 8} L${ox} ${AXIS - OBJECT_H} L${ox + 6} ${AXIS - OBJECT_H + 8}`} className="fill-none stroke-ink" strokeWidth="3" />
        {real && ix < 600 && (
          <>
            <path d={`M${ox} ${AXIS - OBJECT_H} H${LENS_X} L${ix} ${AXIS - ih}`} className="fill-none stroke-[var(--plot-2)]" strokeWidth="1.5" />
            <path d={`M${ox} ${AXIS - OBJECT_H} L${ix} ${AXIS - ih}`} className="fill-none stroke-[var(--plot-3)]" strokeWidth="1.5" />
            <line x1={ix} y1={AXIS} x2={ix} y2={AXIS - ih} className="stroke-[var(--plot-4)]" strokeWidth="3" />
          </>
        )}
      </svg>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <SliderField label="Object distance |u|" unit="cm" value={u} min={6} max={80} step={0.5} onChange={setU} />
          {!real && <Notice tone="warning">The object is inside the focal length, so no real image forms on the screen. Move it further away.</Notice>}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Meter label="|u|" value={u} unit="cm" digits={1} />
            <Meter label="Image distance v" value={v} unit="cm" digits={1} />
          </div>
          <Button variant="primary" icon={<Plus size={16} />} disabled={!real} onClick={() => v && onRecord({ u, v, invU: 1 / u, invV: 1 / v, f: (u * v) / (u + v) })}>
            Record reading
          </Button>
        </div>
      </div>
    </div>
  );
}

export const lens: ExperimentDef<Truth> = {
  id: "convex-lens",
  title: "Convex Lens",
  minReadings: 3,
  columns: [
    { key: "u", label: "|u| (cm)", digits: 1 },
    { key: "v", label: "v (cm)", digits: 1 },
    { key: "invU", label: "1/|u| (cm⁻¹)", digits: 4 },
    { key: "invV", label: "1/v (cm⁻¹)", digits: 4 },
    { key: "f", label: "f = uv/(u+v) (cm)", digits: 2 },
  ],
  graph: { x: "invU", y: "invV", xLabel: "1/|u| (cm⁻¹)", yLabel: "1/v (cm⁻¹)", fit: "linear" },
  setup: () => ({ f: 10 + Math.floor(Math.random() * 11) }),
  Simulation: LensSim,
  results: (rows, truth) => [
    { label: "Mean focal length", symbol: "f", value: mean(rows.map((r) => Number(r.f))), unit: "cm", expected: truth.f, expectedLabel: "lens marking" },
  ],
};
