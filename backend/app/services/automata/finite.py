from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Iterable
from dataclasses import dataclass, field

from app.schemas.automata import (
    EPSILON,
    ConvertResponse,
    FiniteMachine,
    FiniteResult,
    FiniteStep,
    FiniteTransition,
    MinimizeResponse,
    State,
    SubsetStep,
)
from app.services.automata.layout import grid_layout

TRAP = "trap"


@dataclass(frozen=True, slots=True)
class Edge:
    target: str
    transition_id: str


@dataclass
class FiniteAutomaton:
    kind: str
    alphabet: list[str]
    states: list[str]
    start: str
    accept: frozenset[str]
    labels: dict[str, str]
    delta: dict[str, dict[str, list[Edge]]] = field(default_factory=dict)

    @classmethod
    def from_machine(cls, machine: FiniteMachine) -> FiniteAutomaton:
        delta: dict[str, dict[str, list[Edge]]] = defaultdict(lambda: defaultdict(list))
        for t in machine.transitions:
            delta[t.source][t.read].append(Edge(t.target, t.id))
        return cls(
            kind=machine.kind,
            alphabet=list(machine.alphabet),
            states=[s.id for s in machine.states],
            start=machine.start,
            accept=frozenset(machine.accept),
            labels={s.id: s.label or s.id for s in machine.states},
            delta=delta,
        )

    def order(self, states: Iterable[str]) -> list[str]:
        index = {s: i for i, s in enumerate(self.states)}
        return sorted(states, key=lambda s: index.get(s, len(index)))

    # ε-closure by breadth-first search
    def epsilon_closure(self, states: Iterable[str]) -> tuple[frozenset[str], list[str]]:
        seen = set(states)
        used: list[str] = []
        queue = deque(seen)
        while queue:
            state = queue.popleft()
            for edge in self.delta.get(state, {}).get(EPSILON, ()):
                used.append(edge.transition_id)
                if edge.target not in seen:
                    seen.add(edge.target)
                    queue.append(edge.target)
        return frozenset(seen), used

    def move(self, states: Iterable[str], symbol: str) -> tuple[frozenset[str], list[str]]:
        targets: set[str] = set()
        used: list[str] = []
        for state in states:
            for edge in self.delta.get(state, {}).get(symbol, ()):
                targets.add(edge.target)
                used.append(edge.transition_id)
        closure, eps_used = self.epsilon_closure(targets)
        return closure, used + eps_used

    def simulate(self, word: str) -> FiniteResult:
        current, used = self.epsilon_closure([self.start])
        steps = [FiniteStep(states=self.order(current), input_index=0, symbol=None,
                            transition_ids=used)]
        for index, symbol in enumerate(word):
            current, used = self.move(current, symbol)
            steps.append(FiniteStep(states=self.order(current), input_index=index + 1,
                                    symbol=symbol, transition_ids=used))
            if not current:
                return FiniteResult(kind=self.kind, accepted=False, halted=True,
                                    reason=f"No transition on '{symbol}': the machine is stuck.",
                                    steps=steps)
        accepted = bool(current & self.accept)
        reason = "Ended in an accepting state." if accepted else "Ended in no accepting state."
        return FiniteResult(kind=self.kind, accepted=accepted, halted=True, reason=reason,
                            steps=steps)

    def subset_label(self, subset: frozenset[str]) -> str:
        if not subset:
            return "∅"
        return "{" + ",".join(self.labels[s] for s in self.order(subset)) + "}"


# NFA → DFA by subset construction over a worklist of discovered subsets
def nfa_to_dfa(fa: FiniteAutomaton, name: str) -> ConvertResponse:
    start, _ = fa.epsilon_closure([fa.start])
    names: dict[frozenset[str], str] = {start: "D0"}
    queue: deque[frozenset[str]] = deque([start])
    transitions: list[FiniteTransition] = []
    steps: list[SubsetStep] = []

    while queue:
        current = queue.popleft()
        for symbol in fa.alphabet:
            target, _ = fa.move(current, symbol)
            is_new = target not in names
            if is_new:
                names[target] = f"D{len(names)}"
                queue.append(target)
            transitions.append(FiniteTransition(id=f"t{len(transitions) + 1}",
                                                source=names[current], target=names[target],
                                                read=symbol))
            steps.append(SubsetStep(source=names[current], symbol=symbol, target=names[target],
                                    target_set=fa.order(target), is_new=is_new))

    ordered = sorted(names.items(), key=lambda item: int(item[1][1:]))
    positions = grid_layout(len(ordered))
    states = [State(id=sid, label=fa.subset_label(subset), x=x, y=y)
              for (subset, sid), (x, y) in zip(ordered, positions, strict=True)]
    dfa = FiniteMachine(
        id=f"{name}-dfa", name=f"{name} (DFA)", kind="dfa", alphabet=fa.alphabet,
        states=states, transitions=transitions, start="D0",
        accept=[sid for subset, sid in ordered if subset & fa.accept],
    )
    return ConvertResponse(dfa=dfa, mapping={sid: fa.order(s) for s, sid in ordered}, steps=steps)


