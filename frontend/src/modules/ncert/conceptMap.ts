import type { Schemas } from "@/services/api";
import type { QuizScore } from "@/services/progressStore";

export type MapNode = Schemas["MapNode"];

export type Status = "mastered" | "learning" | "new" | "unavailable";

export interface Mastery {
  status: Status;
  // 0–1 blend of quiz accuracy and completed topics
  level: number;
  quiz: number | null;
}

export interface Recommendation {
  kind: "revise" | "continue" | "start";
  chapterId: string;
  reason: string;
}

export const MASTERED = 0.8;
const WEAK = 0.6;

export interface ProgressSnapshot {
  quizScores: Record<string, QuizScore>;
  completedTopics: Record<string, number>;
}

export function masteryOf(node: MapNode, progress: ProgressSnapshot): Mastery {
  if (!node.available || node.topicIds.length === 0) return { status: "unavailable", level: 0, quiz: null };
  let total = 0;
  let quizSum = 0;
  let quizCount = 0;
  for (const topic of node.topicIds) {
    const key = `${node.id}/${topic}`;
    const score = progress.quizScores[key];
    const ratio = score ? score.correct / score.total : null;
    if (ratio !== null) {
      quizSum += ratio;
      quizCount += 1;
    }
    // A finished quiz counts fully; a topic only marked complete counts half
    total += ratio ?? (progress.completedTopics[key] ? 0.5 : 0);
  }
  const level = total / node.topicIds.length;
  const status: Status = level >= MASTERED ? "mastered" : level > 0 ? "learning" : "new";
  return { status, level, quiz: quizCount ? quizSum / quizCount : null };
}

export interface Graph {
  byId: Map<string, MapNode>;
  children: Map<string, string[]>;
  depth: Map<string, number>;
}

export function buildGraph(nodes: MapNode[]): Graph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const n of nodes) for (const p of n.prerequisites) children.get(p)?.push(n.id);
  const depth = new Map<string, number>();
  // Longest path from a root gives the column, so every edge points rightwards
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const parents = byId.get(id)?.prerequisites ?? [];
    const d = parents.length ? 1 + Math.max(...parents.map(depthOf)) : 0;
    depth.set(id, d);
    return d;
  };
  for (const n of nodes) depthOf(n.id);
  return { byId, children, depth };
}

export function descendants(graph: Graph, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(graph.children.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...(graph.children.get(next) ?? []));
  }
  return seen;
}

export function ancestors(graph: Graph, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(graph.byId.get(id)?.prerequisites ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...(graph.byId.get(next)?.prerequisites ?? []));
  }
  return seen;
}

// Rule-based study plan: fix weak foundations first, then finish what is started, then unlock the most
export function recommend(nodes: MapNode[], mastery: Map<string, Mastery>, limit = 3): Recommendation[] {
  const graph = buildGraph(nodes);
  const m = (id: string) => mastery.get(id) ?? { status: "unavailable" as const, level: 0, quiz: null };
  const title = (id: string) => graph.byId.get(id)?.title ?? id;
  const unlocks = (id: string) => [...descendants(graph, id)].filter((d) => graph.byId.get(d)?.available).length;
  const ready = (n: MapNode) => n.prerequisites.every((p) => m(p).status === "unavailable" || m(p).status === "mastered");

  const out: Recommendation[] = [];
  const taken = new Set<string>();
  const push = (r: Recommendation) => {
    if (taken.has(r.chapterId) || out.length >= limit) return;
    taken.add(r.chapterId);
    out.push(r);
  };

  for (const n of nodes) {
    const quiz = m(n.id).quiz;
    if (quiz === null || quiz >= WEAK) continue;
    for (const p of n.prerequisites) {
      const pm = m(p);
      if (pm.status !== "unavailable" && pm.level < WEAK) {
        push({ kind: "revise", chapterId: p, reason: `Your ${title(n.id)} scores are low and it builds on ${title(p)}, which is not secure yet.` });
      }
    }
  }

  const byPriority = (a: MapNode, b: MapNode) => unlocks(b.id) - unlocks(a.id) || a.grade - b.grade || a.number - b.number;
  nodes
    .filter((n) => m(n.id).status === "learning")
    .sort((a, b) => m(b.id).level - m(a.id).level || byPriority(a, b))
    .forEach((n) => push({ kind: "continue", chapterId: n.id, reason: `${Math.round(m(n.id).level * 100)}% mastered. Finish its quizzes to reach ${MASTERED * 100}%.` }));

  nodes
    .filter((n) => m(n.id).status === "new" && ready(n))
    .sort(byPriority)
    .forEach((n) => {
      const count = unlocks(n.id);
      push({ kind: "start", chapterId: n.id, reason: count ? `Prerequisites done. It leads to ${count} more available chapter${count === 1 ? "" : "s"}.` : "All its prerequisites are done." });
    });

  return out;
}

export interface Placed {
  node: MapNode;
  x: number;
  y: number;
}

export function layout(nodes: MapNode[], colWidth: number, rowHeight: number): { placed: Map<string, Placed>; width: number; height: number } {
  const graph = buildGraph(nodes);
  const columns = new Map<number, MapNode[]>();
  for (const n of nodes) {
    const d = graph.depth.get(n.id) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), n]);
  }
  const placed = new Map<string, Placed>();
  const order = [...columns.keys()].sort((a, b) => a - b);
  for (const d of order) {
    // Sort each column by the average row of its parents to keep edges short
    const column = columns.get(d)!.sort((a, b) => {
      const avg = (n: MapNode) => {
        const ys = n.prerequisites.map((p) => placed.get(p)?.y).filter((y): y is number => y !== undefined);
        return ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : Number.POSITIVE_INFINITY;
      };
      return avg(a) - avg(b) || a.grade - b.grade || a.number - b.number;
    });
    column.forEach((node, i) => placed.set(node.id, { node, x: d * colWidth, y: i * rowHeight }));
  }
  const rows = Math.max(...[...columns.values()].map((c) => c.length));
  return { placed, width: order.length * colWidth, height: rows * rowHeight };
}
