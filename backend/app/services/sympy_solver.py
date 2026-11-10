import dataclasses
import re

import sympy as sp
from sympy.integrals.manualintegrate import DontKnowRule, Rule, integral_steps
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

from app.schemas.calculus import CalculusResult, Step

FUNCTIONS = {
    "sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "cot": sp.cot, "sec": sp.sec, "csc": sp.csc,
    "asin": sp.asin, "acos": sp.acos, "atan": sp.atan,
    "arcsin": sp.asin, "arccos": sp.acos, "arctan": sp.atan,
    "sinh": sp.sinh, "cosh": sp.cosh, "tanh": sp.tanh,
    "exp": sp.exp, "log": sp.log, "ln": sp.log, "sqrt": sp.sqrt, "abs": sp.Abs,
}
CONSTANTS = {"pi": sp.pi, "e": sp.E, "E": sp.E}
INFINITIES = {"oo": sp.oo, "inf": sp.oo, "infinity": sp.oo}
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
SAFE_GLOBALS = {
    "__builtins__": {},
    "Integer": sp.Integer, "Float": sp.Float, "Rational": sp.Rational,
    "Symbol": sp.Symbol, "Function": sp.Function,
}

ALLOWED_CHARS = re.compile(r"^[0-9A-Za-z+\-*/^().\s]*$")
IDENTIFIER = re.compile(r"[A-Za-z]+")
BIG_EXPONENT = re.compile(r"(\^|\*\*)\s*\(?\s*(\d+)")


class ExpressionError(ValueError):
    pass


def parse_expression(text: str, variable: str, extra: dict | None = None) -> sp.Expr:
    if variable == "e":
        raise ExpressionError("'e' is Euler's number; pick another variable name.")
    if not ALLOWED_CHARS.match(text):
        raise ExpressionError("Use only numbers, letters, + - * / ^ and parentheses.")
    names = {**FUNCTIONS, **CONSTANTS, **(extra or {})}
    for token in IDENTIFIER.findall(text):
        if token != variable and token not in names:
            raise ExpressionError(
                f"Unknown name '{token}'. Write products with * (e.g. {variable}*sin({variable}))."
            )
    if any(len(digits) > 8 for digits in re.findall(r"\d+", text)):
        raise ExpressionError("Numbers are limited to 8 digits.")
    if any(int(m.group(2)) > 100 for m in BIG_EXPONENT.finditer(text)):
        raise ExpressionError("Exponents above 100 are not supported.")
    if text.count("^") + text.count("**") > 6:
        raise ExpressionError("The expression has too many powers.")

    local = {**names, variable: sp.Symbol(variable, real=True)}
    try:
        expr = parse_expr(text, local_dict=local, global_dict=SAFE_GLOBALS,
                          transformations=TRANSFORMS)
    except (SyntaxError, TypeError, ValueError, AttributeError, NameError) as exc:
        raise ExpressionError(f"Could not read the expression: {exc}") from exc
    if not isinstance(expr, sp.Expr):
        raise ExpressionError("That is not a mathematical expression.")
    return expr


def parse_point(text: str) -> sp.Expr:
    cleaned = text.strip().lower().replace("∞", "oo")
    sign = -1 if cleaned.startswith("-") else 1
    if cleaned.lstrip("+-") in INFINITIES:
        return sign * sp.oo
    value = parse_expression(text, "t")
    if value.free_symbols:
        raise ExpressionError("A limit point or bound must be a number such as 0, 2, pi/2 or oo.")
    return value


def _numeric(value: sp.Expr) -> float | None:
    if value.is_real and value.is_finite:
        return float(value.evalf())
    return None


def tidy(expr: sp.Expr) -> sp.Expr:
    simplified = sp.simplify(expr)
    numer, denom = sp.fraction(sp.together(simplified))
    if denom == 1:
        return simplified
    return sp.expand(numer) / sp.factor(denom)


def _d(x: sp.Symbol, expr: sp.Expr) -> str:
    return rf"\frac{{d}}{{d{x}}}\left[{sp.latex(expr)}\right]"


