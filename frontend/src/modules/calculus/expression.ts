import { derivative, type MathNode, parse } from "mathjs";

const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "exp", "log", "sqrt", "abs",
]);
const CONSTANTS = new Set(["pi", "e"]);

export interface RealFunction {
  text: string;
  node: MathNode;
  tex: string;
  at: (x: number) => number;
}

export type Compiled = { ok: true; fn: RealFunction } | { ok: false; error: string };

const normalize = (text: string) =>
  text
    .replace(/\bln\s*\(/g, "log(")
    .replace(/\barc(sin|cos|tan)\b/g, "a$1")
    .replace(/\*\*/g, "^");

function fromNode(node: MathNode, text: string, variable: string): RealFunction {
  const code = node.compile();
  return {
    text,
    node,
    tex: node.toTex({ parenthesis: "keep", implicit: "hide" }),
    at: (x: number) => {
      try {
        const value = code.evaluate({ [variable]: x });
        return typeof value === "number" ? value : Number.NaN;
      } catch {
        return Number.NaN;
      }
    },
  };
}

export function compileExpression(text: string, variable = "x"): Compiled {
  const source = normalize(text.trim());
  if (!source) return { ok: false, error: "Enter a function of x." };
  let node: MathNode;
  try {
    node = parse(source);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read the expression." };
  }
  for (const n of node.filter((n) => "isFunctionNode" in n && n.isFunctionNode)) {
    const name = (n as unknown as { fn: { name: string } }).fn.name;
    if (!FUNCTIONS.has(name)) return { ok: false, error: `Unknown function “${name}”.` };
  }
  for (const n of node.filter((n) => "isSymbolNode" in n && n.isSymbolNode)) {
    const name = (n as unknown as { name: string }).name;
    if (name !== variable && !CONSTANTS.has(name) && !FUNCTIONS.has(name)) {
      return { ok: false, error: `Unknown name “${name}”. Use ${variable} as the variable.` };
    }
  }
  if (node.filter((n) => "isAssignmentNode" in n && Boolean(n.isAssignmentNode)).length) {
    return { ok: false, error: "Assignments are not allowed." };
  }
  return { ok: true, fn: fromNode(node, text, variable) };
}

// Symbolic derivative via mathjs, with a central-difference fallback
export function differentiate(fn: RealFunction, variable = "x"): RealFunction {
  try {
    const node = derivative(fn.node, variable);
    return fromNode(node, node.toString(), variable);
  } catch {
    const h = 1e-5;
    return { ...fn, tex: `\\frac{d}{d${variable}}\\left(${fn.tex}\\right)`, at: (x) => (fn.at(x + h) - fn.at(x - h)) / (2 * h) };
  }
}
