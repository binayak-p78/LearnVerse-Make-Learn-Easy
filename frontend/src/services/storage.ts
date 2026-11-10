import type { StateStorage } from "zustand/middleware";

export const safeStorage: StateStorage = {
  getItem(name) {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      localStorage.setItem(name, value);
    } catch {
      // storage full or blocked: progress stays in memory for this session
    }
  },
  removeItem(name) {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
