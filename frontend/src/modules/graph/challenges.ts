export type Level = "easy" | "medium" | "hard";
export type FamilyKey = "line" | "parabola" | "abs" | "sine" | "exponential" | "circle";
export type Params = Record<string, number>;

interface Range {
  min: number;
  max: number;
  step: number;
}

export interface ParamSpec {
  name: string;
  slider: Range;
  target: Range;
  neutral: number;
  nonZero?: boolean;
}

interface FamilyBase {
  key: FamilyKey;
  label: string;
  template: string;
  params: ParamSpec[];
  expression: (p: Params) => string;
}

export type Family = FamilyBase &
  (
    | { shape: "explicit"; domain: [number, number]; y: (p: Params, x: number) => number }
    | { shape: "implicit"; F: (p: Params, x: number, y: number) => number; points: (p: Params, n: number) => [number, number][] }
  );

export interface Challenge {
  id: string;
  title: string;
  level: Level;
  family: FamilyKey;
  blurb: string;
}

const spec = (name: string, slider: [number, number, number], target: [number, number, number], neutral: number, nonZero = false): ParamSpec => ({
  name,
  slider: { min: slider[0], max: slider[1], step: slider[2] },
  target: { min: target[0], max: target[1], step: target[2] },
  neutral,
  nonZero,
});

const fmt = (v: number) => String(Number(v.toFixed(2)));
const signed = (v: number) => (v === 0 ? "" : v > 0 ? ` + ${fmt(v)}` : ` − ${fmt(-v)}`);
const coef = (v: number) => (v === 1 ? "" : v === -1 ? "−" : fmt(v).replace("-", "−"));
const shifted = (name: string, h: number) => (h === 0 ? name : `(${name}${signed(-h)})`);

export const FAMILIES: Record<FamilyKey, Family> = {
  line: {
    key: "line",
    label: "Straight line",
    template: "y = m x + c",
    shape: "explicit",
    domain: [-8, 8],
    params: [spec("m", [-5, 5, 0.1], [-3, 3, 0.5], 1, true), spec("c", [-8, 8, 0.1], [-4, 4, 0.5], 0)],
    y: (p, x) => p.m * x + p.c,
    expression: (p) => `y = ${coef(p.m)}x${signed(p.c)}`,
  },
  parabola: {
    key: "parabola",
    label: "Parabola",
    template: "y = a*(x - h)^2 + k",
    shape: "explicit",
    domain: [-8, 8],
    params: [spec("a", [-3, 3, 0.05], [-2, 2, 0.25], 1, true), spec("h", [-8, 8, 0.1], [-4, 4, 0.5], 0), spec("k", [-8, 8, 0.1], [-4, 4, 0.5], 0)],
    y: (p, x) => p.a * (x - p.h) ** 2 + p.k,
    expression: (p) => `y = ${coef(p.a)}${shifted("x", p.h)}²${signed(p.k)}`,
  },
  abs: {
    key: "abs",
    label: "Absolute value",
    template: "y = a abs(x - h) + k",
    shape: "explicit",
    domain: [-8, 8],
    params: [spec("a", [-4, 4, 0.05], [-2, 2, 0.5], 1, true), spec("h", [-8, 8, 0.1], [-4, 4, 0.5], 0), spec("k", [-8, 8, 0.1], [-4, 4, 0.5], 0)],
    y: (p, x) => p.a * Math.abs(x - p.h) + p.k,
    expression: (p) => `y = ${coef(p.a)}|x${signed(-p.h)}|${signed(p.k)}`,
  },
  sine: {
    key: "sine",
    label: "Sine wave",
    template: "y = a sin(b*(x - h)) + k",
    shape: "explicit",
    domain: [-8, 8],
    params: [
      spec("a", [-5, 5, 0.1], [0.5, 3, 0.5], 1, true),
      spec("b", [0.1, 4, 0.05], [0.5, 2, 0.5], 1, true),
      spec("h", [-6, 6, 0.1], [-2, 2, 0.5], 0),
      spec("k", [-6, 6, 0.1], [-2, 2, 0.5], 0),
    ],
    y: (p, x) => p.a * Math.sin(p.b * (x - p.h)) + p.k,
    expression: (p) => `y = ${coef(p.a)}sin(${coef(p.b)}${shifted("x", p.h)})${signed(p.k)}`,
  },
  exponential: {
    key: "exponential",
    label: "Exponential",
    template: "y = a e^(b x) + k",
    shape: "explicit",
    domain: [-6, 6],
    params: [spec("a", [-4, 4, 0.05], [0.5, 2, 0.5], 1, true), spec("b", [-1.5, 1.5, 0.05], [-0.6, 0.6, 0.2], 0.5, true), spec("k", [-6, 6, 0.1], [-3, 3, 0.5], 0)],
    y: (p, x) => p.a * Math.exp(p.b * x) + p.k,
    expression: (p) => `y = ${coef(p.a)}e^(${coef(p.b)}x)${signed(p.k)}`,
  },
  circle: {
    key: "circle",
    label: "Circle",
    template: "(x - h)^2 + (y - k)^2 = r^2",
    shape: "implicit",
    params: [spec("h", [-8, 8, 0.1], [-4, 4, 0.5], 0), spec("k", [-8, 8, 0.1], [-3, 3, 0.5], 0), spec("r", [0.1, 8, 0.1], [1, 4, 0.5], 1)],
    F: (p, x, y) => (x - p.h) ** 2 + (y - p.k) ** 2 - p.r ** 2,
    points: (p, n) =>
      Array.from({ length: n }, (_, i) => {
        const angle = (2 * Math.PI * i) / n;
        return [p.h + p.r * Math.cos(angle), p.k + p.r * Math.sin(angle)];
      }),
    expression: (p) => `${shifted("x", p.h)}² + ${shifted("y", p.k)}² = ${fmt(p.r * p.r)}`,
  },
};

