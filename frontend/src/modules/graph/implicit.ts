export type Segment = [number, number, number, number];

// Marching squares over a pixel grid: returns line segments where F(x, y) changes sign
export function contour(
  F: (x: number, y: number) => number,
  width: number,
  height: number,
  toWorld: (px: number, py: number) => [number, number],
  cell = 5,
): Segment[] {
  const cols = Math.ceil(width / cell) + 1;
  const rows = Math.ceil(height / cell) + 1;
  const values = new Float64Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const [x, y] = toWorld(i * cell, j * cell);
      values[j * cols + i] = F(x, y);
    }
  }

  const segments: Segment[] = [];
  const edgePoint = (i0: number, j0: number, v0: number, i1: number, j1: number, v1: number): [number, number] => {
    const t = v0 / (v0 - v1);
    return [(i0 + (i1 - i0) * t) * cell, (j0 + (j1 - j0) * t) * cell];
  };

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = values[j * cols + i];
      const b = values[j * cols + i + 1];
      const c = values[(j + 1) * cols + i + 1];
      const d = values[(j + 1) * cols + i];
      if (![a, b, c, d].every(Number.isFinite)) continue;
      const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (code === 0 || code === 15) continue;
      // Sign flips across a pole (e.g. tan) are not real crossings
      const spread = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
      if (spread > 1e6) continue;

      const top = () => edgePoint(i, j, a, i + 1, j, b);
      const right = () => edgePoint(i + 1, j, b, i + 1, j + 1, c);
      const bottom = () => edgePoint(i, j + 1, d, i + 1, j + 1, c);
      const left = () => edgePoint(i, j, a, i, j + 1, d);
      const add = (p: [number, number], q: [number, number]) => segments.push([p[0], p[1], q[0], q[1]]);

      switch (code) {
        case 1: case 14: add(left(), bottom()); break;
        case 2: case 13: add(bottom(), right()); break;
        case 3: case 12: add(left(), right()); break;
        case 4: case 11: add(top(), right()); break;
        case 6: case 9: add(top(), bottom()); break;
        case 7: case 8: add(left(), top()); break;
        case 5: {
          const centre = (a + b + c + d) / 4;
          if (centre > 0) { add(left(), top()); add(bottom(), right()); }
          else { add(left(), bottom()); add(top(), right()); }
          break;
        }
        case 10: {
          const centre = (a + b + c + d) / 4;
          if (centre > 0) { add(left(), bottom()); add(top(), right()); }
          else { add(left(), top()); add(bottom(), right()); }
          break;
        }
      }
    }
  }
  return segments;
}
