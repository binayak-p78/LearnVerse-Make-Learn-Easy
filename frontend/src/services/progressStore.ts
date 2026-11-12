import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./storage";

export type ModuleKey =
  | "graph"
  | "projectile"
  | "calculus"
  | "automata"
  | "pda"
  | "turing"
  | "ncert"
  | "lab"
  | "match"
  | "review"
  | "map"
  | "assign";

export interface Visit {
  path: string;
  title: string;
  module: ModuleKey;
  at: number;
}

export interface QuizScore {
  correct: number;
  total: number;
  at: number;
}

export type LabMode = "guided" | "realistic" | "mystery";

export interface ExperimentRecord {
  title: string;
  result: string;
  errorPercent: number | null;
  mode?: LabMode;
  score?: number;
  at: number;
}

export interface MatchRecord {
  title: string;
  score: number;
  at: number;
  lastScore: number;
  lastAt: number;
}

interface ProgressState {
  visits: Record<string, Visit>;
  bookmarks: Record<string, Visit>;
  completedTopics: Record<string, number>;
  quizScores: Record<string, QuizScore>;
  experiments: Record<string, ExperimentRecord>;
  matches: Record<string, MatchRecord>;
  activeDays: string[];
  activity: Record<string, number>;
  recordVisit: (visit: Omit<Visit, "at">) => void;
  toggleBookmark: (visit: Omit<Visit, "at">) => void;
  setTopicComplete: (key: string, done: boolean) => void;
  saveQuizScore: (key: string, correct: number, total: number) => void;
  saveExperiment: (id: string, record: Omit<ExperimentRecord, "at">) => void;
  saveMatch: (id: string, title: string, score: number) => void;
  reset: () => void;
}

const MAX_VISITS = 30;

export const dayKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const markActive = (days: string[]) => {
  const today = dayKey();
  return days.at(-1) === today ? days : [...days, today].slice(-400);
};

// Marks today active and counts one more learning action for the activity chart
const bump = (s: { activeDays: string[]; activity: Record<string, number> }) => {
  const today = dayKey();
  const activity = Object.fromEntries(
    Object.entries({ ...s.activity, [today]: (s.activity[today] ?? 0) + 1 }).sort(([a], [b]) => a.localeCompare(b)).slice(-60),
  );
  return { activeDays: markActive(s.activeDays), activity };
};

const initial = {
  visits: {},
  bookmarks: {},
  completedTopics: {},
  quizScores: {},
  experiments: {},
  matches: {},
  activeDays: [],
  activity: {},
};

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      ...initial,
      recordVisit: (visit) =>
        set((s) => {
          const visits = { ...s.visits, [visit.path]: { ...visit, at: Date.now() } };
          const trimmed = Object.values(visits)
            .sort((a, b) => b.at - a.at)
            .slice(0, MAX_VISITS);
          return {
            visits: Object.fromEntries(trimmed.map((v) => [v.path, v])),
            ...bump(s),
          };
        }),
      toggleBookmark: (visit) =>
        set((s) => {
          const bookmarks = { ...s.bookmarks };
          if (bookmarks[visit.path]) delete bookmarks[visit.path];
          else bookmarks[visit.path] = { ...visit, at: Date.now() };
          return { bookmarks };
        }),
      setTopicComplete: (key, done) =>
        set((s) => {
          const completedTopics = { ...s.completedTopics };
          if (done) completedTopics[key] = Date.now();
          else delete completedTopics[key];
          return { completedTopics, ...bump(s) };
        }),
      saveQuizScore: (key, correct, total) =>
        set((s) => ({
          quizScores: { ...s.quizScores, [key]: { correct, total, at: Date.now() } },
          ...bump(s),
        })),
      saveExperiment: (id, record) =>
        set((s) => ({
          experiments: { ...s.experiments, [id]: { ...record, at: Date.now() } },
          ...bump(s),
        })),
      // Keeps the best score per challenge plus the latest attempt
      saveMatch: (id, title, score) =>
        set((s) => {
          const now = Date.now();
          const previous = s.matches[id];
          const best = previous && previous.score >= score ? { score: previous.score, at: previous.at } : { score, at: now };
          return { matches: { ...s.matches, [id]: { title, ...best, lastScore: score, lastAt: now } }, ...bump(s) };
        }),
      reset: () => set(initial),
    }),
    { name: "mle-progress", version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);

export function streak(days: string[], today = dayKey()): number {
  const set = new Set(days);
  const cursor = new Date(`${today}T12:00:00`);
  if (!set.has(today)) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (set.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export const gradeOfChapter = (chapterId: string) => Number(chapterId.match(/^c(\d+)-/)?.[1] ?? 0);
