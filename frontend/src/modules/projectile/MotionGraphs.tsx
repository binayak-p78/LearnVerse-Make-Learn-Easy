import { useId, useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tex } from "@/components/ui/Tex";
import { formatNumber, ticks } from "@/components/plot/scale";
import { accelerationAt, type LaunchParams, type Sample, sampleAt, type Trajectory } from "./engine";
import { areaUpTo, downsample, type Pick, pickers, rangeOf, tangentLine } from "./motion";

const W = 300;
const H = 170;
const PAD = { left: 40, right: 10, top: 26, bottom: 22 };
const MAX_POINTS = 180;

interface PlotSpec {
  title: string;
  unit: string;
  pick: Pick;
  color: string;
  overlay: { kind: "tangent"; slope: number; label: string } | { kind: "area"; label: string; note: string };
}

function MotionPlot({ spec, samples, flightTime, time, now }: {
  spec: PlotSpec;
  samples: Sample[];
  flightTime: number;
  time: number;
  now: Sample;
}) {
  const clip = `clip${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const range = useMemo(() => rangeOf(samples.map(spec.pick)), [samples, spec.pick]);
  const T = flightTime || 1;
  const sx = (t: number) => PAD.left + (t / T) * (W - PAD.left - PAD.right);
  const sy = (v: number) => H - PAD.bottom - ((v - range.min) / (range.max - range.min)) * (H - PAD.top - PAD.bottom);
  const path = samples.map((s, i) => `${i ? "L" : "M"}${sx(s.t).toFixed(1)} ${sy(spec.pick(s)).toFixed(1)}`).join("");
  const value = spec.pick(now);
  const { overlay } = spec;

  let shaded = "";
  if (overlay.kind === "area" && time > 0) {
    const upto = samples.filter((s) => s.t <= time);
    const pts = [...upto.map((s) => [s.t, spec.pick(s)] as const), [time, value] as const];
    shaded = `M${sx(0)} ${sy(0)}${pts.map(([t, v]) => `L${sx(t).toFixed(1)} ${sy(v).toFixed(1)}`).join("")}L${sx(time)} ${sy(0)}Z`;
  }
  const tangent = overlay.kind === "tangent" ? tangentLine(time, value, overlay.slope, T * 0.18) : null;

  return (
    <figure className="min-w-0 rounded-2xl bg-surface-2 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${spec.title} against time. ${overlay.label}`}>
        <defs>
          <clipPath id={clip}>
            <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom} />
          </clipPath>
        </defs>
        <text x={PAD.left} y={14} fontSize="11" fontWeight="600" className="fill-ink">{spec.title}</text>
        <text x={W - PAD.right} y={14} fontSize="10" textAnchor="end" className="fill-muted">{overlay.label}</text>
        {ticks(range.min, range.max, 4).map((v) => (
          <g key={`y${v}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(v)} y2={sy(v)} className={v === 0 ? "stroke-muted" : "stroke-[var(--grid)]"} strokeWidth="1" />
            <text x={PAD.left - 4} y={sy(v) + 3} fontSize="9" textAnchor="end" className="fill-muted">{formatNumber(v, 1)}</text>
          </g>
        ))}
        {ticks(0, T, 5).map((t) => (
          <text key={`t${t}`} x={sx(t)} y={H - 6} fontSize="9" textAnchor="middle" className="fill-muted">{formatNumber(t, 2)}</text>
        ))}
        <g clipPath={`url(#${clip})`}>
          {shaded && <path d={shaded} className="fill-accent/20" />}
          <path d={path} fill="none" stroke={`var(${spec.color})`} strokeWidth="2" />
          {tangent && (
            <line x1={sx(tangent.from[0])} y1={sy(tangent.from[1])} x2={sx(tangent.to[0])} y2={sy(tangent.to[1])} className="stroke-ink" strokeWidth="1.5" strokeDasharray="5 3" />
          )}
        </g>
        <line x1={sx(time)} x2={sx(time)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-accent" strokeWidth="1" />
        <circle cx={sx(time)} cy={sy(value)} r="3.5" className="fill-accent" />
      </svg>
      <figcaption className="px-1 pb-0.5 text-[11px] text-muted">
        {spec.title} = {formatNumber(value, 2)} {spec.unit}
        {overlay.kind === "area" && <> · {overlay.note}</>}
      </figcaption>
    </figure>
  );
}

export function MotionGraphs({ trajectory, time, params }: { trajectory: Trajectory; time: number; params: LaunchParams }) {
  const samples = useMemo(() => downsample(trajectory.samples, MAX_POINTS), [trajectory]);
  const now = sampleAt(trajectory, time);
  const accel = accelerationAt(now, params);
  const areaX = areaUpTo(trajectory.samples, time, pickers.vx);
  const areaY = areaUpTo(trajectory.samples, time, pickers.vy);
  const f = (v: number) => formatNumber(v, 2);

  const specs: PlotSpec[] = [
    { title: "x(t)", unit: "m", pick: pickers.x, color: "--plot-2", overlay: { kind: "tangent", slope: now.velocity.x, label: `slope = vₓ = ${f(now.velocity.x)} m/s` } },
    { title: "y(t)", unit: "m", pick: pickers.y, color: "--plot-1", overlay: { kind: "tangent", slope: now.velocity.y, label: `slope = vᵧ = ${f(now.velocity.y)} m/s` } },
    { title: "vₓ(t)", unit: "m/s", pick: pickers.vx, color: "--plot-3", overlay: { kind: "area", label: `area = x = ${f(areaX)} m`, note: `slope = aₓ = ${f(accel.x)} m/s²` } },
    { title: "vᵧ(t)", unit: "m/s", pick: pickers.vy, color: "--plot-4", overlay: { kind: "area", label: `area = y − h = ${f(areaY)} m`, note: `slope = aᵧ = ${f(accel.y)} m/s²${params.drag ? " (RK4, with drag)" : " = −g"}` } },
  ];

  return (
    <Card>
      <CardHeader
        title="Motion graphs"
        subtitle="The dashed tangent's slope is the velocity; the shaded area under a velocity graph is the displacement."
      />
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {specs.map((spec) => (
          <MotionPlot key={spec.title} spec={spec} samples={samples} flightTime={trajectory.flightTime} time={time} now={now} />
        ))}
      </div>
      <div className="overflow-x-auto px-4 pb-4 text-sm">
        <Tex block math={`v_x = \\frac{dx}{dt},\\quad v_y = \\frac{dy}{dt},\\quad a_y = \\frac{dv_y}{dt},\\qquad x = \\int_0^t v_x\\,dt,\\quad y - h = \\int_0^t v_y\\,dt`} />
      </div>
    </Card>
  );
}
