import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./storage";

export type ThemeChoice = "light" | "dark" | "system";

interface SettingsState {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "mle-settings", storage: createJSONStorage(() => safeStorage) },
  ),
);