class Differentiator:
    def __init__(self, x: sp.Symbol) -> None:
        self.x = x
        self.steps: list[Step] = []

    def _record(self, rule: str, description: str, expr: sp.Expr, rhs: str) -> None:
        self.steps.append(Step(rule=rule, description=description,
                               latex=f"{_d(self.x, expr)} = {rhs}"))

    def _quotient_parts(self, f: sp.Expr) -> tuple[sp.Expr, sp.Expr] | None:
        numer, denom = f.as_numer_denom()
        if denom != 1 and denom.has(self.x) and numer.has(self.x):
            return numer, denom
        return None

    def d(self, f: sp.Expr) -> sp.Expr:
        x = self.x
        if not f.has(x):
            self._record("Constant rule", "The derivative of a constant is 0.", f, "0")
            return sp.Integer(0)
        if f == x:
            self._record("Identity", f"The derivative of {x} with respect to itself is 1.", f, "1")
            return sp.Integer(1)

        if f.is_Add:
            terms = f.as_ordered_terms()
            self._record("Sum rule", "Differentiate each term separately.", f,
                         " + ".join(_d(x, t) for t in terms))
            return sp.Add(*(self.d(t) for t in terms))

        if f.is_Mul:
            const, rest = f.as_independent(x, as_Add=False)
            if const != 1:
                self._record("Constant multiple rule", "Move the constant factor outside.", f,
                             rf"{sp.latex(const)} \cdot {_d(x, rest)}")
                return const * self.d(rest)
            parts = self._quotient_parts(f)
            if parts:
                u, v = parts
                self._record("Quotient rule", r"(u/v)' = (u'v - uv') / v².", f,
                             rf"\frac{{{_d(x, u)} \cdot {sp.latex(v)} - {sp.latex(u)} \cdot "
                             rf"{_d(x, v)}}}{{\left({sp.latex(v)}\right)^2}}")
                du, dv = self.d(u), self.d(v)
                return (du * v - u * dv) / v**2
            u, v = f.args[0], sp.Mul(*f.args[1:])
            self._record("Product rule", "(uv)' = u'v + uv'.", f,
                         rf"{_d(x, u)} \cdot {sp.latex(v)} + {sp.latex(u)} \cdot {_d(x, v)}")
            return self.d(u) * v + u * self.d(v)

        if f.is_Pow:
            base, exponent = f.as_base_exp()
            if not exponent.has(x):
                result = exponent * base ** (exponent - 1)
                if base == x:
                    self._record("Power rule", rf"d/d{x} {x}ⁿ = n·{x}ⁿ⁻¹.", f, sp.latex(result))
                    return result
                self._record("Chain rule (power)", "Differentiate the outer power, then multiply "
                             "by the derivative of the inside.", f,
                             rf"{sp.latex(result)} \cdot {_d(x, base)}")
                return result * self.d(base)
            if not base.has(x):
                self._record("Exponential rule", "d/dx aᵘ = aᵘ · ln(a) · u'.", f,
                             rf"{sp.latex(f)} \ln\left({sp.latex(base)}\right) \cdot "
                             rf"{_d(x, exponent)}")
                return f * sp.log(base) * self.d(exponent)
            inner = exponent * sp.log(base)
            self._record("Logarithmic differentiation", "Write f^g as e^(g·ln f) and use the "
                         "chain rule.", f, rf"{sp.latex(f)} \cdot {_d(x, inner)}")
            return f * self.d(inner)

        if isinstance(f, sp.Function) and len(f.args) == 1:
            u = f.args[0]
            t = sp.Dummy("t", real=True)
            outer = f.func(t).diff(t)
            outer_at_u = outer.subs(t, u)
            name = f.func.__name__
            if u == x:
                self._record(f"Derivative of {name}", f"Standard derivative of {name}.", f,
                             sp.latex(outer_at_u))
                return outer_at_u
            self._record("Chain rule", f"Outer function {name}, inner function "
                         f"u = {sp.sstr(u)}.", f, rf"{sp.latex(outer_at_u)} \cdot {_d(x, u)}")
            return outer_at_u * self.d(u)

        result = sp.diff(f, x)
        self._record("Differentiate", "Apply the standard rules.", f, sp.latex(result))
        return result


def derivative(expression: str, variable: str, order: int) -> CalculusResult:
    x = sp.Symbol(variable, real=True)
    f = parse_expression(expression, variable)
    steps: list[Step] = []
    current = f
    for n in range(1, order + 1):
        engine = Differentiator(x)
        if order > 1:
            steps.append(Step(rule=f"Derivative {n}", description="Differentiate the previous "
                              "result." if n > 1 else "First derivative.",
                              latex=_d(x, current)))
        raw = engine.d(current)
        steps.extend(engine.steps)
        simplified = tidy(raw)
        steps.append(Step(rule="Simplify", description="Combine and simplify the terms.",
                          latex=rf"{sp.latex(raw)} = {sp.latex(simplified)}"))
        current = simplified

    notation = f"d^{order}/d{variable}^{order}" if order > 1 else f"d/d{variable}"
    return CalculusResult(
        input_latex=(rf"\frac{{d^{{{order}}}}}{{d{variable}^{{{order}}}}}" if order > 1
                     else rf"\frac{{d}}{{d{variable}}}") + rf"\left[{sp.latex(f)}\right]",
        result=f"{notation} = {sp.sstr(current)}",
        result_latex=sp.latex(current),
        steps=steps,
    )


