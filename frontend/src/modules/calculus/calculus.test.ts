import { describe, expect, it } from "vitest";
import { compileExpression, differentiate } from "./expression";
import { estimateLimit, integrate, riemann } from "./numeric";

const fn = (text: string) => {
  const result = compileExpression(text);
  if (!result.ok) throw new Error(result.error);
  return result.fn;
};

describe("expression", () => {
  it("parses implicit multiplication and ln", () => {
    expect(fn("2x^2 + 3").at(2)).toBe(11);
    expect(fn("ln(e)").at(0)).toBeCloseTo(1);
  });

  it("rejects unknown names", () => {
    const result = compileExpression("y + 1");
    expect(result.ok).toBe(false);
  });

  it("differentiates symbolically", () => {
    expect(differentiate(fn("x^3")).at(2)).toBeCloseTo(12);
    expect(differentiate(fn("sin(x)")).at(0)).toBeCloseTo(1);
  });
});

describe("numeric", () => {
  const square = (x: number) => x * x;

  it("Riemann sums bracket and converge to the integral", () => {
    const left = riemann(square, 0, 3, 100, "left").sum;
    const right = riemann(square, 0, 3, 100, "right").sum;
    expect(left).toBeLessThan(9);
    expect(right).toBeGreaterThan(9);
    expect(riemann(square, 0, 3, 1000, "midpoint").sum).toBeCloseTo(9, 4);
    expect(riemann(square, 0, 3, 4, "trapezoid").strips).toHaveLength(4);
  });

  it("adaptive Simpson is accurate", () => {
    expect(integrate(Math.sin, 0, Math.PI)).toBeCloseTo(2, 9);
    expect(integrate(square, 0, 3)).toBeCloseTo(9, 9);
  });

  it("estimates limits and detects jumps", () => {
    expect(estimateLimit((x) => Math.sin(x) / x, 0).value).toBeCloseTo(1, 5);
    expect(estimateLimit((x) => Math.abs(x) / x, 0).value).toBeNull();
  });
});
