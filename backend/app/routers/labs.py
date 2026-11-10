from functools import lru_cache
from typing import Literal

from fastapi import APIRouter

from app.config import CONTENT_DIR
from app.errors import ApiError
from app.schemas.base import ApiModel, ErrorResponse

router = APIRouter(prefix="/labs", tags=["labs"], responses={404: {"model": ErrorResponse}})


class VivaQuestion(ApiModel):
    question: str
    answer: str


class LabSummary(ApiModel):
    id: str
    title: str
    subject: Literal["physics", "electrical"]
    order: int
    aim: str
    minutes: int


class LabDetail(LabSummary):
    apparatus: list[str]
    theory: str
    formula: str
    procedure: list[str]
    precautions: list[str]
    viva: list[VivaQuestion]


@lru_cache(maxsize=1)
def _labs() -> dict[str, LabDetail]:
    labs = [LabDetail.model_validate_json(p.read_text(encoding="utf-8"))
            for p in (CONTENT_DIR / "labs").glob("*.json")]
    return {lab.id: lab for lab in sorted(labs, key=lambda lab: lab.order)}


@router.get("", response_model=list[LabSummary])
def list_labs() -> list[LabSummary]:
    return [LabSummary.model_validate(lab.model_dump(include=set(LabSummary.model_fields)))
            for lab in _labs().values()]


@router.get("/{lab_id}", response_model=LabDetail)
def get_lab(lab_id: str) -> LabDetail:
    lab = _labs().get(lab_id)
    if lab is None:
        raise ApiError(404, "NOT_FOUND", f"No experiment named '{lab_id}'.")
    return lab
