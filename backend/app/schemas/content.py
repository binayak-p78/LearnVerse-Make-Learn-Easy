from typing import Literal, Self

from pydantic import Field, model_validator

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
    option_feedback: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _feedback_matches_options(self) -> Self:
        if self.option_feedback and len(self.option_feedback) != len(self.options or []):
            raise ValueError(f"{self.id}: optionFeedback needs one entry per option")
        return self


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
    prerequisites: list[str] = Field(default_factory=list)


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


class Diagnosis(ApiModel):
    code: Literal[
        "OPTION", "SIGN", "RECIPROCAL", "NEGATIVE_RECIPROCAL", "SQUARED", "SQUARE_ROOT",
        "FACTOR_TWO", "PLACE_VALUE", "DEGREES_RADIANS", "FACTOR_PI", "ROUNDING", "OFF_BY_ONE",
    ]
    message: str


class AnswerResult(ApiModel):
    correct: bool
    correct_answer: float
    explanation: str
    diagnosis: Diagnosis | None = None


class HintRequest(ApiModel):
    chapter_id: str
    topic_id: str
    question_id: str
    level: int = Field(ge=1, le=3)


class HintResult(ApiModel):
    level: int
    max_level: int
    kind: Literal["strategy", "example", "eliminate", "range"]
    text: str
    example_index: int | None = None
    eliminate: int | None = None


class MapNode(ApiModel):
    id: str
    grade: int
    number: int
    title: str
    available: bool
    topic_ids: list[str]
    prerequisites: list[str]


class ConceptMap(ApiModel):
    nodes: list[MapNode]
