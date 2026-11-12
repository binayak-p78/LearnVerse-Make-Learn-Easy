import { useLocation } from "react-router";

type Tint = "home" | "sim" | "automata" | "learn" | "lab";

const TINTS: [RegExp, Tint][] = [
  [/^\/(graph|match|projectile|calculus)\b/, "sim"],
  [/^\/(automata|pda|turing)\b/, "automata"],
  [/^\/lab\b/, "lab"],
  [/^\/(ncert|review|assign|assignment)\b/, "learn"],
];

export const tintFor = (pathname: string): Tint => TINTS.find(([re]) => re.test(pathname))?.[1] ?? "home";

export function Ambient() {
  const { pathname } = useLocation();
  return <div className="ambient" data-tint={tintFor(pathname)} aria-hidden />;
}
