import { useSyncExternalStore } from "react";

export const DATA_CACHE = "mle-data-v1";

export interface OfflineProgress {
  done: number;
  total: number;
  current: string;
}

export interface OfflineResult {
  saved: number;
  failed: string[];
}

interface ClassSummary {
  grade: number;
}

interface ClassDetail {
  chapters: { id: string; available: boolean }[];
}

interface LabSummary {
  id: string;
}

const apiBase: string = import.meta.env.VITE_API_URL ?? "";

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

let waiting: ServiceWorker | null = null;
const updateListeners = new Set<() => void>();
const setWaiting = (worker: ServiceWorker | null) => {
  waiting = worker;
  updateListeners.forEach((notify) => notify());
};

// True once a newer build has installed and is waiting for this tab to reload
export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (notify) => {
      updateListeners.add(notify);
      return () => updateListeners.delete(notify);
    },
    () => waiting !== null,
    () => false,
  );
}

export function applyUpdate() {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
  waiting.postMessage({ type: "SKIP_WAITING" });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
          });
        });
      })
      .catch(() => {
        // Offline support is optional; the app works without it
      });
  });
}

export const offlineSupported = () => typeof caches !== "undefined" && "serviceWorker" in navigator;

// Fetches every lesson and lab from the server and stores the responses for offline use
export async function downloadForOffline(onProgress?: (progress: OfflineProgress) => void): Promise<OfflineResult> {
  const cache = typeof caches !== "undefined" ? await caches.open(DATA_CACHE) : null;
  const result: OfflineResult = { saved: 0, failed: [] };
  let total = 2;
  let done = 0;

  const save = async <T>(path: string): Promise<T | null> => {
    onProgress?.({ done, total, current: path });
    try {
      const response = await fetch(`${apiBase}${path}`, { cache: "reload" });
      if (!response.ok) throw new Error(String(response.status));
      await cache?.put(`${apiBase}${path}`, response.clone());
      result.saved += 1;
      return (await response.json()) as T;
    } catch {
      result.failed.push(path);
      return null;
    } finally {
      done += 1;
      onProgress?.({ done, total, current: path });
    }
  };

  const [classes, labs] = await Promise.all([
    save<ClassSummary[]>("/api/content/classes"),
    save<LabSummary[]>("/api/labs"),
  ]);
  total += (classes?.length ?? 0) + (labs?.length ?? 0);
  const details = await Promise.all((classes ?? []).map((c) => save<ClassDetail>(`/api/content/classes/${c.grade}`)));
  const chapters = details.flatMap((d) => d?.chapters.filter((ch) => ch.available).map((ch) => ch.id) ?? []);
  total += chapters.length;
  await Promise.all([
    ...chapters.map((id) => save(`/api/content/chapters/${id}`)),
    ...(labs ?? []).map((lab) => save(`/api/labs/${lab.id}`)),
  ]);
  return result;
}
