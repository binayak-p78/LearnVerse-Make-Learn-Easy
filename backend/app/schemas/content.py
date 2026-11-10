from typing import Literal

from pydantic import Field

from app.schemas.base import ApiModel


class WorkedExample(ApiModel):
    problem: str
    solution: str


class Widget(ApiModel):
    module: Literal["graph", "calculus", "projectile", "lab"]
    label: str
    params: dict[str, str] = Field(default_factory=dict)


class QuestionPublic(ApiModel):
    id: str
    type: Literal["mcq", "numeric"]
    prompt: str
    options: list[str] | None = None
    hint: str = ""


class Question(QuestionPublic):
    answer: float
    tolerance: float = 0.01
    explanation: str = ""


class TopicBase(ApiModel):
    id: str
    title: str
    notes: str
    examples: list[WorkedExample] = Field(default_factory=list)
    widget: Widget | None = None


class Topic(TopicBase):
    quiz: list[Question] = Field(default_factory=list)


class TopicPublic(TopicBase):
    quiz: list[QuestionPublic]


class ChapterFile(ApiModel):
    id: str
    grade: int = Field(ge=11, le=12)
    number: int
    title: str
    summary: str
    topics: list[Topic]


class ChapterPublic(ApiModel):
    id: str
    grade: int
    number: int
    title: str
    summary: str
    topics: list[TopicPublic]


class CatalogChapter(ApiModel):
    id: str
    number: int
    title: str


class CatalogClass(ApiModel):
    grade: int
    title: str
    book: str
    chapters: list[CatalogChapter]


class Catalog(ApiModel):
    classes: list[CatalogClass]


class ChapterSummary(ApiModel):
    id: str
    number: int
    title: str
    available: bool
    summary: str = ""
    topic_count: int = 0
    topic_ids: list[str] = Field(default_factory=list)


class ClassSummary(ApiModel):
    grade: int
    title: str
    book: str
    chapter_count: int
    available_count: int
    topic_count: int


class ClassDetail(ApiModel):
    grade: int
    title: str
    book: str
    chapters: list[ChapterSummary]


class SearchHit(ApiModel):
    type: Literal["chapter", "topic"]
    grade: int
    chapter_id: str
    topic_id: str | None = None
    title: str
    snippet: str
    available: bool


class AnswerRequest(ApiModel):
    chapter_id: str
    topic_id: str
    question_id: str
    answer: float


class AnswerResult(ApiModel):
    correct: bool
    correct_answer: float
    explanation: str
