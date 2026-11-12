import { formatNumber } from "@/components/plot/scale";
import type { Curve, Transform } from "../calculus/PlotCanvas";
import { contour } from "./implicit";
import type { Item, Scope } from "./parse";

export function itemCurve(item: Item, scope: Scope, color: string): Curve | null {
  if (item.kind === "explicit" || (item.kind === "function" && item.plotted)) return { fn: (x) => item.at(x, scope), color };
  return null;
}

// Draws the parts PlotCanvas does not handle itself: implicit, vertical and point items
export function drawItem(ctx: CanvasRenderingContext2D, t: Transform, item: Item, scope: Scope, color: string, textColor: string) {
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
      if (!Number.isFinite(x)) {
        pen = false;
        continue;
      }
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
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.fillText(`(${formatNumber(x, 2)}, ${formatNumber(y, 2)})`, px + 9, py - 8);
  }
}

// Vertical cursor line with a dot on the curve, used while listening or exploring
export function drawCursor(ctx: CanvasRenderingContext2D, t: Transform, x: number, y: number, color: string) {
  const [px, py] = t.toPx(x, Number.isFinite(y) ? y : 0);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, t.height);
  ctx.stroke();
  ctx.restore();
  if (!Number.isFinite(y)) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
