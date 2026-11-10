import json
from functools import lru_cache

from pydantic import TypeAdapter

from app.config import SHARED_DIR
from app.schemas.automata import Example

_examples = TypeAdapter(list[Example])


@lru_cache(maxsize=1)
def load_examples() -> dict[str, Example]:
    raw = json.loads((SHARED_DIR / "automata" / "examples.json").read_text(encoding="utf-8"))
    return {example.machine.id: example for example in _examples.validate_python(raw["examples"])}
