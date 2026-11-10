import { ArrowRight, BookOpen, CalendarDays, CheckSquare, Clock, Flame, Plus, Square, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { moduleByKey, MODULES } from "@/app/modules";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { fetchClasses } from "@/modules/ncert/content";
import { dayKey, gradeOfChapter, streak, useProgress, type Visit } from "@/services/progressStore";
import { CurveHero } from "./CurveHero";
import { ActivityBars, ago, type DayActivity, ListRow, SectionCard, StatCard } from "./widgets";

const LAB_EXPERIMENTS = 6;
const RECENT_PREVIEW = 6;

function lastDays(count: number, activity: Record<string, number>): DayActivity[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - 1 - i));
    const key = dayKey(date);
    return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2), actions: activity[key] ?? 0 };
  });
}

const isToday = (at: number) => dayKey(new Date(at)) === dayKey();

function HeroHeader({ days, lastVisit }: { days: number; lastVisit?: Visit }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const facts = [
    { icon: CalendarDays, label: "Today", value: new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) },
    { icon: Flame, label: "Streak", value: `${days} day${days === 1 ? "" : "s"}` },
  ];
  return (
    <Card className="flex flex-wrap items-center gap-4 p-3 pr-4 sm:flex-nowrap">
      <span className="hidden h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] bg-lime text-on-lime sm:flex">
        <BookOpen size={28} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {greeting}
          {days > 0 ? <Badge tone="lime">Active</Badge> : <Badge>Start today</Badge>}
        </h1>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {facts.map((f) => (
            <div key={f.label} className="flex items-center gap-2.5">
              <span className="card-edge flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2"><f.icon size={16} aria-hidden /></span>
              <span className="leading-tight">
                <dt className="text-xs text-muted">{f.label}</dt>
                <dd className="text-sm font-medium">{f.value}</dd>
              </span>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex gap-2">
        <Link to="/graph" aria-label="New graph" title="New graph" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary hover:bg-primary-hover">
          <Plus size={20} aria-hidden />
        </Link>
        <Link
          to={lastVisit?.path ?? "/ncert"}
          aria-label={lastVisit ? `Continue: ${lastVisit.title}` : "Start a lesson"}
          title={lastVisit ? `Continue: ${lastVisit.title}` : "Start a lesson"}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary hover:bg-primary-hover"
        >
          <ArrowRight size={20} aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

interface PlanRow {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  metric: string;
  metricHint: string;
  trailing: string;
  to: string;
}

function PlanCard({ rows }: { rows: PlanRow[] }) {
  return (
    <div className="card-edge rounded-[24px] bg-surface/80 p-2 shadow-card backdrop-blur-md">
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.id}>
            <Link
              to={r.to}
              className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-colors ${
                i === 0 ? "bg-primary text-on-primary" : "card-edge bg-surface-2 hover:bg-surface"
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold tabular-nums ${i === 0 ? "bg-surface-2 text-ink" : "bg-surface text-ink"}`}>{r.badge}</span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-medium">{r.title}</span>
                <span className={`mt-1 block truncate text-[11px] ${i === 0 ? "opacity-70" : "text-muted"}`}>{r.subtitle}</span>
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-medium tabular-nums">{r.metric}</span>
                <span className={`mt-1 block truncate text-[11px] ${i === 0 ? "opacity-70" : "text-muted"}`}>{r.metricHint}</span>
              </span>
              <span className="text-xs font-semibold tabular-nums">{r.trailing}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link to={rows[0]?.to ?? "/ncert"} className="flex h-11 items-center justify-center rounded-2xl bg-primary text-sm font-medium text-on-primary hover:bg-primary-hover">
          Continue
        </Link>
        <Link to="/ncert" className="card-edge flex h-11 items-center justify-center rounded-2xl bg-surface-2 text-sm font-medium hover:bg-surface">
          All lessons
        </Link>
      </div>
    </div>
  );
}

function RecentTable({ items }: { items: Visit[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, RECENT_PREVIEW);
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Recently opened</h2>
        {items.length > RECENT_PREVIEW && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            {expanded ? "Show less" : "See all"} <ArrowRight size={15} className={expanded ? "-rotate-90" : ""} aria-hidden />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">Nothing yet. Pick a module to begin.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="w-[48%] rounded-l-2xl bg-surface-2 px-3.5 py-3 font-normal">Item</th>
                <th scope="col" className="bg-surface-2 px-3 py-3 font-normal">Module</th>
                <th scope="col" className="rounded-r-2xl bg-surface-2 px-3.5 py-3 text-right font-normal">When</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((v) => (
                <tr key={v.path} className="border-b border-line/80 last:border-0">
                  <td className="px-3.5 py-3.5">
                    <Link to={v.path} className="block truncate font-medium hover:underline">{v.title}</Link>
                  </td>
                  <td className="truncate px-3 py-3.5">{moduleByKey[v.module]?.short ?? v.module}</td>
                  <td className="whitespace-nowrap px-3.5 py-3.5 text-right text-muted">{ago(v.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { visits, bookmarks, completedTopics, quizScores, experiments, activeDays, activity, toggleBookmark, reset } = useProgress();
  const classes = useAsync(fetchClasses, []);

  const recent = Object.values(visits).sort((a, b) => b.at - a.at);
  const lastVisit = recent[0];
  const lastUsed = new Map<string, number>();
  for (const v of recent) if (!lastUsed.has(v.module)) lastUsed.set(v.module, v.at);
  const modules = [...MODULES].sort((a, b) => (lastUsed.get(b.key) ?? 0) - (lastUsed.get(a.key) ?? 0));

  const scores = Object.values(quizScores);
  const average = scores.length ? Math.round((scores.reduce((s, q) => s + q.correct / q.total, 0) / scores.length) * 100) : null;
  const best = scores.length ? Math.round(Math.max(...scores.map((q) => q.correct / q.total)) * 100) : null;
  const topicsDone = Object.keys(completedTopics).length;
  const topicsTotal = classes.data?.reduce((s, c) => s + c.topicCount, 0) ?? 0;
  const labDone = Object.keys(experiments).length;
  const days = streak(activeDays);
  const week = lastDays(14, activity ?? {});
  const weekTotal = week.slice(-7).reduce((s, d) => s + d.actions, 0);

  const doneIn = (grade: number) => Object.keys(completedTopics).filter((k) => gradeOfChapter(k) === grade).length;
  const classRows: PlanRow[] = (classes.data ?? [{ grade: 11, title: "Class 11", book: "Mathematics", chapterCount: 0, topicCount: 0 }, { grade: 12, title: "Class 12", book: "Mathematics", chapterCount: 0, topicCount: 0 }])
    .filter((c) => c.grade === 11 || c.grade === 12)
    .map((c) => {
      const done = doneIn(c.grade);
      return {
        id: `class-${c.grade}`,
        badge: String(c.grade),
        title: `Class ${c.grade}`,
        subtitle: c.chapterCount ? `${c.chapterCount} chapters` : "NCERT maths",
        metric: `${done}/${c.topicCount || "—"}`,
        metricHint: "topics done",
        trailing: c.topicCount ? `${Math.round((done / c.topicCount) * 100)}%` : "—",
        to: `/ncert/class/${c.grade}`,
      };
    })
    .sort((a, b) => doneIn(Number(b.badge)) - doneIn(Number(a.badge)));
  const planRows: PlanRow[] = [
    ...classRows,
    { id: "lab", badge: "Lab", title: "Engineering lab", subtitle: "Physics & circuits", metric: `${labDone}/${LAB_EXPERIMENTS}`, metricHint: "experiments", trailing: `${Math.round((labDone / LAB_EXPERIMENTS) * 100)}%`, to: "/lab" },
  ];

  const goals = [
    { label: "Open any lesson or simulator", done: activeDays.includes(dayKey()) },
    { label: "Mark an NCERT topic complete", done: Object.values(completedTopics).some(isToday) },
    { label: "Finish a practice quiz", done: scores.some((q) => isToday(q.at)) },
    { label: "Record a lab experiment", done: Object.values(experiments).some((e) => isToday(e.at)) },
  ];
  const goalsDone = goals.filter((g) => g.done).length;
  const bookmarkList = Object.values(bookmarks).sort((a, b) => b.at - a.at);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)_380px]">
      <div className="order-2 min-w-0 space-y-4 lg:order-1">
        <SectionCard title="All modules" subtitle={`${MODULES.length} available`}>
          <ul className="space-y-1">
            {modules.map((m, i) => {
              const used = lastUsed.get(m.key);
              return (
                <ListRow
                  key={m.key}
                  to={m.path}
                  icon={<m.icon size={16} aria-hidden />}
                  title={m.title}
                  subtitle={used ? `${m.short} · ${ago(used)}` : m.group}
                  highlighted={i === 0 && used !== undefined}
                />
              );
            })}
          </ul>
        </SectionCard>

        <SectionCard title="Bookmarks">
          {bookmarkList.length === 0 ? (
            <p className="px-1.5 pb-2 text-sm text-muted">Bookmark any simulator or lesson to find it here.</p>
          ) : (
            <ul className="space-y-1">
              {bookmarkList.map((v) => {
                const Icon = moduleByKey[v.module]?.icon ?? Clock;
                return (
                  <ListRow
                    key={v.path}
                    to={v.path}
                    icon={<Icon size={16} aria-hidden />}
                    title={v.title}
                    subtitle={moduleByKey[v.module]?.short ?? ""}
                    trailing={<IconButton size="sm" variant="ghost" label={`Remove bookmark ${v.title}`} icon={<X size={13} />} onClick={() => toggleBookmark(v)} />}
                  />
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Today's goals"
          action={
            <span className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-primary px-3 text-sm font-semibold tabular-nums text-on-primary">
              {goalsDone}/{goals.length}
            </span>
          }
        >
          <div className="card-edge rounded-2xl bg-surface-2 p-3.5">
            <p className="text-sm font-medium">Small steps that count today:</p>
            <ul className="mt-2.5 space-y-2.5">
              {goals.map((g) => (
                <li key={g.label} className={`flex items-center gap-2.5 text-[13px] ${g.done ? "text-muted line-through" : ""}`}>
                  {g.done ? <CheckSquare size={16} className="shrink-0 text-ink" aria-hidden /> : <Square size={16} className="shrink-0 text-muted" aria-hidden />}
                  <span>{g.label}</span>
                  <span className="sr-only">{g.done ? "(done)" : "(not done)"}</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>
      </div>

      <div className="order-1 min-w-0 space-y-4 lg:order-2">
        <HeroHeader days={days} lastVisit={lastVisit} />
        <CurveHero overlay={<PlanCard rows={planRows} />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Quiz average"
            badge={scores.length ? `${scores.length} done` : undefined}
            value={average === null ? "—" : `${average}%`}
            meter={(average ?? 0) / 100}
            footer={best === null ? "Finish a quiz to see your score" : `Best score ${best}%`}
            tone="sun"
          />
          <StatCard
            label="Topics completed"
            badge={goals[1].done ? "+ today" : undefined}
            value={String(topicsDone)}
            meter={topicsTotal ? topicsDone / topicsTotal : 0}
            footer={topicsTotal ? `${topicsDone} of ${topicsTotal} NCERT topics` : "Start the backend to see totals"}
            tone="salmon"
          />
        </div>
      </div>

      <div className="order-3 grid min-w-0 content-start gap-4 lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
        <Card className="p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Learning activity</h2>
              <p className="mt-1 text-xs text-muted">Lessons, simulations and quizzes, last 14 days</p>
            </div>
            <Badge tone="lime">{weekTotal} this week</Badge>
          </div>
          <ActivityBars days={week} />
        </Card>

        <RecentTable items={recent} />

        {labDone > 0 && (
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-xl font-semibold tracking-tight">Lab results</h2>
            <ul className="divide-y divide-line/80 text-sm">
              {Object.entries(experiments).map(([id, r]) => (
                <li key={id}>
                  <Link to={`/lab/${id}`} className="flex items-center justify-between gap-3 px-1 py-3 hover:underline">
                    <span className="truncate font-medium">{r.title}</span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px]">{r.errorPercent !== null ? `${r.errorPercent.toFixed(1)}% err` : "saved"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="text-right lg:col-span-2 xl:col-span-1">
          <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Clear all saved progress, bookmarks and history on this device?")) reset(); }}>
            Reset progress
          </Button>
        </div>
      </div>
    </div>
  );
}
