import { FAMILIES, type Family, type FamilyKey, type Params } from "./challenges";

export type StudentCurve =
  | { kind: "explicit"; f: (x: number) => number }
  | { kind: "implicit"; F: (x: number, y: number) => number };

export interface MatchScore {
  score: number;
  rms: number;
  best: number;
}

export interface Hint {
  id: string;
  text: string;
}

const SAMPLES = 200;
const CIRCLE_POINTS = 120;
// Target values beyond this band are off-screen, so they are not scored
const BAND = 8;
// RMS distance that scores zero; per-point error is capped so one far point cannot dominate
const SCALE = 1.5;
const CAP = 3;

const round1 = (v: number) => String(Number(Math.abs(v).toFixed(1)));

// First-order distance from (x, y) to the curve F = 0: |F| / |∇F|
export function implicitDistance(F: (x: number, y: number) => number, x: number, y: number): number {
  const value = F(x, y);
  if (!Number.isFinite(value)) return CAP;
  const h = 1e-4;
  const gx = (F(x + h, y) - F(x - h, y)) / (2 * h);
  const gy = (F(x, y + h) - F(x, y - h)) / (2 * h);
  const g = Math.hypot(gx, gy);
  if (!Number.isFinite(g) || g < 1e-9) return Math.abs(value) < 1e-9 ? 0 : CAP;
  return Math.min(CAP, Math.abs(value) / g);
}

export function targetPoints(family: Family, p: Params): [number, number][] {
  if (family.shape === "implicit") return family.points(p, CIRCLE_POINTS);
  const [x0, x1] = family.domain;
  const out: [number, number][] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const x = x0 + ((x1 - x0) * i) / (SAMPLES - 1);
    const y = family.y(p, x);
    if (Number.isFinite(y) && Math.abs(y) <= BAND) out.push([x, y]);
  }
  return out;
}

function distanceTo(curve: StudentCurve, x: number, y: number): number {
  if (curve.kind === "implicit") return implicitDistance(curve.F, x, y);
  const v = curve.f(x);
  return Number.isFinite(v) ? Math.min(CAP, Math.abs(v - y)) : CAP;
}

export function rmsDistance(points: [number, number][], curve: StudentCurve): number {
  if (!points.length) return CAP;
  const sum = points.reduce((s, [x, y]) => s + distanceTo(curve, x, y) ** 2, 0);
  return Math.sqrt(sum / points.length);
}

export const toScore = (rms: number) => Math.round(100 * Math.max(0, 1 - rms / SCALE));

export function scoreMatch(family: Family, target: Params, curves: StudentCurve[]): MatchScore {
  const points = targetPoints(family, target);
  let best = { score: 0, rms: CAP, best: -1 };
  curves.forEach((curve, i) => {
    const rms = rmsDistance(points, curve);
    if (rms < best.rms) best = { score: toScore(rms), rms, best: i };
  });
  return best;
}

export const familyCurve = (family: Family, p: Params): StudentCurve =>
  family.shape === "explicit" ? { kind: "explicit", f: (x) => family.y(p, x) } : { kind: "implicit", F: (x, y) => family.F(p, x, y) };

type Describe = (student: number, target: number, period: number) => string;

const higher = (what: string, name: string): Describe => (s, t) =>
  s > t ? `${what} about ${round1(s - t)} too high. Decrease ${name}.` : `${what} about ${round1(t - s)} too low. Increase ${name}.`;
const further = (what: string, name: string): Describe => (s, t) =>
  s > t ? `${what} about ${round1(s - t)} too far right. Decrease ${name}.` : `${what} about ${round1(t - s)} too far left. Increase ${name}.`;
const size = (sign: string, big: string, small: string, name: string): Describe => (s, t) =>
  Math.sign(s) !== Math.sign(t) ? `${sign} ${name} has the wrong sign.` : Math.abs(s) > Math.abs(t) ? `${big} Make |${name}| smaller.` : `${small} Make |${name}| larger.`;

