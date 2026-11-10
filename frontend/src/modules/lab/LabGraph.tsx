import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/components/plot/scale";
import { linearFit, originFit } from "./fit";
import type { GraphSpec, Row } from "./types";

export function LabGraph({ rows, spec }: { rows: Row[]; spec: GraphSpec }) {
  const points = rows
    .map((r) => ({ x: Number(r[spec.x]), y: Number(r[spec.y]) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const fit = spec.fit === "origin" ? originFit(xs, ys) : spec.fit === "linear" ? linearFit(xs, ys) : null;
  const x0 = spec.fit === "origin" ? 0 : Math.min(...xs);
  const x1 = Math.max(...xs);
  const line = fit && points.length > 1 ? [x0, x1].map((x) => ({ x, y: fit.slope * x + fit.intercept })) : [];

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Record readings to plot {spec.yLabel} against {spec.xLabel}.</p>;
  }

  return (
    <div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart margin={{ top: 10, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" />
            <XAxis type="number" dataKey="x" domain={["auto", "auto"]} tick={{ fill: "var(--muted)", fontSize: 11 }} stroke="var(--border)"
              label={{ value: spec.xLabel, position: "insideBottom", offset: -14, fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
            <YAxis type="number" dataKey="y" domain={["auto", "auto"]} tick={{ fill: "var(--muted)", fontSize: 11 }} stroke="var(--border)" width={56}
              label={{ value: spec.yLabel, angle: -90, position: "insideLeft", fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(value) => formatNumber(Number(value), 4)}
            />
            {line.length > 0 && <Line data={line} dataKey="y" stroke="var(--plot-2)" strokeWidth={2} dot={false} isAnimationActive={false} name="best fit" />}
            <Scatter data={points} fill="var(--plot-1)" name="reading" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {fit && points.length > 1 && (
        <p className="mt-1 text-center font-mono text-xs text-muted">
          best fit: y = {formatNumber(fit.slope, 4)}x{spec.fit === "linear" ? ` ${fit.intercept >= 0 ? "+" : "−"} ${formatNumber(Math.abs(fit.intercept), 4)}` : ""} · R² = {fit.r2.toFixed(4)}
        </p>
      )}
    </div>
  );
}
