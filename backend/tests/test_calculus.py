import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("x^3", "3*x**2"),
        ("sin(x^2)", "2*x*cos(x**2)"),
        ("x*e^x", "(x + 1)*exp(x)"),
        ("(x^2+1)/(x-1)", "(x**2 - 2*x - 1)/(x - 1)**2"),
        ("5", "0"),
    ],
)
def test_derivative(expression, expected):
    body = client.post("/api/calculus/derivative", json={"expression": expression}).json()
    assert body["result"] == f"d/dx = {expected}"
    assert body["steps"]


def test_derivative_names_the_rules():
    body = client.post("/api/calculus/derivative", json={"expression": "x*sin(x)"}).json()
    rules = [s["rule"] for s in body["steps"]]
    assert "Product rule" in rules and "Derivative of sin" in rules


def test_second_derivative():
    body = client.post("/api/calculus/derivative",
                       json={"expression": "x^4", "order": 2}).json()
    assert body["resultLatex"] == "12 x^{2}"


def test_indefinite_integral():
    body = client.post("/api/calculus/integral", json={"expression": "2x + cos(x)"}).json()
    assert body["result"] == "x**2 + sin(x) + C"
    assert "Sum rule" in [s["rule"] for s in body["steps"]]


def test_definite_integral():
    body = client.post("/api/calculus/integral",
                       json={"expression": "x^2", "lower": "0", "upper": "3"}).json()
    assert body["result"] == "9" and body["numeric"] == 9.0


def test_integration_by_parts_is_explained():
    body = client.post("/api/calculus/integral", json={"expression": "x*e^x"}).json()
    assert "Integration by parts" in [s["rule"] for s in body["steps"]]


def test_limits():
    sinc = client.post("/api/calculus/limit",
                       json={"expression": "sin(x)/x", "point": "0"}).json()
    assert sinc["result"] == "1"
    assert "Indeterminate 0/0" in [s["rule"] for s in sinc["steps"]]

    jump = client.post("/api/calculus/limit",
                       json={"expression": "abs(x)/x", "point": "0"}).json()
    assert jump["result"] == "does not exist"

    infinity = client.post("/api/calculus/limit",
                           json={"expression": "1/x", "point": "oo"}).json()
    assert infinity["result"] == "0"


@pytest.mark.parametrize(
    "expression",
    ["__import__('os')", "x; print(1)", "eval(x)", "lambda: 1", "9^9999", "xy"],
)
def test_unsafe_or_bad_input_is_rejected(expression):
    response = client.post("/api/calculus/derivative", json={"expression": expression})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "INVALID_EXPRESSION"