// Family-specific wording for each parameter mismatch
const MESSAGES: Record<FamilyKey, Record<string, Describe>> = {
  line: {
    m: size("It slopes the wrong way:", "Too steep.", "Too shallow.", "m"),
    c: higher("It crosses the y-axis", "c"),
  },
  parabola: {
    a: size("It opens the wrong way:", "Too narrow.", "Too wide.", "a"),
    h: further("The vertex is", "h"),
    k: higher("The vertex is", "k"),
  },
  abs: {
    a: size("The V points the wrong way:", "Too steep.", "Too flat.", "a"),
    h: further("The corner is", "h"),
    k: higher("The corner is", "k"),
  },
  sine: {
    a: size("It starts going the wrong way:", "Amplitude too large.", "Amplitude too small.", "a"),
    b: (s, t) => (s > t ? "Period too short: b is too big." : "Period too long: b is too small."),
    h: (s, t, period) => further("The wave is shifted", "h")(wrapShift(s - t, period), 0, period),
    k: higher("The midline is", "k"),
  },
  exponential: {
    a: size("It is flipped upside down:", "Stretched too much vertically.", "Not stretched enough vertically.", "a"),
    b: (s, t) =>
      Math.sign(s) !== Math.sign(t)
        ? `It grows the wrong way: b should be ${t > 0 ? "positive (rising to the right)" : "negative (falling to the right)"}.`
        : Math.abs(s) > Math.abs(t) ? "It changes too fast. Make |b| smaller." : "It changes too slowly. Make |b| larger.",
    k: higher("The asymptote y = k is", "k"),
  },
  circle: {
    h: further("The centre is", "h"),
    k: higher("The centre is", "k"),
    r: (s, t) => (s > t ? `Too big: the radius is about ${round1(s - t)} too large.` : `Too small: the radius is about ${round1(t - s)} too short.`),
  },
};

// Reduces a horizontal shift into (−period/2, period/2]
const wrapShift = (d: number, period: number) => (Number.isFinite(period) && period > 0 ? d - period * Math.round(d / period) : d);

