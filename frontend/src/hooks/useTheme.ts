import { useEffect, useState } from "react";
import { useSettings } from "@/services/settingsStore";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function useResolvedTheme(): "light" | "dark" {
  const choice = useSettings((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const query = media();
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return choice === "system" ? (systemDark ? "dark" : "light") : choice;
}

export function useApplyTheme() {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return theme;
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
