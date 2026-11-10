import { type ReactNode, useId, useState } from "react";
import { Link } from "react-router";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";

const W = 640;
const H = 470;
const X_MAX = 3 * Math.PI;
const BASE_Y = 125;
const AMP = 72;
const CALLOUT_X = 470;

const f = (x: number) => Math.sin(x) + 0.3 * Math.sin(2 * x + 0.6);
const df = (x: number) => Math.cos(x) + 0.6 * Math.cos(2 * x + 0.6);
const sx = (x: number) => 30 + (x / X_MAX) * (W - 60);
const sy = (y: number) => BASE_Y - y * AMP;

const CURVE = Array.from({ length: 161 }, (_, i) => {
  const x = (i / 160) * X_MAX;
  return `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(f(x)).toFixed(1)}`;
}).join(" ");

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Decorative tangent sweeping along a curve; the readout links to the calculus module
export function CurveHero({ overlay }: { overlay: ReactNode }) {
  const uid = useId().replace(/:/g, "");
  const [time, setTime] = useState(2.2);
  const [animate] = useState(() => !reducedMotion());
  useAnimationLoop(animate, (dt) => setTime((t) => t + dt));

  const x0 = 0.7 + (X_MAX - 1.4) * (0.5 - 0.5 * Math.cos(time * 0.3));
  const slope = df(x0);
  const px = sx(x0);
  const py = sy(f(x0));
  const reach = 0.95;
  const [from, to] = [-reach, reach].map((d) => ({ x: sx(x0 + d), y: sy(f(x0) + slope * d) }));

  return (
    <div className="relative">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
          <defs>
            <pattern id={`dots-${uid}`} width="7" height="7" patternUnits="userSpaceOnUse">
              <circle cx="3.5" cy="3.5" r="1.25" fill="var(--dots-strong)" />
            </pattern>
            <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="white" stopOpacity="0.55" />
              <stop offset="0.75" stopColor="white" stopOpacity="0.08" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id={`mask-${uid}`}>
              <rect width={W} height={H} fill={`url(#fade-${uid})`} />
            </mask>
          </defs>

          <path d={`${CURVE} L${sx(X_MAX)},${H} L${sx(0)},${H} Z`} fill={`url(#dots-${uid})`} mask={`url(#mask-${uid})`} />
          <line x1="20" x2={W - 20} y1={BASE_Y} y2={BASE_Y} stroke="var(--dots)" strokeDasharray="2 6" />
          <path d={CURVE} fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--salmon)" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${px + 11},${py} H${CALLOUT_X} V${H}`} fill="none" stroke="var(--muted)" strokeWidth="1.25" />
          <circle cx={px} cy={py} r="11" fill="var(--surface-2)" stroke="var(--text)" strokeWidth="1.5" />
          <circle cx={px} cy={py} r="4" fill="var(--text)" />
        </svg>

        <Link
          to="/calculus"
          className="group absolute left-1 top-[52%] max-w-[44%] rounded-2xl p-2 transition-colors hover:bg-surface/70 sm:left-2"
        >
          <span className="block text-xs font-medium text-muted">Slope of the tangent</span>
          <span className="mt-1 block text-[34px] font-normal leading-none tracking-tight tabular-nums sm:text-[44px]">
            {slope >= 0 ? "+" : "−"}
            {Math.abs(slope).toFixed(2)}
          </span>
          <span className="mt-2 block text-xs text-muted">
            f(x) = sin x + 0.3 sin(2x + 0.6) at x = {x0.toFixed(2)}
          </span>
          <span className="mt-2 inline-block text-xs font-semibold underline-offset-4 group-hover:underline">Open calculus visualizer →</span>
        </Link>
      </div>

      <div className="relative mt-4 sm:absolute sm:bottom-0 sm:right-0 sm:mt-0 sm:w-[54%]">{overlay}</div>
    </div>
  );
}
