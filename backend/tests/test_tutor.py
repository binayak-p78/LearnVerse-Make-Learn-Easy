import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import content_loader, tutor

client = TestClient(app)


@pytest.mark.parametrize(
    ("given", "correct", "code"),
    [
        (0.5, -0.5, "SIGN"),
        (3.0, -3.0, "SIGN"),
        (2.0, -0.5, "NEGATIVE_RECIPROCAL"),
        (4.0, 0.25, "RECIPROCAL"),
        (24.0, 12.0, "FACTOR_TWO"),
        (25.0, 5.0, "SQUARED"),
        (3.0, 9.0, "SQUARE_ROOT"),
        (120.0, 2.094, "DEGREES_RADIANS"),
        (6.0, 6 * math.pi, "FACTOR_PI"),
        (0.6, 6.0, "PLACE_VALUE"),
        (2.3, 2.333, "ROUNDING"),
        (11.0, 12.0, "OFF_BY_ONE"),
    ],
)
def test_numeric_rules(given, correct, code):
    diagnosis = tutor.diagnose_numeric(given, correct)
    assert diagnosis is not None and diagnosis.code == code


def test_unrelated_answer_has_no_diagnosis():
    assert tutor.diagnose_numeric(7.3, 2.0) is None


def _check(chapter, topic, question, answer):
    return client.post("/api/quiz/check", json={
        "chapterId": chapter, "topicId": topic, "questionId": question, "answer": answer,
    }).json()


def test_wrong_answers_are_diagnosed():
    squared = _check("c11-conic-sections", "circle-parabola", "c1", 25)["diagnosis"]
    assert squared["code"] == "SQUARED"
    option = _check("c12-integrals", "indefinite", "i1", 0)["diagnosis"]
    assert option["code"] == "OPTION" and "Sign slip" in option["message"]


def test_correct_answer_has_no_diagnosis():
    assert _check("c12-integrals", "indefinite", "i1", 1)["diagnosis"] is None


def test_option_feedback_stays_private():
    chapter = client.get("/api/content/chapters/c12-integrals").json()
    question = chapter["topics"][0]["quiz"][0]
    assert "optionFeedback" not in question


def _hint(level, chapter="c12-integrals", topic="methods", question="b1"):
    return client.post("/api/quiz/hint", json={
        "chapterId": chapter, "topicId": topic, "questionId": question, "level": level,
    })


def test_hint_ladder_never_reveals_the_answer():
    first, second, third = (_hint(level).json() for level in (1, 2, 3))
    assert first["kind"] == "strategy" and first["text"]
    assert second["kind"] == "example" and second["exampleIndex"] == 0
    assert third["kind"] == "eliminate" and third["eliminate"] != 0
    assert _hint(3).json()["eliminate"] == third["eliminate"]


def test_numeric_hint_gives_a_range():
    body = _hint(3, "c12-application-of-derivatives", "tangents-rates", "t3").json()
    assert body["kind"] == "range" and "between 100 and 1000" in body["text"]


def test_hint_level_is_validated():
    assert _hint(4).status_code == 422
    assert _hint(1, question="missing").status_code == 404


def test_every_question_has_a_hint_and_valid_feedback():
    for chapter in content_loader.chapters().values():
        for topic in chapter.topics:
            for question in topic.quiz:
                assert question.hint, f"{chapter.id}/{topic.id}/{question.id}"
                if question.option_feedback:
                    assert question.option_feedback[int(question.answer)] == ""


def test_strategy_rules_match_keywords():
    question = content_loader.find_question("c11-limits-and-derivatives", "limits", "l1")[1]
    assert "0/0" in tutor.strategy(question)


def test_concept_map_is_a_dag_over_the_catalog():
    nodes = {n["id"]: n for n in client.get("/api/content/map").json()["nodes"]}
    assert len(nodes) == 27
    for node in nodes.values():
        assert set(node["prerequisites"]) <= nodes.keys()

    state: dict[str, int] = {}

    def visit(node_id: str) -> None:
        assert state.get(node_id) != 1, f"cycle through {node_id}"
        if state.get(node_id) == 2:
            return
        state[node_id] = 1
        for parent in nodes[node_id]["prerequisites"]:
            visit(parent)
        state[node_id] = 2

    for node_id in nodes:
        visit(node_id)
    assert nodes["c12-integrals"]["available"] and nodes["c12-integrals"]["topicIds"]
