export interface LinearFit {
  slope: number;
  intercept: number;
  r2: number;
}

// Ordinary least squares y = m·x + c
export function linearFit(xs: number[], ys: number[]): LinearFit | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
}

// Least squares through the origin y = m·x
export function originFit(xs: number[], ys: number[]): LinearFit | null {
  const sxx = xs.reduce((s, x) => s + x * x, 0);
  if (xs.length < 1 || sxx === 0) return null;
  const slope = xs.reduce((s, x, i) => s + x * ys[i], 0) / sxx;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - slope * xs[i]) ** 2, 0);
  return { slope, intercept: 0, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

export const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN);

export const percentError = (measured: number, expected: number) => (Math.abs(measured - expected) / Math.abs(expected)) * 100;

// Box–Muller standard normal sample
export function gaussian(sigma = 1): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const roundTo = (value: number, step: number) => Math.round(value / step) * step;
