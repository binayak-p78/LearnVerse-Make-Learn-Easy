import math

Point = tuple[float, float]


def grid_layout(count: int, spacing_x: float = 200, spacing_y: float = 170) -> list[Point]:
    columns = max(1, math.ceil(math.sqrt(count)))
    return [
        (100 + (i % columns) * spacing_x, 100 + (i // columns) * spacing_y)
        for i in range(count)
    ]
