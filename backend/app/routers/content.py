from typing import Annotated

from fastapi import APIRouter, Query

from app.errors import ApiError
from app.schemas.base import ErrorResponse
from app.schemas.content import (
    AnswerRequest,
    AnswerResult,
    ChapterPublic,
    ClassDetail,
    ClassSummary,
    ConceptMap,
    HintRequest,
    HintResult,
    SearchHit,
)
from app.services import content_loader, tutor

router = APIRouter(tags=["content"], responses={404: {"model": ErrorResponse}})


@router.get("/content/classes", response_model=list[ClassSummary])
def list_classes() -> list[ClassSummary]:
    return content_loader.class_summaries()


@router.get("/content/classes/{grade}", response_model=ClassDetail)
def get_class(grade: int) -> ClassDetail:
    detail = content_loader.class_detail(grade)
    if detail is None:
        raise ApiError(404, "NOT_FOUND", f"Class {grade} is not in the catalog.")
    return detail


@router.get("/content/chapters/{chapter_id}", response_model=ChapterPublic)
def get_chapter(chapter_id: str) -> ChapterPublic:
    chapter = content_loader.chapters().get(chapter_id)
    if chapter is None:
        raise ApiError(404, "NOT_FOUND", "This chapter has not been written yet.")
    return content_loader.to_public(chapter)


@router.get("/content/map", response_model=ConceptMap)
def concept_map() -> ConceptMap:
    return content_loader.concept_map()


@router.get("/content/search", response_model=list[SearchHit])
def search(
    q: Annotated[str, Query(min_length=2, max_length=60)],
    grade: Annotated[int | None, Query(ge=11, le=12)] = None,
) -> list[SearchHit]:
    return content_loader.search(q, grade)


@router.post("/quiz/check", response_model=AnswerResult)
def check_answer(body: AnswerRequest) -> AnswerResult:
    found = content_loader.find_question(body.chapter_id, body.topic_id, body.question_id)
    if found is None:
        raise ApiError(404, "NOT_FOUND", "Question not found.")
    _, question = found
    if question.type == "mcq":
        correct = int(body.answer) == int(question.answer)
    else:
        scale = max(1.0, abs(question.answer))
        correct = abs(body.answer - question.answer) <= question.tolerance * scale
    return AnswerResult(correct=correct, correct_answer=question.answer,
                        explanation=question.explanation,
                        diagnosis=None if correct else tutor.diagnose(question, body.answer))


@router.post("/quiz/hint", response_model=HintResult)
def get_hint(body: HintRequest) -> HintResult:
    found = content_loader.find_question(body.chapter_id, body.topic_id, body.question_id)
    if found is None:
        raise ApiError(404, "NOT_FOUND", "Question not found.")
    topic, question = found
    return tutor.hint(question, topic, body.level)
