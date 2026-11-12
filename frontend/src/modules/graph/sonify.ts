import { formatNumber } from "@/components/plot/scale";

export interface Range2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface CurveSamples {
  xs: number[];
  ys: number[];
}

export interface Extremum {
  x: number;
  y: number;
}

export interface CurveAnalysis {
  roots: number[];
  turningPoints: number;
  max: Extremum | null;
  min: Extremum | null;
  definedFraction: number;
  trend: "rises" | "falls" | "flat" | "turns";
}

export interface SoundPoint {
  t: number;
  freq: number | null;
  pan: number;
}

export interface SoundClick {
  t: number;
  kind: "root" | "axis";
}

export interface SoundPlan {
  duration: number;
  points: SoundPoint[];
  clicks: SoundClick[];
}

export const LOW_HZ = 200;
export const HIGH_HZ = 1000;

export function sampleCurve(f: (x: number) => number, xMin: number, xMax: number, n = 400): CurveSamples {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = xMin + ((xMax - xMin) * i) / (n - 1);
    const y = f(x);
    xs.push(x);
    ys.push(Number.isFinite(y) ? y : Number.NaN);
  }
  return { xs, ys };
}

// Exponential pitch map, so equal steps in y sound like equal musical intervals
export function frequencyFor(y: number, yMin: number, yMax: number, low = LOW_HZ, high = HIGH_HZ): number | null {
  if (!Number.isFinite(y) || y < yMin || y > yMax || yMax <= yMin) return null;
  const t = (y - yMin) / (yMax - yMin);
  return low * (high / low) ** t;
}

export const panFor = (x: number, xMin: number, xMax: number) => Math.max(-1, Math.min(1, ((x - xMin) / (xMax - xMin)) * 2 - 1));

// A sign change counts as a root unless the jump is a pole (e.g. tan x)
export function findRoots({ xs, ys }: CurveSamples, jumpLimit = Infinity): number[] {
  const roots: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const y0 = ys[i];
    if (!Number.isFinite(y0)) continue;
    if (y0 === 0) {
      if (roots.at(-1) !== xs[i]) roots.push(xs[i]);
      continue;
    }
    const y1 = ys[i + 1];
    if (i + 1 >= xs.length || !Number.isFinite(y1) || y1 === 0) continue;
    if (Math.sign(y0) !== Math.sign(y1) && Math.abs(y1 - y0) <= jumpLimit) {
      roots.push(xs[i] + ((xs[i + 1] - xs[i]) * y0) / (y0 - y1));
    }
  }
  return roots;
}

export function analyzeCurve(samples: CurveSamples, jumpLimit = Infinity): CurveAnalysis {
  const { xs, ys } = samples;
  let max: Extremum | null = null;
  let min: Extremum | null = null;
  let defined = 0;
  let up = 0;
  let down = 0;
  let turningPoints = 0;
  let lastDirection = 0;
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (!Number.isFinite(y)) continue;
    defined += 1;
    if (!max || y > max.y) max = { x: xs[i], y };
    if (!min || y < min.y) min = { x: xs[i], y };
    const next = ys[i + 1];
    if (!Number.isFinite(next) || Math.abs(next - y) > jumpLimit) continue;
    const direction = Math.sign(next - y);
    if (direction > 0) up += 1;
    if (direction < 0) down += 1;
    if (direction !== 0) {
      if (lastDirection !== 0 && direction !== lastDirection) turningPoints += 1;
      lastDirection = direction;
    }
  }
  const steps = up + down;
  const trend = steps === 0 ? "flat" : up / steps >= 0.97 ? "rises" : down / steps >= 0.97 ? "falls" : "turns";
  return { roots: findRoots(samples, jumpLimit), turningPoints, max, min, definedFraction: xs.length ? defined / xs.length : 0, trend };
}

const at = (v: number) => formatNumber(v, 2).replace("-", "−");

export function describeCurve(a: CurveAnalysis, xMin: number, xMax: number): string {
  if (!a.max || !a.min) return `The curve is not defined between x = ${at(xMin)} and ${at(xMax)}.`;
  const parts: string[] = [];
  const span = `from x = ${at(xMin)} to ${at(xMax)}`;
  if (a.trend === "rises") parts.push(`The curve rises ${span}.`);
  else if (a.trend === "falls") parts.push(`The curve falls ${span}.`);
  else if (a.trend === "flat") parts.push(`The curve is flat ${span}.`);
  else parts.push(`${span[0].toUpperCase()}${span.slice(1)}, the curve turns ${a.turningPoints} time${a.turningPoints === 1 ? "" : "s"}.`);
  if (a.roots.length === 0) parts.push("It does not cross the x-axis.");
  else {
    const shown = a.roots.slice(0, 3).map(at).join(", ");
    parts.push(`It crosses the x-axis ${a.roots.length} time${a.roots.length === 1 ? "" : "s"}, near x = ${shown}${a.roots.length > 3 ? " and more" : ""}.`);
  }
  if (a.trend !== "flat") parts.push(`Highest ≈ ${at(a.max.y)} at x ≈ ${at(a.max.x)}; lowest ≈ ${at(a.min.y)} at x ≈ ${at(a.min.x)}.`);
  if (a.definedFraction < 0.99) parts.push("It is undefined over part of the range.");
  return parts.join(" ");
}

export function buildPlan(samples: CurveSamples, view: Range2D, duration: number): SoundPlan {
  const { xs, ys } = samples;
  const timeOf = (x: number) => ((x - view.xMin) / (view.xMax - view.xMin)) * duration;
  const points = xs.map((x, i) => ({ t: timeOf(x), freq: frequencyFor(ys[i], view.yMin, view.yMax), pan: panFor(x, view.xMin, view.xMax) }));
  const clicks: SoundClick[] = findRoots(samples, (view.yMax - view.yMin) * 2).map((x) => ({ t: timeOf(x), kind: "root" as const }));
  if (view.xMin < 0 && view.xMax > 0) clicks.push({ t: timeOf(0), kind: "axis" });
  return { duration, points, clicks: clicks.sort((a, b) => a.t - b.t) };
}