// Compares slider values to the target, ranked by how much fixing each one alone would help
export function parameterHints(familyKey: FamilyKey, target: Params, student: Params, limit = 3): Hint[] {
  const family = FAMILIES[familyKey];
  const points = targetPoints(family, target);
  const current = rmsDistance(points, familyCurve(family, student));
  const period = familyKey === "sine" ? (2 * Math.PI) / Math.abs(target.b) : Number.NaN;
  const ranked: { hint: Hint; gain: number }[] = [];
  for (const p of family.params) {
    const s = student[p.name];
    const t = target[p.name];
    const diff = p.name === "h" && familyKey === "sine" ? wrapShift(s - t, period) : s - t;
    if (Math.abs(diff) <= p.slider.step * 1.5) continue;
    const fixed = rmsDistance(points, familyCurve(family, { ...student, [p.name]: t }));
    const gain = current - fixed;
    if (gain <= 0.01) continue;
    ranked.push({ hint: { id: `param-${p.name}`, text: MESSAGES[familyKey][p.name](s, t, period) }, gain });
  }
  return ranked.sort((a, b) => b.gain - a.gain).slice(0, limit).map((r) => r.hint);
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const std = (v: number[]) => {
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
};

function explicitShapeHints(points: [number, number][], f: (x: number) => number): Hint[] {
  const pairs = points.map(([x, y]) => ({ x, t: y, s: f(x) }));
  const valid = pairs.filter((p) => Number.isFinite(p.s));
  const hints: Hint[] = [];
  if (valid.length < pairs.length * 0.7) {
    hints.push({ id: "missing", text: "Your curve is missing over much of the range. Check for square roots or logs of negative numbers." });
  }
  if (valid.length < 3) return hints;

  const ts = valid.map((p) => p.t);
  const ss = valid.map((p) => p.s);
  const st = std(ts);
  const sd = std(ss);
  const errorOf = (g: (x: number) => number) =>
    Math.sqrt(mean(valid.map((p) => Math.min(CAP, Math.abs((Number.isFinite(g(p.x)) ? g(p.x) : Infinity) - p.t)) ** 2)));
  const current = errorOf(f);

  if (st > 0.1 && sd > 0.1) {
    const corr = mean(valid.map((p) => (p.t - mean(ts)) * (p.s - mean(ss)))) / (st * sd);
    if (corr < -0.5) hints.push({ id: "flip", text: "It is upside down compared with the target. Flip the sign of your expression." });
  }

  // Best horizontal shift: try f(x − d) for d in [−6, 6]
  let bestShift = 0;
  let bestError = current;
  for (let d = -6; d <= 6.0001; d += 0.1) {
    const e = errorOf((x) => f(x - d));
    if (e < bestError - 1e-9) {
      bestError = e;
      bestShift = d;
    }
  }
  if (Math.abs(bestShift) >= 0.2 && bestError < current * 0.6) {
    hints.push({ id: "shift", text: `Shift it ${bestShift > 0 ? "right" : "left"} by about ${round1(bestShift)}.` });
  }

  if (st > 0.1) {
    const ratio = sd / st;
    if (ratio > 1.25) hints.push({ id: "squash", text: `It is about ${ratio.toFixed(1)}× too tall. Squash it vertically.` });
    else if (ratio < 0.8 && ratio > 0) hints.push({ id: "stretch", text: `It is about ${(1 / ratio).toFixed(1)}× too flat. Stretch it vertically.` });
  }

  const offset = mean(valid.map((p) => p.s - p.t));
  if (Math.abs(offset) > 0.25) hints.push({ id: "offset", text: `Move it ${offset > 0 ? "down" : "up"} by about ${round1(offset)}.` });
  return hints;
}

function implicitShapeHints(family: Family, target: Params, curve: StudentCurve): Hint[] {
  if (curve.kind === "explicit") {
    return [{ id: "need-xy", text: "A circle needs an equation in both x and y, like (x − h)² + (y − k)² = r²." }];
  }
  if (family.shape !== "implicit") return [];
  const h = 1e-4;
  let dx = 0;
  let dy = 0;
  let radial = 0;
  let count = 0;
  // Each target point is pushed along −F∇F/|∇F|² onto the student's curve
  for (const [x, y] of family.points(target, 72)) {
    const F = curve.F(x, y);
    const gx = (curve.F(x + h, y) - curve.F(x - h, y)) / (2 * h);
    const gy = (curve.F(x, y + h) - curve.F(x, y - h)) / (2 * h);
    const g2 = gx * gx + gy * gy;
    if (!Number.isFinite(F) || !Number.isFinite(g2) || g2 < 1e-12) continue;
    const ux = (-F * gx) / g2;
    const uy = (-F * gy) / g2;
    if (Math.hypot(ux, uy) > 6) continue;
    const nx = x - target.h;
    const ny = y - target.k;
    const n = Math.hypot(nx, ny) || 1;
    dx += ux;
    dy += uy;
    radial += (ux * nx + uy * ny) / n;
    count += 1;
  }
  if (!count) return [{ id: "far", text: "Your curve is far from the target. Start from (x − h)² + (y − k)² = r²." }];
  dx /= count;
  dy /= count;
  radial /= count;
  const hints: Hint[] = [];
  if (Math.abs(dx) > 0.2) hints.push({ id: "move-x", text: `Move it ${dx > 0 ? "left" : "right"} by about ${round1(dx)}.` });
  if (Math.abs(dy) > 0.2) hints.push({ id: "move-y", text: `Move it ${dy > 0 ? "down" : "up"} by about ${round1(dy)}.` });
  if (Math.abs(radial) > 0.2) hints.push({ id: "radius", text: radial > 0 ? "It is too big. Shrink the radius." : "It is too small. Grow the radius." });
  return hints;
}

// Generic rules from samples when the student's curve is not in the template form
export function shapeHints(familyKey: FamilyKey, target: Params, curve: StudentCurve | null, limit = 3): Hint[] {
  const family = FAMILIES[familyKey];
  if (!curve) return [{ id: "empty", text: "Type an equation to draw your curve." }];
  const hints =
    family.shape === "implicit"
      ? implicitShapeHints(family, target, curve)
      : curve.kind === "explicit"
        ? explicitShapeHints(targetPoints(family, target), curve.f)
        : [{ id: "need-y", text: "Write this one as y = … in terms of x." }];
  return hints.slice(0, limit);
}

export interface FeedbackInput {
  family: FamilyKey;
  target: Params;
  sliders: Params | null;
  curve: StudentCurve | null;
}

export function matchFeedback({ family, target, sliders, curve }: FeedbackInput, limit = 3): Hint[] {
  if (sliders) {
    const direct = parameterHints(family, target, sliders, limit);
    if (direct.length) return direct;
  }
  return shapeHints(family, target, curve, limit);
}
