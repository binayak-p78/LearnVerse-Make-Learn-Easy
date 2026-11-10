import { Queue, Stack } from "./structures";
import { EPSILON, type PDAMachine, type PDAResult, type PDAStep } from "./types";

interface Config {
  state: string;
  index: number;
  stack: Stack<string>;
}

interface Rule {
  read: string;
  pop: string;
  push: string;
  target: string;
  transitionId: string;
}

const configKey = (c: Config) => `${c.state}|${c.index}|${c.stack.key()}`;

export class PushdownAutomaton {
  private readonly rules = new Map<string, Rule[]>();

  constructor(readonly machine: PDAMachine) {
    for (const t of machine.transitions) {
      const list = this.rules.get(t.from) ?? [];
      list.push({ read: t.read, pop: t.pop, push: t.push === EPSILON ? "" : t.push, target: t.to, transitionId: t.id });
      this.rules.set(t.from, list);
    }
  }

  isAccepting(config: Config, length: number): boolean {
    if (config.index !== length) return false;
    return this.machine.acceptMode === "empty" ? config.stack.isEmpty() : this.machine.accept.includes(config.state);
  }

  *successors(config: Config, word: string[]): Generator<[Config, string]> {
    const symbol = word[config.index];
    for (const rule of this.rules.get(config.state) ?? []) {
      let index = config.index;
      if (rule.read !== EPSILON) {
        if (rule.read !== symbol) continue;
        index += 1;
      }
      let stack = config.stack;
      if (rule.pop !== EPSILON) {
        if (stack.peek() !== rule.pop) continue;
        [, stack] = stack.pop();
      }
      yield [{ state: rule.target, index, stack: stack.pushAll(rule.push) }, rule.transitionId];
    }
  }

  // Breadth-first search over configurations with a visited set and a cap
  simulate(input: string, maxConfigs = 2000): PDAResult {
    const word = [...input];
    const start: Config = { state: this.machine.start, index: 0, stack: Stack.of([this.machine.initialStack]) };
    const parent = new Map<string, { config: Config; previous: string | null; transitionId: string | null }>([
      [configKey(start), { config: start, previous: null, transitionId: null }],
    ]);
    const queue = new Queue([start]);
    const stackLimit = 2 * word.length + 32;
    let best = start;
    let explored = 0;
    let acceptedAt: Config | null = null;
    let truncated = false;

    for (let config = queue.dequeue(); config !== undefined; config = queue.dequeue()) {
      explored += 1;
      if (config.index > best.index || (config.index === best.index && config.stack.size < best.stack.size)) best = config;
      if (this.isAccepting(config, word.length)) {
        acceptedAt = config;
        break;
      }
      if (explored >= maxConfigs) {
        truncated = true;
        break;
      }
      const key = configKey(config);
      for (const [next, transitionId] of this.successors(config, word)) {
        const nextKey = configKey(next);
        if (parent.has(nextKey) || next.stack.size > stackLimit) continue;
        parent.set(nextKey, { config: next, previous: key, transitionId });
        queue.enqueue(next);
      }
    }

    const steps: PDAStep[] = [];
    for (let key: string | null = configKey(acceptedAt ?? best); key !== null; ) {
      const entry: { config: Config; previous: string | null; transitionId: string | null } = parent.get(key)!;
      steps.push({ state: entry.config.state, inputIndex: entry.config.index, stack: entry.config.stack.snapshot(), transitionId: entry.transitionId });
      key = entry.previous;
    }
    steps.reverse();

    const reason = acceptedAt
      ? this.machine.acceptMode === "empty"
        ? "Input consumed with an empty stack."
        : "Input consumed in an accepting state."
      : truncated
        ? `Stopped after exploring ${explored} configurations.`
        : "Every branch got stuck before accepting.";
    return { kind: "pda", accepted: acceptedAt !== null, halted: !truncated, reason, explored, steps };
  }
}
