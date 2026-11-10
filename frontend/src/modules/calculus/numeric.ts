export type RiemannMethod = "left" | "right" | "midpoint" | "trapezoid";

export interface Strip {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface RiemannResult {
  sum: number;
  strips: Strip[];
}

type Fn = (x: number) => number;

export function riemann(f: Fn, a: number, b: number, n: number, method: RiemannMethod): RiemannResult {
  const width = (b - a) / n;
  const strips: Strip[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * width;
    const x1 = x0 + width;
    if (method === "trapezoid") {
      const y0 = f(x0);
      const y1 = f(x1);
      strips.push({ x0, x1, y0, y1 });
      sum += ((y0 + y1) / 2) * width;
      continue;
    }
    const sampleX = method === "left" ? x0 : method === "right" ? x1 : (x0 + x1) / 2;
    const y = f(sampleX);
    strips.push({ x0, x1, y0: y, y1: y });
    sum += y * width;
  }
  return { sum, strips };
}

// Adaptive Simpson's rule with Richardson correction
export function integrate(f: Fn, a: number, b: number, tolerance = 1e-10, maxDepth = 40): number {
  const simpson = (x0: number, x1: number, f0: number, fm: number, f1: number) =>
    ((x1 - x0) / 6) * (f0 + 4 * fm + f1);

  const recurse = (x0: number, x1: number, f0: number, fm: number, f1: number, whole: number, tol: number, depth: number): number => {
    const m = (x0 + x1) / 2;
    const lm = (x0 + m) / 2;
    const rm = (m + x1) / 2;
    const flm = f(lm);
    const frm = f(rm);
    const left = simpson(x0, m, f0, flm, fm);
    const right = simpson(m, x1, fm, frm, f1);
    const delta = left + right - whole;
    if (depth <= 0 || Math.abs(delta) <= 15 * tol) return left + right + delta / 15;
    return (
      recurse(x0, m, f0, flm, fm, left, tol / 2, depth - 1) +
      recurse(m, x1, fm, frm, f1, right, tol / 2, depth - 1)
    );
  };

  if (a === b) return 0;
  const f0 = f(a);
  const f1 = f(b);
  const fm = f((a + b) / 2);
  return recurse(a, b, f0, fm, f1, simpson(a, b, f0, fm, f1), tolerance, maxDepth);
}

export interface LimitRow {
  h: number;
  left: number;
  right: number;
}

export function limitTable(f: Fn, a: number, steps = 6): LimitRow[] {
  return Array.from({ length: steps }, (_, i) => {
    const h = 10 ** -(i + 1);
    return { h, left: f(a - h), right: f(a + h) };
  });
}

export function estimateLimit(f: Fn, a: number): { left: number; right: number; value: number | null } {
  const near = (side: 1 | -1) => {
    const values = [1e-4, 1e-5, 1e-6].map((h) => f(a + side * h));
    const last = values[values.length - 1];
    const stable = values.every((v) => Number.isFinite(v) && Math.abs(v - last) < 1e-3 * Math.max(1, Math.abs(last)));
    return stable ? last : Number.NaN;
  };
  const left = near(-1);
  const right = near(1);
  const agree = Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-3 * Math.max(1, Math.abs(right));
  return { left, right, value: agree ? (left + right) / 2 : null };
}
