import { ArrowRight, RotateCcw, Sparkles, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LoadError } from "@/components/OfflineNotice";
import { Badge, Card, CardHeader, PageHeader, Skeleton } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { api, unwrap } from "@/services/api";
import { useProgress } from "@/services/progressStore";
import { ancestors, buildGraph, layout, type MapNode, type Mastery, masteryOf, recommend, type Recommendation, type Status } from "./conceptMap";

const NODE_W = 172;
const NODE_H = 48;
const COL_W = 214;
const ROW_H = 64;
const PAD = 12;

const STATUS: Record<Status, { label: string; fill: string; text: string }> = {
  mastered: { label: "Mastered", fill: "var(--lime)", text: "var(--lime-text)" },
  learning: { label: "Learning", fill: "var(--sun)", text: "var(--bright-text)" },
  new: { label: "Not started", fill: "var(--surface-2)", text: "var(--text)" },
  unavailable: { label: "Not written yet", fill: "transparent", text: "var(--muted)" },
};

const KIND: Record<Recommendation["kind"], { label: string; icon: typeof Target; tone: "danger" | "warning" | "lime" }> = {
  revise: { label: "Revise", icon: RotateCcw, tone: "danger" },
  continue: { label: "Continue", icon: ArrowRight, tone: "warning" },
  start: { label: "Start", icon: Sparkles, tone: "lime" },
};

function wrap(title: string, max = 24): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of title.split(" ")) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  lines.push(line);
  return lines.length > 2 ? [lines[0], `${lines.slice(1).join(" ").slice(0, max - 1)}…`] : lines;
}

