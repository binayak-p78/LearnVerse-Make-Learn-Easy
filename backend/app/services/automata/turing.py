from __future__ import annotations

from dataclasses import dataclass

from app.schemas.automata import TMMachine, TMResult, TMStep
from app.services.automata.structures import Tape

MOVES = {"L": -1, "R": 1, "S": 0}


@dataclass(frozen=True, slots=True)
class Rule:
    write: str
    move: int
    target: str
    transition_id: str


class TuringMachine:
    def __init__(self, machine: TMMachine) -> None:
        self.start = machine.start
        self.accept = frozenset(machine.accept)
        self.blank = machine.blank
        self.rules: dict[tuple[str, str], Rule] = {
            (t.source, t.read): Rule(t.write, MOVES[t.move], t.target, t.id)
            for t in machine.transitions
        }

    def simulate(self, word: str, max_steps: int) -> TMResult:
        tape = Tape(self.blank, word)
        state, head = self.start, 0

        def snapshot(transition_id: str | None) -> TMStep:
            offset, cells = tape.window(head)
            return TMStep(state=state, head=head, tape=cells, tape_offset=offset,
                          transition_id=transition_id)

        steps = [snapshot(None)]
        for _ in range(max_steps):
            if state in self.accept:
                return TMResult(kind="tm", accepted=True, halted=True,
                                reason="Reached an accepting state.", output=tape.content(),
                                steps=steps)
            rule = self.rules.get((state, tape.read(head)))
            if rule is None:
                return TMResult(kind="tm", accepted=False, halted=True,
                                reason=f"No rule for ({state}, {tape.read(head)}): rejected.",
                                output=tape.content(), steps=steps)
            tape.write(head, rule.write)
            head += rule.move
            state = rule.target
            steps.append(snapshot(rule.transition_id))

        accepted = state in self.accept
        return TMResult(kind="tm", accepted=accepted, halted=accepted,
                        reason="Reached an accepting state." if accepted
                        else f"Step limit of {max_steps} reached; the machine may loop forever.",
                        output=tape.content(), steps=steps)
