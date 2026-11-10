import { Tape } from "./structures";
import type { TMMachine, TMResult, TMStep } from "./types";

const MOVES = { L: -1, R: 1, S: 0 } as const;

interface Rule {
  write: string;
  move: number;
  target: string;
  transitionId: string;
}

const ruleKey = (state: string, symbol: string) => `${state}\u0001${symbol}`;

export class TuringMachine {
  private readonly rules = new Map<string, Rule>();
  private readonly accept: Set<string>;

  constructor(readonly machine: TMMachine) {
    this.accept = new Set(machine.accept);
    for (const t of machine.transitions) {
      this.rules.set(ruleKey(t.from, t.read), { write: t.write, move: MOVES[t.move], target: t.to, transitionId: t.id });
    }
  }

  simulate(input: string, maxSteps = 2000): TMResult {
    const tape = new Tape(this.machine.blank, input);
    let state = this.machine.start;
    let head = 0;
    const snapshot = (transitionId: string | null): TMStep => {
      const { offset, cells } = tape.window(head);
      return { state, head, tape: cells, tapeOffset: offset, transitionId };
    };
    const steps = [snapshot(null)];
    const finish = (accepted: boolean, halted: boolean, reason: string): TMResult => ({
      kind: "tm",
      accepted,
      halted,
      reason,
      output: tape.content(),
      steps,
    });

    for (let i = 0; i < maxSteps; i++) {
      if (this.accept.has(state)) return finish(true, true, "Reached an accepting state.");
      const rule = this.rules.get(ruleKey(state, tape.read(head)));
      if (!rule) return finish(false, true, `No rule for (${state}, ${tape.read(head)}): rejected.`);
      tape.write(head, rule.write);
      head += rule.move;
      state = rule.target;
      steps.push(snapshot(rule.transitionId));
    }
    return this.accept.has(state)
      ? finish(true, true, "Reached an accepting state.")
      : finish(false, false, `Step limit of ${maxSteps} reached; the machine may loop forever.`);
  }
}
