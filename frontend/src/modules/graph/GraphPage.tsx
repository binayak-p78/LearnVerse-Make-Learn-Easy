import { Check, Link2, Maximize, Pause, Play, Plus, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { formatNumber } from "@/components/plot/scale";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { cssVar, useResolvedTheme } from "@/hooks/useTheme";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { type Curve, PlotCanvas, type Transform, type Viewport, zoomViewport } from "../calculus/PlotCanvas";
import { contour } from "./implicit";
import { buildScope, type Item, missingParams, parseRow, userFunctionName } from "./parse";
import { makeRows, type Row, type SliderBounds, useGraph } from "./store";

const DEFAULT_VIEW: Viewport = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };
const DEFAULT_BOUNDS: SliderBounds = { min: -10, max: 10, step: 0.1 };

const EXAMPLES: Record<string, string[]> = {
  "Sine wave y = a sin(bx + c)": ["y = a sin(b x + c)", "a = 2", "b = 1", "c = 0"],
  "Straight line y = mx + c": ["y = m x + c", "m = 1", "c = 2", "(0, c)", "(-c/m, 0)"],
  "Circle (x − h)² + (y − k)² = r²": ["(x - h)^2 + (y - k)^2 = r^2", "h = 1", "k = 0", "r = 3", "(h, k)"],
  "Conic sections": ["x^2/a^2 + y^2/b^2 = 1", "a = 4", "b = 2", "x^2/a^2 - y^2/b^2 = 1", "y^2 = 4 p x", "p = 1"],
  "Tangent to a curve": ["f(x) = x^3 - 3x", "y = f(p) + (3p^2 - 3)(x - p)", "p = 1.5", "(p, f(p))"],
  "Exponential and logarithm": ["y = e^x", "y = ln(x)", "y = x"],
  "Quadratic roots": ["y = a x^2 + b x + c", "a = 1", "b = -1", "c = -6", "((-b + sqrt(b^2 - 4a c))/(2a), 0)", "((-b - sqrt(b^2 - 4a c))/(2a), 0)"],
};

const PALETTE = ["--plot-1", "--plot-2", "--plot-3", "--plot-4", "--plot-5"];

function SliderRow({ row, value, bounds, onChange, onBounds, playing, onTogglePlay }: {
  row: Row;
  value: number;
  bounds: SliderBounds;
  onChange: (v: number) => void;
  onBounds: (b: SliderBounds) => void;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const bound = (key: "min" | "max", text: string) => {
    const n = Number(text);
    if (Number.isFinite(n)) onBounds({ ...bounds, [key]: n });
  };
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <IconButton size="sm" variant="ghost" label={playing ? "Pause animation" : "Animate slider"} icon={playing ? <Pause size={14} /> : <Play size={14} />} onClick={onTogglePlay} />
      <input aria-label={`${row.text.split("=")[0].trim()} minimum`} className="h-7 w-12 rounded border border-line bg-surface px-1 text-center font-mono text-[11px]" defaultValue={bounds.min} onBlur={(e) => bound("min", e.target.value)} />
      <input
        type="range"
        aria-label={`${row.text.split("=")[0].trim()} slider`}
        className="min-w-0 flex-1"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input aria-label={`${row.text.split("=")[0].trim()} maximum`} className="h-7 w-12 rounded border border-line bg-surface px-1 text-center font-mono text-[11px]" defaultValue={bounds.max} onBlur={(e) => bound("max", e.target.value)} />
    </div>
  );
}

