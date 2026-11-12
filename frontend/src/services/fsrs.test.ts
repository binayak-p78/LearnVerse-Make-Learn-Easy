import { describe, expect, it } from "vitest";
import { intervalDays, RATING, ratingFor, retrievability, review } from "./fsrs";

const DAY = 86_400_000;

describe("fsrs", () => {
  it("retrievability is 90% after one stability-length interval", () => {
    expect(retrievability(0, 5)).toBe(1);
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 6);
    expect(intervalDays(5)).toBe(5);
  });

  it("first reviews use the initial stabilities", () => {
    const t0 = 1_000_000;
    expect(review(undefined, RATING.good, t0).stability).toBeCloseTo(3.7145);
    expect(review(undefined, RATING.again, t0).due).toBe(t0 + 10 * 60_000);
    expect(review(undefined, RATING.easy, t0).difficulty).toBeLessThan(review(undefined, RATING.hard, t0).difficulty);
  });

  it("successful reviews grow the interval and lapses shrink it", () => {
    let t = 0;
    let card = review(undefined, RATING.good, t);
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      t = card.due;
      card = review(card, RATING.good, t);
      intervals.push((card.due - t) / DAY);
    }
    expect(intervals).toEqual([...intervals].sort((a, b) => a - b));
    expect(intervals.at(-1)).toBeGreaterThan(intervals[0]);

    const lapsed = review(card, RATING.again, card.due);
    expect(lapsed.stability).toBeLessThan(card.stability);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.difficulty).toBeGreaterThan(card.difficulty);
  });

  it("difficulty stays within 1 to 10", () => {
    let card = review(undefined, RATING.again, 0);
    for (let i = 1; i < 30; i++) card = review(card, RATING.again, i * DAY);
    expect(card.difficulty).toBeLessThanOrEqual(10);
    for (let i = 30; i < 60; i++) card = review(card, RATING.easy, i * DAY);
    expect(card.difficulty).toBeGreaterThanOrEqual(1);
  });

  it("maps quiz outcomes to ratings", () => {
    expect(ratingFor(false, 0)).toBe(RATING.again);
    expect(ratingFor(true, 2)).toBe(RATING.hard);
    expect(ratingFor(true, 0)).toBe(RATING.good);
  });
});
