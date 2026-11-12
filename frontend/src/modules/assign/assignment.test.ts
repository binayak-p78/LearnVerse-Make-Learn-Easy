import { describe, expect, it } from "vitest";
import { type Assignment, decodeAssignment, encodeAssignment, evaluate, makeCode, readCode, taskHref } from "./assignment";

const ASSIGNMENT: Assignment = {
  v: 1,
  id: "abc23xyz",
  title: "Week 3 · Derivatives — परीक्षा",
  teacher: "Ms. Rao",
  due: "2026-11-20",
  tasks: [
    { kind: "quiz", chapterId: "c11-limits-and-derivatives", topicId: "derivatives", title: "Derivatives quiz", pass: 60 },
    { kind: "lab", experimentId: "ohms-law", mode: "mystery", title: "Ohm's law", pass: 50 },
    { kind: "match", challengeId: "sine-easy", title: "Sine", pass: 80 },
  ],
};

const empty = { quizScores: {}, experiments: {}, matches: {} };

describe("assignments", () => {
  it("round-trips through a URL-safe link, including non-ASCII text", () => {
    const encoded = encodeAssignment(ASSIGNMENT);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeAssignment(encoded)).toEqual(ASSIGNMENT);
    expect(decodeAssignment("not-base64!")).toBeNull();
    expect(decodeAssignment(encodeAssignment({ ...ASSIGNMENT, tasks: [{ kind: "nope" } as never] }))).toBeNull();
  });

  it("links each task to its module", () => {
    expect(ASSIGNMENT.tasks.map(taskHref)).toEqual([
      "/ncert/chapter/c11-limits-and-derivatives/derivatives",
      "/lab/ohms-law?mode=mystery",
      "/match?challenge=sine-easy",
    ]);
  });

  it("counts only attempts after the assignment was opened", () => {
    const since = 1000;
    const progress = {
      quizScores: { "c11-limits-and-derivatives/derivatives": { correct: 2, total: 3, at: 2000 } },
      experiments: { "ohms-law": { title: "Ohm", result: "", errorPercent: 4, mode: "guided" as const, at: 2000 } },
      matches: { "sine-easy": { title: "Sine", score: 95, at: 500, lastScore: 82, lastAt: 3000 } },
    };
    const [quiz, lab, match] = ASSIGNMENT.tasks.map((t) => evaluate(t, progress, since));
    expect(quiz).toEqual({ attempted: true, passed: true, score: 67 });
    expect(lab.attempted).toBe(false);
    expect(match).toEqual({ attempted: true, passed: true, score: 82 });
    expect(evaluate(ASSIGNMENT.tasks[0], empty, since).attempted).toBe(false);
  });

  it("accepts a genuine code and rejects edited or foreign ones", () => {
    const code = makeCode({ assignmentId: ASSIGNMENT.id, name: "Asha", scores: [67, null, 82], at: 1_700_000_000_000 });
    const read = readCode(code, ASSIGNMENT);
    expect(read).toEqual({ ok: true, submission: { assignmentId: ASSIGNMENT.id, name: "Asha", scores: [67, null, 82], at: 1_700_000_000_000 - (1_700_000_000_000 % 60_000) } });

    const [prefix, payload, sum] = code.split(".");
    const forged = makeCode({ assignmentId: ASSIGNMENT.id, name: "Asha", scores: [100, 100, 100], at: 1_700_000_000_000 }).split(".")[1];
    expect(readCode(`${prefix}.${forged}.${sum}`, ASSIGNMENT).ok).toBe(false);
    expect(readCode(`${prefix}.${payload}.${sum.slice(0, -1)}${sum.endsWith("0") ? "1" : "0"}`, ASSIGNMENT).ok).toBe(false);
    expect(readCode(code, { ...ASSIGNMENT, id: "other123" })).toMatchObject({ ok: false, reason: expect.stringContaining("different") });
    expect(readCode("hello", ASSIGNMENT).ok).toBe(false);
    expect(readCode(` ${code.slice(0, 20)}\n${code.slice(20)} `, ASSIGNMENT).ok).toBe(true);
    // Names that encode to "-" or "_" in base64url must survive
    for (const name of ["~~~>>>", "???", "Ünïcödé ✓"]) {
      expect(readCode(makeCode({ assignmentId: ASSIGNMENT.id, name, scores: [1, 2, 3], at: 0 }), ASSIGNMENT)).toMatchObject({ ok: true, submission: { name } });
    }
  });
});