INTEGRAL_RULES = {
    "ConstantRule": ("Constant rule", "∫a dx = a·x."),
    "PowerRule": ("Power rule", "∫xⁿ dx = xⁿ⁺¹/(n+1), for n ≠ −1."),
    "AddRule": ("Sum rule", "Integrate each term separately."),
    "ConstantTimesRule": ("Constant multiple", "Move the constant outside the integral."),
    "ReciprocalRule": ("Reciprocal rule", "∫1/x dx = ln|x|."),
    "ExpRule": ("Exponential rule", "∫aˣ dx = aˣ/ln(a); for eˣ this is eˣ."),
    "SinRule": ("Sine rule", "∫sin x dx = −cos x."),
    "CosRule": ("Cosine rule", "∫cos x dx = sin x."),
    "SecTanRule": ("sec·tan rule", "∫sec x tan x dx = sec x."),
    "CscCotRule": ("csc·cot rule", "∫csc x cot x dx = −csc x."),
    "Sec2Rule": ("sec² rule", "∫sec² x dx = tan x."),
    "Csc2Rule": ("csc² rule", "∫csc² x dx = −cot x."),
    "ArctanRule": ("Arctangent rule", "∫1/(a + b x²) dx gives an arctan."),
    "ArcsinRule": ("Arcsine rule", "∫1/√(1 − x²) dx = arcsin x."),
    "RewriteRule": ("Rewrite", "Rewrite the integrand in an easier form."),
    "CyclicPartsRule": ("Cyclic parts", "Integration by parts brings the integral back; solve "
                        "for it."),
    "PiecewiseRule": ("Piecewise", "Integrate each piece separately."),
}


def _describe_rule(rule: Rule) -> tuple[str, str]:
    name = type(rule).__name__
    if name == "URule":
        return "Substitution", f"Let u = {sp.sstr(rule.u_func)}."
    if name == "PartsRule":
        return ("Integration by parts",
                f"∫u dv = uv − ∫v du with u = {sp.sstr(rule.u)}, dv = {sp.sstr(rule.dv)}.")
    label, text = INTEGRAL_RULES.get(name, (re.sub(r"(?<!^)(?=[A-Z])", " ",
                                                   name.removesuffix("Rule")), ""))
    return label, text or "Apply the standard integral."


def _walk_integral(rule: Rule | None, out: list[Step], depth: int = 0) -> None:
    if rule is None or depth > 25:
        return
    if type(rule).__name__ == "AlternativeRule":
        _walk_integral(rule.alternatives[0], out, depth)
        return
    label, description = _describe_rule(rule)
    try:
        evaluated = sp.latex(rule.eval())
    except Exception:
        evaluated = r"\dots"
    out.append(Step(rule=label, description=description,
                    latex=rf"\int {sp.latex(rule.integrand)}\,d{rule.variable} = {evaluated}"))
    for field in dataclasses.fields(rule):
        value = getattr(rule, field.name)
        children = value if isinstance(value, (list, tuple)) else [value]
        for child in children:
            if isinstance(child, Rule):
                _walk_integral(child, out, depth + 1)


def _has_unknown(rule: Rule) -> bool:
    if isinstance(rule, DontKnowRule):
        return True
    for field in dataclasses.fields(rule):
        value = getattr(rule, field.name)
        children = value if isinstance(value, (list, tuple)) else [value]
        if any(isinstance(c, Rule) and _has_unknown(c) for c in children):
            return True
    return False


