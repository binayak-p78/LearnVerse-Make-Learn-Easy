import json
import re
from functools import lru_cache

from app.config import CONTENT_DIR
from app.schemas.content import (
    Catalog,
    ChapterFile,
    ChapterPublic,
    ChapterSummary,
    ClassDetail,
    ClassSummary,
    ConceptMap,
    MapNode,
    Question,
    QuestionPublic,
    SearchHit,
    Topic,
    TopicPublic,
)

NCERT_DIR = CONTENT_DIR / "ncert"


@lru_cache(maxsize=1)
def catalog() -> Catalog:
    return Catalog.model_validate_json((NCERT_DIR / "catalog.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def chapters() -> dict[str, ChapterFile]:
    loaded: dict[str, ChapterFile] = {}
    for path in sorted(NCERT_DIR.glob("class-*/*.json")):
        chapter = ChapterFile.model_validate(json.loads(path.read_text(encoding="utf-8")))
        loaded[chapter.id] = chapter
    return loaded


def to_public(chapter: ChapterFile) -> ChapterPublic:
    return ChapterPublic(
        id=chapter.id, grade=chapter.grade, number=chapter.number, title=chapter.title,
        summary=chapter.summary,
        topics=[
            TopicPublic(
                id=t.id, title=t.title, notes=t.notes, examples=t.examples, widget=t.widget,
                quiz=[QuestionPublic(id=q.id, type=q.type, prompt=q.prompt, options=q.options,
                                     hint=q.hint) for q in t.quiz],
            )
            for t in chapter.topics
        ],
    )


def class_summaries() -> list[ClassSummary]:
    authored = chapters()
    return [
        ClassSummary(
            grade=c.grade, title=c.title, book=c.book, chapter_count=len(c.chapters),
            available_count=sum(ch.id in authored for ch in c.chapters),
            topic_count=sum(len(authored[ch.id].topics) for ch in c.chapters if ch.id in authored),
        )
        for c in catalog().classes
    ]


def class_detail(grade: int) -> ClassDetail | None:
    authored = chapters()
    for c in catalog().classes:
        if c.grade != grade:
            continue
        summaries = []
        for ch in c.chapters:
            full = authored.get(ch.id)
            summaries.append(ChapterSummary(
                id=ch.id, number=ch.number, title=ch.title, available=full is not None,
                summary=full.summary if full else "",
                topic_count=len(full.topics) if full else 0,
                topic_ids=[t.id for t in full.topics] if full else [],
            ))
        return ClassDetail(grade=c.grade, title=c.title, book=c.book, chapters=summaries)
    return None


def _snippet(text: str, query: str, width: int = 90) -> str:
    plain = re.sub(r"[#*$`\\]", "", text)
    at = plain.lower().find(query.lower())
    if at < 0:
        return plain[:width].strip()
    start = max(0, at - width // 3)
    return ("…" if start else "") + plain[start:start + width].strip() + "…"


def search(query: str, grade: int | None, limit: int = 30) -> list[SearchHit]:
    q = query.strip().lower()
    authored = chapters()
    hits: list[SearchHit] = []
    for c in catalog().classes:
        if grade is not None and c.grade != grade:
            continue
        for ch in c.chapters:
            full = authored.get(ch.id)
            if q in ch.title.lower():
                hits.append(SearchHit(type="chapter", grade=c.grade, chapter_id=ch.id,
                                      title=ch.title, snippet=full.summary if full else "",
                                      available=full is not None))
            if full is None:
                continue
            for topic in full.topics:
                if q in topic.title.lower() or q in topic.notes.lower():
                    hits.append(SearchHit(type="topic", grade=c.grade, chapter_id=ch.id,
                                          topic_id=topic.id, title=topic.title,
                                          snippet=_snippet(topic.notes, q), available=True))
    return hits[:limit]



def concept_map() -> ConceptMap:
    authored = chapters()
    return ConceptMap(nodes=[
        MapNode(
            id=ch.id, grade=c.grade, number=ch.number, title=ch.title,
            available=ch.id in authored,
            topic_ids=[t.id for t in authored[ch.id].topics] if ch.id in authored else [],
            prerequisites=ch.prerequisites,
        )
        for c in catalog().classes
        for ch in c.chapters
    ])


def find_question(
    chapter_id: str, topic_id: str, question_id: str,
) -> tuple[Topic, Question] | None:
    chapter = chapters().get(chapter_id)
    topic = next((t for t in chapter.topics if t.id == topic_id), None) if chapter else None
    question = next((q for q in topic.quiz if q.id == question_id), None) if topic else None
    return (topic, question) if topic and question else None
