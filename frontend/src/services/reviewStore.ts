import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type Memory, type Rating, review } from "./fsrs";
import { safeStorage } from "./storage";

export interface CardRef {
  chapterId: string;
  topicId: string;
  questionId: string;
  prompt: string;
}

export interface ReviewCard extends CardRef, Memory {}

interface ReviewState {
  cards: Record<string, ReviewCard>;
  grade: (ref: CardRef, rating: Rating, now?: number) => void;
  forget: (key: string) => void;
  reset: () => void;
}

export const cardKey = (ref: Pick<CardRef, "chapterId" | "topicId" | "questionId">) => `${ref.chapterId}/${ref.topicId}/${ref.questionId}`;

export const useReviews = create<ReviewState>()(
  persist(
    (set) => ({
      cards: {},
      grade: (ref, rating, now = Date.now()) =>
        set((s) => {
          const key = cardKey(ref);
          const memory = review(s.cards[key], rating, now);
          return { cards: { ...s.cards, [key]: { ...ref, ...memory } } };
        }),
      forget: (key) =>
        set((s) => {
          const cards = { ...s.cards };
          delete cards[key];
          return { cards };
        }),
      reset: () => set({ cards: {} }),
    }),
    { name: "mle-reviews", version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);

export const dueCards = (cards: Record<string, ReviewCard>, now = Date.now()) =>
  Object.values(cards)
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due);
