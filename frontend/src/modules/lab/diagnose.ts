import { formatNumber } from "@/components/plot/scale";
import { linearFit, mean, originFit } from "./fit";
import type { GraphSpec, Instrument, LabMode, Row, Sweep } from "./types";

export type Severity = "warning" | "info";

export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  deduction: number;
}

export interface ZeroCheck {
  checked: Record<string, boolean>;
  corrections: Record<string, number>;
  actual: Record<string, number>;
}

export interface DiagnoseInput {
  mode: LabMode;
  raw: Row[];
  rows: Row[];
  instruments: Instrument[];
  graph?: GraphSpec;
  sweep?: Sweep;
  consistency?: string;
  zero: ZeroCheck;
}

export const GOOD_READINGS = 5;
const MIN_COVERAGE = 0.4;
const MIN_R2 = 0.98;

type Model = "origin" | "linear" | "mean";

// Two-sided 99% Student-t critical values; small samples need wide margins before calling an error
const T99 = [Number.POSITIVE_INFINITY, 63.66, 9.92, 5.84, 4.6, 4.03, 3.71, 3.5, 3.36, 3.25, 3.17];
const tCritical = (dof: number) => (dof < 1 ? Number.POSITIVE_INFINITY : (T99[dof] ?? 2.9));

const numbers = (rows: Row[], key: string) => rows.map((r) => Number(r[key]));
const nameOf = (label: string) => label.replace(/\s*\(.*\)$/, "");
const instrumentFor = (instruments: Instrument[], field: string) => instruments.find((i) => i.fields.includes(field));

function fitModel(model: Model, xs: number[], ys: number[]): ((x: number) => number) | null {
  if (model === "mean") {
    const m = mean(ys);
    return Number.isFinite(m) ? () => m : null;
  }
  const fit = model === "origin" ? originFit(xs, ys) : linearFit(xs, ys);
  return fit ? (x) => fit.slope * x + fit.intercept : null;
}

const parameterCount: Record<Model, number> = { origin: 1, linear: 2, mean: 1 };

// Extra prediction variance at x for a model fitted to xs, relative to one reading's variance
function leverage(model: Model, xs: number[], x: number): number {
  if (model === "mean") return 1 / xs.length;
  if (model === "origin") return (x * x) / xs.reduce((s, v) => s + v * v, 0);
  const mx = mean(xs);
  return 1 / xs.length + (x - mx) ** 2 / xs.reduce((s, v) => s + (v - mx) ** 2, 0);
}

