import {
  BookOpen,
  ChartSpline,
  Cpu,
  FlaskConical,
  Layers,
  type LucideIcon,
  Rocket,
  Sigma,
  Workflow,
} from "lucide-react";
import type { ModuleKey } from "@/services/progressStore";

export interface ModuleInfo {
  key: ModuleKey;
  path: string;
  title: string;
  short: string;
  description: string;
  icon: LucideIcon;
  group: "Simulators" | "Theory of Computation" | "Learn";
}

export const MODULES: ModuleInfo[] = [
  {
    key: "graph",
    path: "/graph",
    title: "Graphing Calculator",
    short: "Graphing",
    description: "Plot equations, conics and points with live sliders, like a graphing calculator.",
    icon: ChartSpline,
    group: "Simulators",
  },
  {
    key: "projectile",
    path: "/projectile",
    title: "Projectile Motion",
    short: "Projectile",
    description: "Launch, compare trajectories and see how drag changes the path.",
    icon: Rocket,
    group: "Simulators",
  },
  {
    key: "calculus",
    path: "/calculus",
    title: "Calculus Visualizer",
    short: "Calculus",
    description: "Tangents, Riemann sums and limits, with step-by-step solutions.",
    icon: Sigma,
    group: "Simulators",
  },
  {
    key: "automata",
    path: "/automata",
    title: "DFA / NFA Simulator",
    short: "DFA / NFA",
    description: "Build finite automata, trace inputs, convert and minimize.",
    icon: Workflow,
    group: "Theory of Computation",
  },
  {
    key: "pda",
    path: "/pda",
    title: "PDA Stack Simulator",
    short: "PDA",
    description: "Pushdown automata with an animated stack and branch search.",
    icon: Layers,
    group: "Theory of Computation",
  },
  {
    key: "turing",
    path: "/turing",
    title: "Turing Machine",
    short: "Turing Machine",
    description: "An infinite tape, a moving head and a transition table.",
    icon: Cpu,
    group: "Theory of Computation",
  },
  {
    key: "ncert",
    path: "/ncert",
    title: "NCERT Mathematics",
    short: "NCERT Maths",
    description: "Class 6–12 notes, worked examples and practice quizzes.",
    icon: BookOpen,
    group: "Learn",
  },
  {
    key: "lab",
    path: "/lab",
    title: "Engineering Lab",
    short: "Engineering Lab",
    description: "Virtual physics and circuits practicals with observation tables.",
    icon: FlaskConical,
    group: "Learn",
  },
];

export const moduleByKey = Object.fromEntries(MODULES.map((m) => [m.key, m])) as Record<
  ModuleKey,
  ModuleInfo
>;

