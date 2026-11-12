import math
import re
import zlib
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from app.schemas.content import Diagnosis, HintResult, Question, Topic

MAX_HINT_LEVEL = 3
_MATCH = 0.01
_ROUNDING = 0.05

Candidates = Callable[[float], Iterable[float]]


@dataclass(frozen=True, slots=True)
class NumericRule:
    code: str
    candidates: Candidates
    message: str


def _nonzero(f: Candidates) -> Candidates:
    return lambda a: f(a) if a != 0 else ()


def _not_unit(f: Candidates) -> Candidates:
    return lambda a: f(a) if abs(a) not in (0.0, 1.0) else ()


# Ordered from most to least specific; the first rule that reproduces the student's value wins
NUMERIC_RULES: tuple[NumericRule, ...] = (
    NumericRule(
        "SIGN", _nonzero(lambda a: (-a,)),
        "Right size, wrong sign. Recheck a minus sign, the direction, "
        "or which point you subtract from.",
    ),
    NumericRule(
        "NEGATIVE_RECIPROCAL", _not_unit(lambda a: (-1 / a,)),
        "That is the negative reciprocal. Check whether the question wants "
        "the perpendicular (normal) or the original slope.",
    ),
    NumericRule(
        "RECIPROCAL", _not_unit(lambda a: (1 / a,)),
        "You have the reciprocal. Check which quantity goes on top of the fraction.",
    ),
    NumericRule(
        "FACTOR_TWO", _nonzero(lambda a: (2 * a, a / 2)),
        "Off by a factor of 2. Look for a missing ½, a 2 from the chain rule, "
        "or a diameter/radius mix-up.",
    ),
    NumericRule(
        "SQUARED", _not_unit(lambda a: (a * a,)),
        "Looks like the square of the answer. Did you forget a square root at the end?",
    ),
    NumericRule(
        "SQUARE_ROOT", lambda a: (math.sqrt(a),) if a > 0 and a != 1 else (),
        "Looks like the square root of the answer. Did you take a root you didn't need, "
        "or forget to square?",
    ),
    NumericRule(
        "DEGREES_RADIANS", _nonzero(lambda a: (a * 180 / math.pi, a * math.pi / 180)),
        "Degrees and radians are mixed up. Multiply by π/180 to go from degrees to radians.",
    ),
    NumericRule(
        "FACTOR_PI", _nonzero(lambda a: (a * math.pi, a / math.pi)),
        "Off by a factor of π. Check whether π belongs in the formula (circle areas, periods).",
    ),
    NumericRule(
        "PLACE_VALUE", _nonzero(lambda a: tuple(a * 10.0**k for k in (-3, -2, -1, 1, 2, 3))),
        "The digits are right but the decimal point is not. Check place value and units.",
    ),
    NumericRule(
        "OFF_BY_ONE", lambda a: (a - 1, a + 1) if a == int(a) else (),
        "Off by one. Recount whether the endpoints are included or excluded.",
    ),
)


def _same(x: float, y: float, rel: float = _MATCH) -> bool:
    return math.isclose(x, y, rel_tol=rel, abs_tol=1e-9)


def diagnose_numeric(given: float, correct: float) -> Diagnosis | None:
    if correct != 0 and _same(given, correct, _ROUNDING):
        return Diagnosis(
            code="ROUNDING",
            message="Very close. Keep more decimal places and round only at the final step.",
        )
    for rule in NUMERIC_RULES:
        if any(_same(given, c) for c in rule.candidates(correct)):
            return Diagnosis(code=rule.code, message=rule.message)
    return None


def diagnose(question: Question, given: float) -> Diagnosis | None:
    if question.type == "mcq":
        index = int(given)
        feedback = question.option_feedback
        if 0 <= index < len(feedback) and feedback[index]:
            return Diagnosis(code="OPTION", message=feedback[index])
        return None
    return diagnose_numeric(given, question.answer)


