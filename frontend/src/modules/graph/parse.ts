import { type MathNode, parse } from "mathjs";

export const BUILTIN_FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "exp", "log", "sqrt", "abs", "floor", "ceil", "sign", "min", "max",
]);
const CONSTANTS = new Set(["pi", "e"]);
const RESERVED = new Set(["x", "y", ...CONSTANTS]);

export type Scope = Record<string, number | ((...args: number[]) => number)>;

interface Compiled {
  evaluate: (scope: Scope) => number;
  params: string[];
}

export type Item =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "explicit"; params: string[]; at: (x: number, scope: Scope) => number }
  | { kind: "vertical"; params: string[]; at: (y: number, scope: Scope) => number }
  | { kind: "implicit"; params: string[]; at: (x: number, y: number, scope: Scope) => number }
  | { kind: "point"; params: string[]; at: (scope: Scope) => [number, number] }
  | { kind: "slider"; name: string; value: number }
  | { kind: "constant"; name: string; params: string[]; value: (scope: Scope) => number }
  | { kind: "function"; name: string; variable: string; params: string[]; at: (t: number, scope: Scope) => number; plotted: boolean }
  | { kind: "value"; params: string[]; value: (scope: Scope) => number };

const normalize = (text: string) =>
  text
    .replace(/\bln\s*\(/g, "log(")
    .replace(/\barc(sin|cos|tan)\b/g, "a$1")
    .replace(/\*\*/g, "^")
    .replace(/π/g, "pi")
    .replace(/·|×/g, "*")
    .replace(/−/g, "-");

// Splits letter runs like "xy" or "ax" into implicit products, keeping known names intact
function splitLetters(text: string, functions: Set<string>): string {
  return text.replace(/[A-Za-z]+(?:_[A-Za-z0-9]+)?/g, (word) => {
    if (word.includes("_") || functions.has(word) || CONSTANTS.has(word) || word.length === 1) return word;
    const fn = [...functions].find((f) => word.startsWith(f));
    if (fn) throw new Error(`Write ${fn}(…) with brackets.`);
    return word.split("").join(" ");
  });
}

function freeSymbols(node: MathNode, functions: Set<string>): string[] {
  const called = new Set<string>();
  node.traverse((n) => {
    if ("isFunctionNode" in n && n.isFunctionNode) called.add((n as unknown as { fn: { name: string } }).fn.name);
  });
  const names = new Set<string>();
  node.traverse((n) => {
    if (!("isSymbolNode" in n && n.isSymbolNode)) return;
    const name = (n as unknown as { name: string }).name;
    if (called.has(name)) {
      if (!functions.has(name)) throw new Error(`Unknown function “${name}”.`);
      return;
    }
    names.add(name);
  });
  return [...names];
}

function compile(text: string, functions: Set<string>, bound: string[]): Compiled {
  const node = parse(splitLetters(normalize(text), functions));
  if (node.filter((n) => Boolean((n as { isAssignmentNode?: boolean }).isAssignmentNode)).length) {
    throw new Error("Use a single “=” per expression.");
  }
  const symbols = freeSymbols(node, functions);
  const params = symbols.filter((s) => !RESERVED.has(s) && !bound.includes(s));
  const code = node.compile();
  return {
    params,
    evaluate: (scope) => {
      try {
        const value = code.evaluate({ ...scope });
        return typeof value === "number" ? value : Number.NaN;
      } catch {
        return Number.NaN;
      }
    },
  };
}

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts;
}

const uses = (c: Compiled, text: string, symbol: string) => new RegExp(`(^|[^A-Za-z])${symbol}([^A-Za-z(]|$)`).test(text) || c.params.includes(symbol);

export function userFunctionName(text: string): string | null {
  const match = text.match(/^\s*([A-Za-z])\s*\(\s*([a-z])\s*\)\s*=/);
  return match && !RESERVED.has(match[1]) ? match[1] : null;
}

