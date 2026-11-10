from collections import Counter, defaultdict

from app.schemas.automata import (
    EPSILON,
    FiniteMachine,
    Issue,
    PDAMachine,
    TMMachine,
    ValidationReport,
)


class _Collector:
    def __init__(self) -> None:
        self.errors: list[Issue] = []
        self.warnings: list[Issue] = []

    def error(self, code: str, message: str, ref: str | None = None) -> None:
        self.errors.append(Issue(code=code, message=message, ref=ref))

    def warn(self, code: str, message: str, ref: str | None = None) -> None:
        self.warnings.append(Issue(code=code, message=message, ref=ref))

    def report(self) -> ValidationReport:
        return ValidationReport(valid=not self.errors, errors=self.errors, warnings=self.warnings)


def _check_symbols(out: _Collector, symbols: list[str], name: str) -> set[str]:
    for symbol, count in Counter(symbols).items():
        if count > 1:
            out.error("DUPLICATE_SYMBOL", f"'{symbol}' appears more than once in the {name}.")
    for symbol in symbols:
        if len(symbol) != 1:
            out.error("INVALID_SYMBOL", f"'{symbol}' in the {name} must be a single character.")
        elif symbol == EPSILON:
            out.error("INVALID_SYMBOL", f"ε is reserved and cannot be part of the {name}.")
    return set(symbols)


def _check_common(out: _Collector, machine: FiniteMachine | PDAMachine | TMMachine) -> set[str]:
    if not machine.states:
        out.error("NO_STATES", "The machine has no states.")
    ids = [s.id for s in machine.states]
    for state_id, count in Counter(ids).items():
        if count > 1:
            out.error("DUPLICATE_STATE", f"State id '{state_id}' is used {count} times.", state_id)
    known = set(ids)

    if not machine.start:
        out.error("MISSING_START", "No start state is set.")
    elif machine.start not in known:
        out.error("UNKNOWN_STATE", f"Start state '{machine.start}' does not exist.", machine.start)
    for state_id in machine.accept:
        if state_id not in known:
            out.error("UNKNOWN_STATE", f"Accept state '{state_id}' does not exist.", state_id)

    transition_ids = [t.id for t in machine.transitions]
    for tid, count in Counter(transition_ids).items():
        if count > 1:
            out.error("DUPLICATE_TRANSITION", f"Transition id '{tid}' is used {count} times.", tid)
    for t in machine.transitions:
        for end in (t.source, t.target):
            if end not in known:
                out.error("UNKNOWN_STATE", f"Transition {t.id} refers to unknown state '{end}'.",
                          t.id)
    return known


def _validate_finite(out: _Collector, machine: FiniteMachine) -> None:
    alphabet = _check_symbols(out, machine.alphabet, "alphabet")
    if not machine.accept:
        out.warn("NO_ACCEPT", "No accept states: every input will be rejected.")
    targets: dict[tuple[str, str], list[str]] = defaultdict(list)
    for t in machine.transitions:
        if t.read == EPSILON:
            if machine.kind == "dfa":
                out.error("DFA_EPSILON", f"Transition {t.id} is an ε-move; DFAs cannot have them.",
                          t.id)
        elif t.read not in alphabet:
            out.error("UNKNOWN_SYMBOL", f"Transition {t.id} reads '{t.read}', which is not in the "
                      "alphabet.", t.id)
        targets[(t.source, t.read)].append(t.id)

    if machine.kind != "dfa":
        return
    for (state, symbol), tids in targets.items():
        if len(tids) > 1:
            out.error("DFA_NONDETERMINISTIC", f"State '{state}' has {len(tids)} transitions on "
                      f"'{symbol}' ({', '.join(tids)}).", tids[0])
    for state in machine.states:
        missing = [a for a in machine.alphabet if (state.id, a) not in targets]
        if missing:
            out.warn("DFA_INCOMPLETE", f"State '{state.id}' has no transition on "
                     f"{', '.join(repr(m) for m in missing)}; those inputs are rejected.", state.id)


def _validate_pda(out: _Collector, machine: PDAMachine) -> None:
    alphabet = _check_symbols(out, machine.alphabet, "input alphabet")
    stack_alphabet = _check_symbols(out, machine.stack_alphabet, "stack alphabet")
    if machine.initial_stack not in stack_alphabet:
        out.error("UNKNOWN_SYMBOL", f"Initial stack symbol '{machine.initial_stack}' is not in "
                  "the stack alphabet.")
    if machine.accept_mode == "final" and not machine.accept:
        out.warn("NO_ACCEPT", "Accepting by final state, but no accept states are set.")
    for t in machine.transitions:
        if t.read != EPSILON and t.read not in alphabet:
            out.error("UNKNOWN_SYMBOL", f"Transition {t.id} reads '{t.read}', which is not in the "
                      "input alphabet.", t.id)
        if t.pop != EPSILON and t.pop not in stack_alphabet:
            out.error("UNKNOWN_SYMBOL", f"Transition {t.id} pops '{t.pop}', which is not in the "
                      "stack alphabet.", t.id)
        if t.push != EPSILON:
            for symbol in t.push:
                if symbol not in stack_alphabet:
                    out.error("UNKNOWN_SYMBOL", f"Transition {t.id} pushes '{symbol}', which is "
                              "not in the stack alphabet.", t.id)


def _validate_tm(out: _Collector, machine: TMMachine) -> None:
    alphabet = _check_symbols(out, machine.alphabet, "input alphabet")
    tape_alphabet = _check_symbols(out, machine.tape_alphabet, "tape alphabet")
    if machine.blank not in tape_alphabet:
        out.error("UNKNOWN_SYMBOL", f"Blank '{machine.blank}' is not in the tape alphabet.")
    if machine.blank in alphabet:
        out.error("INVALID_SYMBOL", "The blank symbol cannot be part of the input alphabet.")
    for symbol in alphabet - tape_alphabet:
        out.error("UNKNOWN_SYMBOL", f"Input symbol '{symbol}' is missing from the tape alphabet.")
    if not machine.accept:
        out.warn("NO_ACCEPT", "No accept states: the machine can only reject or loop.")

    seen: dict[tuple[str, str], str] = {}
    accept = set(machine.accept)
    for t in machine.transitions:
        for role, symbol in (("reads", t.read), ("writes", t.write)):
            if symbol not in tape_alphabet:
                out.error("UNKNOWN_SYMBOL", f"Transition {t.id} {role} '{symbol}', which is not "
                          "in the tape alphabet.", t.id)
        key = (t.source, t.read)
        if key in seen:
            out.error("TM_NONDETERMINISTIC", f"State '{t.source}' has two rules for '{t.read}' "
                      f"({seen[key]}, {t.id}).", t.id)
        seen[key] = t.id
        if t.source in accept:
            out.warn("UNREACHABLE_RULE", f"Transition {t.id} leaves accept state '{t.source}'; "
                     "the machine halts on entering it.", t.id)


def validate(machine: FiniteMachine | PDAMachine | TMMachine) -> ValidationReport:
    out = _Collector()
    _check_common(out, machine)
    match machine:
        case FiniteMachine():
            _validate_finite(out, machine)
        case PDAMachine():
            _validate_pda(out, machine)
        case TMMachine():
            _validate_tm(out, machine)
    return out.report()
