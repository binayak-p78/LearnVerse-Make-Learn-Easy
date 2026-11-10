from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass

from app.schemas.automata import EPSILON, PDAMachine, PDAResult, PDAStep
from app.services.automata.structures import Stack


@dataclass(frozen=True, slots=True)
class Config:
    state: str
    index: int
    stack: Stack


@dataclass(frozen=True, slots=True)
class Rule:
    read: str
    pop: str
    push: str
    target: str
    transition_id: str


class PushdownAutomaton:
    def __init__(self, machine: PDAMachine) -> None:
        self.start = machine.start
        self.accept = frozenset(machine.accept)
        self.mode = machine.accept_mode
        self.initial_stack = machine.initial_stack
        self.rules: dict[str, list[Rule]] = defaultdict(list)
        for t in machine.transitions:
            push = "" if t.push == EPSILON else t.push
            self.rules[t.source].append(Rule(t.read, t.pop, push, t.target, t.id))

    def is_accepting(self, config: Config, length: int) -> bool:
        if config.index != length:
            return False
        if self.mode == "empty":
            return config.stack.is_empty()
        return config.state in self.accept

    def successors(self, config: Config, word: str):
        symbol = word[config.index] if config.index < len(word) else None
        for rule in self.rules.get(config.state, ()):
            if rule.read == EPSILON:
                next_index = config.index
            elif rule.read == symbol:
                next_index = config.index + 1
            else:
                continue
            stack = config.stack
            if rule.pop != EPSILON:
                if stack.peek() != rule.pop:
                    continue
                _, stack = stack.pop()
            yield Config(rule.target, next_index, stack.push_all(rule.push)), rule.transition_id

    # Breadth-first search over configurations with a visited set and a cap
    def simulate(self, word: str, max_configs: int) -> PDAResult:
        start = Config(self.start, 0, Stack.of(self.initial_stack))
        parent: dict[Config, tuple[Config | None, str | None]] = {start: (None, None)}
        queue: deque[Config] = deque([start])
        stack_limit = 2 * len(word) + 32
        best = start
        explored = 0
        accepted_at: Config | None = None
        truncated = False

        while queue:
            config = queue.popleft()
            explored += 1
            if (config.index, -len(config.stack)) > (best.index, -len(best.stack)):
                best = config
            if self.is_accepting(config, len(word)):
                accepted_at = config
                break
            if explored >= max_configs:
                truncated = True
                break
            for successor, transition_id in self.successors(config, word):
                if successor in parent or len(successor.stack) > stack_limit:
                    continue
                parent[successor] = (config, transition_id)
                queue.append(successor)

        end = accepted_at or best
        steps: list[PDAStep] = []
        node: Config | None = end
        while node is not None:
            previous, transition_id = parent[node]
            steps.append(PDAStep(state=node.state, input_index=node.index,
                                 stack=node.stack.snapshot(), transition_id=transition_id))
            node = previous
        steps.reverse()

        if accepted_at is not None:
            reason = ("Input consumed with an empty stack." if self.mode == "empty"
                      else "Input consumed in an accepting state.")
        elif truncated:
            reason = f"Stopped after exploring {explored} configurations."
        else:
            reason = "Every branch got stuck before accepting."
        return PDAResult(kind="pda", accepted=accepted_at is not None, halted=not truncated,
                         reason=reason, explored=explored, steps=steps)
