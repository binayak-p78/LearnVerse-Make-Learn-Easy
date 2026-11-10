from typing import Literal

from pydantic import Field

from app.schemas.base import ApiModel

Expression = str
VariableName = str


class DerivativeRequest(ApiModel):
    expression: Expression = Field(min_length=1, max_length=200)
    variable: VariableName = Field(default="x", pattern=r"^[a-z]$")
    order: int = Field(default=1, ge=1, le=5)


class IntegralRequest(ApiModel):
    expression: Expression = Field(min_length=1, max_length=200)
    variable: VariableName = Field(default="x", pattern=r"^[a-z]$")
    lower: str | None = Field(default=None, max_length=40)
    upper: str | None = Field(default=None, max_length=40)


class LimitRequest(ApiModel):
    expression: Expression = Field(min_length=1, max_length=200)
    variable: VariableName = Field(default="x", pattern=r"^[a-z]$")
    point: str = Field(max_length=40)
    direction: Literal["+", "-", "+-"] = "+-"


class Step(ApiModel):
    rule: str
    description: str
    latex: str


class CalculusResult(ApiModel):
    input_latex: str
    result: str
    result_latex: str
    numeric: float | None = None
    steps: list[Step]
