import { describe, expect, it } from "vitest";
import { CHALLENGES, FAMILIES, makeTarget, mulberry32, startingRows } from "./challenges";
import { familyCurve, matchFeedback, parameterHints, scoreMatch, shapeHints } from "./match";
import { buildScope, parseRow } from "./parse";
import { analyzeCurve, buildPlan, describeCurve, findRoots, frequencyFor, panFor, sampleCurve } from "./sonify";

describe("challenges", () => {
  it("has unique ids and a family for each", () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) expect(FAMILIES[c.family]).toBeDefined();
  });

  it("generates the same target from the same seed", () => {
    const c = CHALLENGES.find((x) => x.id === "sine-easy")!;
    expect(makeTarget(c, 42)).toEqual(makeTarget(c, 42));
    expect(mulberry32(7)()).toBe(mulberry32(7)());
  });

  it("keeps targets on the grid and away from zero where required", () => {
    for (const c of CHALLENGES) {
      for (let seed = 0; seed < 30; seed++) {
        const t = makeTarget(c, seed);
        for (const p of FAMILIES[c.family].params) {
          expect(t[p.name]).toBeGreaterThanOrEqual(p.target.min);
          expect(t[p.name]).toBeLessThanOrEqual(p.target.max);
          if (p.nonZero) expect(t[p.name]).not.toBe(0);
        }
      }
    }
  });

  it("templates parse in the grapher and agree with the family formula", () => {
    for (const family of Object.values(FAMILIES)) {
      const c = CHALLENGES.find((x) => x.family === family.key)!;
      const target = makeTarget(c, 3);
      const items = [family.template, ...family.params.map((p) => `${p.name} = ${target[p.name]}`)].map((t) => parseRow(t));
      const scope = buildScope(items);
      const main = items[0];
      if (family.shape === "explicit") {
        expect(main.kind).toBe("explicit");
        if (main.kind === "explicit") for (const x of [-2, 0, 1.5]) expect(main.at(x, scope)).toBeCloseTo(family.y(target, x), 9);
      } else {
        expect(main.kind).toBe("implicit");
        if (main.kind === "implicit") expect(main.at(1, 2, scope)).toBeCloseTo(family.F(target, 1, 2), 9);
      }
    }
  });

  it("gives sliders on easy, the template on medium and nothing on hard", () => {
    expect(startingRows(CHALLENGES.find((c) => c.id === "line-easy")!)).toEqual(["y = m x + c", "m = 1", "c = 0"]);
    expect(startingRows(CHALLENGES.find((c) => c.id === "parabola-medium")!)).toEqual(["y = a*(x - h)^2 + k"]);
    expect(startingRows(CHALLENGES.find((c) => c.id === "line-hard")!)).toEqual([""]);
  });
});

describe("scoring", () => {
  const sine = FAMILIES.sine;
  const target = { a: 2, b: 1, h: 0.5, k: 1 };

  it("scores an exact match 100 and a far curve near 0", () => {
    expect(scoreMatch(sine, target, [familyCurve(sine, target)]).score).toBe(100);
    expect(scoreMatch(sine, target, [{ kind: "explicit", f: () => 9 }]).score).toBe(0);
    expect(scoreMatch(sine, target, []).score).toBe(0);
  });

  it("picks the best of several student curves", () => {
    const result = scoreMatch(sine, target, [{ kind: "explicit", f: () => 9 }, familyCurve(sine, target)]);
    expect(result.best).toBe(1);
    expect(result.score).toBe(100);
  });

  it("scores a circle given as an implicit equation", () => {
    const circle = FAMILIES.circle;
    const t = { h: 1, k: -1, r: 3 };
    expect(scoreMatch(circle, t, [{ kind: "implicit", F: (x, y) => (x - 1) ** 2 + (y + 1) ** 2 - 9 }]).score).toBeGreaterThanOrEqual(99);
    const off = scoreMatch(circle, t, [{ kind: "implicit", F: (x, y) => (x - 1.5) ** 2 + (y + 1) ** 2 - 9 }]).score;
    expect(off).toBeLessThan(90);
    expect(off).toBeGreaterThan(40);
  });
});

describe("parameter hints", () => {
  it("flags a parabola that opens the wrong way first", () => {
    const hints = parameterHints("parabola", { a: 1, h: 0, k: 0 }, { a: -1, h: 0.5, k: 0 });
    expect(hints[0].text).toMatch(/opens the wrong way/);
  });

  it("describes shifts in the right direction", () => {
    const hints = parameterHints("parabola", { a: 1, h: 0, k: 0 }, { a: 1, h: 2, k: 0 });
    expect(hints).toHaveLength(1);
    expect(hints[0].text).toMatch(/too far right.*Decrease h/);
  });

  it("reads sine shifts modulo the period and spots a short period", () => {
    const period = 2 * Math.PI;
    expect(parameterHints("sine", { a: 1, b: 1, h: 0, k: 0 }, { a: 1, b: 1, h: period, k: 0 })).toHaveLength(0);
    const hints = parameterHints("sine", { a: 1, b: 1, h: 0, k: 0 }, { a: 1, b: 2, h: 0, k: 0 });
    expect(hints[0].text).toMatch(/Period too short/);
  });

  it("says nothing when the sliders match", () => {
    expect(parameterHints("line", { m: 2, c: 1 }, { m: 2, c: 1 })).toEqual([]);
  });
});

