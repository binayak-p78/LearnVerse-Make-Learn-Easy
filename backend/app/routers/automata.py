from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Query

from app.errors import ApiError
from app.schemas.automata import (
    SCHEMA_VERSION,
    ConvertResponse,
    Example,
    ExampleSummary,
    FiniteMachine,
    ImportResponse,
    Machine,
    MachineDocument,
    MachineRequest,
    MinimizeResponse,
    PDAMachine,
    SimulateRequest,
    SimulationResult,
    TMMachine,
    ValidationReport,
)
from app.schemas.base import ErrorResponse
from app.services.automata.examples import load_examples
from app.services.automata.finite import FiniteAutomaton, minimize_dfa, nfa_to_dfa
from app.services.automata.pda import PushdownAutomaton
from app.services.automata.turing import TuringMachine
from app.services.automata.validation import validate

router = APIRouter(
    prefix="/automata",
    tags=["automata"],
    responses={400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)

Kind = Literal["dfa", "nfa", "pda", "tm"]


def _require_valid(machine: Machine) -> None:
    report = validate(machine)
    if not report.valid:
        raise ApiError(400, "INVALID_MACHINE", report.errors[0].message,
                       errors=[e.model_dump() for e in report.errors])


def _check_input(machine: Machine, word: str) -> None:
    alphabet = set(machine.alphabet)
    for index, symbol in enumerate(word):
        if symbol not in alphabet:
            raise ApiError(400, "INVALID_INPUT",
                           f"Input symbol '{symbol}' at position {index} is not in the alphabet.")


@router.get("/examples", response_model=list[ExampleSummary])
def list_examples(kind: Annotated[Kind | None, Query()] = None) -> list[ExampleSummary]:
    return [
        ExampleSummary(id=e.machine.id, name=e.machine.name,
                       description=e.machine.description, kind=e.machine.kind)
        for e in load_examples().values()
        if kind is None or e.machine.kind == kind
    ]


@router.get("/examples/{example_id}", response_model=Example)
def get_example(example_id: str) -> Example:
    example = load_examples().get(example_id)
    if example is None:
        raise ApiError(404, "NOT_FOUND", f"No example named '{example_id}'.")
    return example


@router.post("/validate", response_model=ValidationReport)
def validate_machine(body: MachineRequest) -> ValidationReport:
    return validate(body.machine)


@router.post("/simulate", response_model=SimulationResult)
def simulate(body: SimulateRequest) -> SimulationResult:
    machine = body.machine
    _require_valid(machine)
    _check_input(machine, body.input)
    match machine:
        case FiniteMachine():
            return FiniteAutomaton.from_machine(machine).simulate(body.input)
        case PDAMachine():
            return PushdownAutomaton(machine).simulate(body.input, body.max_steps)
        case TMMachine():
            return TuringMachine(machine).simulate(body.input, body.max_steps)


@router.post("/convert/nfa-to-dfa", response_model=ConvertResponse)
def convert_nfa_to_dfa(body: MachineRequest) -> ConvertResponse:
    machine = body.machine
    if not isinstance(machine, FiniteMachine):
        raise ApiError(400, "WRONG_KIND", "Subset construction needs a DFA or NFA.")
    _require_valid(machine)
    return nfa_to_dfa(FiniteAutomaton.from_machine(machine), machine.name)


@router.post("/minimize", response_model=MinimizeResponse)
def minimize(body: MachineRequest) -> MinimizeResponse:
    machine = body.machine
    if not isinstance(machine, FiniteMachine) or machine.kind != "dfa":
        raise ApiError(400, "WRONG_KIND", "Minimization needs a DFA. Convert the NFA first.")
    _require_valid(machine)
    return minimize_dfa(FiniteAutomaton.from_machine(machine), machine.name)


@router.post("/export", response_model=MachineDocument)
def export_machine(body: MachineRequest) -> MachineDocument:
    return MachineDocument(schema_version=SCHEMA_VERSION,
                           exported_at=datetime.now(UTC).isoformat(timespec="seconds"),
                           machine=body.machine)


@router.post("/import", response_model=ImportResponse)
def import_machine(document: Annotated[MachineDocument, Body()]) -> ImportResponse:
    if document.schema_version != SCHEMA_VERSION:
        raise ApiError(400, "UNSUPPORTED_VERSION",
                       f"Schema version {document.schema_version} is not supported; "
                       f"expected {SCHEMA_VERSION}.")
    return ImportResponse(machine=document.machine, validation=validate(document.machine))
