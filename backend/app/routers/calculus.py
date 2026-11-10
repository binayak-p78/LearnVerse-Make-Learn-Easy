from fastapi import APIRouter

from app.errors import ApiError
from app.schemas.base import ErrorResponse
from app.schemas.calculus import CalculusResult, DerivativeRequest, IntegralRequest, LimitRequest
from app.services import sympy_solver
from app.services.sympy_solver import ExpressionError

router = APIRouter(
    prefix="/calculus",
    tags=["calculus"],
    responses={400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)


def _run(fn, *args) -> CalculusResult:
    try:
        return fn(*args)
    except ExpressionError as exc:
        raise ApiError(400, "INVALID_EXPRESSION", str(exc)) from exc
    except (NotImplementedError, ValueError, TypeError) as exc:
        raise ApiError(400, "UNSOLVABLE", f"SymPy could not solve this: {exc}") from exc


@router.post("/derivative", response_model=CalculusResult)
def derivative(body: DerivativeRequest) -> CalculusResult:
    return _run(sympy_solver.derivative, body.expression, body.variable, body.order)


@router.post("/integral", response_model=CalculusResult)
def integral(body: IntegralRequest) -> CalculusResult:
    return _run(sympy_solver.integral, body.expression, body.variable, body.lower, body.upper)


@router.post("/limit", response_model=CalculusResult)
def limit(body: LimitRequest) -> CalculusResult:
    return _run(sympy_solver.limit, body.expression, body.variable, body.point, body.direction)
