import {
  BookOpen,
  ClipboardList,
  Crosshair,
  Network,
  Repeat,
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
    key: "match",
    path: "/match",
    title: "Graph Match",
    short: "Graph Match",
    description: "Tune a curve until it lands on the target. Practice for graph transformations.",
    icon: Crosshair,
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
    description: "Class 11–12 notes, worked examples and practice quizzes.",
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
  {
    key: "review",
    path: "/review",
    title: "Daily Review",
    short: "Review",
    description: "Spaced repetition of quiz questions, scheduled so you revise just before you forget.",
    icon: Repeat,
    group: "Learn",
  },
  {
    key: "map",
    path: "/ncert/map",
    title: "Concept Map",
    short: "Concept Map",
    description: "How the chapters build on each other, coloured by your mastery, with what to study next.",
    icon: Network,
    group: "Learn",
  },
  {
    key: "assign",
    path: "/assign",
    title: "Assignments",
    short: "Assignments",
    description: "Teachers build a task list as a link; students return a verification code.",
    icon: ClipboardList,
    group: "Learn",
  },
];

export const moduleByKey = Object.fromEntries(MODULES.map((m) => [m.key, m])) as Record<
  ModuleKey,
  ModuleInfo
>;