export const CHALLENGES: Challenge[] = [
  { id: "line-easy", title: "Line it up", level: "easy", family: "line", blurb: "Tune the slope m and intercept c." },
  { id: "parabola-easy", title: "Vertex hunt", level: "easy", family: "parabola", blurb: "Move the vertex (h, k) and set the width a." },
  { id: "abs-easy", title: "V for vertex", level: "easy", family: "abs", blurb: "Place the corner of the V and set its steepness." },
  { id: "sine-easy", title: "Ride the wave", level: "easy", family: "sine", blurb: "Amplitude a, frequency b, shift h and midline k." },
  { id: "parabola-medium", title: "Parabola, no sliders", level: "medium", family: "parabola", blurb: "The form is given. Add the sliders yourself." },
  { id: "sine-medium", title: "Wave without help", level: "medium", family: "sine", blurb: "The form is given. Add the sliders yourself." },
  { id: "exponential-medium", title: "Growth curve", level: "medium", family: "exponential", blurb: "Match the stretch, the growth rate and the asymptote." },
  { id: "circle-medium", title: "Circle back", level: "medium", family: "circle", blurb: "Find the centre (h, k) and the radius r." },
  { id: "line-hard", title: "Blank page: line", level: "hard", family: "line", blurb: "Type the whole equation yourself." },
  { id: "parabola-hard", title: "Blank page: parabola", level: "hard", family: "parabola", blurb: "Type the whole equation yourself." },
  { id: "abs-hard", title: "Blank page: V shape", level: "hard", family: "abs", blurb: "Type the whole equation yourself." },
  { id: "sine-hard", title: "Blank page: wave", level: "hard", family: "sine", blurb: "Type the whole equation yourself." },
  { id: "exponential-hard", title: "Blank page: exponential", level: "hard", family: "exponential", blurb: "Type the whole equation yourself." },
  { id: "circle-hard", title: "Blank page: circle", level: "hard", family: "circle", blurb: "Type the whole equation yourself." },
];

export const challengeById = new Map(CHALLENGES.map((c) => [c.id, c]));

// Mulberry32: small deterministic PRNG so a seed always gives the same target
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashString = (text: string) => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

export const randomSeed = () => Math.floor(Math.random() * 1_000_000);

export function makeTarget(challenge: Challenge, seed: number): Params {
  const random = mulberry32(seed ^ hashString(challenge.id));
  const params: Params = {};
  for (const p of FAMILIES[challenge.family].params) {
    const { min, max, step } = p.target;
    const count = Math.floor((max - min) / step + 1e-9) + 1;
    let value = 0;
    for (let tries = 0; tries < 20; tries++) {
      value = Number((min + step * Math.floor(random() * count)).toFixed(6));
      if (!p.nonZero || value !== 0) break;
    }
    params[p.name] = value;
  }
  return params;
}

export function startingRows(challenge: Challenge): string[] {
  const family = FAMILIES[challenge.family];
  if (challenge.level === "easy") return [family.template, ...family.params.map((p) => `${p.name} = ${p.neutral}`)];
  if (challenge.level === "medium") return [family.template];
  return [""];
}