# Keyword → strategy, used when a question has no authored hint
STRATEGIES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pattern, re.IGNORECASE), text)
    for pattern, text in (
        (r"\blim\b|limit",
         "Substitute the value first. If you get 0/0, factor and cancel, "
         "or use a standard limit such as sin θ/θ → 1."),
        (r"∫|integra|area",
         "Find an antiderivative. For a definite integral, evaluate it at the upper limit "
         "minus the lower limit."),
        (r"maxim|minim|increasing|decreasing",
         "Find f′(x), solve f′(x) = 0 and check the sign of f′ on either side."),
        (r"d/dx|derivative|f′|dy/dx|tangent|normal",
         "Differentiate with the power, product or chain rule, then substitute the point."),
        (r"continu",
         "Compare the left-hand limit, the right-hand limit and the function's value "
         "at the point."),
        (r"focus|foci|eccentric|latus|ellipse|hyperbola|parabola|circle",
         "Rewrite the equation in standard form and read off a, b and c."),
        (r"distance",
         "Use the point–line distance formula |ax₁ + by₁ + c| / √(a² + b²)."),
        (r"slope|intercept",
         "Rearrange into y = mx + c, or use (y₂ − y₁)/(x₂ − x₁)."),
        (r"radian|°|sin|cos|tan",
         "Convert angles with π rad = 180°, then use the standard values."),
    )
)
FALLBACK_STRATEGY = (
    "Write down the formula that links what you are given to what is asked, "
    "then substitute carefully."
)

_TOKEN = re.compile(r"[a-z]{2,}|\d+|[∫√π]", re.IGNORECASE)
_STOP = frozenset({
    "the", "of", "is", "at", "and", "what", "find", "as", "to", "in", "if", "for", "an", "decimal",
})


def strategy(question: Question) -> str:
    matches = (text for pattern, text in STRATEGIES if pattern.search(question.prompt))
    return next(matches, FALLBACK_STRATEGY)


def _tokens(text: str) -> frozenset[str]:
    return frozenset(t.lower() for t in _TOKEN.findall(text)) - _STOP


def closest_example(question: Question, topic: Topic) -> int | None:
    if not topic.examples:
        return None
    wanted = _tokens(question.prompt)
    scores = [len(wanted & _tokens(ex.problem)) for ex in topic.examples]
    return max(range(len(scores)), key=lambda i: (scores[i], -i))


def _eliminated_option(question: Question) -> int:
    # Stable choice so asking twice rules out the same option
    wrong = [i for i in range(len(question.options or [])) if i != int(question.answer)]
    return min(wrong, key=lambda i: zlib.crc32(f"{question.id}:{i}".encode()))


def _range_hint(answer: float) -> str:
    if answer == 0:
        return "The answer is neither positive nor negative."
    sign = "positive" if answer > 0 else "negative"
    low = 10.0 ** math.floor(math.log10(abs(answer)))
    whole = "a whole number" if answer == int(answer) else "not a whole number, so give a decimal"
    return f"The answer is {sign}, its size is between {low:g} and {low * 10:g}, and it is {whole}."


def _result(level: int, kind: str, text: str, **extra: int) -> HintResult:
    return HintResult(level=level, max_level=MAX_HINT_LEVEL, kind=kind, text=text, **extra)


def hint(question: Question, topic: Topic, level: int) -> HintResult:
    level = max(1, min(MAX_HINT_LEVEL, level))
    if level == 1:
        return _result(1, "strategy", question.hint or strategy(question))
    if level == 2:
        index = closest_example(question, topic)
        if index is not None:
            return _result(2, "example", f"Worked example {index + 1} uses the same method. "
                           "Follow its steps.", example_index=index)
        text = strategy(question)
        return _result(2, "strategy", text if text != question.hint else FALLBACK_STRATEGY)
    if question.type == "mcq":
        index = _eliminated_option(question)
        reason = question.option_feedback[index] if question.option_feedback else ""
        option = (question.options or [])[index]
        return _result(3, "eliminate", f"Rule out “{option}”. {reason}".strip(), eliminate=index)
    return _result(3, "range", _range_hint(question.answer))
