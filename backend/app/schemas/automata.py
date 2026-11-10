from typing import Annotated, Literal

from pydantic import Field, field_validator

from app.schemas.base import ApiModel

EPSILON = "ε"
SCHEMA_VERSION = 1

Symbol = Annotated[str, Field(min_length=1, max_length=1)]
StateId = Annotated[str, Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_\-]+$")]


def _normalize_epsilon(value: str) -> str:
    return EPSILON if value in ("", "e", "eps", "epsilon", "λ") else value


class State(ApiModel):
    id: StateId
    label: str = Field(default="", max_length=32)
    x: float = 0
    y: float = 0


class TransitionBase(ApiModel):
    id: Annotated[str, Field(min_length=1, max_length=32)]
    source: StateId = Field(alias="from")
    target: StateId = Field(alias="to")


class FiniteTransition(TransitionBase):
    read: str = Field(max_length=8)

    _eps = field_validator("read", mode="before")(_normalize_epsilon)


class PDATransition(TransitionBase):
    read: str = Field(max_length=8)
    pop: str = Field(default=EPSILON, max_length=8)
    push: str = Field(default=EPSILON, max_length=16)

    _eps = field_validator("read", "pop", "push", mode="before")(_normalize_epsilon)


class TMTransition(TransitionBase):
    read: Symbol
    write: Symbol
    move: Literal["L", "R", "S"]


class MachineBase(ApiModel):
    id: str = Field(default="untitled", max_length=64)
    name: str = Field(default="Untitled", max_length=80)
    description: str = Field(default="", max_length=400)
    alphabet: list[str] = Field(max_length=32)
    states: list[State] = Field(max_length=64)
    start: str
    accept: list[str] = Field(default_factory=list)


class FiniteMachine(MachineBase):
    kind: Literal["dfa", "nfa"]
    transitions: list[FiniteTransition] = Field(default_factory=list, max_length=512)


class PDAMachine(MachineBase):
    kind: Literal["pda"]
    stack_alphabet: list[str] = Field(max_length=32)
    initial_stack: Symbol = "Z"
    accept_mode: Literal["final", "empty"] = "final"
    transitions: list[PDATransition] = Field(default_factory=list, max_length=512)


class TMMachine(MachineBase):
    kind: Literal["tm"]
    tape_alphabet: list[str] = Field(max_length=32)
    blank: Symbol = "_"
    transitions: list[TMTransition] = Field(default_factory=list, max_length=512)


Machine = Annotated[FiniteMachine | PDAMachine | TMMachine, Field(discriminator="kind")]


class Issue(ApiModel):
    code: str
    message: str
    ref: str | None = None


class ValidationReport(ApiModel):
    valid: bool
    errors: list[Issue]
    warnings: list[Issue]


class ExampleCase(ApiModel):
    input: str
    accepted: bool
    output: str | None = None


class ExampleSummary(ApiModel):
    id: str
    name: str
    description: str
    kind: Literal["dfa", "nfa", "pda", "tm"]


class Example(ApiModel):
    machine: Machine
    cases: list[ExampleCase]


class SimulateRequest(ApiModel):
    machine: Machine
    input: str = Field(default="", max_length=256)
    max_steps: int = Field(default=2000, ge=1, le=20000)


class FiniteStep(ApiModel):
    states: list[str]
    input_index: int
    symbol: str | None
    transition_ids: list[str]


class PDAStep(ApiModel):
    state: str
    input_index: int
    stack: list[str]
    transition_id: str | None


class TMStep(ApiModel):
    state: str
    head: int
    tape: str
    tape_offset: int
    transition_id: str | None


class FiniteResult(ApiModel):
    kind: Literal["dfa", "nfa"]
    accepted: bool
    halted: bool
    reason: str
    steps: list[FiniteStep]


class PDAResult(ApiModel):
    kind: Literal["pda"]
    accepted: bool
    halted: bool
    reason: str
    explored: int
    steps: list[PDAStep]


class TMResult(ApiModel):
    kind: Literal["tm"]
    accepted: bool
    halted: bool
    reason: str
    output: str
    steps: list[TMStep]


SimulationResult = Annotated[FiniteResult | PDAResult | TMResult, Field(discriminator="kind")]


class MachineRequest(ApiModel):
    machine: Machine


class SubsetStep(ApiModel):
    source: str = Field(alias="from")
    symbol: str
    target: str = Field(alias="to")
    target_set: list[str]
    is_new: bool


class ConvertResponse(ApiModel):
    dfa: FiniteMachine
    mapping: dict[str, list[str]]
    steps: list[SubsetStep]


class MinimizeResponse(ApiModel):
    dfa: FiniteMachine
    partitions: list[list[str]]
    removed_unreachable: list[str]
    added_trap: bool


class MachineDocument(ApiModel):
    schema_version: int = SCHEMA_VERSION
    exported_at: str | None = None
    machine: Machine


class ImportResponse(ApiModel):
    machine: Machine
    validation: ValidationReport
