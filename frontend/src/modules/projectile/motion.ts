import type { Sample } from "./engine";

export type Pick = (s: Sample) => number;

export const pickers = {
  x: (s: Sample) => s.position.x,
  y: (s: Sample) => s.position.y,
  vx: (s: Sample) => s.velocity.x,
  vy: (s: Sample) => s.velocity.y,
} satisfies Record<string, Pick>;

// Evenly thins samples to at most `max` points, always keeping the first and last
export function downsample(samples: Sample[], max: number): Sample[] {
  if (samples.length <= max || max < 2) return samples;
  const step = (samples.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => samples[Math.round(i * step)]);
}

// Running trapezoid integral of `pick` over time; result[i] is the area from t₀ to tᵢ
export function cumulativeArea(samples: Sample[], pick: Pick): number[] {
  const out = new Array<number>(samples.length);
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    if (i > 0) total += ((pick(samples[i - 1]) + pick(samples[i])) / 2) * (samples[i].t - samples[i - 1].t);
    out[i] = total;
  }
  return out;
}

// Trapezoid area under `pick` from the first sample up to time t (interpolating the last strip)
export function areaUpTo(samples: Sample[], t: number, pick: Pick): number {
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (b.t <= t) {
      total += ((pick(a) + pick(b)) / 2) * (b.t - a.t);
      continue;
    }
    if (a.t < t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      const end = pick(a) + (pick(b) - pick(a)) * f;
      total += ((pick(a) + end) / 2) * (t - a.t);
    }
    break;
  }
  return total;
}

// Central-difference slope of `pick` at time t using the neighbouring samples
export function slopeAt(samples: Sample[], t: number, pick: Pick): number {
  if (samples.length < 2) return 0;
  const after = samples.findIndex((s) => s.t >= t);
  const k = after < 0 ? samples.length - 1 : after;
  const left = samples[Math.max(0, k - 1)];
  const right = samples[Math.min(samples.length - 1, k + 1)];
  return (pick(right) - pick(left)) / (right.t - left.t || 1);
}

export interface Line {
  from: [number, number];
  to: [number, number];
}

// Tangent through (t₀, value) with the given slope, spanning t₀ ± halfWidth
export function tangentLine(t0: number, value: number, slope: number, halfWidth: number): Line {
  return {
    from: [t0 - halfWidth, value - slope * halfWidth],
    to: [t0 + halfWidth, value + slope * halfWidth],
  };
}

export interface Range {
  min: number;
  max: number;
}

// Value range of a series that always includes zero, padded so flat lines still show
export function rangeOf(values: number[]): Range {
  let min = 0;
  let max = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const pad = (max - min) * 0.08 || Math.max(1, Math.abs(max)) * 0.5;
  return { min: min - (min < 0 ? pad : 0), max: max + pad };
}
