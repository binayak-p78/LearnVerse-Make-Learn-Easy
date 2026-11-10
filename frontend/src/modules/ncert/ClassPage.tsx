import { CheckCircle2, ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router";
import { LoadError } from "@/components/OfflineNotice";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { useProgress } from "@/services/progressStore";
import { fetchClass } from "./content";
import { ProgressBar } from "./NcertHome";

export default function ClassPage() {
  const grade = Number(useParams().grade);
  const detail = useAsync(() => fetchClass(grade), [grade]);
  const completed = useProgress((s) => s.completedTopics);
  useTrackVisit(detail.data ? `NCERT Class ${grade}` : undefined, "ncert");

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted">
        <Link to="/ncert" className="hover:text-accent">NCERT Mathematics</Link> / Class {grade}
      </nav>
      <PageHeader title={`Class ${grade} Mathematics`} description={detail.data ? `NCERT ${detail.data.book}. Chapters marked “Coming soon” are listed for planning and have no lessons yet.` : undefined} />

      {detail.error && <LoadError error={detail.error} onRetry={detail.reload} />}
      {detail.loading && <Skeleton className="h-96" />}
      {detail.data && (
        <Card>
          <ol className="divide-y divide-line">
            {detail.data.chapters.map((ch) => {
              const done = ch.topicIds.filter((t) => completed[`${ch.id}/${t}`]).length;
              const content = (
                <div className="flex items-center gap-4 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-sm font-semibold">
                    {ch.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${ch.available ? "" : "text-muted"}`}>{ch.title}</p>
                    {ch.available ? (
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="w-32"><ProgressBar value={ch.topicCount ? done / ch.topicCount : 0} label={`${ch.title} progress`} /></div>
                        <span className="text-[11px] text-muted">{done}/{ch.topicCount} topics</span>
                      </div>
                    ) : null}
                  </div>
                  {ch.available ? (
                    done === ch.topicCount && ch.topicCount > 0 ? (
                      <CheckCircle2 size={18} className="text-success" aria-label="Completed" />
                    ) : (
                      <ChevronRight size={18} className="text-muted" aria-hidden />
                    )
                  ) : (
                    <Badge>Coming soon</Badge>
                  )}
                </div>
              );
              return (
                <li key={ch.id}>
                  {ch.available ? (
                    <Link to={`/ncert/chapter/${ch.id}`} className="block hover:bg-surface-2">{content}</Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </>
  );
}
