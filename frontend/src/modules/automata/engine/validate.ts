import { EPSILON, type Issue, type Machine, type PDAMachine, type TMMachine, type ValidationReport } from "./types";

class Collector {
  readonly errors: Issue[] = [];
  readonly warnings: Issue[] = [];
  error(code: string, message: string, ref: string | null = null) {
    this.errors.push({ code, message, ref });
  }
  warn(code: string, message: string, ref: string | null = null) {
    this.warnings.push({ code, message, ref });
  }
  report(): ValidationReport {
    return { valid: this.errors.length === 0, errors: this.errors, warnings: this.warnings };
  }
}

const counts = (items: string[]) => items.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());

function checkSymbols(out: Collector, symbols: string[], name: string): Set<string> {
  for (const [symbol, count] of counts(symbols)) {
    if (count > 1) out.error("DUPLICATE_SYMBOL", `'${symbol}' appears more than once in the ${name}.`);
  }
  for (const symbol of symbols) {
    if ([...symbol].length !== 1) out.error("INVALID_SYMBOL", `'${symbol}' in the ${name} must be a single character.`);
    else if (symbol === EPSILON) out.error("INVALID_SYMBOL", `ε is reserved and cannot be part of the ${name}.`);
  }
  return new Set(symbols);
}

function checkCommon(out: Collector, m: Machine): void {
  if (m.states.length === 0) out.error("NO_STATES", "The machine has no states.");
  for (const [id, count] of counts(m.states.map((s) => s.id))) {
    if (count > 1) out.error("DUPLICATE_STATE", `State id '${id}' is used ${count} times.`, id);
  }
  const known = new Set(m.states.map((s) => s.id));
  if (!m.start) out.error("MISSING_START", "No start state is set.");
  else if (!known.has(m.start)) out.error("UNKNOWN_STATE", `Start state '${m.start}' does not exist.`, m.start);
  for (const id of m.accept) {
    if (!known.has(id)) out.error("UNKNOWN_STATE", `Accept state '${id}' does not exist.`, id);
  }
  const transitions: { id: string; from: string; to: string }[] = m.transitions;
  for (const [id, count] of counts(transitions.map((t) => t.id))) {
    if (count > 1) out.error("DUPLICATE_TRANSITION", `Transition id '${id}' is used ${count} times.`, id);
  }
  for (const t of transitions) {
    for (const end of [t.from, t.to]) {
      if (!known.has(end)) out.error("UNKNOWN_STATE", `Transition ${t.id} refers to unknown state '${end}'.`, t.id);
    }
  }
}

function validatePda(out: Collector, m: PDAMachine): void {
  const alphabet = checkSymbols(out, m.alphabet, "input alphabet");
  const stack = checkSymbols(out, m.stackAlphabet, "stack alphabet");
  if (!stack.has(m.initialStack)) out.error("UNKNOWN_SYMBOL", `Initial stack symbol '${m.initialStack}' is not in the stack alphabet.`);
  if (m.acceptMode === "final" && m.accept.length === 0) out.warn("NO_ACCEPT", "Accepting by final state, but no accept states are set.");
  for (const t of m.transitions) {
    if (t.read !== EPSILON && !alphabet.has(t.read)) out.error("UNKNOWN_SYMBOL", `Transition ${t.id} reads '${t.read}', which is not in the input alphabet.`, t.id);
    if (t.pop !== EPSILON && !stack.has(t.pop)) out.error("UNKNOWN_SYMBOL", `Transition ${t.id} pops '${t.pop}', which is not in the stack alphabet.`, t.id);
    if (t.push !== EPSILON) {
      for (const symbol of t.push) {
        if (!stack.has(symbol)) out.error("UNKNOWN_SYMBOL", `Transition ${t.id} pushes '${symbol}', which is not in the stack alphabet.`, t.id);
      }
    }
  }
}

function validateTm(out: Collector, m: TMMachine): void {
  const alphabet = checkSymbols(out, m.alphabet, "input alphabet");
  const tape = checkSymbols(out, m.tapeAlphabet, "tape alphabet");
  if (!tape.has(m.blank)) out.error("UNKNOWN_SYMBOL", `Blank '${m.blank}' is not in the tape alphabet.`);
  if (alphabet.has(m.blank)) out.error("INVALID_SYMBOL", "The blank symbol cannot be part of the input alphabet.");
  for (const symbol of alphabet) {
    if (!tape.has(symbol)) out.error("UNKNOWN_SYMBOL", `Input symbol '${symbol}' is missing from the tape alphabet.`);
  }
  if (m.accept.length === 0) out.warn("NO_ACCEPT", "No accept states: the machine can only reject or loop.");
  const seen = new Map<string, string>();
  for (const t of m.transitions) {
    for (const [role, symbol] of [["reads", t.read], ["writes", t.write]] as const) {
      if (!tape.has(symbol)) out.error("UNKNOWN_SYMBOL", `Transition ${t.id} ${role} '${symbol}', which is not in the tape alphabet.`, t.id);
    }
    const key = `${t.from}\u0001${t.read}`;
    const previous = seen.get(key);
    if (previous) out.error("TM_NONDETERMINISTIC", `State '${t.from}' has two rules for '${t.read}' (${previous}, ${t.id}).`, t.id);
    seen.set(key, t.id);
    if (m.accept.includes(t.from)) out.warn("UNREACHABLE_RULE", `Transition ${t.id} leaves accept state '${t.from}'; the machine halts on entering it.`, t.id);
  }
}

export function validate(m: Machine): ValidationReport {
  const out = new Collector();
  checkCommon(out, m);

  if (m.kind === "pda") {
    validatePda(out, m);
  } else if (m.kind === "tm") {
    validateTm(out, m);
  } else {
    const alphabet = checkSymbols(out, m.alphabet, "alphabet");
    if (m.accept.length === 0) out.warn("NO_ACCEPT", "No accept states: every input will be rejected.");
    const targets = new Map<string, string[]>();
    for (const t of m.transitions) {
      if (t.read === EPSILON) {
        if (m.kind === "dfa") out.error("DFA_EPSILON", `Transition ${t.id} is an ε-move; DFAs cannot have them.`, t.id);
      } else if (!alphabet.has(t.read)) {
        out.error("UNKNOWN_SYMBOL", `Transition ${t.id} reads '${t.read}', which is not in the alphabet.`, t.id);
      }
      const key = `${t.from}\u0001${t.read}`;
      targets.set(key, [...(targets.get(key) ?? []), t.id]);
    }
    if (m.kind === "dfa") {
      for (const [key, ids] of targets) {
        const [state, symbol] = key.split("\u0001");
        if (ids.length > 1) {
          out.error("DFA_NONDETERMINISTIC", `State '${state}' has ${ids.length} transitions on '${symbol}' (${ids.join(", ")}).`, ids[0]);
        }
      }
      for (const s of m.states) {
        const missing = m.alphabet.filter((a) => !targets.has(`${s.id}\u0001${a}`));
        if (missing.length) {
          out.warn("DFA_INCOMPLETE", `State '${s.id}' has no transition on ${missing.map((x) => `'${x}'`).join(", ")}; those inputs are rejected.`, s.id);
        }
      }
    }
  }
  return out.report();
}
