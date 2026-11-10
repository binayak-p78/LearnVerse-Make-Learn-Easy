import { describe, expect, it } from "vitest";
import { nfaToDfa } from "./finite";
import { EXAMPLES, simulate } from "./machine";
import { Queue, Stack, Tape } from "./structures";
import type { FiniteMachine, TMMachine } from "./types";
import { validate } from "./validate";

describe("data structures", () => {
  it("stack is persistent and keyed by content", () => {
    const base = Stack.of(["Z"]);
    const pushed = base.pushAll("AB");
    expect(pushed.snapshot()).toEqual(["A", "B", "Z"]);
    const [top, rest] = pushed.pop();
    expect(top).toBe("A");
    expect(rest.snapshot()).toEqual(["B", "Z"]);
    expect(base.snapshot()).toEqual(["Z"]);
    expect(Stack.of(["A", "Z"]).key()).toBe(Stack.empty<string>().push("Z").push("A").key());
  });

  it("queue keeps FIFO order across growth", () => {
    const q = new Queue<number>([], 2);
    for (let i = 0; i < 10; i++) q.enqueue(i);
    const out: number[] = [];
    for (let v = q.dequeue(); v !== undefined; v = q.dequeue()) out.push(v);
    expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("tape is two-way infinite and sparse", () => {
    const tape = new Tape("_", "ab");
    tape.write(-3, "x");
    expect(tape.read(-3)).toBe("x");
    expect(tape.read(99)).toBe("_");
    expect(tape.content()).toBe("x__ab");
  });
});

describe("shared fixtures", () => {
  for (const { machine, cases } of EXAMPLES) {
    describe(machine.id, () => {
      it("is valid", () => {
        expect(validate(machine).errors).toEqual([]);
      });
      for (const c of cases) {
        it(`"${c.input}" → ${c.accepted ? "accept" : "reject"}`, () => {
          const result = simulate(machine, c.input);
          expect(result.accepted).toBe(c.accepted);
          if (c.output !== undefined && result.kind === "tm") expect(result.output).toBe(c.output);
        });
      }
    });
  }
});

describe("subset construction", () => {
  it("builds the 8-state DFA and preserves the language", () => {
    const example = EXAMPLES.find((e) => e.machine.id === "nfa-third-last-1")!;
    const { dfa, mapping } = nfaToDfa(example.machine as FiniteMachine);
    expect(dfa.states).toHaveLength(8);
    expect(mapping.D0).toEqual(["q0"]);
    expect(validate(dfa).valid).toBe(true);
    for (const c of example.cases) expect(simulate(dfa, c.input).accepted).toBe(c.accepted);
  });

  it("uses the ε-closure of the start state", () => {
    const nfa = EXAMPLES.find((e) => e.machine.id === "nfa-epsilon-abc")!.machine as FiniteMachine;
    expect(nfaToDfa(nfa).mapping.D0).toEqual(["q0", "q1", "q2"]);
  });
});

describe("guards", () => {
  it("flags DFA nondeterminism", () => {
    const dfa = EXAMPLES.find((e) => e.machine.id === "dfa-even-zeros")!.machine as FiniteMachine;
    const broken = { ...dfa, transitions: [...dfa.transitions, { id: "x", from: "q0", to: "q0", read: "0" }] };
    expect(validate(broken).errors.map((e) => e.code)).toContain("DFA_NONDETERMINISTIC");
  });

  it("stops a looping Turing machine", () => {
    const loop: TMMachine = {
      id: "loop", name: "loop", description: "", kind: "tm", alphabet: ["1"], tapeAlphabet: ["1", "_"], blank: "_",
      states: [{ id: "q", label: "q", x: 0, y: 0 }], start: "q", accept: [],
      transitions: [{ id: "t", from: "q", to: "q", read: "_", write: "_", move: "R" }],
    };
    const result = simulate(loop, "", 50);
    expect(result.halted).toBe(false);
    expect(result.steps).toHaveLength(51);
  });
});
