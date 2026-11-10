import { Maximize, Pause, Play, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { BookmarkButton } from "@/components/BookmarkButton";
import { IconButton } from "@/components/ui/Button";
import { Card, CardHeader, Notice, PageHeader } from "@/components/ui/Card";
import { Segmented, SelectField, SliderField, TextField } from "@/components/ui/Field";
import { Tex } from "@/components/ui/Tex";
import { formatNumber } from "@/components/plot/scale";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { cssVar, useResolvedTheme } from "@/hooks/useTheme";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { compileExpression, differentiate } from "./expression";
import { estimateLimit, integrate, limitTable, riemann, type RiemannMethod } from "./numeric";
import { type Curve, PlotCanvas, type Transform, type Viewport, zoomViewport } from "./PlotCanvas";
import { SolverPanel, type SolveRequest } from "./SolverPanel";

type Mode = "derivative" | "integral" | "limit";

const PRESETS = ["x^2", "x^3 - 3x", "sin(x)", "e^x", "ln(x)", "1/x", "sin(x)/x", "abs(x)/x", "sqrt(x)"];
const DEFAULT_VIEW: Viewport = { xMin: -6, xMax: 6, yMin: -4, yMax: 6 };

const parseBound = (text: string) => {
  const compiled = compileExpression(text);
  return compiled.ok ? compiled.fn.at(0) : Number.NaN;
};

export default function CalculusPage() {
  useTrackVisit("Calculus Visualizer", "calculus");
  const theme = useResolvedTheme();
  const [query] = useSearchParams();
  const [mode, setMode] = useState<Mode>((query.get("mode") as Mode) || "derivative");
  const [text, setText] = useState(query.get("f") ?? "x^2");
  const [view, setView] = useState<Viewport>(DEFAULT_VIEW);
  const [x0, setX0] = useState(Number(query.get("x0") ?? 1));
  const [showDerivative, setShowDerivative] = useState(true);
  const [lowerText, setLowerText] = useState(query.get("a") ?? "0");
  const [upperText, setUpperText] = useState(query.get("b") ?? "2");
  const [n, setN] = useState(8);
  const [method, setMethod] = useState<RiemannMethod>("midpoint");
  const [pointText, setPointText] = useState(query.get("a") ?? "0");
  const [hExp, setHExp] = useState(0);
  const [approaching, setApproaching] = useState(false);

  const compiled = useMemo(() => compileExpression(text), [text]);
  const fn = compiled.ok ? compiled.fn : null;
  const dfn = useMemo(() => (fn ? differentiate(fn) : null), [fn]);
  const a = parseBound(lowerText);
  const b = parseBound(upperText);
  const point = parseBound(pointText);
  const h = 10 ** -hExp;

  const hRef = useRef(hExp);
  hRef.current = hExp;
  useAnimationLoop(approaching, (dt) => {
    const next = hRef.current + dt * 1.2;
    if (next >= 5) {
      setHExp(5);
      setApproaching(false);
      return false;
    }
    setHExp(next);
  });

  const palette = useMemo(
    () => ({ f: cssVar("--plot-1"), df: cssVar("--plot-3"), mark: cssVar("--plot-2"), fill: cssVar("--plot-1"), muted: cssVar("--muted") }),
    [theme],
  );

  const slope = dfn ? dfn.at(x0) : Number.NaN;
  const y0 = fn ? fn.at(x0) : Number.NaN;

  const sums = useMemo(
    () => (fn && Number.isFinite(a) && Number.isFinite(b) && a !== b ? riemann(fn.at, Math.min(a, b), Math.max(a, b), n, method) : null),
    [fn, a, b, n, method],
  );
  const exact = useMemo(
    () => (fn && Number.isFinite(a) && Number.isFinite(b) ? integrate(fn.at, Math.min(a, b), Math.max(a, b)) : Number.NaN),
    [fn, a, b],
  );
  const limit = useMemo(() => (fn && Number.isFinite(point) ? estimateLimit(fn.at, point) : null), [fn, point]);
  const table = useMemo(() => (fn && Number.isFinite(point) ? limitTable(fn.at, point) : []), [fn, point]);

  const curves = useMemo<Curve[]>(() => {
    if (!fn) return [];
    const list: Curve[] = [{ fn: fn.at, color: palette.f }];
    if (mode === "derivative" && showDerivative && dfn) list.push({ fn: dfn.at, color: palette.df, width: 2, dashed: true });
    if (mode === "derivative" && Number.isFinite(slope) && Number.isFinite(y0)) {
      list.push({ fn: (x) => y0 + slope * (x - x0), color: palette.mark, width: 1.75 });
    }
    return list;
  }, [fn, dfn, mode, showDerivative, slope, y0, x0, palette]);

  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, t: Transform) => {
      if (!fn) return;
      if (mode === "integral" && sums) {
        ctx.fillStyle = palette.fill;
        ctx.strokeStyle = palette.fill;
        for (const s of sums.strips) {
          if (!Number.isFinite(s.y0) || !Number.isFinite(s.y1)) continue;
          const [px0, py0] = t.toPx(s.x0, s.y0);
          const [px1, py1] = t.toPx(s.x1, s.y1);
          const [, base] = t.toPx(0, 0);
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.moveTo(px0, base);
          ctx.lineTo(px0, py0);
          ctx.lineTo(px1, py1);
          ctx.lineTo(px1, base);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (mode === "limit" && Number.isFinite(point)) {
        const [px] = t.toPx(point, 0);
        ctx.strokeStyle = palette.muted;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, t.height);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const [x, color] of [[point - h, cssVar("--plot-3")], [point + h, cssVar("--plot-2")]] as const) {
          const y = fn.at(x);
          if (!Number.isFinite(y)) continue;
          const [cx, cy] = t.toPx(x, y);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        if (limit?.value != null) {
          const [lx, ly] = t.toPx(point, limit.value);
          ctx.strokeStyle = palette.f;
          ctx.fillStyle = cssVar("--surface");
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(lx, ly, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    },
    [fn, mode, sums, point, h, limit, palette],
  );

  const request: SolveRequest =
    mode === "derivative"
      ? { kind: "derivative", expression: text }
      : mode === "integral"
        ? { kind: "integral", expression: text, lower: lowerText, upper: upperText, definite: true }
        : { kind: "limit", expression: text, point: pointText };

  const centre = () => ({ x: (view.xMin + view.xMax) / 2, y: (view.yMin + view.yMax) / 2 });

  return (
    <>
      <PageHeader
        title="Calculus Visualizer"
        description="Drag to pan, scroll or pinch to zoom. In derivative mode, drag the orange point along the curve."
        actions={<BookmarkButton title="Calculus Visualizer" module="calculus" />}
      />

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Function" />
            <div className="space-y-3 p-4">
              <TextField label="f(x) =" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
                className="font-mono" aria-invalid={!compiled.ok} />
              {!compiled.ok && <p className="text-xs text-danger">{compiled.error}</p>}
              {fn && <Tex math={`f(x) = ${fn.tex}`} className="block overflow-x-auto text-sm" />}
              <SelectField label="Examples" value="" onChange={(e) => e.target.value && setText(e.target.value)}>
                <option value="">Choose an example…</option>
                {PRESETS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </SelectField>
              <Segmented label="Mode" value={mode} onChange={setMode} options={[
                { value: "derivative", label: "Derivative" },
                { value: "integral", label: "Integral" },
                { value: "limit", label: "Limit" },
              ]} />
            </div>
          </Card>

          <Card>
            <CardHeader title={mode === "derivative" ? "Tangent line" : mode === "integral" ? "Riemann sum" : "Approach"} />
            <div className="space-y-4 p-4">
              {mode === "derivative" && (
                <>
                  <SliderField label="Point x₀" value={x0} min={view.xMin} max={view.xMax} step={0.01}
                    onChange={setX0} format={(v) => v.toFixed(2)} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showDerivative} onChange={(e) => setShowDerivative(e.target.checked)} />
                    Plot f′(x) (dashed)
                  </label>
                  {dfn && <Tex math={`f'(x) = ${dfn.tex}`} className="block overflow-x-auto text-sm" />}
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">f(x₀)</dt><dd className="font-mono">{formatNumber(y0)}</dd></div>
                    <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">slope f′(x₀)</dt><dd className="font-mono">{formatNumber(slope)}</dd></div>
                  </dl>
                  <Tex block math={`y = ${formatNumber(y0)} + ${formatNumber(slope)}\\,(x - ${formatNumber(x0)})`} />
                </>
              )}
              {mode === "integral" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <TextField label="Lower a" value={lowerText} onChange={(e) => setLowerText(e.target.value)} className="font-mono" />
                    <TextField label="Upper b" value={upperText} onChange={(e) => setUpperText(e.target.value)} className="font-mono" />
                  </div>
                  <SliderField label="Subintervals n" value={n} min={1} max={200} onChange={setN} />
                  <SelectField label="Method" value={method} onChange={(e) => setMethod(e.target.value as RiemannMethod)}>
                    <option value="left">Left endpoint</option>
                    <option value="right">Right endpoint</option>
                    <option value="midpoint">Midpoint</option>
                    <option value="trapezoid">Trapezoid</option>
                  </SelectField>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">Sum (n = {n})</dt><dd className="font-mono">{formatNumber(sums?.sum ?? Number.NaN, 5)}</dd></div>
                    <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">Integral</dt><dd className="font-mono">{formatNumber(exact, 5)}</dd></div>
                    <div className="col-span-2 rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">Error</dt><dd className="font-mono">{formatNumber(Math.abs((sums?.sum ?? Number.NaN) - exact), 6)}</dd></div>
                  </dl>
                </>
              )}
              {mode === "limit" && (
                <>
                  <TextField label="x approaches a =" value={pointText} onChange={(e) => setPointText(e.target.value)} className="font-mono" />
                  <SliderField label="Distance h = 10^−k, k" value={Number(hExp.toFixed(2))} min={0} max={5} step={0.01}
                    onChange={(v) => { setApproaching(false); setHExp(v); }} />
                  <button type="button" onClick={() => { if (hExp >= 5) setHExp(0); setApproaching((p) => !p); }}
                    className="inline-flex items-center gap-2 text-sm font-medium text-accent">
                    {approaching ? <Pause size={14} /> : <Play size={14} />} {approaching ? "Pause" : "Animate the approach"}
                  </button>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">f(a − h)</dt><dd className="font-mono">{formatNumber(fn?.at(point - h) ?? Number.NaN, 6)}</dd></div>
                    <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">f(a + h)</dt><dd className="font-mono">{formatNumber(fn?.at(point + h) ?? Number.NaN, 6)}</dd></div>
                  </dl>
                  <p className="text-sm">
                    {limit?.value != null ? (
                      <>Estimated limit ≈ <span className="font-mono font-semibold">{formatNumber(limit.value, 6)}</span></>
                    ) : (
                      <span className="text-warning">The left and right values do not agree, so the limit may not exist.</span>
                    )}
                  </p>
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
              <p className="text-xs text-muted">
                x ∈ [{formatNumber(view.xMin, 2)}, {formatNumber(view.xMax, 2)}], y ∈ [{formatNumber(view.yMin, 2)}, {formatNumber(view.yMax, 2)}]
              </p>
              <div className="flex gap-1">
                <IconButton size="sm" variant="ghost" label="Zoom in" icon={<ZoomIn size={16} />} onClick={() => setView((v) => zoomViewport(v, 1 / 1.4, centre().x, centre().y))} />
                <IconButton size="sm" variant="ghost" label="Zoom out" icon={<ZoomOut size={16} />} onClick={() => setView((v) => zoomViewport(v, 1.4, centre().x, centre().y))} />
                <IconButton size="sm" variant="ghost" label="Reset view" icon={<Maximize size={16} />} onClick={() => setView(DEFAULT_VIEW)} />
              </div>
            </div>
            <div className="p-3">
              {compiled.ok ? (
                <PlotCanvas
                  viewport={view}
                  onViewportChange={setView}
                  curves={curves}
                  overlay={overlay}
                  handle={mode === "derivative" ? { x: x0, y: y0, onDrag: setX0 } : undefined}
                  label={`Graph of f(x) = ${text}`}
                />
              ) : (
                <Notice tone="warning" title="Fix the function to see its graph">{compiled.error}</Notice>
              )}
            </div>
          </Card>

          {mode === "limit" && table.length > 0 && (
            <Card>
              <CardHeader title="Table of values" subtitle="As h shrinks, both columns should approach the same number." />
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[360px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr><th className="py-1">h</th><th>f(a − h)</th><th>f(a + h)</th></tr>
                  </thead>
                  <tbody className="font-mono">
                    {table.map((row) => (
                      <tr key={row.h} className="border-t border-line">
                        <td className="py-1">{row.h.toExponential(0)}</td>
                        <td>{formatNumber(row.left, 7)}</td>
                        <td>{formatNumber(row.right, 7)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {compiled.ok && <SolverPanel request={request} />}
        </div>
      </div>
    </>
  );
}
