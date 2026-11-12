import { describe, expect, it } from "vitest";
import { routeQuery } from "./intent";

const to = (q: string) => routeQuery(q)?.to;

describe("routeQuery", () => {
  it("sends equations to the grapher", () => {
    expect(to("y = sin x")).toBe(`/graph?e=${encodeURIComponent("y = sin x")}`);
    expect(to("x^2 + y^2 = 9")).toMatch(/^\/graph\?e=/);
    expect(to("plot the parabola y = x^2")).toBe(`/graph?e=${encodeURIComponent("the parabola y = x^2")}`);
  });

  it("opens experiments, with the requested mode", () => {
    expect(to("simple pendulum")).toBe("/lab/simple-pendulum");
    expect(to("mystery Ohm's law")).toBe("/lab/ohms-law?mode=mystery");
    expect(to("lens with parallax")).toBe("/lab/convex-lens?mode=realistic");
    expect(to("any lab")).toBe("/lab");
  });

  it("recognises modules by keyword", () => {
    expect(to("turing machine")).toBe("/turing");
    expect(to("build a DFA")).toBe("/automata");
    expect(to("projectile on the moon")).toBe("/projectile");
    expect(to("what should I study next?")).toBe("/ncert/map");
    expect(to("revise my mistakes")).toBe("/review");
    expect(to("riemann sums")).toBe("/calculus");
  });

  it("falls back to lesson search", () => {
    expect(to("conic sections")).toBe(`/ncert?q=${encodeURIComponent("conic sections")}`);
    expect(to("   ")).toBeUndefined();
  });
});
