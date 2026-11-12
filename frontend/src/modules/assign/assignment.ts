import type { ExperimentRecord, LabMode, MatchRecord, QuizScore } from "@/services/progressStore";

export type Task =
  | { kind: "quiz"; chapterId: string; topicId: string; title: string; pass: number }
  | { kind: "lab"; experimentId: string; mode: LabMode; title: string; pass: number }
  | { kind: "match"; challengeId: string; title: string; pass: number };

export interface Assignment {
  v: 1;
  id: string;
  title: string;
  teacher: string;
  due: string | null;
  tasks: Task[];
}

export interface TaskStatus {
  attempted: boolean;
  passed: boolean;
  score: number | null;
}

export interface ProgressView {
  quizScores: Record<string, QuizScore>;
  experiments: Record<string, ExperimentRecord>;
  matches: Record<string, MatchRecord>;
}

export interface Submission {
  assignmentId: string;
  name: string;
  scores: (number | null)[];
  at: number;
}

export type CodeCheck = { ok: true; submission: Submission } | { ok: false; reason: string };

const VERSION = 1;
const CODE_PREFIX = "MLE1";

export function taskHref(task: Task): string {
  if (task.kind === "quiz") return `/ncert/chapter/${task.chapterId}/${task.topicId}`;
  if (task.kind === "lab") return task.mode === "guided" ? `/lab/${task.experimentId}` : `/lab/${task.experimentId}?mode=${task.mode}`;
  return `/match?challenge=${encodeURIComponent(task.challengeId)}`;
}

export function newAssignmentId(random: () => number = Math.random): string {
  return Array.from({ length: 8 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(random() * 31)]).join("");
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((data.length + 3) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

// cyrb53: small, fast 53-bit string hash
export function hash53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const checksum = (payload: string, assignmentId: string) => hash53(`${assignmentId}|${payload}`, VERSION).toString(36).padStart(11, "0").slice(-8).toUpperCase();

export function encodeAssignment(a: Assignment): string {
  return toBase64Url(JSON.stringify(a));
}

const isTask = (t: unknown): t is Task => {
  if (typeof t !== "object" || t === null) return false;
  const task = t as Record<string, unknown>;
  if (typeof task.title !== "string" || typeof task.pass !== "number") return false;
  if (task.kind === "quiz") return typeof task.chapterId === "string" && typeof task.topicId === "string";
  if (task.kind === "lab") return typeof task.experimentId === "string" && ["guided", "realistic", "mystery"].includes(task.mode as string);
  if (task.kind === "match") return typeof task.challengeId === "string";
  return false;
};

export function decodeAssignment(data: string): Assignment | null {
  try {
    const a = JSON.parse(fromBase64Url(data)) as Partial<Assignment>;
    if (a.v !== VERSION || typeof a.id !== "string" || typeof a.title !== "string" || !Array.isArray(a.tasks) || !a.tasks.every(isTask)) return null;
    return { v: VERSION, id: a.id, title: a.title, teacher: typeof a.teacher === "string" ? a.teacher : "", due: typeof a.due === "string" ? a.due : null, tasks: a.tasks };
  } catch {
    return null;
  }
}

const NOT_DONE: TaskStatus = { attempted: false, passed: false, score: null };

// Only attempts made after the student opened the assignment count
export function evaluate(task: Task, progress: ProgressView, since: number): TaskStatus {
  let score: number | null = null;
  if (task.kind === "quiz") {
    const q = progress.quizScores[`${task.chapterId}/${task.topicId}`];
    if (q && q.at >= since && q.total > 0) score = Math.round((q.correct / q.total) * 100);
  } else if (task.kind === "lab") {
    const r = progress.experiments[task.experimentId];
    if (r && r.at >= since && (task.mode === "guided" || r.mode === task.mode)) {
      score = r.score ?? (r.errorPercent === null ? 100 : Math.max(0, Math.round(100 - 5 * r.errorPercent)));
    }
  } else {
    const m = progress.matches[task.challengeId];
    if (m) {
      const candidates = [m.at >= since ? m.score : null, (m.lastAt ?? m.at) >= since ? (m.lastScore ?? m.score) : null].filter((s): s is number => s !== null);
      if (candidates.length) score = Math.max(...candidates);
    }
  }
  return score === null ? NOT_DONE : { attempted: true, passed: score >= task.pass, score };
}

export function makeCode(s: Submission): string {
  const payload = toBase64Url(JSON.stringify([s.assignmentId, s.name, s.scores, Math.round(s.at / 60_000)]));
  return `${CODE_PREFIX}.${payload}.${checksum(payload, s.assignmentId)}`;
}

export function readCode(code: string, assignment: Assignment): CodeCheck {
  const parts = code.replace(/\s+/g, "").split(".");
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX) return { ok: false, reason: "Not a MAKE LEARN EASY code." };
  const [, payload, sum] = parts;
  let fields: unknown;
  try {
    fields = JSON.parse(fromBase64Url(payload));
  } catch {
    return { ok: false, reason: "The code is damaged. Ask the student to copy it again." };
  }
  if (!Array.isArray(fields) || fields.length !== 4) return { ok: false, reason: "The code is damaged." };
  const [assignmentId, name, scores, minutes] = fields as [unknown, unknown, unknown, unknown];
  if (assignmentId !== assignment.id) return { ok: false, reason: "This code is for a different assignment." };
  if (checksum(payload, assignment.id) !== sum) return { ok: false, reason: "Checksum mismatch: the code was edited or mistyped." };
  if (typeof name !== "string" || !Array.isArray(scores) || typeof minutes !== "number" || scores.length !== assignment.tasks.length) {
    return { ok: false, reason: "The code does not match this assignment's tasks." };
  }
  return { ok: true, submission: { assignmentId, name, scores: scores.map((x) => (typeof x === "number" ? x : null)), at: minutes * 60_000 } };
}
