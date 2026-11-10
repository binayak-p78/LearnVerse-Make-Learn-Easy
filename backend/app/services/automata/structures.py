from __future__ import annotations

from collections.abc import Iterable, Iterator
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class _Node:
    value: str
    below: _Node | None


class Stack:
    # Persistent linked stack: push/pop return new stacks that share their tail,
    # so PDA branches can fork cheaply and configurations stay hashable.
    __slots__ = ("_top", "_size", "_key")

    def __init__(self, top: _Node | None = None, size: int = 0) -> None:
        self._top = top
        self._size = size
        self._key: tuple[str, ...] | None = None

    @classmethod
    def of(cls, symbols: Iterable[str]) -> Stack:
        stack = cls()
        for symbol in reversed(list(symbols)):
            stack = stack.push(symbol)
        return stack

    def push(self, symbol: str) -> Stack:
        return Stack(_Node(symbol, self._top), self._size + 1)

    def push_all(self, symbols: str) -> Stack:
        stack = self
        for symbol in reversed(symbols):
            stack = stack.push(symbol)
        return stack

    def pop(self) -> tuple[str, Stack]:
        if self._top is None:
            raise IndexError("pop from empty stack")
        return self._top.value, Stack(self._top.below, self._size - 1)

    def peek(self) -> str | None:
        return None if self._top is None else self._top.value

    def is_empty(self) -> bool:
        return self._top is None

    def __len__(self) -> int:
        return self._size

    def __iter__(self) -> Iterator[str]:
        node = self._top
        while node is not None:
            yield node.value
            node = node.below

    def snapshot(self) -> list[str]:
        return list(self)

    def _identity(self) -> tuple[str, ...]:
        if self._key is None:
            self._key = tuple(self)
        return self._key

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Stack) and self._identity() == other._identity()

    def __hash__(self) -> int:
        return hash(self._identity())

    def __repr__(self) -> str:
        return f"Stack({''.join(self)})"


class Tape:
    # Sparse, two-way infinite tape: only non-blank cells are stored.
    __slots__ = ("blank", "_cells")

    def __init__(self, blank: str, content: str = "") -> None:
        self.blank = blank
        self._cells: dict[int, str] = {i: c for i, c in enumerate(content) if c != blank}

    def read(self, position: int) -> str:
        return self._cells.get(position, self.blank)

    def write(self, position: int, symbol: str) -> None:
        if symbol == self.blank:
            self._cells.pop(position, None)
        else:
            self._cells[position] = symbol

    def bounds(self) -> tuple[int, int] | None:
        if not self._cells:
            return None
        return min(self._cells), max(self._cells)

    def window(self, head: int, margin: int = 0) -> tuple[int, str]:
        bounds = self.bounds()
        low, high = (head, head) if bounds is None else (min(bounds[0], head), max(bounds[1], head))
        low, high = low - margin, high + margin
        return low, "".join(self.read(i) for i in range(low, high + 1))

    def content(self) -> str:
        bounds = self.bounds()
        if bounds is None:
            return ""
        return "".join(self.read(i) for i in range(bounds[0], bounds[1] + 1))
