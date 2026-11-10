import { useEffect } from "react";
import { arrow, formatNumber, ticks } from "@/components/plot/scale";
import { useCanvas } from "@/hooks/useCanvas";
import { cssVar, useResolvedTheme } from "@/hooks/useTheme";
import { accelerationAt, sampleAt, type Trajectory } from "./engine";

export interface PlottedTrajectory {
  trajectory: Trajectory;
  color: string;
  label: string;
}

const PAD = { left: 48, right: 20, top: 20, bottom: 36 };

export function ProjectileCanvas({
  current,
  comparisons,
  time,
  showVectors,
}: {
  current: Trajectory;
  comparisons: PlottedTrajectory[];
  time: number;
  showVectors: boolean;
}) {
  const { canvasRef, size, context } = useCanvas();
  const theme = useResolvedTheme();

  useEffect(() => {
    const ctx = context();
    if (!ctx || size.width === 0) return;
    const { width, height } = size;
    const colors = {
      text: cssVar("--text"),
      muted: cssVar("--muted"),
      grid: cssVar("--grid"),
      surface: cssVar("--surface"),
      accent: cssVar("--plot-1"),
      velocity: cssVar("--plot-3"),
      accel: cssVar("--plot-2"),
      ground: cssVar("--border"),
    };

    const all = [current, ...comparisons.map((c) => c.trajectory)];
    const maxX = Math.max(1, ...all.map((t) => t.range)) * 1.08;
    const maxY = Math.max(1, ...all.map((t) => t.maxHeight)) * 1.18;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    // Equal scale on both axes so the path keeps its true shape
    const scale = Math.min(plotW / maxX, plotH / maxY);
    const toX = (x: number) => PAD.left + x * scale;
    const toY = (y: number) => height - PAD.bottom - y * scale;
    const worldW = plotW / scale;
    const worldH = plotH / scale;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.surface;
    ctx.fillRect(0, 0, width, height);

    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.grid;
    ctx.fillStyle = colors.muted;
    ctx.textAlign = "center";
    for (const x of ticks(0, worldW, Math.max(3, Math.floor(plotW / 80)))) {
      ctx.beginPath();
      ctx.moveTo(toX(x), PAD.top);
      ctx.lineTo(toX(x), toY(0));
      ctx.stroke();
      ctx.fillText(formatNumber(x, 1), toX(x), height - PAD.bottom + 16);
    }
    ctx.textAlign = "right";
    for (const y of ticks(0, worldH, Math.max(3, Math.floor(plotH / 60)))) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, toY(y));
      ctx.lineTo(width - PAD.right, toY(y));
      ctx.stroke();
      ctx.fillText(formatNumber(y, 1), PAD.left - 6, toY(y) + 4);
    }
    ctx.textAlign = "left";
    ctx.fillText("x (m)", width - PAD.right - 30, height - 6);
    ctx.fillText("y (m)", 6, PAD.top - 6 > 8 ? PAD.top - 6 : 12);

    ctx.strokeStyle = colors.ground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD.left, toY(0));
    ctx.lineTo(width - PAD.right, toY(0));
    ctx.stroke();

    const path = (t: Trajectory, until = Infinity) => {
      ctx.beginPath();
      t.samples.forEach((s, i) => {
        if (s.t > until) return;
        if (i === 0) ctx.moveTo(toX(s.position.x), toY(s.position.y));
        else ctx.lineTo(toX(s.position.x), toY(s.position.y));
      });
      if (until < Infinity) {
        const p = sampleAt(t, until).position;
        ctx.lineTo(toX(p.x), toY(p.y));
      }
      ctx.stroke();
    };

    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    for (const c of comparisons) {
      ctx.strokeStyle = c.color;
      path(c.trajectory);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(toX(c.trajectory.range), toY(0), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = colors.accent;
    path(current);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    path(current, time);

    const peak = sampleAt(current, current.peakTime).position;
    ctx.fillStyle = colors.muted;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.muted;
    ctx.beginPath();
    ctx.moveTo(toX(peak.x), toY(peak.y));
    ctx.lineTo(toX(peak.x), toY(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "center";
    ctx.fillText(`H = ${formatNumber(current.maxHeight, 2)} m`, toX(peak.x), toY(peak.y) - 10);
    ctx.fillText(`R = ${formatNumber(current.range, 2)} m`, toX(current.range), toY(0) - 8);

    const now = sampleAt(current, time);
    const bx = toX(now.position.x);
    const by = toY(now.position.y);

    if (showVectors) {
      const speedRef = Math.max(1, current.params.speed);
      const vScale = 60 / speedRef;
      arrow(ctx, bx, by, bx + now.velocity.x * vScale, by - now.velocity.y * vScale, colors.velocity, 2.5);
      ctx.globalAlpha = 0.55;
      arrow(ctx, bx, by, bx + now.velocity.x * vScale, by, colors.velocity, 1.5);
      arrow(ctx, bx, by, bx, by - now.velocity.y * vScale, colors.velocity, 1.5);
      ctx.globalAlpha = 1;
      const a = accelerationAt(now, current.params);
      const aScale = 40 / Math.max(1, current.params.gravity);
      arrow(ctx, bx, by, bx + a.x * aScale, by - a.y * aScale, colors.accel, 2.5);
    }

    ctx.fillStyle = colors.accent;
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [size, current, comparisons, time, showVectors, theme, context]);

  return (
    <div className="relative h-[320px] w-full sm:h-[420px]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full rounded-lg"
        role="img"
        aria-label={`Trajectory: range ${formatNumber(current.range, 2)} metres, maximum height ${formatNumber(current.maxHeight, 2)} metres, flight time ${formatNumber(current.flightTime, 2)} seconds.`}
      />
    </div>
  );
}