describe("shape hints", () => {
  const target = { a: 1, h: 0, k: 0 };

  it("suggests a vertical move", () => {
    const hints = shapeHints("parabola", target, { kind: "explicit", f: (x) => x * x + 2 });
    expect(hints.map((h) => h.id)).toContain("offset");
    expect(hints.find((h) => h.id === "offset")!.text).toMatch(/down by about 2/);
  });

  it("finds a horizontal shift", () => {
    const hints = shapeHints("parabola", target, { kind: "explicit", f: (x) => (x + 1.5) ** 2 });
    expect(hints.find((h) => h.id === "shift")!.text).toMatch(/right by about 1\.5/);
  });

  it("spots an upside-down curve", () => {
    const hints = shapeHints("sine", { a: 2, b: 1, h: 0, k: 0 }, { kind: "explicit", f: (x) => -2 * Math.sin(x) });
    expect(hints[0].id).toBe("flip");
  });

  it("moves and resizes a circle", () => {
    const hints = shapeHints("circle", { h: 0, k: 0, r: 2 }, { kind: "implicit", F: (x, y) => (x - 1) ** 2 + y * y - 9 });
    const ids = hints.map((h) => h.id);
    expect(ids).toContain("move-x");
    expect(hints.find((h) => h.id === "move-x")!.text).toMatch(/left/);
    expect(hints.find((h) => h.id === "radius")!.text).toMatch(/too big/);
  });

  it("prefers parameter hints when sliders are available", () => {
    const hints = matchFeedback({ family: "line", target: { m: 2, c: 0 }, sliders: { m: -2, c: 0 }, curve: null });
    expect(hints[0].text).toMatch(/wrong way/);
    expect(matchFeedback({ family: "line", target: { m: 2, c: 0 }, sliders: null, curve: null })[0].id).toBe("empty");
  });
});

describe("sonification", () => {
  it("maps height to pitch exponentially and x to pan", () => {
    expect(frequencyFor(-1, -1, 1)).toBeCloseTo(200);
    expect(frequencyFor(1, -1, 1)).toBeCloseTo(1000);
    expect(frequencyFor(0, -1, 1)).toBeCloseTo(Math.sqrt(200 * 1000));
    expect(frequencyFor(5, -1, 1)).toBeNull();
    expect(frequencyFor(Number.NaN, -1, 1)).toBeNull();
    expect(panFor(-10, -10, 10)).toBe(-1);
    expect(panFor(10, -10, 10)).toBe(1);
  });

  it("finds roots and ignores poles", () => {
    const sin = sampleCurve(Math.sin, -10, 10, 801);
    const roots = findRoots(sin);
    expect(roots).toHaveLength(7);
    expect(roots[3]).toBeCloseTo(0, 6);
    const tan = sampleCurve(Math.tan, -1.5, 1.6, 400);
    expect(findRoots(tan, 20)).toHaveLength(1);
  });

  it("describes a rising line and a wave", () => {
    const line = analyzeCurve(sampleCurve((x) => 2 * x + 1, -5, 5, 200));
    expect(line.trend).toBe("rises");
    expect(describeCurve(line, -5, 5)).toMatch(/rises from x = −5 to 5.*crosses the x-axis 1 time, near x = −0\.5/);
    const wave = analyzeCurve(sampleCurve(Math.sin, -10, 10, 400));
    expect(wave.trend).toBe("turns");
    expect(wave.turningPoints).toBe(6);
    expect(wave.max!.y).toBeCloseTo(1, 2);
  });

  it("notes undefined parts", () => {
    const a = analyzeCurve(sampleCurve(Math.sqrt, -4, 4, 100));
    expect(a.definedFraction).toBeLessThan(0.6);
    expect(describeCurve(a, -4, 4)).toMatch(/undefined over part/);
  });

  it("builds a plan with root clicks and an axis tick in time order", () => {
    const view = { xMin: -4, xMax: 4, yMin: -3, yMax: 3 };
    const plan = buildPlan(sampleCurve((x) => x * x - 1, view.xMin, view.xMax, 200), view, 4);
    expect(plan.points).toHaveLength(200);
    expect(plan.clicks.map((c) => c.kind)).toEqual(["root", "axis", "root"]);
    expect(plan.clicks[1].t).toBeCloseTo(2);
    expect(plan.points[0].freq).toBeNull();
  });
});
