import { describe, expect, it } from "vitest";
import { type LaunchParams, sampleAt, simulate } from "./engine";
import { areaUpTo, cumulativeArea, downsample, pickers, rangeOf, slopeAt, tangentLine } from "./motion";

const base: LaunchParams = { speed: 25, angleDeg: 50, height: 12, gravity: 9.81, drag: 0 };

describe("motion graphs calculus helpers", () => {
  it("area under v_y equals the change in height", () => {
    for (const params of [base, { ...base, drag: 0.02 }]) {
      const traj = simulate(params);
      for (const f of [0.2, 0.5, 0.83, 1]) {
        const t = traj.flightTime * f;
        const area = areaUpTo(traj.samples, t, pickers.vy);
        expect(area).toBeCloseTo(sampleAt(traj, t).position.y - params.height, 2);
      }
    }
  });

  it("area under v_x equals the horizontal distance", () => {
    const traj = simulate({ ...base, drag: 0.01 });
    const areas = cumulativeArea(traj.samples, pickers.vx);
    expect(areas[0]).toBe(0);
    expect(areas.at(-1)!).toBeCloseTo(traj.range, 2);
  });

  it("slope of position equals velocity", () => {
    for (const params of [base, { ...base, drag: 0.03 }]) {
      const traj = simulate(params);
      for (const f of [0.1, 0.4, 0.7]) {
        const t = traj.flightTime * f;
        const now = sampleAt(traj, t);
        expect(slopeAt(traj.samples, t, pickers.y)).toBeCloseTo(now.velocity.y, 1);
        expect(slopeAt(traj.samples, t, pickers.x)).toBeCloseTo(now.velocity.x, 1);
      }
    }
  });

  it("slope of v_y is −g without drag", () => {
    const traj = simulate(base);
    expect(slopeAt(traj.samples, traj.flightTime / 3, pickers.vy)).toBeCloseTo(-9.81, 3);
  });

  it("tangent line passes through the point with the given slope", () => {
    const line = tangentLine(2, 5, -3, 1);
    expect(line.from).toEqual([1, 8]);
    expect(line.to).toEqual([3, 2]);
  });

  it("downsampling keeps the end points", () => {
    const traj = simulate(base);
    const thin = downsample(traj.samples, 50);
    expect(thin).toHaveLength(50);
    expect(thin[0]).toBe(traj.samples[0]);
    expect(thin.at(-1)).toBe(traj.samples.at(-1));
  });

  it("ranges include zero and never collapse", () => {
    expect(rangeOf([3, 3, 3]).min).toBe(0);
    const flat = rangeOf([0, 0]);
    expect(flat.max).toBeGreaterThan(flat.min);
    expect(rangeOf([-4, 2]).min).toBeLessThan(-4);
  });
});
