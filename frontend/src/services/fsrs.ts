export type Rating = 1 | 2 | 3 | 4;

export const RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const satisfies Record<string, Rating>;

export interface Memory {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number;
  due: number;
}

// FSRS-4.5 default weights
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755] as const;
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 86_400_000;
export const DESIRED_RETENTION = 0.9;
const MAX_INTERVAL_DAYS = 365;

const clampDifficulty = (d: number) => Math.min(10, Math.max(1, d));

export const retrievability = (elapsedDays: number, stability: number) =>
  (1 + (FACTOR * Math.max(0, elapsedDays)) / stability) ** DECAY;

export function intervalDays(stability: number, retention = DESIRED_RETENTION): number {
  const days = (stability / FACTOR) * (retention ** (1 / DECAY) - 1);
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));
}

const initialDifficulty = (rating: Rating) => clampDifficulty(W[4] - (rating - 3) * W[5]);

function nextDifficulty(d: number, rating: Rating): number {
  const updated = d - W[6] * (rating - 3);
  // Mean reversion towards the default difficulty keeps ratings from drifting forever
  return clampDifficulty(W[7] * initialDifficulty(RATING.good) + (1 - W[7]) * updated);
}

function recallStability(d: number, s: number, r: number, rating: Rating): number {
  const hard = rating === RATING.hard ? W[15] : 1;
  const easy = rating === RATING.easy ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}

const forgetStability = (d: number, s: number, r: number) =>
  Math.min(s, W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - r)));

// Failed cards come back the same day; everything else is scheduled at the 90% recall point
export function review(memory: Memory | undefined, rating: Rating, now = Date.now()): Memory {
  if (!memory) {
    const stability = W[rating - 1];
    return {
      stability,
      difficulty: initialDifficulty(rating),
      reps: 1,
      lapses: rating === RATING.again ? 1 : 0,
      lastReview: now,
      due: rating === RATING.again ? now + 10 * 60_000 : now + intervalDays(stability) * DAY,
    };
  }
  const elapsed = (now - memory.lastReview) / DAY;
  const r = retrievability(elapsed, memory.stability);
  const difficulty = nextDifficulty(memory.difficulty, rating);
  const failed = rating === RATING.again;
  const stability = failed ? forgetStability(memory.difficulty, memory.stability, r) : recallStability(memory.difficulty, memory.stability, r, rating);
  return {
    stability,
    difficulty,
    reps: memory.reps + 1,
    lapses: memory.lapses + (failed ? 1 : 0),
    lastReview: now,
    due: failed ? now + 10 * 60_000 : now + intervalDays(stability) * DAY,
  };
}

export function ratingFor(correct: boolean, hintsUsed: number): Rating {
  if (!correct) return RATING.again;
  return hintsUsed > 0 ? RATING.hard : RATING.good;
}
