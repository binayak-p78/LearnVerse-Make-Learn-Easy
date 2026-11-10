import { describe, expect, it } from "vitest";
import { contour } from "./implicit";
import { buildScope, type Item, missingParams, parseRow } from "./parse";

const kind = (text: string) => parseRow(text).kind;

describe("row classification", () => {
  it("recognises each kind of row", () => {
    expect(kind("")).toBe("empty");
    expect(kind("x^2")).toBe("explicit");
    expect(kind("y = 2x + 1")).toBe("explicit");
    expect(kind("x = y^2")).toBe("vertical");
    expect(kind("x^2 + y^2 = 9")).toBe("implicit");
    expect(kind("(1, 2)")).toBe("point");
    expect(kind("a = 3")).toBe("slider");
    expect(kind("f(x) = x^3")).toBe("function");
    expect(kind("2 + 3")).toBe("value");
    expect(kind("y < x")).toBe("error");
    expect(kind("y^2")).toBe("error");
  });

  it("finds free parameters and splits implicit products", () => {
    const item = parseRow("y = a x^2 + bx + c");
    expect(item.kind).toBe("explicit");
    expect("params" in item && [...item.params].sort()).toEqual(["a", "b", "c"]);
  });

  it("evaluates with sliders, constants and user functions", () => {
    const rows = ["a = 2", "k = a + 1", "f(x) = x^2", "y = k f(x)"];
    const items: Item[] = [];
    const fns = new Set<string>();
    for (const r of rows) {
      const item = parseRow(r, fns);
      if (item.kind === "function") fns.add(item.name);
      items.push(item);
    }
    const scope = buildScope(items);
    const curve = items[3];
    expect(curve.kind).toBe("explicit");
    if (curve.kind === "explicit") expect(curve.at(2, scope)).toBe(12);
    expect(missingParams(curve, scope)).toEqual([]);
  });

  it("reports missing sliders", () => {
    const item = parseRow("y = m x");
    expect(missingParams(item, {})).toEqual(["m"]);
  });

  it("rejects unknown functions", () => {
    expect(kind("y = foo(x)")).toBe("error");
    expect(kind("y = sinx")).toBe("error");
  });
});

describe("marching squares", () => {
  it("traces a circle of radius 3", () => {
    const toWorld = (px: number, py: number): [number, number] => [px / 20 - 5, 5 - py / 20];
    const segments = contour((x, y) => x * x + y * y - 9, 200, 200, toWorld, 4);
    expect(segments.length).toBeGreaterThan(40);
    for (const [x1, y1] of segments) {
      const [wx, wy] = toWorld(x1, y1);
      expect(Math.hypot(wx, wy)).toBeCloseTo(3, 1);
    }
  });
});