function graphPoints(rows: Row[], graph: GraphSpec) {
  return rows
    .map((r) => [Number(r[graph.x]), Number(r[graph.y])] as const)
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

function fewReadings(rows: Row[]): Finding | null {
  if (rows.length >= GOOD_READINGS) return null;
  return {
    code: "few-readings",
    severity: "warning",
    message: `Only ${rows.length} reading${rows.length === 1 ? "" : "s"}. Take at least ${GOOD_READINGS} so one bad reading cannot spoil the result.`,
    deduction: 5,
  };
}

function bunched(rows: Row[], sweep: Sweep | undefined): Finding | null {
  if (!sweep || rows.length < 2 || !(sweep.max > sweep.min)) return null;
  const values = numbers(rows, sweep.field).filter(Number.isFinite);
  if (values.length < 2) return null;
  const coverage = (Math.max(...values) - Math.min(...values)) / (sweep.max - sweep.min);
  if (coverage >= MIN_COVERAGE) return null;
  return {
    code: "bunched",
    severity: "warning",
    message: `Your readings of ${sweep.label} cover only ${Math.round(coverage * 100)}% of the usable range (${formatNumber(sweep.min, 2)} to ${formatNumber(sweep.max, 2)}). Spread them out for a reliable result.`,
    deduction: 5,
  };
}

// A line that should pass through the origin but has a clear intercept points to a zero error
function missedOrigin(rows: Row[], graph: GraphSpec | undefined, instruments: Instrument[]): Finding | null {
  if (graph?.fit !== "origin") return null;
  const points = graphPoints(rows, graph);
  const n = points.length;
  if (n < 3) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const fit = linearFit(xs, ys);
  if (!fit) return null;
  const mx = mean(xs);
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const ssRes = points.reduce((s, [x, y]) => s + (y - (fit.slope * x + fit.intercept)) ** 2, 0);
  const standardError = Math.sqrt(ssRes / Math.max(1, n - 2)) * Math.sqrt(1 / n + (mx * mx) / sxx);
  const yInstrument = instrumentFor(instruments, graph.y);
  const xInstrument = instrumentFor(instruments, graph.x);
  const threshold = Math.max(2 * (yInstrument?.leastCount ?? 0), tCritical(n - 2) * standardError);
  if (Math.abs(fit.intercept) <= threshold) return null;
  const suspects = [...new Set([yInstrument, xInstrument].filter((i): i is Instrument => Boolean(i)).map((i) => i.label.toLowerCase()))];
  const unit = yInstrument?.unit ? ` ${yInstrument.unit}` : "";
  return {
    code: "intercept",
    severity: "warning",
    message: `Your ${nameOf(graph.yLabel)}–${nameOf(graph.xLabel)} line misses the origin by ${formatNumber(fit.intercept, yInstrument?.digits ?? 3)}${unit}.${
      suspects.length ? ` Check the ${suspects.join(" or ")} zero.` : " Look for a systematic error."
    }`,
    deduction: 5,
  };
}

// Leave-one-out residual test: a reading far outside the scatter of all the others
function outliers(rows: Row[], graph: GraphSpec | undefined, consistency: string | undefined, instruments: Instrument[]): Finding[] {
  let model: Model;
  let xs: number[];
  let ys: number[];
  let field: string;
  if (graph && graph.fit !== "none") {
    const points = graphPoints(rows, graph);
    model = graph.fit;
    xs = points.map(([x]) => x);
    ys = points.map(([, y]) => y);
    field = graph.y;
  } else if (consistency) {
    ys = numbers(rows, consistency).filter(Number.isFinite);
    xs = ys.map((_, i) => i);
    model = "mean";
    field = consistency;
  } else return [];

  const p = parameterCount[model];
  if (ys.length - 1 - p < 2) return [];
  const leastCount = instrumentFor(instruments, field)?.leastCount ?? 0;
  const floor = Math.max(2 * leastCount, 0.01 * Math.max(...ys.map(Math.abs)));
  const found: Finding[] = [];
  ys.forEach((y, i) => {
    const restX = xs.filter((_, j) => j !== i);
    const restY = ys.filter((_, j) => j !== i);
    const predict = fitModel(model, restX, restY);
    if (!predict) return;
    const dof = restY.length - p;
    const spread = Math.sqrt(restY.reduce((s, v, j) => s + (v - predict(restX[j])) ** 2, 0) / dof);
    const residual = y - predict(xs[i]);
    if (Math.abs(residual) > Math.max(tCritical(dof) * spread * Math.sqrt(1 + leverage(model, restX, xs[i])), floor)) {
      found.push({
        code: "outlier",
        severity: "warning",
        message: `Reading ${i + 1} is out of line with the others (off by ${formatNumber(Math.abs(residual), 3)}). Repeat it or strike it out.`,
        deduction: 3,
      });
    }
  });
  return found;
}

function lowR2(rows: Row[], graph: GraphSpec | undefined): Finding | null {
  if (!graph || graph.fit === "none") return null;
  const points = graphPoints(rows, graph);
  if (points.length < 3) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const fit = graph.fit === "origin" ? originFit(xs, ys) : linearFit(xs, ys);
  if (!fit || fit.r2 >= MIN_R2) return null;
  return {
    code: "low-r2",
    severity: "warning",
    message: `The points scatter about the best-fit line (R² = ${fit.r2.toFixed(3)}). Take each reading more carefully.`,
    deduction: 5,
  };
}

function zeroRules(mode: LabMode, instruments: Instrument[], zero: ZeroCheck): Finding[] {
  if (mode === "guided" || instruments.length === 0) return [];
  const unchecked = instruments.filter((i) => !zero.checked[i.key]);
  const found: Finding[] = [];
  if (unchecked.length) {
    found.push({
      code: "zero-unchecked",
      severity: "warning",
      message: `You did not check the zero of the ${unchecked.map((i) => i.label.toLowerCase()).join(", ")} before taking readings.`,
      deduction: 10,
    });
  }
  for (const instrument of instruments) {
    if (!zero.checked[instrument.key]) continue;
    const entered = zero.corrections[instrument.key] ?? 0;
    if (Math.abs(entered - (zero.actual[instrument.key] ?? 0)) > instrument.leastCount / 2) {
      found.push({
        code: "zero-mismatch",
        severity: "warning",
        message: `Your ${instrument.label.toLowerCase()} zero correction (${formatNumber(entered, instrument.digits)} ${instrument.unit}) does not match its zero reading seen straight on.`,
        deduction: 5,
      });
    }
  }
  return found;
}

function parallax(mode: LabMode, raw: Row[], instruments: Instrument[]): Finding | null {
  if (mode === "guided" || !instruments.some((i) => i.analog)) return null;
  const skewed = raw.filter((r) => r.eye !== undefined && r.eye !== "straight").length;
  if (!skewed) return null;
  return {
    code: "parallax",
    severity: "warning",
    message: `${skewed} reading${skewed === 1 ? " was" : "s were"} taken with your eye to the side of the pointer (parallax). Keep your eye straight in line with it.`,
    deduction: 5,
  };
}

export function diagnose(input: DiagnoseInput): Finding[] {
  const { mode, raw, rows, instruments, graph, sweep, consistency, zero } = input;
  return [
    ...zeroRules(mode, instruments, zero),
    parallax(mode, raw, instruments),
    fewReadings(rows),
    bunched(rows, sweep),
    missedOrigin(rows, graph, instruments),
    ...outliers(rows, graph, consistency, instruments),
    lowR2(rows, graph),
  ].filter((f): f is Finding => f !== null);
}

export interface Grade {
  accuracy: number;
  deductions: { message: string; points: number }[];
  score: number;
  band: "A" | "B" | "C" | "D" | "E";
}

// Full marks within 1% of the true value, falling linearly to zero at 20%
export function accuracyScore(errorPercent: number): number {
  if (!Number.isFinite(errorPercent)) return 0;
  if (errorPercent <= 1) return 100;
  if (errorPercent >= 20) return 0;
  return Math.round((100 * (20 - errorPercent)) / 19);
}

export function gradeMystery(errorPercent: number, findings: Finding[]): Grade {
  const accuracy = accuracyScore(errorPercent);
  const deductions = findings.filter((f) => f.deduction > 0).map((f) => ({ message: f.message, points: f.deduction }));
  const score = Math.max(0, accuracy - deductions.reduce((s, d) => s + d.points, 0));
  const band = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";
  return { accuracy, deductions, score, band };
}
