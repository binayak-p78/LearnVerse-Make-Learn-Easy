import { useEffect } from "react";
import { useLocation } from "react-router";
import { type ModuleKey, useProgress } from "@/services/progressStore";

export function useTrackVisit(title: string | undefined, module: ModuleKey) {
  const { pathname } = useLocation();
  const recordVisit = useProgress((s) => s.recordVisit);
  useEffect(() => {
    if (title) recordVisit({ path: pathname, title, module });
  }, [pathname, title, module, recordVisit]);
}