def integral(expression: str, variable: str, lower: str | None,
             upper: str | None) -> CalculusResult:
    x = sp.Symbol(variable, real=True)
    f = parse_expression(expression, variable)
    steps: list[Step] = []

    rule = integral_steps(f, x)
    if _has_unknown(rule):
        antiderivative = sp.integrate(f, x)
        if antiderivative.has(sp.Integral):
            raise ExpressionError("No closed-form antiderivative was found.")
        steps.append(Step(rule="Integrate", description="Solved directly; no simple rule chain "
                          "applies.", latex=rf"\int {sp.latex(f)}\,d{x} = "
                          rf"{sp.latex(antiderivative)}"))
    else:
        _walk_integral(rule, steps)
        antiderivative = rule.eval()
    antiderivative = sp.simplify(antiderivative)

    if (lower is None) != (upper is None):
        raise ExpressionError("Give both bounds for a definite integral, or neither.")
    if lower is None or upper is None:
        steps.append(Step(rule="Add constant", description="Every antiderivative differs by a "
                          "constant C.", latex=rf"\int {sp.latex(f)}\,d{x} = "
                          rf"{sp.latex(antiderivative)} + C"))
        return CalculusResult(
            input_latex=rf"\int {sp.latex(f)}\,d{x}",
            result=f"{sp.sstr(antiderivative)} + C",
            result_latex=rf"{sp.latex(antiderivative)} + C",
            steps=steps,
        )

    a, b = parse_point(lower), parse_point(upper)
    value = sp.simplify(sp.integrate(f, (x, a, b)))
    bracket = rf"\left[{sp.latex(antiderivative)}\right]_{{{sp.latex(a)}}}^{{{sp.latex(b)}}}"
    steps.append(Step(rule="Fundamental theorem", description="Evaluate F(b) − F(a).",
                      latex=rf"{bracket} = {sp.latex(value)}"))
    return CalculusResult(
        input_latex=rf"\int_{{{sp.latex(a)}}}^{{{sp.latex(b)}}} {sp.latex(f)}\,d{x}",
        result=sp.sstr(value),
        result_latex=sp.latex(value),
        numeric=_numeric(value),
        steps=steps,
    )


def limit(expression: str, variable: str, point: str, direction: str) -> CalculusResult:
    x = sp.Symbol(variable, real=True)
    f = parse_expression(expression, variable)
    a = parse_point(point)
    steps: list[Step] = []
    arrow = {"+": "^+", "-": "^-", "+-": ""}[direction]
    lim = rf"\lim_{{{x} \to {sp.latex(a)}{arrow}}}"

    if a.is_finite:
        direct = f.subs(x, a)
        if direct.is_finite and not direct.has(sp.nan, sp.zoo):
            steps.append(Step(rule="Direct substitution", description=f"The function is defined "
                              f"at {x} = {sp.sstr(a)}, so substitute.",
                              latex=rf"f({sp.latex(a)}) = {sp.latex(sp.simplify(direct))}"))
        else:
            numer, denom = sp.fraction(sp.together(f))
            ln, ld = sp.limit(numer, x, a), sp.limit(denom, x, a)
            if ln == 0 and ld == 0:
                ratio = sp.simplify(sp.diff(numer, x) / sp.diff(denom, x))
                steps.append(Step(rule="Indeterminate 0/0", description="Numerator and "
                                  "denominator both tend to 0; apply L'Hôpital's rule.",
                                  latex=rf"{lim} \frac{{{sp.latex(numer)}}}{{{sp.latex(denom)}}}"
                                  rf" = {lim} {sp.latex(ratio)}"))
            else:
                steps.append(Step(rule="Not defined at the point", description="Substitution "
                                  "fails, so study the behaviour near the point.",
                                  latex=rf"f({sp.latex(a)}) \text{{ is undefined}}"))

    if direction == "+-":
        left, right = sp.limit(f, x, a, "-"), sp.limit(f, x, a, "+")
        steps.append(Step(rule="One-sided limits", description="Compare the left and right "
                          "limits.", latex=rf"\lim_{{{x}\to {sp.latex(a)}^-}} = {sp.latex(left)},"
                          rf"\quad \lim_{{{x}\to {sp.latex(a)}^+}} = {sp.latex(right)}"))
        if left != right:
            return CalculusResult(input_latex=rf"{lim} {sp.latex(f)}",
                                  result="does not exist",
                                  result_latex=r"\text{does not exist}", steps=steps)
        value = right
    else:
        value = sp.limit(f, x, a, direction)

    steps.append(Step(rule="Result", description="The limit value.",
                      latex=rf"{lim} {sp.latex(f)} = {sp.latex(value)}"))
    return CalculusResult(input_latex=rf"{lim} {sp.latex(f)}", result=sp.sstr(value),
                          result_latex=sp.latex(value), numeric=_numeric(value), steps=steps)
