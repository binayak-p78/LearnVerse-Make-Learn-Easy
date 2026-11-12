export interface Route {
  to: string;
  label: string;
}

interface Rule {
  test: RegExp;
  route: (text: string, match: RegExpMatchArray) => Route;
}

const LABS: [RegExp, string, string][] = [
  [/pendulum/, "simple-pendulum", "Simple Pendulum"],
  [/ohm/, "ohms-law", "Ohm's Law"],
  [/\brc\b|capacitor|time constant/, "rc-circuit", "RC Circuit"],
  [/lens|focal/, "convex-lens", "Convex Lens"],
  [/meter bridge|metre bridge|wheatstone/, "meter-bridge", "Meter Bridge"],
  [/series|parallel/, "series-parallel", "Series and Parallel"],
];

const graph = (expression: string): Route => ({ to: `/graph?e=${encodeURIComponent(expression.trim())}`, label: "Graphing Calculator" });

// Looks like something to plot: only maths characters and either "=" or an x-term
const MATH_ONLY = /^[\dxyabcmkhrtπ\s+\-−*/^().,=|eπsincotalgqrpbf√]+$/i;
const looksPlottable = (text: string) => MATH_ONLY.test(text) && (/=/.test(text) || /x/.test(text)) && /[\d^+\-*/()=]/.test(text);

// First matching rule wins, so specific intents sit above general ones
const RULES: Rule[] = [
  { test: /^(?:plot|graph|draw|sketch)\s+(.+)$/i, route: (_, m) => graph(m[1]) },
  { test: /review|revise|flash ?cards?|spaced/i, route: () => ({ to: "/review", label: "Daily Review" }) },
  { test: /concept map|what (?:should i|to) (?:study|learn)|study next|prerequisite/i, route: () => ({ to: "/ncert/map", label: "Concept Map" }) },
  { test: /assignment|homework|teacher/i, route: () => ({ to: "/assign", label: "Assignments" }) },
  { test: /graph match|match the graph|challenge/i, route: () => ({ to: "/match", label: "Graph Match" }) },
  {
    test: /pendulum|ohm|\brc\b|capacitor|time constant|lens|focal|meter bridge|metre bridge|wheatstone|series|parallel/i,
    route: (text) => {
      const lower = text.toLowerCase();
      const [, id, title] = LABS.find(([re]) => re.test(lower))!;
      const mode = /mystery|unknown/.test(lower) ? "mystery" : /realistic|zero error|parallax/.test(lower) ? "realistic" : null;
      return { to: mode ? `/lab/${id}?mode=${mode}` : `/lab/${id}`, label: `${title} experiment` };
    },
  },
  { test: /\blab\b|experiment|practical/i, route: () => ({ to: "/lab", label: "Engineering Lab" }) },
  { test: /turing/i, route: () => ({ to: "/turing", label: "Turing Machine" }) },
  { test: /\bpda\b|pushdown|push-down/i, route: () => ({ to: "/pda", label: "PDA Simulator" }) },
  { test: /\bdfa\b|\bnfa\b|automat|finite state|regular language/i, route: () => ({ to: "/automata", label: "DFA / NFA Simulator" }) },
  { test: /projectile|trajectory|throw|launch|cannon/i, route: () => ({ to: "/projectile", label: "Projectile Motion" }) },
  { test: /riemann|tangent line|differentiate|derivative of|integrate|area under/i, route: () => ({ to: "/calculus", label: "Calculus Visualizer" }) },
];

export function routeQuery(raw: string): Route | null {
  const text = raw.trim();
  if (!text) return null;
  for (const rule of RULES) {
    const match = text.match(rule.test);
    if (match) return rule.route(text, match);
  }
  if (looksPlottable(text)) return graph(text);
  return { to: `/ncert?q=${encodeURIComponent(text)}`, label: "Search NCERT lessons" };
}
