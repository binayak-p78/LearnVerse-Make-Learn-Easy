import { describe, expect, it } from "vitest";
import { tintFor } from "./Ambient";

describe("tintFor", () => {
  it("gives each section its own ambient palette", () => {
    expect(tintFor("/")).toBe("home");
    expect(tintFor("/match")).toBe("sim");
    expect(tintFor("/turing")).toBe("automata");
    expect(tintFor("/lab/ohms-law")).toBe("lab");
    expect(tintFor("/ncert/map")).toBe("learn");
    expect(tintFor("/assignment")).toBe("learn");
    expect(tintFor("/graphics")).toBe("home");
  });
});