function MapView({ nodes, mastery }: { nodes: MapNode[]; mastery: Map<string, Mastery> }) {
  const navigate = useNavigate();
  const [focus, setFocus] = useState<string | null>(null);
  const graph = useMemo(() => buildGraph(nodes), [nodes]);
  const { placed, width, height } = useMemo(() => layout(nodes, COL_W, ROW_H), [nodes]);
  const chain = useMemo(() => (focus ? new Set([focus, ...ancestors(graph, focus)]) : null), [focus, graph]);

  const open = (n: MapNode) => n.available && navigate(`/ncert/chapter/${n.id}`);

  return (
    <div className="overflow-x-auto">
      <svg
        width={width - COL_W + NODE_W + PAD * 2}
        height={height - ROW_H + NODE_H + PAD * 2}
        className="block"
        role="group"
        aria-label="Chapter prerequisite map. Arrows point from a prerequisite to the chapter that needs it."
      >
        <defs>
          <marker id="map-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="var(--muted)" />
          </marker>
        </defs>
        <g transform={`translate(${PAD} ${PAD})`}>
          {nodes.flatMap((n) =>
            n.prerequisites.map((p) => {
              const a = placed.get(p)!;
              const b = placed.get(n.id)!;
              const x1 = a.x + NODE_W;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x - 2;
              const y2 = b.y + NODE_H / 2;
              const mid = (x1 + x2) / 2;
              const lit = chain?.has(n.id) && chain.has(p);
              return (
                <path
                  key={`${p}-${n.id}`}
                  d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
                  fill="none"
                  stroke={lit ? "var(--accent)" : "var(--muted)"}
                  strokeWidth={lit ? 2.2 : 1.1}
                  strokeOpacity={chain && !lit ? 0.18 : 0.7}
                  markerEnd="url(#map-arrow)"
                />
              );
            }),
          )}
          {nodes.map((n) => {
            const { x, y } = placed.get(n.id)!;
            const m = mastery.get(n.id)!;
            const style = STATUS[m.status];
            const dim = chain && !chain.has(n.id);
            const label = `Class ${n.grade}, ${n.title}: ${style.label}${m.status !== "unavailable" ? `, ${Math.round(m.level * 100)}%` : ""}`;
            return (
              <g
                key={n.id}
                transform={`translate(${x} ${y})`}
                opacity={dim ? 0.35 : 1}
                role={n.available ? "link" : "img"}
                tabIndex={0}
                aria-label={label}
                className={n.available ? "cursor-pointer" : "cursor-default"}
                onMouseEnter={() => setFocus(n.id)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(n.id)}
                onBlur={() => setFocus(null)}
                onClick={() => open(n)}
                onKeyDown={(e) => { if (e.key === "Enter") open(n); }}
              >
                <title>{label}</title>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={14}
                  fill={style.fill}
                  stroke={focus === n.id ? "var(--accent)" : "var(--border)"}
                  strokeWidth={focus === n.id ? 2 : 1}
                  strokeDasharray={m.status === "unavailable" ? "4 3" : undefined}
                />
                {m.status === "learning" && <rect x={8} y={NODE_H - 6} width={(NODE_W - 16) * m.level} height={2.5} rx={1.25} fill="var(--text)" opacity={0.55} />}
                <text x={10} y={14} fontSize={9.5} fill={style.text} opacity={0.75} fontWeight={600}>Class {n.grade} · Ch {n.number}</text>
                {wrap(n.title).map((line, i) => (
                  <text key={i} x={10} y={28 + i * 12} fontSize={11} fill={style.text} fontWeight={500}>{line}</text>
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default function ConceptMapPage() {
  useTrackVisit("Concept Map", "map");
  const map = useAsync(() => unwrap(api.GET("/api/content/map")), []);
  const quizScores = useProgress((s) => s.quizScores);
  const completedTopics = useProgress((s) => s.completedTopics);
  const nodes = map.data?.nodes ?? [];
  const mastery = useMemo(() => new Map(nodes.map((n) => [n.id, masteryOf(n, { quizScores, completedTopics })])), [nodes, quizScores, completedTopics]);
  const plan = useMemo(() => recommend(nodes, mastery), [nodes, mastery]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const counts = nodes.reduce<Record<Status, number>>((acc, n) => ({ ...acc, [mastery.get(n.id)!.status]: acc[mastery.get(n.id)!.status] + 1 }), { mastered: 0, learning: 0, new: 0, unavailable: 0 });

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted">
        <Link to="/ncert" className="hover:text-accent">NCERT Mathematics</Link> / Concept map
      </nav>
      <PageHeader
        title="Concept Map"
        description="Each chapter points to the chapters that build on it. Colours show your mastery from quizzes and completed topics. Hover or focus a chapter to trace everything it depends on."
      />
      {map.error && <LoadError error={map.error} onRetry={map.reload} />}
      {map.loading && <Skeleton className="h-[520px]" />}
      {map.data && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="min-w-0">
            <CardHeader
              title="Classes 11 and 12"
              subtitle={`${counts.mastered} mastered · ${counts.learning} in progress · ${counts.new} not started`}
              actions={
                <ul className="flex flex-wrap gap-2 text-[11px] text-muted" aria-label="Legend">
                  {(Object.keys(STATUS) as Status[]).map((s) => (
                    <li key={s} className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded border border-line" style={{ background: STATUS[s].fill, borderStyle: s === "unavailable" ? "dashed" : "solid" }} />
                      {STATUS[s].label}
                    </li>
                  ))}
                </ul>
              }
            />
            <div className="p-3 sm:p-4">
              <MapView nodes={nodes} mastery={mastery} />
            </div>
          </Card>

          <Card className="h-fit">
            <CardHeader title="What to study next" subtitle="Picked by rules: shaky foundations first, then unfinished chapters, then the ones that unlock the most." />
            <ol className="space-y-2 p-4">
              {plan.length === 0 && <li className="text-sm text-muted">Everything available is mastered. Nicely done.</li>}
              {plan.map((r) => {
                const node = byId.get(r.chapterId);
                const kind = KIND[r.kind];
                const inner = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{node?.title}</span>
                      <Badge tone={kind.tone}><kind.icon size={11} aria-hidden /> {kind.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">{r.reason}</p>
                    {node && !node.available && <p className="mt-1 text-xs text-muted">Not on this site yet. Use your NCERT textbook.</p>}
                  </>
                );
                return (
                  <li key={r.chapterId}>
                    {node?.available ? (
                      <Link to={`/ncert/chapter/${r.chapterId}`} className="card-edge block rounded-2xl bg-surface-2 p-3 hover:bg-surface">{inner}</Link>
                    ) : (
                      <div className="card-edge rounded-2xl bg-surface-2 p-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}
