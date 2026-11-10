import { Check, Lightbulb, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/Card";
import { api, ApiError, type Schemas, unwrap } from "@/services/api";
import { useProgress } from "@/services/progressStore";

type Question = Schemas["QuestionPublic"];
type Outcome = Schemas["AnswerResult"];

function QuestionCard({
  index,
  question,
  outcome,
  onCheck,
}: {
  index: number;
  question: Question;
  outcome?: Outcome;
  onCheck: (answer: number) => Promise<void>;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const options = question.options ?? [];
  const value = question.type === "mcq" ? choice : text.trim() === "" ? null : Number(text);
  const ready = value !== null && Number.isFinite(value);

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(undefined);
    try {
      await onCheck(value);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const correctText =
    outcome && (question.type === "mcq" ? options[outcome.correctAnswer] : String(outcome.correctAnswer));

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

      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {question.type === "mcq" ? (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Options</legend>
            {options.map((option, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  choice === i ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"
                }`}
              >
                <input type="radio" name={question.id} checked={choice === i} onChange={() => setChoice(i)} disabled={Boolean(outcome)} />
                {option}
              </label>
            ))}
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
              {busy ? "Checking…" : "Check"}
            </Button>
          )}
          {question.hint && !outcome && (
            <Button size="sm" variant="ghost" icon={<Lightbulb size={14} />} onClick={() => setShowHint((v) => !v)}>
              {showHint ? "Hide hint" : "Hint"}
            </Button>
          )}
        </div>
        {showHint && !outcome && <p className="text-xs text-muted">{question.hint}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
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

export function Quiz({ chapterId, topicId, questions }: { chapterId: string; topicId: string; questions: Question[] }) {
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [attempt, setAttempt] = useState(0);
  const saveQuizScore = useProgress((s) => s.saveQuizScore);
  const best = useProgress((s) => s.quizScores[`${chapterId}/${topicId}`]);
  const answered = Object.keys(outcomes).length;
  const correct = Object.values(outcomes).filter((o) => o.correct).length;

  if (questions.length === 0) return null;

  const check = async (question: Question, answer: number) => {
    const outcome = await unwrap(
      api.POST("/api/quiz/check", { body: { chapterId, topicId, questionId: question.id, answer } }),
    );
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
      <ol className="space-y-3" key={attempt}>
        {questions.map((q, i) => (
          <QuestionCard key={q.id} index={i} question={q} outcome={outcomes[q.id]} onCheck={(answer) => check(q, answer)} />
        ))}
      </ol>
      {answered === questions.length && (
        <Notice tone={correct === questions.length ? "success" : "neutral"} title={`You scored ${correct} out of ${questions.length}.`}>
          {correct === questions.length ? "Well done." : "Review the notes above and press Retry."}
        </Notice>
      )}
    </section>
  );
}
