import { describe, expect, it } from "vitest";
import { analyticSummary, type LaunchParams, sampleAt, simulate } from "./engine";

const base: LaunchParams = { speed: 20, angleDeg: 45, height: 0, gravity: 9.81, drag: 0 };

describe("projectile engine", () => {
  it("matches the textbook range and height formulas", () => {
    const s = analyticSummary(base);
    expect(s.range).toBeCloseTo((20 * 20 * Math.sin(Math.PI / 2)) / 9.81, 6);
    expect(s.maxHeight).toBeCloseTo((20 * 20 * 0.5) / (2 * 9.81), 6);
    expect(s.flightTime).toBeCloseTo((2 * 20 * Math.SQRT1_2) / 9.81, 6);
  });

  it("handles a launch from a height", () => {
    const s = analyticSummary({ ...base, angleDeg: 0, height: 20 });
    expect(s.flightTime).toBeCloseTo(Math.sqrt((2 * 20) / 9.81), 6);
    expect(s.maxHeight).toBe(20);
  });

  it("samples a drag-free path that lands on the ground", () => {
    const t = simulate(base);
    expect(t.samples.at(-1)!.position.y).toBeCloseTo(0, 6);
    expect(sampleAt(t, t.peakTime).position.y).toBeCloseTo(t.maxHeight, 2);
  });

  it("RK4 with tiny drag converges to the analytic answer", () => {
    const t = simulate({ ...base, drag: 1e-9 });
    expect(t.range).toBeCloseTo(analyticSummary(base).range, 3);
  });

  it("drag shortens the range and lowers the peak", () => {
    const free = simulate(base);
    const dragged = simulate({ ...base, drag: 0.02 });
    expect(dragged.range).toBeLessThan(free.range);
    expect(dragged.maxHeight).toBeLessThan(free.maxHeight);
    expect(dragged.samples.at(-1)!.position.y).toBe(0);
  });
});
