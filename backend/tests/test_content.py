from fastapi.testclient import TestClient

from app.main import app
from app.services import content_loader

client = TestClient(app)


def test_catalog_covers_classes_11_and_12():
    classes = client.get("/api/content/classes").json()
    assert [c["grade"] for c in classes] == [11, 12]
    assert all(c["availableCount"] >= 1 for c in classes)


def test_every_authored_chapter_is_in_the_catalog():
    catalog_ids = {ch.id for c in content_loader.catalog().classes for ch in c.chapters}
    assert set(content_loader.chapters()) <= catalog_ids


def test_chapter_hides_answers():
    chapter = client.get("/api/content/chapters/c11-limits-and-derivatives").json()
    question = chapter["topics"][0]["quiz"][0]
    assert "answer" not in question and "explanation" not in question


def test_class_detail_marks_availability():
    detail = client.get("/api/content/classes/11").json()
    available = [ch for ch in detail["chapters"] if ch["available"]]
    assert available and available[0]["topicIds"]
    assert client.get("/api/content/classes/10").status_code == 404


def test_quiz_check_numeric_and_mcq():
    numeric = client.post("/api/quiz/check", json={
        "chapterId": "c12-integrals", "topicId": "definite", "questionId": "df1", "answer": 9,
    }).json()
    assert numeric["correct"]
    mcq = client.post("/api/quiz/check", json={
        "chapterId": "c12-integrals", "topicId": "indefinite", "questionId": "i1", "answer": 0,
    }).json()
    assert not mcq["correct"] and mcq["correctAnswer"] == 1


def test_search_finds_topics():
    hits = client.get("/api/content/search", params={"q": "riemann"}).json()
    assert any(h["chapterId"] == "c12-integrals" for h in hits)


def test_every_mcq_answer_is_a_valid_option():
    for chapter in content_loader.chapters().values():
        for topic in chapter.topics:
            for question in topic.quiz:
                if question.type == "mcq":
                    assert question.options and 0 <= question.answer < len(question.options)


def test_labs():
    labs = client.get("/api/labs").json()
    assert len(labs) == 6 and labs[0]["id"] == "simple-pendulum"
    detail = client.get("/api/labs/ohms-law").json()
    assert detail["viva"] and detail["formula"]
    assert client.get("/api/labs/nope").status_code == 404
