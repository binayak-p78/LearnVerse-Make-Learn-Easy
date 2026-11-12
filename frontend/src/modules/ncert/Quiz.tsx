import { Check, Lightbulb, Stethoscope, X } from "lucide-react";
import { useState } from "react";
import { OfflineQuizNote } from "@/components/OfflineNotice";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { api, ApiError, type Schemas, unwrap } from "@/services/api";
import { ratingFor } from "@/services/fsrs";
import { useProgress } from "@/services/progressStore";
import { useReviews } from "@/services/reviewStore";

export type Question = Schemas["QuestionPublic"];
export type Outcome = Schemas["AnswerResult"];
type Hint = Schemas["HintResult"];
type Example = Schemas["WorkedExample"];

export interface QuizContext {
  chapterId: string;
  topicId: string;
  examples: Example[];
}

const MAX_HINTS = 3;

export const checkAnswer = (ctx: QuizContext, question: Question, answer: number) =>
  unwrap(api.POST("/api/quiz/check", { body: { chapterId: ctx.chapterId, topicId: ctx.topicId, questionId: question.id, answer } }));

const fetchHint = (ctx: QuizContext, question: Question, level: number) =>
  unwrap(api.POST("/api/quiz/hint", { body: { chapterId: ctx.chapterId, topicId: ctx.topicId, questionId: question.id, level } }));

// Grades the answer and schedules the question for spaced review
export function useGradedCheck(ctx: QuizContext) {
  const grade = useReviews((s) => s.grade);
  return async (question: Question, answer: number, hintsUsed: number) => {
    const outcome = await checkAnswer(ctx, question, answer);
    grade({ chapterId: ctx.chapterId, topicId: ctx.topicId, questionId: question.id, prompt: question.prompt }, ratingFor(outcome.correct, hintsUsed));
    return outcome;
  };
}

function HintView({ hint, examples }: { hint: Hint; examples: Example[] }) {
  const example = hint.exampleIndex !== null && hint.exampleIndex !== undefined ? examples[hint.exampleIndex] : undefined;
  return (
    <li className="rounded-xl border border-line/70 bg-surface-2 px-3 py-2 text-xs">
      <span className="mr-1.5 font-semibold text-muted">Hint {hint.level}.</span>
      {hint.text}
      {example && (
        <details className="mt-2 rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-3 py-2"><Markdown className="inline text-xs [&_p]:inline">{example.problem}</Markdown></summary>
          <div className="border-t border-line px-3 py-2"><Markdown className="text-xs">{example.solution}</Markdown></div>
        </details>
      )}
    </li>
  );
}

