import { describe, expect, it } from "vitest";
import { ancestors, buildGraph, layout, type MapNode, masteryOf, recommend } from "./conceptMap";

const node = (id: string, prerequisites: string[] = [], available = true, topics = ["t1", "t2"]): MapNode => ({
  id,
  grade: 11,
  number: id.charCodeAt(0),
  title: id.toUpperCase(),
  available,
  topicIds: available ? topics : [],
  prerequisites,
});

const NODES = [node("a"), node("b", ["a"]), node("c", ["b"]), node("d", ["a"]), node("x", [], false), node("e", ["x"])];
const score = (correct: number, total = 4) => ({ correct, total, at: 0 });

describe("concept map", () => {
  it("blends quiz scores and completed topics into mastery", () => {
    const m = masteryOf(node("a"), { quizScores: { "a/t1": score(4), "a/t2": score(3) }, completedTopics: {} });
    expect(m.level).toBeCloseTo(0.875);
    expect(m.status).toBe("mastered");
    const half = masteryOf(node("a"), { quizScores: {}, completedTopics: { "a/t1": 1 } });
    expect(half).toMatchObject({ status: "learning", quiz: null });
    expect(masteryOf(node("x", [], false), { quizScores: {}, completedTopics: {} }).status).toBe("unavailable");
  });

  it("places every prerequisite in an earlier column", () => {
    const graph = buildGraph(NODES);
    for (const n of NODES) for (const p of n.prerequisites) expect(graph.depth.get(p)!).toBeLessThan(graph.depth.get(n.id)!);
    expect([...ancestors(graph, "c")].sort()).toEqual(["a", "b"]);
    const { placed, width } = layout(NODES, 100, 50);
    expect(placed.get("c")!.x).toBe(200);
    expect(width).toBe(300);
  });

  it("recommends revising a weak prerequisite before anything else", () => {
    const progress = { quizScores: { "a/t1": score(1), "b/t1": score(1), "b/t2": score(1) }, completedTopics: {} };
    const mastery = new Map(NODES.map((n) => [n.id, masteryOf(n, progress)]));
    const plan = recommend(NODES, mastery);
    expect(plan[0]).toMatchObject({ kind: "revise", chapterId: "a" });
    expect(plan.map((r) => r.chapterId)).toContain("b");
  });

  it("starts chapters whose prerequisites are mastered, preferring ones that unlock more", () => {
    const progress = { quizScores: { "a/t1": score(4), "a/t2": score(4) }, completedTopics: {} };
    const mastery = new Map(NODES.map((n) => [n.id, masteryOf(n, progress)]));
    const plan = recommend(NODES, mastery);
    expect(plan[0]).toMatchObject({ kind: "start", chapterId: "b" });
    expect(plan.map((r) => r.chapterId)).toEqual(["b", "d", "e"]);
  });
});
