import { useEffect, useRef } from "react";
import { formatNumber, ticks } from "@/components/plot/scale";
import { useCanvas } from "@/hooks/useCanvas";
import { cssVar, useResolvedTheme } from "@/hooks/useTheme";

export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Transform {
  toPx: (x: number, y: number) => [number, number];
  toWorld: (px: number, py: number) => [number, number];
  width: number;
  height: number;
  viewport: Viewport;
}

export interface Curve {
  fn: (x: number) => number;
  color: string;
  width?: number;
  dashed?: boolean;
}

interface Props {
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  curves: Curve[];
  overlay?: (ctx: CanvasRenderingContext2D, t: Transform) => void;
  handle?: { x: number; y: number; onDrag: (x: number) => void };
  lockAspect?: boolean;
  tall?: boolean;
  onHover?: (point: [number, number] | null) => void;
  label: string;
}

// Keeps one world unit the same length on both axes
function squareUp(v: Viewport, width: number, height: number): Viewport {
  if (!width || !height) return v;
  const half = (((v.xMax - v.xMin) / width) * height) / 2;
  const cy = (v.yMin + v.yMax) / 2;
  return { ...v, yMin: cy - half, yMax: cy + half };
}

function makeTransform(viewport: Viewport, width: number, height: number): Transform {
  const { xMin, xMax, yMin, yMax } = viewport;
  return {
    width,
    height,
    viewport,
    toPx: (x, y) => [((x - xMin) / (xMax - xMin)) * width, height - ((y - yMin) / (yMax - yMin)) * height],
    toWorld: (px, py) => [xMin + (px / width) * (xMax - xMin), yMin + ((height - py) / height) * (yMax - yMin)],
  };
}

function zoom(viewport: Viewport, factor: number, cx: number, cy: number): Viewport {
  const clamp = (span: number) => Math.min(1e6, Math.max(1e-4, span));
  const w = clamp((viewport.xMax - viewport.xMin) * factor);
  const h = clamp((viewport.yMax - viewport.yMin) * factor);
  const fx = (cx - viewport.xMin) / (viewport.xMax - viewport.xMin);
  const fy = (cy - viewport.yMin) / (viewport.yMax - viewport.yMin);
  return { xMin: cx - fx * w, xMax: cx + (1 - fx) * w, yMin: cy - fy * h, yMax: cy + (1 - fy) * h };
}