export default function GraphPage() {
  useTrackVisit("Graphing Calculator", "graph");
  const theme = useResolvedTheme();
  const [query, setQuery] = useSearchParams();
  const { rows, setRows, updateRow, insertAfter, removeRow } = useGraph();
  const [view, setView] = useState<Viewport>(DEFAULT_VIEW);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [playing, setPlaying] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const directions = useRef(new Map<string, number>());
  const focusNext = useRef<string | null>(null);

  // Expressions passed in the link (?e=…&e=…) replace the saved ones
  useEffect(() => {
    const shared = query.getAll("e");
    if (shared.length) {
      setRows(makeRows(shared));
      setQuery({}, { replace: true });
    }
  }, [query, setQuery, setRows]);

  useEffect(() => {
    if (focusNext.current) {
      inputs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  });

  const items = useMemo(() => {
    const functions = new Set(rows.map((r) => userFunctionName(r.text)).filter((n): n is string => n !== null));
    return rows.map((r) => parseRow(r.text, functions));
  }, [rows]);
  const scope = useMemo(() => buildScope(items), [items]);

  const colors = useMemo(() => PALETTE.map((v) => cssVar(v)),
    // theme is a dependency so colours refresh when it changes
    [theme]);
  const colorOf = (row: Row) => colors[row.color % colors.length];

  const curves = useMemo<Curve[]>(() => {
    const list: Curve[] = [];
    items.forEach((item, i) => {
      const row = rows[i];
      if (row.hidden || missingParams(item, scope).length) return;
      if (item.kind === "explicit") list.push({ fn: (x) => item.at(x, scope), color: colorOf(row) });
      if (item.kind === "function" && item.plotted) list.push({ fn: (x) => item.at(x, scope), color: colorOf(row) });
    });
    return list;
  }, [items, rows, scope, colors]);

  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, t: Transform) => {
      items.forEach((item, i) => {
        const row = rows[i];
        if (row.hidden || missingParams(item, scope).length) return;
        const color = colors[row.color % colors.length];
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;
        if (item.kind === "implicit") {
          ctx.beginPath();
          for (const [x1, y1, x2, y2] of contour((x, y) => item.at(x, y, scope), t.width, t.height, t.toWorld)) {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.stroke();
        }
        if (item.kind === "vertical") {
          ctx.beginPath();
          let pen = false;
          for (let py = 0; py <= t.height; py += 1) {
            const [, y] = t.toWorld(0, py);
            const x = item.at(y, scope);
            if (!Number.isFinite(x)) { pen = false; continue; }
            const [px] = t.toPx(x, y);
            if (pen) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
            pen = true;
          }
          ctx.stroke();
        }
        if (item.kind === "point") {
          const [x, y] = item.at(scope);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          const [px, py] = t.toPx(x, y);
          ctx.beginPath();
          ctx.arc(px, py, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "12px ui-sans-serif, system-ui";
          ctx.fillStyle = cssVar("--text");
          ctx.textAlign = "left";
          ctx.fillText(`(${formatNumber(x, 2)}, ${formatNumber(y, 2)})`, px + 9, py - 8);
        }
      });
    },
    [items, rows, scope, colors],
  );

  useAnimationLoop(playing.size > 0, (dt) => {
    const current = useGraph.getState().rows;
    for (const id of playing) {
      const row = current.find((r) => r.id === id);
      const item = row ? parseRow(row.text) : null;
      if (!row || item?.kind !== "slider") continue;
      const b = row.bounds ?? DEFAULT_BOUNDS;
      const dir = directions.current.get(id) ?? 1;
      let next = item.value + dir * (b.max - b.min) * dt * 0.25;
      if (next > b.max || next < b.min) {
        directions.current.set(id, -dir);
        next = Math.min(b.max, Math.max(b.min, next));
      }
      updateRow(id, { text: `${item.name} = ${Number(next.toFixed(3))}` });
    }
  });

  const addRow = (after: string | null, text = "") => {
    focusNext.current = insertAfter(after, text);
  };

  const addSliders = (row: Row, names: string[]) => {
    let after = row.id;
    for (const name of names) after = insertAfter(after, `${name} = 1`);
  };

  const share = async () => {
    const params = new URLSearchParams();
    rows.filter((r) => r.text.trim()).forEach((r) => params.append("e", r.text));
    const url = `${window.location.origin}/graph?${params}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const centre = { x: (view.xMin + view.xMax) / 2, y: (view.yMin + view.yMax) / 2 };

  const describe = (item: Item): string | null => {
    if (item.kind === "value") return `= ${formatNumber(item.value(scope), 6)}`;
    if (item.kind === "constant") return `= ${formatNumber(item.value(scope), 6)}`;
    if (item.kind === "point") {
      const [x, y] = item.at(scope);
      return `(${formatNumber(x, 4)}, ${formatNumber(y, 4)})`;
    }
    return null;
  };

  return (
    <>
      <PageHeader
        title="Graphing Calculator"
        description="Type equations to plot them. Unknown letters become sliders, implicit equations like x² + y² = 9 are traced, and (a, b) plots a point."
        actions={<BookmarkButton title="Graphing Calculator" module="graph" />}
      />

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="order-2 flex flex-col lg:order-1 lg:max-h-[calc(100vh-180px)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => addRow(null)}>Expression</Button>
            <Button size="sm" icon={copied ? <Check size={14} /> : <Link2 size={14} />} onClick={share}>{copied ? "Copied" : "Share link"}</Button>
            <IconButton size="sm" variant="ghost" label="Clear all" icon={<Trash2 size={14} />} onClick={() => setRows(makeRows([""]))} />
            <SelectField aria-label="Load an example" className="w-full" value="" onChange={(e) => { if (e.target.value) { setRows(makeRows(EXAMPLES[e.target.value])); setView(DEFAULT_VIEW); } }}>
              <option value="">Load an example…</option>
              {Object.keys(EXAMPLES).map((name) => <option key={name}>{name}</option>)}
            </SelectField>
          </div>

          <ol className="flex-1 divide-y divide-line overflow-y-auto">
            {rows.map((row, i) => {
              const item = items[i];
              const missing = missingParams(item, scope);
              const extra = describe(item);
              const drawable = !["empty", "error", "slider", "value", "constant"].includes(item.kind) && !(item.kind === "function" && !item.plotted);
              return (
                <li key={row.id} className="flex gap-2 px-3 py-2.5">
                  <span className="w-5 shrink-0 pt-2 text-right font-mono text-[10px] text-muted">{i + 1}</span>
                  <button
                    type="button"
                    aria-label={row.hidden ? "Show on graph" : "Hide from graph"}
                    aria-pressed={!row.hidden}
                    disabled={!drawable}
                    onClick={() => updateRow(row.id, { hidden: !row.hidden })}
                    className="mt-1.5 h-6 w-6 shrink-0 rounded-full border-2 disabled:opacity-25"
                    style={{ borderColor: colorOf(row), background: row.hidden || !drawable ? "transparent" : colorOf(row) }}
                  />
                  <div className="min-w-0 flex-1">
                    <input
                      ref={(el) => { if (el) inputs.current.set(row.id, el); else inputs.current.delete(row.id); }}
                      aria-label={`Expression ${i + 1}`}
                      spellCheck={false}
                      autoComplete="off"
                      className={`h-9 w-full rounded-lg border bg-surface px-2.5 font-mono text-sm focus:outline-none ${item.kind === "error" ? "border-danger/60" : "border-line focus:border-accent"}`}
                      value={row.text}
                      placeholder="e.g. y = x^2 or x^2 + y^2 = 4"
                      onChange={(e) => updateRow(row.id, { text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addRow(row.id);
                        }
                        if (e.key === "Backspace" && row.text === "" && rows.length > 1) {
                          e.preventDefault();
                          focusNext.current = rows[Math.max(0, i - 1)].id;
                          removeRow(row.id);
                        }
                      }}
                    />
                    {item.kind === "error" && <p className="mt-1 text-[11px] text-danger">{item.message}</p>}
                    {extra && <p className="mt-1 font-mono text-xs text-muted">{extra}</p>}
                    {missing.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                        add slider:
                        {missing.map((name) => (
                          <button key={name} type="button" className="rounded-md bg-accent-soft px-2 py-0.5 font-mono font-semibold text-accent" onClick={() => addSliders(row, [name])}>
                            {name}
                          </button>
                        ))}
                        {missing.length > 1 && (
                          <button type="button" className="rounded-md border border-line px-2 py-0.5" onClick={() => addSliders(row, missing)}>all</button>
                        )}
                      </p>
                    )}
                    {item.kind === "slider" && (
                      <SliderRow
                        row={row}
                        value={item.value}
                        bounds={row.bounds ?? DEFAULT_BOUNDS}
                        onChange={(v) => updateRow(row.id, { text: `${item.name} = ${v}` })}
                        onBounds={(bounds) => updateRow(row.id, { bounds })}
                        playing={playing.has(row.id)}
                        onTogglePlay={() => setPlaying((p) => { const next = new Set(p); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })}
                      />
                    )}
                  </div>
                  <IconButton size="sm" variant="ghost" label={`Delete expression ${i + 1}`} icon={<X size={14} />} onClick={() => removeRow(row.id)} />
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="order-1 min-w-0 lg:order-2">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
            <p className="font-mono text-xs tabular-nums text-muted" aria-live="off">
              {hover ? `x = ${formatNumber(hover[0], 3)}, y = ${formatNumber(hover[1], 3)}` : "Drag to pan · scroll or pinch to zoom"}
            </p>
            <div className="flex gap-1">
              <IconButton size="sm" variant="ghost" label="Zoom in" icon={<ZoomIn size={16} />} onClick={() => setView((v) => zoomViewport(v, 1 / 1.4, centre.x, centre.y))} />
              <IconButton size="sm" variant="ghost" label="Zoom out" icon={<ZoomOut size={16} />} onClick={() => setView((v) => zoomViewport(v, 1.4, centre.x, centre.y))} />
              <IconButton size="sm" variant="ghost" label="Reset view" icon={<Maximize size={16} />} onClick={() => setView(DEFAULT_VIEW)} />
            </div>
          </div>
          <div className="p-3">
            <PlotCanvas
              viewport={view}
              onViewportChange={setView}
              curves={curves}
              overlay={overlay}
              lockAspect
              tall
              onHover={setHover}
              label={`Graph of ${rows.filter((r) => r.text.trim()).map((r) => r.text).join("; ") || "nothing yet"}`}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
