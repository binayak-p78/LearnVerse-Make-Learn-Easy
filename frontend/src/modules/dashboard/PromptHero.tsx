import { ArrowUp, ChartSpline, Crosshair, FlaskConical, LayoutGrid, Network, Repeat } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { routeQuery } from "./intent";

const EXAMPLES = [
  "y = a sin(b x)",
  "mystery Ohm's law",
  "what should I study next?",
  "x^2/16 + y^2/9 = 1",
  "projectile on the moon",
  "conic sections",
  "build a DFA",
];

const TYPE_MS = 70;
const HOLD_MS = 1600;

// Placeholder that types example prompts, or stays still when reduced motion is on
function useTypewriter(lines: string[], active: boolean): string {
  const [state, setState] = useState({ line: 0, chars: 0, holding: false });
  useEffect(() => {
    if (!active) return;
    const { line, chars, holding } = state;
    const full = lines[line];
    const delay = holding ? HOLD_MS : TYPE_MS;
    const id = setTimeout(() => {
      if (holding) setState({ line: (line + 1) % lines.length, chars: 0, holding: false });
      else if (chars >= full.length) setState({ line, chars, holding: true });
      else setState({ line, chars: chars + 1, holding: false });
    }, delay);
    return () => clearTimeout(id);
  }, [state, lines, active]);
  return active ? lines[state.line].slice(0, state.chars) : lines[0];
}

export interface Chip {
  label: string;
  to: string;
  icon: typeof ChartSpline;
}

export function PromptHero({ reviewsDue }: { reviewsDue: number }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [motion] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const typed = useTypewriter(EXAMPLES, motion && !focused && text === "");
  const route = routeQuery(text);

  const chips: Chip[] = [
    { label: "Plot y = sin x", to: `/graph?e=${encodeURIComponent("y = sin x")}`, icon: ChartSpline },
    { label: "Mystery lab", to: "/lab/ohms-law?mode=mystery", icon: FlaskConical },
    { label: reviewsDue ? `Daily review · ${reviewsDue} due` : "Daily review", to: "/review", icon: Repeat },
    { label: "Graph match", to: "/match", icon: Crosshair },
    { label: "Concept map", to: "/ncert/map", icon: Network },
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (route) navigate(route.to);
  };

  return (
    <section aria-labelledby="hero-title" className="mesh-glow card-edge relative overflow-hidden rounded-[32px] px-4 pb-10 pt-14 shadow-card sm:px-8 sm:pb-14 sm:pt-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-surface to-transparent" aria-hidden />
      <div className="relative mx-auto max-w-3xl text-center">
        <h1 id="hero-title" className="text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[58px]">
          Learn it by{" "}
          <span className="inline-flex items-center gap-2 align-baseline">
            <span className="inline-block h-[0.8em] w-[0.8em] rotate-12 rounded-[30%] bg-gradient-to-br from-[var(--mesh-pink)] via-[var(--mesh-orange)] to-[var(--mesh-ember)] shadow-sm" aria-hidden />
            seeing it
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink/75 sm:text-base">
          Type an equation, a chapter or an experiment and the right simulator opens.
        </p>

        <form onSubmit={submit} className="mx-auto mt-8 max-w-2xl text-left">
          <div className="card-edge rounded-[24px] bg-surface-2/95 p-3 shadow-card backdrop-blur-sm sm:p-4">
            <label htmlFor="hero-prompt" className="sr-only">What do you want to learn?</label>
            <textarea
              id="hero-prompt"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (route) navigate(route.to);
                }
              }}
              placeholder={focused ? "Try y = x^2, pendulum, or limits" : `Try “${typed}”`}
              className="block w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed placeholder:text-muted focus:outline-none sm:text-base"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <Link to="/graph" className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-sm font-medium text-ink/80 hover:bg-surface">
                <LayoutGrid size={16} aria-hidden /> All tools
              </Link>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs text-muted" aria-live="polite">{route ? `Opens: ${route.label}` : ""}</span>
                <button
                  type="submit"
                  aria-label={route ? `Go to ${route.label}` : "Type something first"}
                  disabled={!route}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity hover:bg-primary-hover disabled:opacity-30"
                >
                  <ArrowUp size={18} aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </form>

        <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2" aria-label="Suggestions">
          {chips.map((c) => (
            <li key={c.label}>
              <Link to={c.to} className="card-edge inline-flex h-10 items-center gap-2 rounded-full bg-surface-2/90 px-4 text-[13px] font-medium shadow-sm backdrop-blur-sm transition-colors hover:bg-surface">
                <c.icon size={15} aria-hidden /> {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
