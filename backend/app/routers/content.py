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
    SearchHit,
)
from app.services import content_loader

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


@router.get("/content/search", response_model=list[SearchHit])
def search(
    q: Annotated[str, Query(min_length=2, max_length=60)],
    grade: Annotated[int | None, Query(ge=11, le=12)] = None,
) -> list[SearchHit]:
    return content_loader.search(q, grade)


@router.post("/quiz/check", response_model=AnswerResult)
def check_answer(body: AnswerRequest) -> AnswerResult:
    chapter = content_loader.chapters().get(body.chapter_id)
    topic = next((t for t in chapter.topics if t.id == body.topic_id), None) if chapter else None
    question = next((q for q in topic.quiz if q.id == body.question_id), None) if topic else None
    if question is None:
        raise ApiError(404, "NOT_FOUND", "Question not found.")
    if question.type == "mcq":
        correct = int(body.answer) == int(question.answer)
    else:
        scale = max(1.0, abs(question.answer))
        correct = abs(body.answer - question.answer) <= question.tolerance * scale
    return AnswerResult(correct=correct, correct_answer=question.answer,
                        explanation=question.explanation)