def _total_delta(fa: FiniteAutomaton) -> tuple[dict[str, dict[str, str]], list[str], bool]:
    reachable: list[str] = []
    seen = {fa.start}
    queue = deque([fa.start])
    while queue:
        state = queue.popleft()
        reachable.append(state)
        for symbol in fa.alphabet:
            for edge in fa.delta.get(state, {}).get(symbol, ()):
                if edge.target not in seen:
                    seen.add(edge.target)
                    queue.append(edge.target)

    delta: dict[str, dict[str, str]] = {}
    added_trap = False
    for state in reachable:
        delta[state] = {}
        for symbol in fa.alphabet:
            edges = fa.delta.get(state, {}).get(symbol, ())
            if edges:
                delta[state][symbol] = edges[0].target
            else:
                delta[state][symbol] = TRAP
                added_trap = True
    if added_trap:
        delta[TRAP] = {symbol: TRAP for symbol in fa.alphabet}
        reachable.append(TRAP)
    return delta, reachable, added_trap


# Hopcroft's partition refinement
def minimize_dfa(fa: FiniteAutomaton, name: str) -> MinimizeResponse:
    delta, states, added_trap = _total_delta(fa)
    removed = [s for s in fa.states if s not in delta]
    if added_trap:
        fa.labels[TRAP] = "∅"

    inverse: dict[str, dict[str, set[str]]] = {
        symbol: defaultdict(set) for symbol in fa.alphabet
    }
    for state, row in delta.items():
        for symbol, target in row.items():
            inverse[symbol][target].add(state)

    accepting = frozenset(s for s in states if s in fa.accept)
    rejecting = frozenset(states) - accepting
    partition: set[frozenset[str]] = {block for block in (accepting, rejecting) if block}
    work: set[frozenset[str]] = set(partition)

    while work:
        splitter = work.pop()
        for symbol in fa.alphabet:
            predecessors = set().union(*(inverse[symbol][s] for s in splitter))
            for block in list(partition):
                inside = block & predecessors
                outside = block - predecessors
                if not inside or not outside:
                    continue
                partition.remove(block)
                partition.update((inside, outside))
                if block in work:
                    work.remove(block)
                    work.update((inside, outside))
                else:
                    work.add(inside if len(inside) <= len(outside) else outside)

    order = {s: i for i, s in enumerate(states)}
    blocks = sorted((sorted(b, key=order.__getitem__) for b in partition),
                    key=lambda b: (fa.start not in b, order[b[0]]))
    block_of = {s: f"m{i}" for i, block in enumerate(blocks) for s in block}
    positions = grid_layout(len(blocks))

    new_states = [
        State(id=f"m{i}", label=",".join(fa.labels.get(s, s) for s in block), x=x, y=y)
        for i, (block, (x, y)) in enumerate(zip(blocks, positions, strict=True))
    ]
    transitions = [
        FiniteTransition(id=f"t{i * len(fa.alphabet) + j + 1}", source=f"m{i}",
                         target=block_of[delta[block[0]][symbol]], read=symbol)
        for i, block in enumerate(blocks)
        for j, symbol in enumerate(fa.alphabet)
    ]
    dfa = FiniteMachine(
        id=f"{name}-min", name=f"{name} (minimal)", kind="dfa", alphabet=fa.alphabet,
        states=new_states, transitions=transitions, start=block_of[fa.start],
        accept=sorted({block_of[s] for s in accepting}, key=lambda b: int(b[1:])),
    )
    return MinimizeResponse(dfa=dfa, partitions=blocks, removed_unreachable=removed,
                            added_trap=added_trap)
