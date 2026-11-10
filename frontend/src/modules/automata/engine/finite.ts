import { Queue } from "./structures";
import {
  type ConvertResult,
  EPSILON,
  type FiniteMachine,
  type FiniteResult,
  type FiniteStep,
  type FiniteTransition,
  type SubsetStep,
} from "./types";

interface Edge {
  target: string;
  transitionId: string;
}

export class FiniteAutomaton {
  readonly delta = new Map<string, Map<string, Edge[]>>();
  private readonly order: Map<string, number>;
  private readonly labels: Map<string, string>;

  constructor(readonly machine: FiniteMachine) {
    this.order = new Map(machine.states.map((s, i) => [s.id, i]));
    this.labels = new Map(machine.states.map((s) => [s.id, s.label || s.id]));
    for (const t of machine.transitions) {
      const row = this.delta.get(t.from) ?? new Map<string, Edge[]>();
      const edges = row.get(t.read) ?? [];
      edges.push({ target: t.to, transitionId: t.id });
      row.set(t.read, edges);
      this.delta.set(t.from, row);
    }
  }

  sorted(states: Iterable<string>): string[] {
    return [...states].sort((a, b) => (this.order.get(a) ?? 1e9) - (this.order.get(b) ?? 1e9));
  }

  key(states: Iterable<string>): string {
    return this.sorted(states).join(",");
  }

  // ε-closure by breadth-first search
  epsilonClosure(states: Iterable<string>): { states: Set<string>; used: string[] } {
    const seen = new Set(states);
    const used: string[] = [];
    const queue = new Queue(seen);
    for (let state = queue.dequeue(); state !== undefined; state = queue.dequeue()) {
      for (const edge of this.delta.get(state)?.get(EPSILON) ?? []) {
        used.push(edge.transitionId);
        if (!seen.has(edge.target)) {
          seen.add(edge.target);
          queue.enqueue(edge.target);
        }
      }
    }
    return { states: seen, used };
  }

  move(states: Iterable<string>, symbol: string): { states: Set<string>; used: string[] } {
    const targets = new Set<string>();
    const used: string[] = [];
    for (const state of states) {
      for (const edge of this.delta.get(state)?.get(symbol) ?? []) {
        targets.add(edge.target);
        used.push(edge.transitionId);
      }
    }
    const closure = this.epsilonClosure(targets);
    return { states: closure.states, used: [...used, ...closure.used] };
  }

  simulate(word: string): FiniteResult {
    let current = this.epsilonClosure([this.machine.start]);
    const steps: FiniteStep[] = [
      { states: this.sorted(current.states), inputIndex: 0, symbol: null, transitionIds: current.used },
    ];
    const symbols = [...word];
    for (const [index, symbol] of symbols.entries()) {
      current = this.move(current.states, symbol);
      steps.push({ states: this.sorted(current.states), inputIndex: index + 1, symbol, transitionIds: current.used });
      if (current.states.size === 0) {
        return { kind: this.machine.kind, accepted: false, halted: true, reason: `No transition on '${symbol}': the machine is stuck.`, steps };
      }
    }
    const accepted = [...current.states].some((s) => this.machine.accept.includes(s));
    return {
      kind: this.machine.kind,
      accepted,
      halted: true,
      reason: accepted ? "Ended in an accepting state." : "Ended in no accepting state.",
      steps,
    };
  }

  subsetLabel(states: Iterable<string>): string {
    const list = this.sorted(states);
    return list.length ? `{${list.map((s) => this.labels.get(s) ?? s).join(",")}}` : "∅";
  }
}

export function gridLayout(count: number, spacingX = 200, spacingY = 170): [number, number][] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  return Array.from({ length: count }, (_, i) => [100 + (i % columns) * spacingX, 100 + Math.floor(i / columns) * spacingY]);
}

// NFA → DFA by subset construction over a worklist of discovered subsets
export function nfaToDfa(machine: FiniteMachine): ConvertResult {
  const fa = new FiniteAutomaton(machine);
  const start = fa.epsilonClosure([machine.start]).states;
  const names = new Map<string, { id: string; set: Set<string> }>([[fa.key(start), { id: "D0", set: start }]]);
  const queue = new Queue([start]);
  const transitions: FiniteTransition[] = [];
  const steps: SubsetStep[] = [];

  for (let current = queue.dequeue(); current !== undefined; current = queue.dequeue()) {
    const from = names.get(fa.key(current))!.id;
    for (const symbol of machine.alphabet) {
      const target = fa.move(current, symbol).states;
      const key = fa.key(target);
      const isNew = !names.has(key);
      if (isNew) {
        names.set(key, { id: `D${names.size}`, set: target });
        queue.enqueue(target);
      }
      const to = names.get(key)!.id;
      transitions.push({ id: `t${transitions.length + 1}`, from, to, read: symbol });
      steps.push({ from, symbol, to, targetSet: fa.sorted(target), isNew });
    }
  }

  const entries = [...names.values()];
  const positions = gridLayout(entries.length);
  return {
    dfa: {
      id: `${machine.id}-dfa`,
      name: `${machine.name} (DFA)`,
      description: `Subset construction of ${machine.name}.`,
      kind: "dfa",
      alphabet: [...machine.alphabet],
      states: entries.map((e, i) => ({ id: e.id, label: fa.subsetLabel(e.set), x: positions[i][0], y: positions[i][1] })),
      transitions,
      start: "D0",
      accept: entries.filter((e) => [...e.set].some((s) => machine.accept.includes(s))).map((e) => e.id),
    },
    mapping: Object.fromEntries(entries.map((e) => [e.id, fa.sorted(e.set)])),
    steps,
  };
}
