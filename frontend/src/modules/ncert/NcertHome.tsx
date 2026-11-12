import { GraduationCap, Network, Repeat, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { LoadError } from "@/components/OfflineNotice";
import { SaveOfflineButton } from "@/components/SaveOfflineButton";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { gradeOfChapter, useProgress } from "@/services/progressStore";
import { dueCards, useReviews } from "@/services/reviewStore";
import { fetchClasses, type SearchHit, searchContent } from "./content";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full rounded-full bg-line">
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function NcertHome() {
  useTrackVisit("NCERT Mathematics", "ncert");
  const classes = useAsync(fetchClasses, []);
  const completed = useProgress((s) => s.completedTopics);
  const due = dueCards(useReviews((s) => s.cards)).length;
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [grade, setGrade] = useState<number | undefined>();
  const term = useDebounced(query.trim(), 250);
  const results = useAsync<SearchHit[]>(() => (term.length >= 2 ? searchContent(term, grade) : Promise.resolve([])), [term, grade]);

  const doneIn = (g: number) => Object.keys(completed).filter((k) => gradeOfChapter(k) === g).length;

  return (
    <>
      <PageHeader
        title="NCERT Mathematics"
        description="Class 11 and 12, organised by the NCERT textbooks. Each topic has notes, worked examples, a practice quiz and links into the graphing calculator."
        actions={
          <>
            <Link to="/ncert/map" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-hover">
              <Network size={14} aria-hidden /> Concept map
            </Link>
            <Link to="/review" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line/60 bg-surface-2 px-3 text-xs font-semibold hover:bg-line/70">
              <Repeat size={14} aria-hidden /> Review{due > 0 && <Badge tone="accent">{due} due</Badge>}
            </Link>
            <SaveOfflineButton />
          </>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Search lessons</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics, e.g. limits, ellipse, integration"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm"
            />
          </label>
          <select aria-label="Filter by class" className="h-10 rounded-lg border border-line bg-surface px-2 text-sm"
            value={grade ?? ""} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">All classes</option>
            {[11, 12].map((g) => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        {term.length >= 2 && (
          <div className="mt-3">
            {results.loading && <Skeleton className="h-10" />}
            {results.error && <p className="text-sm text-danger">{results.error.message}</p>}
            {results.data && results.data.length === 0 && <p className="text-sm text-muted">No matches for “{term}”.</p>}
            <ul className="divide-y divide-line">
              {results.data?.map((hit, i) => (
                <li key={i}>
                  <Link
                    to={hit.available ? `/ncert/chapter/${hit.chapterId}${hit.topicId ? `/${hit.topicId}` : ""}` : `/ncert/class/${hit.grade}`}
                    className="flex items-start justify-between gap-3 py-2.5 hover:text-accent"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{hit.title}</span>
                      {hit.snippet && <span className="block truncate text-xs text-muted">{hit.snippet}</span>}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <Badge>Class {hit.grade}</Badge>
                      <Badge tone={hit.type === "topic" ? "accent" : "neutral"}>{hit.type}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {classes.error && <LoadError error={classes.error} onRetry={classes.reload} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {classes.loading && Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-36" />)}
        {classes.data?.map((c) => {
          const done = doneIn(c.grade);
          return (
            <Link key={c.grade} to={`/ncert/class/${c.grade}`} className="group">
              <Card className="h-full p-4 transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <GraduationCap size={20} aria-hidden />
                  </span>
                  <Badge>{c.book}</Badge>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{c.title}</h2>
                <p className="text-xs text-muted">
                  {c.chapterCount} chapters · {c.availableCount} with lessons · {c.topicCount} topics
                </p>
                <div className="mt-3 space-y-1">
                  <ProgressBar value={c.topicCount ? done / c.topicCount : 0} label={`Class ${c.grade} progress`} />
                  <p className="text-[11px] text-muted">{done} of {c.topicCount} topics completed</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
