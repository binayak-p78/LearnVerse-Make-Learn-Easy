import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.automata.examples import load_examples
from app.services.automata.structures import Stack, Tape

client = TestClient(app)
EXAMPLES = list(load_examples().values())
CASES = [(e.machine.id, case) for e in EXAMPLES for case in e.cases]


def dump(machine) -> dict:
    return machine.model_dump(mode="json")


def test_stack_is_persistent():
    base = Stack.of("Z")
    pushed = base.push_all("AB")
    assert pushed.snapshot() == ["A", "B", "Z"]
    top, rest = pushed.pop()
    assert top == "A" and rest.snapshot() == ["B", "Z"]
    assert base.snapshot() == ["Z"]
    assert Stack.of("AZ") == Stack().push("Z").push("A")
    assert len({Stack.of("AZ"), Stack.of("AZ")}) == 1


def test_tape_is_two_way_infinite():
    tape = Tape("_", "ab")
    tape.write(-3, "x")
    assert tape.read(-3) == "x" and tape.read(100) == "_"
    assert tape.content() == "x__ab"
    tape.write(-3, "_")
    assert tape.window(5) == (0, "ab____")


def test_every_example_is_valid():
    for example in EXAMPLES:
        report = client.post("/api/automata/validate", json={"machine": dump(example.machine)})
        assert report.status_code == 200
        assert report.json()["valid"], (example.machine.id, report.json()["errors"])


@pytest.mark.parametrize(("example_id", "case"), CASES, ids=[f"{i}:{c.input}" for i, c in CASES])
def test_examples_simulate(example_id, case):
    machine = load_examples()[example_id].machine
    response = client.post("/api/automata/simulate",
                           json={"machine": dump(machine), "input": case.input})
    assert response.status_code == 200, response.json()
    body = response.json()
    assert body["accepted"] is case.accepted, body["reason"]
    if case.output is not None:
        assert body["output"] == case.output


def test_list_examples_filters_by_kind():
    response = client.get("/api/automata/examples", params={"kind": "pda"})
    assert {e["kind"] for e in response.json()} == {"pda"}
    assert client.get("/api/automata/examples/nope").json()["detail"]["code"] == "NOT_FOUND"


def test_subset_construction_matches_nfa():
    nfa = load_examples()["nfa-third-last-1"]
    converted = client.post("/api/automata/convert/nfa-to-dfa",
                            json={"machine": dump(nfa.machine)}).json()
    assert len(converted["dfa"]["states"]) == 8
    assert converted["mapping"]["D0"] == ["q0"]
    for case in nfa.cases:
        run = client.post("/api/automata/simulate",
                          json={"machine": converted["dfa"], "input": case.input}).json()
        assert run["accepted"] is case.accepted


def test_epsilon_closure_in_subset_construction():
    nfa = load_examples()["nfa-epsilon-abc"].machine
    converted = client.post("/api/automata/convert/nfa-to-dfa", json={"machine": dump(nfa)}).json()
    assert converted["mapping"]["D0"] == ["q0", "q1", "q2"]
    assert "D0" in converted["dfa"]["accept"]


def test_minimize_merges_equivalent_states():
    machine = {
        "kind": "dfa", "alphabet": ["0", "1"], "start": "a", "accept": ["c", "d"],
        "states": [{"id": s} for s in "abcde"],
        "transitions": [
            {"id": "1", "from": "a", "to": "b", "read": "0"},
            {"id": "2", "from": "a", "to": "c", "read": "1"},
            {"id": "3", "from": "b", "to": "b", "read": "0"},
            {"id": "4", "from": "b", "to": "d", "read": "1"},
            {"id": "5", "from": "c", "to": "c", "read": "0"},
            {"id": "6", "from": "c", "to": "c", "read": "1"},
            {"id": "7", "from": "d", "to": "d", "read": "0"},
            {"id": "8", "from": "d", "to": "d", "read": "1"},
            {"id": "9", "from": "e", "to": "a", "read": "0"},
        ],
    }
    body = client.post("/api/automata/minimize", json={"machine": machine}).json()
    assert body["removedUnreachable"] == ["e"]
    assert sorted(map(sorted, body["partitions"])) == [["a", "b"], ["c", "d"]]
    assert body["addedTrap"] is False
    assert len(body["dfa"]["transitions"]) == 4


def test_minimize_rejects_nfa():
    nfa = load_examples()["nfa-ends-ab"].machine
    response = client.post("/api/automata/minimize", json={"machine": dump(nfa)})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "WRONG_KIND"


def test_validation_reports_problems():
    machine = {
        "kind": "dfa", "alphabet": ["a"], "start": "missing", "accept": [],
        "states": [{"id": "q0"}],
        "transitions": [
            {"id": "t1", "from": "q0", "to": "q0", "read": "a"},
            {"id": "t2", "from": "q0", "to": "q9", "read": "a"},
            {"id": "t3", "from": "q0", "to": "q0", "read": ""},
        ],
    }
    report = client.post("/api/automata/validate", json={"machine": machine}).json()
    codes = {e["code"] for e in report["errors"]}
    assert not report["valid"]
    assert {"UNKNOWN_STATE", "DFA_NONDETERMINISTIC", "DFA_EPSILON"} <= codes
    assert "NO_ACCEPT" in {w["code"] for w in report["warnings"]}


def test_simulate_rejects_invalid_machine_and_input():
    dfa = dump(load_examples()["dfa-even-zeros"].machine)
    bad_input = client.post("/api/automata/simulate", json={"machine": dfa, "input": "012"})
    assert bad_input.status_code == 400
    assert bad_input.json()["detail"]["code"] == "INVALID_INPUT"

    dfa["start"] = "nowhere"
    invalid = client.post("/api/automata/simulate", json={"machine": dfa, "input": "0"})
    assert invalid.status_code == 400
    assert invalid.json()["detail"]["code"] == "INVALID_MACHINE"


def test_schema_errors_use_consistent_shape():
    response = client.post("/api/automata/simulate", json={"machine": {"kind": "xyz"}})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "SCHEMA_ERROR"


def test_tm_step_limit_guards_infinite_loops():
    loop = {
        "kind": "tm", "alphabet": ["1"], "tapeAlphabet": ["1", "_"], "blank": "_",
        "start": "q", "accept": [], "states": [{"id": "q"}],
        "transitions": [{"id": "t", "from": "q", "to": "q", "read": "_", "write": "_",
                         "move": "R"}],
    }
    body = client.post("/api/automata/simulate",
                       json={"machine": loop, "input": "", "maxSteps": 50}).json()
    assert body["halted"] is False and body["accepted"] is False
    assert len(body["steps"]) == 51


def test_pda_returns_accepting_path_with_stack():
    pda = dump(load_examples()["pda-anbn"].machine)
    body = client.post("/api/automata/simulate", json={"machine": pda, "input": "aabb"}).json()
    stacks = [step["stack"] for step in body["steps"]]
    assert stacks[0] == ["Z"] and ["A", "A", "Z"] in stacks and stacks[-1] == ["Z"]


def test_export_import_round_trip():
    machine = dump(load_examples()["tm-binary-increment"].machine)
    document = client.post("/api/automata/export", json={"machine": machine}).json()
    assert document["schemaVersion"] == 1 and document["exportedAt"]
    imported = client.post("/api/automata/import", json=document).json()
    assert imported["machine"] == machine and imported["validation"]["valid"]

    document["schemaVersion"] = 99
    rejected = client.post("/api/automata/import", json=document)
    assert rejected.json()["detail"]["code"] == "UNSUPPORTED_VERSION"
