import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/services/storage";
import { EXAMPLES } from "./engine/machine";
import type { Machine } from "./engine/types";

export type Workspace = "finite" | "pda" | "tm";

const firstExample = (id: string) => structuredClone(EXAMPLES.find((e) => e.machine.id === id)!.machine);

interface AutomataState {
  machines: Record<Workspace, Machine>;
  revision: Record<Workspace, number>;
  setMachine: (workspace: Workspace, machine: Machine) => void;
  // Replaces the machine and bumps the revision so the diagram refits
  loadMachine: (workspace: Workspace, machine: Machine) => void;
}

export const useAutomata = create<AutomataState>()(
  persist(
    (set) => ({
      machines: {
        finite: firstExample("dfa-even-zeros"),
        pda: firstExample("pda-anbn"),
        tm: firstExample("tm-binary-increment"),
      },
      revision: { finite: 0, pda: 0, tm: 0 },
      setMachine: (workspace, machine) => set((s) => ({ machines: { ...s.machines, [workspace]: machine } })),
      loadMachine: (workspace, machine) =>
        set((s) => ({
          machines: { ...s.machines, [workspace]: machine },
          revision: { ...s.revision, [workspace]: s.revision[workspace] + 1 },
        })),
    }),
    {
      name: "mle-automata",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ machines: s.machines }),
    },
  ),
);
