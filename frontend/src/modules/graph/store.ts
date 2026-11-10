import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/services/storage";

export interface SliderBounds {
  min: number;
  max: number;
  step: number;
}

export interface Row {
  id: string;
  text: string;
  color: number;
  hidden: boolean;
  bounds?: SliderBounds;
}

export const PALETTE_SIZE = 5;

let counter = 0;
const newId = () => `r${Date.now().toString(36)}${(counter++).toString(36)}`;

export const makeRows = (texts: string[]): Row[] =>
  texts.map((text, i) => ({ id: newId(), text, color: i % PALETTE_SIZE, hidden: false }));

export const DEFAULT_ROWS = ["y = a sin(b x)", "a = 2", "b = 1", "x^2/9 + y^2/4 = 1", "(pi/2, a)"];

interface GraphState {
  rows: Row[];
  setRows: (rows: Row[]) => void;
  updateRow: (id: string, patch: Partial<Row>) => void;
  insertAfter: (id: string | null, text?: string) => string;
  removeRow: (id: string) => void;
}

export const useGraph = create<GraphState>()(
  persist(
    (set, get) => ({
      rows: makeRows(DEFAULT_ROWS),
      setRows: (rows) => set({ rows }),
      updateRow: (id, patch) => set((s) => ({ rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      insertAfter: (id, text = "") => {
        const rows = get().rows;
        const index = id === null ? rows.length - 1 : rows.findIndex((r) => r.id === id);
        const used = new Set(rows.map((r) => r.color));
        const color = [...Array(PALETTE_SIZE).keys()].find((c) => !used.has(c)) ?? rows.length % PALETTE_SIZE;
        const row: Row = { id: newId(), text, color, hidden: false };
        set({ rows: [...rows.slice(0, index + 1), row, ...rows.slice(index + 1)] });
        return row.id;
      },
      removeRow: (id) => set((s) => ({ rows: s.rows.filter((r) => r.id !== id) })),
    }),
    { name: "mle-graph", version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);
