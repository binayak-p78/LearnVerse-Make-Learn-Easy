import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/services/storage";
import type { Assignment } from "./assignment";

export interface Stored {
  assignment: Assignment;
  at: number;
}

interface AssignState {
  created: Record<string, Stored>;
  received: Record<string, Stored>;
  studentName: string;
  saveCreated: (a: Assignment) => void;
  removeCreated: (id: string) => void;
  // First open fixes the start time; later opens keep it
  receive: (a: Assignment) => number;
  removeReceived: (id: string) => void;
  setStudentName: (name: string) => void;
}

export const useAssignments = create<AssignState>()(
  persist(
    (set, get) => ({
      created: {},
      received: {},
      studentName: "",
      saveCreated: (a) => set((s) => ({ created: { ...s.created, [a.id]: { assignment: a, at: s.created[a.id]?.at ?? Date.now() } } })),
      removeCreated: (id) =>
        set((s) => {
          const created = { ...s.created };
          delete created[id];
          return { created };
        }),
      receive: (a) => {
        const existing = get().received[a.id];
        if (existing) return existing.at;
        const at = Date.now();
        set((s) => ({ received: { ...s.received, [a.id]: { assignment: a, at } } }));
        return at;
      },
      removeReceived: (id) =>
        set((s) => {
          const received = { ...s.received };
          delete received[id];
          return { received };
        }),
      setStudentName: (studentName) => set({ studentName }),
    }),
    { name: "mle-assignments", version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);

export const assignmentUrl = (encoded: string) => `${window.location.origin}/assignment#${encoded}`;