export function PlotCanvas({ viewport: requested, onViewportChange, curves, overlay, handle, lockAspect, tall, onHover, label }: Props) {
  const { canvasRef, size, context } = useCanvas();
  const viewport = lockAspect ? squareUp(requested, size.width, size.height) : requested;
  const theme = useResolvedTheme();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ mode: "pan" | "handle" | "pinch"; start: Viewport; distance?: number } | null>(null);
  const transform = makeTransform(viewport, size.width, size.height);
  const latest = useRef({ viewport, transform, onViewportChange, handle });
  latest.current = { viewport, transform, onViewportChange, handle };

  useEffect(() => {
    const ctx = context();
    if (!ctx || size.width === 0) return;
    const { width, height } = size;
    const t = makeTransform(viewport, width, height);
    const grid = cssVar("--grid");
    const muted = cssVar("--muted");
    const axis = cssVar("--text");

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = cssVar("--surface");
    ctx.fillRect(0, 0, width, height);

    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.lineWidth = 1;
    const [ox, oy] = t.toPx(0, 0);
    const labelY = Math.min(height - 6, Math.max(14, oy + 14));
    const labelX = Math.min(width - 6, Math.max(30, ox - 6));
    ctx.fillStyle = muted;
    ctx.textAlign = "center";
    for (const x of ticks(viewport.xMin, viewport.xMax, Math.max(4, Math.floor(width / 70)))) {
      const [px] = t.toPx(x, 0);
      ctx.strokeStyle = grid;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
      if (x !== 0) ctx.fillText(formatNumber(x), px, labelY);
    }
    ctx.textAlign = "right";
    for (const y of ticks(viewport.yMin, viewport.yMax, Math.max(4, Math.floor(height / 50)))) {
      const [, py] = t.toPx(0, y);
      ctx.strokeStyle = grid;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
      if (y !== 0) ctx.fillText(formatNumber(y), labelX, py + 4);
    }

    ctx.strokeStyle = axis;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(width, oy);
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, height);
    ctx.stroke();
    ctx.globalAlpha = 1;

    overlay?.(ctx, t);

    const span = viewport.yMax - viewport.yMin;
    for (const curve of curves) {
      ctx.strokeStyle = curve.color;
      ctx.lineWidth = curve.width ?? 2.5;
      ctx.setLineDash(curve.dashed ? [6, 5] : []);
      ctx.beginPath();
      let pen = false;
      let previous = Number.NaN;
      for (let px = 0; px <= width; px += 1) {
        const [x] = t.toWorld(px, 0);
        const y = curve.fn(x);
        // Lift the pen at gaps and near-vertical jumps (asymptotes)
        if (!Number.isFinite(y) || (Number.isFinite(previous) && Math.abs(y - previous) > span * 2)) {
          pen = false;
          previous = y;
          continue;
        }
        const [, py] = t.toPx(x, Math.max(viewport.yMin - span * 4, Math.min(viewport.yMax + span * 4, y)));
        if (pen) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
        pen = true;
        previous = y;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (handle && Number.isFinite(handle.y)) {
      const [hx, hy] = t.toPx(handle.x, handle.y);
      ctx.fillStyle = cssVar("--plot-2");
      ctx.strokeStyle = cssVar("--surface");
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [size, viewport, curves, overlay, handle, theme, context]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { viewport: vp, transform: t, onViewportChange: change } = latest.current;
      const rect = canvas.getBoundingClientRect();
      const [cx, cy] = t.toWorld(event.clientX - rect.left, event.clientY - rect.top);
      change(zoom(vp, event.deltaY > 0 ? 1.12 : 1 / 1.12, cx, cy));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef]);

  const local = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = local(event);
    pointers.current.set(event.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: "pinch", start: viewport, distance: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    if (handle) {
      const [hx, hy] = transform.toPx(handle.x, handle.y);
      if (Math.hypot(p.x - hx, p.y - hy) < 18) {
        gesture.current = { mode: "handle", start: viewport };
        return;
      }
    }
    gesture.current = { mode: "pan", start: viewport };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (onHover && pointers.current.size === 0) onHover(transform.toWorld(local(event).x, local(event).y));
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !gesture.current) return;
    const p = local(event);
    pointers.current.set(event.pointerId, p);
    const g = gesture.current;

    if (g.mode === "handle" && handle) {
      handle.onDrag(transform.toWorld(p.x, p.y)[0]);
    } else if (g.mode === "pan") {
      const dx = ((p.x - previous.x) / size.width) * (viewport.xMax - viewport.xMin);
      const dy = ((p.y - previous.y) / size.height) * (viewport.yMax - viewport.yMin);
      onViewportChange({ xMin: viewport.xMin - dx, xMax: viewport.xMax - dx, yMin: viewport.yMin + dy, yMax: viewport.yMax + dy });
    } else if (g.mode === "pinch" && pointers.current.size === 2 && g.distance) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const [cx, cy] = makeTransform(g.start, size.width, size.height).toWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
      onViewportChange(zoom(g.start, g.distance / Math.max(1, distance), cx, cy));
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    else if (gesture.current?.mode === "pinch") gesture.current = { mode: "pan", start: viewport };
  };

  return (
    <div className={`relative w-full ${tall ? "h-[60vh] min-h-[360px] lg:h-[calc(100vh-290px)]" : "h-[340px] sm:h-[440px]"}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-grab touch-none rounded-lg active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => onHover?.(null)}
      />
    </div>
  );
}

export const zoomViewport = zoom;