export function parseRow(raw: string, userFunctions: Set<string> = new Set()): Item {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (/[<>≤≥]/.test(text)) return { kind: "error", message: "Inequalities are not supported yet." };
  const functions = new Set([...BUILTIN_FUNCTIONS, ...userFunctions]);

  try {
    const sides = splitTopLevel(text, "=");
    if (sides.length > 2) return { kind: "error", message: "Use a single “=” per expression." };

    if (sides.length === 1) {
      const point = text.match(/^\((.*)\)$/);
      const coords = point ? splitTopLevel(point[1], ",") : [];
      if (coords.length === 2) {
        const [px, py] = coords.map((c) => compile(c, functions, []));
        return { kind: "point", params: [...new Set([...px.params, ...py.params])], at: (scope) => [px.evaluate(scope), py.evaluate(scope)] };
      }
      const c = compile(text, functions, []);
      if (uses(c, normalize(text), "y")) return { kind: "error", message: "Add “= …” to make this an equation in x and y." };
      if (uses(c, normalize(text), "x")) return { kind: "explicit", params: c.params, at: (x, scope) => c.evaluate({ ...scope, x }) };
      return { kind: "value", params: c.params, value: (scope) => c.evaluate(scope) };
    }

    const [lhsRaw, rhsRaw] = sides.map((s) => s.trim());
    if (!lhsRaw || !rhsRaw) return { kind: "error", message: "Both sides of “=” need something." };

    const fnDef = lhsRaw.match(/^([A-Za-z])\s*\(\s*([a-z])\s*\)$/);
    if (fnDef && !RESERVED.has(fnDef[1])) {
      const [, name, variable] = fnDef;
      const body = compile(rhsRaw, functions, [variable]);
      return {
        kind: "function",
        name,
        variable,
        params: body.params,
        plotted: variable === "x",
        at: (t, scope) => body.evaluate({ ...scope, [variable]: t }),
      };
    }

    if (/^[A-Za-z](_[A-Za-z0-9]+)?$/.test(lhsRaw) && !RESERVED.has(lhsRaw)) {
      const numeric = Number(rhsRaw);
      if (rhsRaw !== "" && Number.isFinite(numeric)) return { kind: "slider", name: lhsRaw, value: numeric };
      const c = compile(rhsRaw, functions, []);
      if (!uses(c, normalize(rhsRaw), "x") && !uses(c, normalize(rhsRaw), "y")) {
        return { kind: "constant", name: lhsRaw, params: c.params, value: (scope) => c.evaluate(scope) };
      }
    }

    const lhs = compile(lhsRaw, functions, []);
    const rhs = compile(rhsRaw, functions, []);
    const params = [...new Set([...lhs.params, ...rhs.params])];
    const rhsHas = (s: string) => uses(rhs, normalize(rhsRaw), s);
    const lhsHas = (s: string) => uses(lhs, normalize(lhsRaw), s);

    if (lhsRaw === "y" && !rhsHas("y")) return { kind: "explicit", params, at: (x, scope) => rhs.evaluate({ ...scope, x }) };
    if (rhsRaw === "y" && !lhsHas("y")) return { kind: "explicit", params, at: (x, scope) => lhs.evaluate({ ...scope, x }) };
    if (lhsRaw === "x" && !rhsHas("x")) return { kind: "vertical", params, at: (y, scope) => rhs.evaluate({ ...scope, y }) };
    if (rhsRaw === "x" && !lhsHas("x")) return { kind: "vertical", params, at: (y, scope) => lhs.evaluate({ ...scope, y }) };
    return {
      kind: "implicit",
      params,
      at: (x, y, scope) => lhs.evaluate({ ...scope, x, y }) - rhs.evaluate({ ...scope, x, y }),
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message.replace(/\(char \d+\)/, "").trim() : "Could not read this." };
  }
}

export function definedName(item: Item): string | null {
  return item.kind === "slider" || item.kind === "constant" || item.kind === "function" ? item.name : null;
}

// Builds the evaluation scope from sliders, constants and user functions in row order
export function buildScope(items: Item[]): Scope {
  const scope: Scope = {};
  for (const item of items) {
    if (item.kind === "slider") scope[item.name] = item.value;
  }
  for (const item of items) {
    if (item.kind === "constant") scope[item.name] = item.value(scope);
    if (item.kind === "function") {
      const fn = item.at;
      scope[item.name] = (t: number) => fn(t, scope);
    }
  }
  return scope;
}

export function missingParams(item: Item, scope: Scope): string[] {
  if (!("params" in item)) return [];
  return item.params.filter((p) => !(p in scope) && !(item.kind === "function" && p === item.variable));
}
