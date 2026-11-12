import { ArrowRight, BookOpen, CalendarClock, Repeat } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { LoadError, OfflineQuizNote } from "@/components/OfflineNotice";
import { Button } from "@/components/ui/Button";
import { Badge, Card, CardHeader, Notice, PageHeader, Skeleton } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { type Chapter, fetchChapter } from "@/modules/ncert/content";
import { type Outcome, QuestionCard, type QuizContext, useGradedCheck } from "@/modules/ncert/Quiz";
import { dayKey } from "@/services/progressStore";
import { retrievability } from "@/services/fsrs";
import { cardKey, dueCards, type ReviewCard, useReviews } from "@/services/reviewStore";

const DAY = 86_400_000;
const FORECAST_DAYS = 7;

function ReviewItem({ card, chapter, position, onDone }: { card: ReviewCard; chapter: Chapter; position: number; onDone: (correct: boolean) => void }) {
  const topic = chapter.topics.find((t) => t.id === card.topicId);
  const question = topic?.quiz.find((q) => q.id === card.questionId);
  const context: QuizContext = { chapterId: card.chapterId, topicId: card.topicId, examples: topic?.examples ?? [] };
  const check = useGradedCheck(context);
  const [outcome, setOutcome] = useState<Outcome>();

  if (!topic || !question) {
    return (
      <Notice tone="warning" title="This question was removed from the lesson." action={<Button size="sm" onClick={() => onDone(false)}>Skip</Button>}>
        It will be dropped from your reviews.
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        <Link to={`/ncert/chapter/${chapter.id}/${topic.id}`} className="hover:text-accent">{chapter.title} · {topic.title}</Link>
        {card.lapses > 0 && <> · forgotten {card.lapses}×</>}
      </p>
      <ol>
        <QuestionCard
          index={position}
          question={question}
          context={context}
          outcome={outcome}
          onCheck={async (answer, hintsUsed) => setOutcome(await check(question, answer, hintsUsed))}
        />
      </ol>
      {outcome && (
        <Button variant="primary" onClick={() => onDone(outcome.correct)}>
          Next <ArrowRight size={16} />
        </Button>
      )}
    </div>
  );
}

function Forecast({ cards }: { cards: ReviewCard[] }) {
  const now = Date.now();
  // Overdue cards count as due today
  const perDay = new Map<string, number>();
  for (const c of cards) {
    const key = dayKey(new Date(Math.max(c.due, now)));
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const days = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    const date = new Date(now + i * DAY);
    const key = dayKey(date);
    return { key, label: i === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" }), count: perDay.get(key) ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <ul className="flex h-28 items-end gap-2" aria-label="Reviews due over the next week">
      {days.map((d) => (
        <li key={d.key} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[11px] tabular-nums text-muted">{d.count || ""}</span>
          <span className="dots w-full rounded-lg" style={{ height: `${Math.max(6, (d.count / max) * 72)}px`, background: d.count ? "var(--salmon)" : undefined }} aria-hidden />
          <span className="text-[10px] text-muted">{d.label}</span>
          <span className="sr-only">{d.count} due</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReviewPage() {
  useTrackVisit("Daily Review", "review");
  const cards = useReviews((s) => s.cards);
  const forget = useReviews((s) => s.forget);
  const [session, setSession] = useState<string[] | null>(null);
  const [position, setPosition] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0 });

  const all = Object.values(cards);
  const due = dueCards(cards);
  const queue = session ?? due.map((c) => cardKey(c));
  const chapterIds = useMemo(() => [...new Set(queue.map((k) => cards[k]?.chapterId).filter(Boolean))].sort(), [queue.join("|")]);
  const chapters = useAsync(() => Promise.all(chapterIds.map(fetchChapter)), [chapterIds.join("|")]);
  const chapterById = new Map(chapters.data?.map((c) => [c.id, c]));
  const recall = all.length ? all.reduce((s, c) => s + retrievability((Date.now() - c.lastReview) / DAY, c.stability), 0) / all.length : null;

  const currentKey = session?.[position];
  const current = currentKey ? cards[currentKey] : undefined;
  const finished = session !== null && position >= session.length;

  const start = () => {
    setSession(due.map((c) => cardKey(c)));
    setPosition(0);
    setTally({ correct: 0, total: 0 });
  };

  const done = (correct: boolean) => {
    if (current && !chapterById.get(current.chapterId)?.topics.some((t) => t.id === current.topicId && t.quiz.some((q) => q.id === current.questionId))) {
      forget(cardKey(current));
    } else setTally((t) => ({ correct: t.correct + (correct ? 1 : 0), total: t.total + 1 }));
    setPosition((p) => p + 1);
  };

  return (
    <>
      <PageHeader
        title="Daily Review"
        description="Every quiz question you answer becomes a review card. A memory model (FSRS) schedules each one for when you are about to forget it: wrong answers return in minutes, easy ones drift out to weeks. Using hints counts as a harder recall."
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <CardHeader
            title={session && !finished ? `Card ${Math.min(position + 1, session.length)} of ${session.length}` : "Today's session"}
            actions={<Badge tone={due.length ? "accent" : "lime"}>{due.length} due now</Badge>}
          />
          <div className="space-y-3 p-4">
            <OfflineQuizNote />
            {all.length === 0 && (
              <Notice title="No review cards yet." action={<Link to="/ncert" className="text-sm font-medium text-accent">Open a lesson</Link>}>
                Answer practice questions in any NCERT topic and they will appear here on schedule.
              </Notice>
            )}
            {all.length > 0 && session === null && (
              due.length ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" icon={<Repeat size={16} />} onClick={start}>Start review ({due.length})</Button>
                  <span className="text-sm text-muted">About {Math.max(1, Math.round(due.length * 0.75))} min</span>
                </div>
              ) : (
                <p className="text-sm text-muted">Nothing is due. Come back {nextDueText(all)}.</p>
              )
            )}
            {session && !finished && chapters.error && <LoadError error={chapters.error} onRetry={chapters.reload} />}
            {session && !finished && chapters.loading && <Skeleton className="h-48" />}
            {session && !finished && current && chapterById.get(current.chapterId) && (
              <ReviewItem key={`${currentKey}-${position}`} card={current} chapter={chapterById.get(current.chapterId)!} position={position} onDone={done} />
            )}
            {finished && (
              <Notice tone="success" title={`Session done: ${tally.correct} of ${tally.total} recalled.`} action={<Button size="sm" onClick={() => setSession(null)}>Close</Button>}>
                Missed cards come back in about ten minutes. {dueCards(cards).length ? `${dueCards(cards).length} are due again now.` : `Next review ${nextDueText(all)}.`}
              </Notice>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Next 7 days" subtitle={`${all.length} card${all.length === 1 ? "" : "s"} in your deck`} />
            <div className="p-4"><Forecast cards={all} /></div>
          </Card>
          <Card>
            <CardHeader title="Memory estimate" />
            <div className="space-y-3 p-4 text-sm">
              <p className="text-3xl tabular-nums">{recall === null ? "—" : `${Math.round(recall * 100)}%`}</p>
              <p className="text-xs text-muted">Predicted chance you would recall a random card right now. Reviewing on schedule keeps it near 90%.</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span className="flex items-center gap-1"><CalendarClock size={13} aria-hidden /> {all.filter((c) => c.reps >= 3).length} learned (3+ reviews)</span>
                <span className="flex items-center gap-1"><BookOpen size={13} aria-hidden /> {new Set(all.map((c) => c.chapterId)).size} chapters</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function nextDueText(cards: ReviewCard[]): string {
  if (!cards.length) return "later";
  const next = Math.min(...cards.map((c) => c.due));
  const hours = (next - Date.now()) / 3_600_000;
  if (hours < 1) return "in a few minutes";
  if (hours < 24) return `in about ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  return `on ${new Date(next).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}`;
}
