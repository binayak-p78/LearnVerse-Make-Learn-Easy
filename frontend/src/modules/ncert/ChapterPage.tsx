import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { BookmarkButton } from "@/components/BookmarkButton";
import { LoadError } from "@/components/OfflineNotice";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Skeleton } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { useProgress } from "@/services/progressStore";
import { fetchChapter, widgetHref } from "./content";
import { Quiz } from "./Quiz";

export default function ChapterPage() {
  const { chapterId = "", topicId } = useParams();
  const navigate = useNavigate();
  const chapter = useAsync(() => fetchChapter(chapterId), [chapterId]);
  const completed = useProgress((s) => s.completedTopics);
  const setTopicComplete = useProgress((s) => s.setTopicComplete);

  const topics = chapter.data?.topics ?? [];
  const index = Math.max(0, topics.findIndex((t) => t.id === topicId));
  const topic = topics[index];
  useTrackVisit(chapter.data && topic ? `${chapter.data.title}: ${topic.title}` : undefined, "ncert");

  if (chapter.error) return <LoadError error={chapter.error} onRetry={chapter.reload} />;
  if (chapter.loading || !chapter.data) return <Skeleton className="h-[480px]" />;
  if (!topic) return <p className="text-muted">This chapter has no topics yet.</p>;

  const data = chapter.data;
  const key = `${data.id}/${topic.id}`;
  const done = Boolean(completed[key]);
  const go = (i: number) => navigate(`/ncert/chapter/${data.id}/${topics[i].id}`);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted">
        <Link to="/ncert" className="hover:text-accent">NCERT Mathematics</Link> /{" "}
        <Link to={`/ncert/class/${data.grade}`} className="hover:text-accent">Class {data.grade}</Link> / Chapter {data.number}
      </nav>
      <PageHeader
        title={`${data.number}. ${data.title}`}
        description={data.summary}
        actions={<BookmarkButton title={`${data.title}: ${topic.title}`} module="ncert" />}
      />

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-6">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col" aria-label="Topics">
            {topics.map((t, i) => {
              const isDone = Boolean(completed[`${data.id}/${t.id}`]);
              return (
                <li key={t.id} className="shrink-0">
                  <Link
                    to={`/ncert/chapter/${data.id}/${t.id}`}
                    aria-current={i === index ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${i === index ? "bg-accent-soft font-medium text-accent" : "hover:bg-surface-2"}`}
                  >
                    {isDone ? <CheckCircle2 size={15} className="text-success" aria-label="Completed" /> : <Circle size={15} className="text-muted" aria-hidden />}
                    <span className="whitespace-nowrap lg:whitespace-normal">{t.title}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{topic.title}</h2>
              <Button
                size="sm"
                variant={done ? "primary" : "secondary"}
                icon={done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                aria-pressed={done}
                onClick={() => setTopicComplete(key, !done)}
              >
                {done ? "Completed" : "Mark as complete"}
              </Button>
            </div>
            <Markdown>{topic.notes}</Markdown>
            {topic.widget && (
              <Link
                to={widgetHref(topic.widget)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-accent hover:border-accent"
              >
                <ExternalLink size={14} aria-hidden /> Try it: {topic.widget.label}
              </Link>
            )}
          </Card>

          {topic.examples.length > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 text-base font-semibold">Worked examples</h2>
              <div className="space-y-2">
                {topic.examples.map((ex, i) => (
                  <details key={i} className="group rounded-lg border border-line">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm">
                      <span className="mr-2 font-semibold text-accent">Example {i + 1}</span>
                      <Markdown className="inline [&_p]:inline">{ex.problem}</Markdown>
                    </summary>
                    <div className="border-t border-line px-4 py-3">
                      <Markdown>{ex.solution}</Markdown>
                    </div>
                  </details>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5 sm:p-6">
            <Quiz key={key} chapterId={data.id} topicId={topic.id} questions={topic.quiz} examples={topic.examples} />
          </Card>

          <div className="flex flex-wrap justify-between gap-2">
            <Button icon={<ArrowLeft size={16} />} disabled={index === 0} onClick={() => go(index - 1)}>
              Previous topic
            </Button>
            {index < topics.length - 1 ? (
              <Button variant="primary" onClick={() => { setTopicComplete(key, true); go(index + 1); }}>
                Next topic <ArrowRight size={16} />
              </Button>
            ) : (
              <Link to={`/ncert/class/${data.grade}`} className="inline-flex h-10 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-on-accent">
                Back to Class {data.grade}
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