export function QuestionCard({
  index,
  question,
  context,
  outcome,
  onCheck,
}: {
  index: number;
  question: Question;
  context: QuizContext;
  outcome?: Outcome;
  onCheck: (answer: number, hintsUsed: number) => Promise<void>;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [hints, setHints] = useState<Hint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const options = question.options ?? [];
  const eliminated = new Set(hints.map((h) => h.eliminate).filter((i): i is number => i !== null && i !== undefined));
  const value = question.type === "mcq" ? choice : text.trim() === "" ? null : Number(text);
  const ready = value !== null && Number.isFinite(value);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => ready && run(() => onCheck(value, hints.length));
  const nextHint = () => run(async () => {
    const hint = await fetchHint(context, question, hints.length + 1);
    setHints((h) => [...h, hint]);
    if (hint.eliminate !== null && hint.eliminate !== undefined && choice === hint.eliminate) setChoice(null);
  });

  const correctText = outcome && (question.type === "mcq" ? options[outcome.correctAnswer] : String(outcome.correctAnswer));

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">
          <span className="mr-2 text-muted">Q{index + 1}.</span>
          {question.prompt}
        </p>
        {outcome && (
          <Badge tone={outcome.correct ? "success" : "danger"}>
            {outcome.correct ? <Check size={12} /> : <X size={12} />} {outcome.correct ? "Correct" : "Not quite"}
          </Badge>
        )}
      </div>

      <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {question.type === "mcq" ? (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Options</legend>
            {options.map((option, i) => {
              const out = eliminated.has(i);
              return (
                <label
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    out ? "cursor-not-allowed border-line text-muted line-through opacity-60" : choice === i ? "cursor-pointer border-accent bg-accent-soft" : "cursor-pointer border-line hover:bg-surface-2"
                  }`}
                >
                  <input type="radio" name={`${context.topicId}-${question.id}`} checked={choice === i} onChange={() => setChoice(i)} disabled={Boolean(outcome) || out} />
                  {option}
                  {out && <span className="sr-only">(ruled out)</span>}
                </label>
              );
            })}
          </fieldset>
        ) : (
          <input
            aria-label="Your answer"
            inputMode="decimal"
            className="h-9 w-40 rounded-lg border border-line bg-surface px-2.5 font-mono text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={Boolean(outcome)}
            placeholder="Your answer"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!outcome && (
            <Button type="submit" size="sm" variant="primary" disabled={!ready || busy}>
              {busy ? "Working…" : "Check"}
            </Button>
          )}
          {!outcome && hints.length < MAX_HINTS && (
            <Button size="sm" variant="ghost" icon={<Lightbulb size={14} />} onClick={() => void nextHint()} disabled={busy}>
              {hints.length === 0 ? "Hint" : `Another hint (${hints.length + 1}/${MAX_HINTS})`}
            </Button>
          )}
          {hints.length > 0 && !outcome && <span className="text-[11px] text-muted">Hints lower how soon this comes back for review.</span>}
        </div>
        {hints.length > 0 && (
          <ol className="space-y-1.5" aria-live="polite">
            {hints.map((h) => <HintView key={h.level} hint={h} examples={context.examples} />)}
          </ol>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        {outcome && !outcome.correct && outcome.diagnosis && (
          <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-xs" role="status">
            <Stethoscope size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <p><span className="font-semibold">What likely went wrong: </span>{outcome.diagnosis.message}</p>
          </div>
        )}
        {outcome && (
          <p className="text-xs text-muted">
            {!outcome.correct && <>Answer: <strong className="text-ink">{correctText}</strong>. </>}
            {outcome.explanation}
          </p>
        )}
      </form>
    </li>
  );
}

export function Quiz({ chapterId, topicId, questions, examples }: { chapterId: string; topicId: string; questions: Question[]; examples: Example[] }) {
  const context: QuizContext = { chapterId, topicId, examples };
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [attempt, setAttempt] = useState(0);
  const saveQuizScore = useProgress((s) => s.saveQuizScore);
  const best = useProgress((s) => s.quizScores[`${chapterId}/${topicId}`]);
  const gradedCheck = useGradedCheck(context);
  const answered = Object.keys(outcomes).length;
  const correct = Object.values(outcomes).filter((o) => o.correct).length;

  if (questions.length === 0) return null;

  const check = async (question: Question, answer: number, hintsUsed: number) => {
    const outcome = await gradedCheck(question, answer, hintsUsed);
    setOutcomes((prev) => {
      const next = { ...prev, [question.id]: outcome };
      if (Object.keys(next).length === questions.length) {
        saveQuizScore(`${chapterId}/${topicId}`, Object.values(next).filter((o) => o.correct).length, questions.length);
      }
      return next;
    });
  };

  return (
    <section aria-labelledby={`quiz-${topicId}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`quiz-${topicId}`} className="text-base font-semibold">Practice</h2>
        <div className="flex items-center gap-2 text-xs text-muted">
          {best && <span>Last score: {best.correct}/{best.total}</span>}
          <Badge tone="accent">{correct}/{answered} correct</Badge>
          {answered > 0 && (
            <Button size="sm" variant="ghost" onClick={() => { setOutcomes({}); setAttempt((a) => a + 1); }}>
              Retry
            </Button>
          )}
        </div>
      </div>
      <OfflineQuizNote />
      <ol className="space-y-3" key={attempt}>
        {questions.map((q, i) => (
          <QuestionCard key={q.id} index={i} question={q} context={context} outcome={outcomes[q.id]} onCheck={(answer, hintsUsed) => check(q, answer, hintsUsed)} />
        ))}
      </ol>
      {answered === questions.length && (
        <Notice tone={correct === questions.length ? "success" : "neutral"} title={`You scored ${correct} out of ${questions.length}.`}>
          {correct === questions.length ? "Well done. These questions will come back in Daily Review." : "Review the notes above and press Retry. Missed questions come back in Daily Review soon."}
        </Notice>
      )}
    </section>
  );
}
