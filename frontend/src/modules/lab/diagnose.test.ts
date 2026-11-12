import { describe, expect, it } from "vitest";
import { applyCorrections, makeBench, newApparatus, parseLabMode } from "./bench";
import { accuracyScore, diagnose, type DiagnoseInput, gradeMystery } from "./diagnose";
import { experimentById } from "./experiments";
import type { Instrument, Row } from "./types";

const voltmeter: Instrument = { key: "voltmeter", label: "Voltmeter", unit: "V", fields: ["V"], leastCount: 0.01, maxZeroError: 0.2, analog: true, digits: 2 };
const ammeter: Instrument = { key: "ammeter", label: "Ammeter", unit: "A", fields: ["I"], leastCount: 0.005, maxZeroError: 0.02, analog: true, digits: 3 };
const graph = { x: "I", y: "V", xLabel: "I (A)", yLabel: "V (V)", fit: "origin" as const };

const ohmRows = (offset: number, currents = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]): Row[] =>
  currents.map((I, k) => ({ I, V: 10 * I + offset + (k % 2 ? 0.004 : -0.004), eye: "straight" }));

const input = (rows: Row[], patch: Partial<DiagnoseInput> = {}): DiagnoseInput => ({
  mode: "realistic",
  raw: rows,
  rows,
  instruments: [voltmeter, ammeter],
  graph,
  sweep: { field: "V", label: "voltage", min: 1, max: 6 },
  zero: { checked: { voltmeter: true, ammeter: true }, corrections: {}, actual: { voltmeter: 0, ammeter: 0 } },
  ...patch,
});

const codes = (i: DiagnoseInput) => diagnose(i).map((f) => f.code);

describe("lab diagnosis rules", () => {
  it("passes clean, well-spread readings", () => {
    expect(codes(input(ohmRows(0)))).toEqual([]);
  });

  it("flags a line that misses the origin and names the instruments", () => {
    const findings = diagnose(input(ohmRows(0.12)));
    const hit = findings.find((f) => f.code === "intercept");
    expect(hit?.message).toMatch(/misses the origin by 0\.12 V/);
    expect(hit?.message).toMatch(/voltmeter or ammeter zero/);
  });

  it("flags too few and bunched readings", () => {
    const rows = ohmRows(0, [0.2, 0.22, 0.24]);
    expect(codes(input(rows))).toEqual(expect.arrayContaining(["few-readings", "bunched"]));
  });

  it("finds a single outlier by leave-one-out residuals", () => {
    const rows = ohmRows(0);
    rows[3] = { ...rows[3], V: Number(rows[3].V) + 0.6 };
    const outliers = diagnose(input(rows)).filter((f) => f.code === "outlier");
    expect(outliers).toHaveLength(1);
    expect(outliers[0].message).toMatch(/Reading 4/);
  });

  it("checks zeros, corrections and parallax only outside guided mode", () => {
    const rows = ohmRows(0).map((r, i) => (i === 0 ? { ...r, eye: "left" } : r));
    const zero = { checked: { voltmeter: true }, corrections: { voltmeter: 0 }, actual: { voltmeter: 0.1, ammeter: 0 } };
    expect(codes(input(rows, { zero }))).toEqual(expect.arrayContaining(["zero-unchecked", "zero-mismatch", "parallax"]));
    expect(codes(input(rows, { zero, mode: "guided" }))).not.toEqual(expect.arrayContaining(["zero-unchecked"]));
  });

  it("uses the consistency field when there is no graph", () => {
    const rows: Row[] = [5, 5.02, 4.98, 5.01, 6.5, 4.99].map((X) => ({ X }));
    const found = diagnose(input(rows, { graph: undefined, sweep: undefined, consistency: "X", instruments: [] }));
    expect(found.map((f) => f.message).join()).toMatch(/Reading 5/);
  });
});

describe("mystery grading", () => {
  it("scores accuracy linearly between 1% and 20% error", () => {
    expect(accuracyScore(0.5)).toBe(100);
    expect(accuracyScore(20)).toBe(0);
    expect(accuracyScore(10.5)).toBe(50);
  });

  it("subtracts each deduction and assigns a band", () => {
    const grade = gradeMystery(0.5, diagnose(input(ohmRows(0, [0.2, 0.22, 0.24]))));
    expect(grade.deductions.length).toBeGreaterThan(0);
    expect(grade.score).toBe(100 - grade.deductions.reduce((s, d) => s + d.points, 0));
    expect(gradeMystery(0.5, []).band).toBe("A");
    expect(gradeMystery(15, []).band).toBe("E");
  });
});

describe("bench", () => {
  it("parses the lab mode from the URL", () => {
    expect(parseLabMode("mystery")).toBe("mystery");
    expect(parseLabMode("nonsense")).toBe("guided");
    expect(parseLabMode(null)).toBe("guided");
  });

  it("adds zero error and parallax, and corrections undo the zero error", () => {
    const def = experimentById.get("ohms-law")!;
    const apparatus = { ...newApparatus(def, "realistic"), zero: { voltmeter: 0.1, ammeter: 0 }, parallax: { voltmeter: 0.02, ammeter: 0.01 } };
    expect(makeBench(def, apparatus, "realistic", "straight").read("voltmeter", 2)).toBeCloseTo(2.1);
    expect(makeBench(def, apparatus, "realistic", "right").read("voltmeter", 2)).toBeCloseTo(2.12);
    expect(makeBench(def, apparatus, "realistic", "left").actual("voltmeter", 2)).toBeCloseTo(1.92);
    const row = applyCorrections({ V: 2.1, I: 0.2 }, { voltmeter: 0.1 }, def.instruments);
    expect(row.V).toBeCloseTo(2);
    expect(def.derive(row).ratio).toBeCloseTo(10);
  });

  it("guided apparatus has no zero errors", () => {
    for (const def of experimentById.values()) {
      const apparatus = newApparatus(def, "guided");
      expect(Object.values(apparatus.zero).every((z) => z === 0)).toBe(true);
    }
  });

  it("mystery pendulum is on an unknown planet", () => {
    const def = experimentById.get("simple-pendulum")!;
    const g = def.target.value(def.setup("mystery"));
    expect(g).toBeGreaterThanOrEqual(1.6);
    expect(g).toBeLessThanOrEqual(25);
  });
});
