import { Dices, Lightbulb, Maximize, Plus, SkipForward, Target, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui/Card";
import { Segmented, SelectField } from "@/components/ui/Field";
import { DotMeter } from "@/modules/dashboard/widgets";
import { cssVar, useResolvedTheme } from "@/hooks/useTheme";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { useProgress } from "@/services/progressStore";
import { type Curve, PlotCanvas, type Transform, type Viewport } from "../calculus/PlotCanvas";
import { type Challenge, challengeById, CHALLENGES, FAMILIES, type Level, makeTarget, type Params, randomSeed, startingRows } from "./challenges";
import { matchFeedback, scoreMatch, type StudentCurve } from "./match";
import { buildScope, missingParams, parseRow, userFunctionName } from "./parse";
import { drawItem, itemCurve } from "./render";
import { makeRows, type Row, type SliderBounds } from "./store";

const MATCH_VIEW: Viewport = { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };
const DEFAULT_BOUNDS: SliderBounds = { min: -10, max: 10, step: 0.1 };
const PALETTE = ["--plot-1", "--plot-3", "--plot-4", "--plot-5", "--plot-2"];
const LEVEL_OPTIONS: { value: Level | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const normalize = (text: string) => text.replace(/\s+/g, "").replace(/\*/g, "");

let rowCounter = 0;
const newRow = (text: string, color: number): Row => ({ id: `m${Date.now().toString(36)}${(rowCounter++).toString(36)}`, text, color, hidden: false });

function verdict(score: number): { tone: "success" | "warning" | "neutral"; label: string } {
  if (score >= 95) return { tone: "success", label: "Bullseye" };
  if (score >= 80) return { tone: "warning", label: "Close" };
  return { tone: "neutral", label: "Keep tuning" };
}

function Game({ challenge, seed, onNewTarget }: { challenge: Challenge; seed: number; onNewTarget: () => void }) {
  const theme = useResolvedTheme();
  const family = FAMILIES[challenge.family];
  const target = useMemo(() => makeTarget(challenge, seed), [challenge, seed]);
  const [rows, setRows] = useState<Row[]>(() => makeRows(startingRows(challenge)));
  const [view, setView] = useState<Viewport>(MATCH_VIEW);
  const [revealed, setRevealed] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const best = useProgress((s) => s.matches[challenge.id]);
  const saveMatch = useProgress((s) => s.saveMatch);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    setRevealed(0);
    setResult(null);
  }, [seed]);

  useEffect(() => {
    if (focusNext.current) {
      inputs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  });

  const items = useMemo(() => {
    const functions = new Set(rows.map((r) => userFunctionName(r.text)).filter((n): n is string => n !== null));
    return rows.map((r) => parseRow(r.text, functions));
  }, [rows]);
  const scope = useMemo(() => buildScope(items), [items]);
  const colors = useMemo(() => ({ rows: PALETTE.map(cssVar), target: cssVar("--muted"), text: cssVar("--text") }),
    // theme is a dependency so colours refresh when it changes
    [theme]);
  const colorOf = (row: Row) => colors.rows[row.color % colors.rows.length];

  const student = useMemo(
    () =>
      items.flatMap((item, i): { row: Row; curve: StudentCurve }[] => {
        if (missingParams(item, scope).length) return [];
        if (item.kind === "explicit" || (item.kind === "function" && item.plotted)) return [{ row: rows[i], curve: { kind: "explicit", f: (x) => item.at(x, scope) } }];
        if (item.kind === "implicit") return [{ row: rows[i], curve: { kind: "implicit", F: (x, y) => item.at(x, y, scope) } }];
        return [];
      }),
    [items, rows, scope],
  );
  const match = useMemo(() => scoreMatch(family, target, student.map((s) => s.curve)), [family, target, student]);

  // Direct parameter feedback only applies when the template row and all its sliders are in place
  const sliders = useMemo<Params | null>(() => {
    if (!rows.some((r) => normalize(r.text) === normalize(family.template))) return null;
    const values: Params = {};
    for (const p of family.params) {
      const v = scope[p.name];
      if (typeof v !== "number") return null;
      values[p.name] = v;
    }
    return values;
  }, [rows, scope, family]);
  const hints = useMemo(() => {
    const missing = [...new Set(items.flatMap((item) => missingParams(item, scope)))];
    if (!student.length && missing.length) {
      return [{ id: "sliders", text: `Add sliders for ${missing.join(", ")} with the buttons under your equation.` }];
    }
    return matchFeedback({ family: family.key, target, sliders, curve: student[match.best]?.curve ?? student[0]?.curve ?? null });
  }, [items, family, target, sliders, student, match.best, scope]);

  const curves = useMemo<Curve[]>(() => {
    const list: Curve[] = [];
    if (family.shape === "explicit") list.push({ fn: (x) => family.y(target, x), color: colors.target, width: 4, dashed: true });
    items.forEach((item, i) => {
      if (missingParams(item, scope).length) return;
      const curve = itemCurve(item, scope, colorOf(rows[i]));
      if (curve) list.push(curve);
    });
    return list;
  }, [family, target, items, rows, scope, colors]);

  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, t: Transform) => {
      if (family.shape === "implicit") {
        const [cx, cy] = t.toPx(target.h, target.k);
        const radius = (target.r * t.width) / (t.viewport.xMax - t.viewport.xMin);
        ctx.save();
        ctx.strokeStyle = colors.target;
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      items.forEach((item, i) => {
        if (missingParams(item, scope).length) return;
        drawItem(ctx, t, item, scope, colorOf(rows[i]), colors.text);
      });
    },
    [family, target, items, rows, scope, colors],
  );

  const update = (id: string, text: string) => setRows((list) => list.map((r) => (r.id === id ? { ...r, text } : r)));
  const insertAfter = (id: string | null, texts: string[]) => {
    setRows((list) => {
      const index = id === null ? list.length - 1 : list.findIndex((r) => r.id === id);
      const added = texts.map((text, i) => newRow(text, (list.length + i) % PALETTE.length));
      if (texts.length === 1 && texts[0] === "") focusNext.current = added[0].id;
      return [...list.slice(0, index + 1), ...added, ...list.slice(index + 1)];
    });
  };
  const remove = (id: string) => setRows((list) => (list.length > 1 ? list.filter((r) => r.id !== id) : [newRow("", 0)]));
  const boundsOf = (name: string): SliderBounds => family.params.find((p) => p.name === name)?.slider ?? DEFAULT_BOUNDS;
  const neutralOf = (name: string) => family.params.find((p) => p.name === name)?.neutral ?? 1;

  const submit = () => {
    saveMatch(challenge.id, challenge.title, match.score);
    setResult(match.score);
  };

  const v = verdict(match.score);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="order-2 min-w-0 space-y-4 lg:order-1">
        <Card>
          <CardHeader
            title="Your curve"
            subtitle={challenge.level === "hard" ? "Type an equation from scratch." : `Form: ${family.template}`}
            actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => insertAfter(null, [""])}>Row</Button>}
          />
          <ol className="divide-y divide-line">
            {rows.map((row, i) => {
              const item = items[i];
              const missing = missingParams(item, scope);
              return (
                <li key={row.id} className="flex gap-2 px-3 py-2.5">
                  <span className="mt-2 h-4 w-4 shrink-0 rounded-full" style={{ background: item.kind === "slider" || item.kind === "empty" ? "transparent" : colorOf(row), border: `2px solid ${colorOf(row)}` }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <input
                      ref={(el) => { if (el) inputs.current.set(row.id, el); else inputs.current.delete(row.id); }}
                      aria-label={`Expression ${i + 1}`}
                      spellCheck={false}
                      autoComplete="off"
                      className={`h-9 w-full rounded-lg border bg-surface px-2.5 font-mono text-sm focus:outline-none ${item.kind === "error" ? "border-danger/60" : "border-line focus:border-accent"}`}
                      value={row.text}
                      placeholder={family.shape === "implicit" ? "e.g. (x - 1)^2 + y^2 = 4" : "e.g. y = 2x + 1"}
                      onChange={(e) => update(row.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          insertAfter(row.id, [""]);
                        }
                      }}
                    />
                    {item.kind === "error" && <p className="mt-1 text-[11px] text-danger">{item.message}</p>}
                    {missing.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                        add slider:
                        {missing.map((name) => (
                          <button key={name} type="button" className="rounded-md bg-accent-soft px-2 py-0.5 font-mono font-semibold text-accent" onClick={() => insertAfter(row.id, [`${name} = ${neutralOf(name)}`])}>
                            {name}
                          </button>
                        ))}
                        {missing.length > 1 && (
                          <button type="button" className="rounded-md border border-line px-2 py-0.5" onClick={() => insertAfter(row.id, missing.map((name) => `${name} = ${neutralOf(name)}`))}>all</button>
                        )}
                      </p>
                    )}
                    {item.kind === "slider" && (() => {
                      const b = boundsOf(item.name);
                      return (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="w-8 text-right font-mono text-[11px] text-muted">{b.min}</span>
                          <input
                            type="range"
                            aria-label={`${item.name} slider`}
                            className="min-w-0 flex-1"
                            min={b.min}
                            max={b.max}
                            step={b.step}
                            value={item.value}
                            onChange={(e) => update(row.id, `${item.name} = ${Number(e.target.value)}`)}
                          />
                          <span className="w-8 font-mono text-[11px] text-muted">{b.max}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <IconButton size="sm" variant="ghost" label={`Delete expression ${i + 1}`} icon={<X size={14} />} onClick={() => remove(row.id)} />
                </li>
              );
            })}
          </ol>
        </Card>

        <Card>
          <CardHeader
            title="Hints"
            subtitle="Rule-based: they compare your curve with the target."
            actions={
              <Button size="sm" icon={<Lightbulb size={14} />} disabled={revealed >= Math.max(1, hints.length)} onClick={() => setRevealed((r) => r + 1)}>
                {revealed === 0 ? "Show a hint" : "Another hint"}
              </Button>
            }
          />
          <div className="px-4 pb-4">
            {revealed === 0 ? (
              <p className="text-sm text-muted">Stuck? Reveal one hint at a time.</p>
            ) : hints.length === 0 ? (
              <p className="text-sm text-muted">{match.score >= 95 ? "Nothing to fix: your curve sits on the target." : "No clear single fix. Try the sliders one at a time."}</p>
            ) : (
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                {hints.slice(0, revealed).map((h) => <li key={h.id}>{h.text}</li>)}
              </ol>
            )}
          </div>
        </Card>
      </div>

      <Card className="order-1 min-w-0 lg:order-2">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="min-w-40 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-muted">Match</span>
              <span className="flex items-center gap-2">
                <Badge tone={v.tone}>{v.label}</Badge>
                <span className="text-2xl tabular-nums" aria-live="polite">{match.score}%</span>
              </span>
            </div>
            <div className="mt-1"><DotMeter value={match.score / 100} label="Match score" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Target size={16} />} onClick={submit}>Submit</Button>
            <Button icon={<Dices size={16} />} onClick={onNewTarget}>New target</Button>
            <IconButton variant="ghost" label="Reset view" icon={<Maximize size={16} />} onClick={() => setView(MATCH_VIEW)} />
          </div>
        </div>
        <div className="space-y-3 p-3">
          {result !== null && (
            <Notice
              tone={result >= 80 ? "success" : "neutral"}
              title={`Saved: ${result}/100${best && best.score > result ? ` (best ${best.score})` : ""}`}
              action={<Button size="sm" icon={<Dices size={14} />} onClick={onNewTarget}>Try another</Button>}
            >
              The target was <span className="font-mono text-ink">{family.expression(target)}</span>.
            </Notice>
          )}
          <PlotCanvas
            viewport={view}
            onViewportChange={setView}
            curves={curves}
            overlay={overlay}
            lockAspect
            tall
            label={`Dashed target ${family.label.toLowerCase()} and your curve; match ${match.score} percent`}
          />
        </div>
      </Card>
    </div>
  );
}

export default function MatchPage() {
  useTrackVisit("Graph Match", "match");
  const [query, setQuery] = useSearchParams();
  const challenge = challengeById.get(query.get("challenge") ?? "") ?? CHALLENGES[0];
  const [fallbackSeed] = useState(randomSeed);
  const seedText = query.get("seed");
  const seed = seedText !== null && /^\d+$/.test(seedText) ? Number(seedText) : fallbackSeed;
  const [level, setLevel] = useState<Level | "all">(challenge.level);
  const bestScores = useProgress((s) => s.matches);
  const list = CHALLENGES.filter((c) => level === "all" || c.level === level);

  // Keeps ?challenge=…&seed=… in the address bar so the exact target can be shared
  useEffect(() => {
    if (query.get("challenge") !== challenge.id || query.get("seed") !== String(seed)) {
      setQuery({ challenge: challenge.id, seed: String(seed) }, { replace: true });
    }
  }, [query, setQuery, challenge.id, seed]);

  const choose = (id: string) => setQuery({ challenge: id, seed: String(randomSeed()) }, { replace: true });
  const next = () => {
    const pool = list.length ? list : CHALLENGES;
    const at = pool.findIndex((c) => c.id === challenge.id);
    choose(pool[(at + 1) % pool.length].id);
  };
  const best = bestScores[challenge.id];

  return (
    <>
      <PageHeader
        title="Graph Match"
        description="Make your curve land on the dashed target. Practice for shifting, stretching and flipping graphs."
        actions={<BookmarkButton title="Graph Match" module="match" />}
      />
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Level</p>
          <Segmented label="Level" value={level} options={LEVEL_OPTIONS} onChange={setLevel} />
        </div>
        <SelectField label="Challenge" className="min-w-56 flex-1" value={list.some((c) => c.id === challenge.id) ? challenge.id : ""} onChange={(e) => e.target.value && choose(e.target.value)}>
          {!list.some((c) => c.id === challenge.id) && <option value="">Pick a challenge…</option>}
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.level}){bestScores[c.id] ? `: best ${bestScores[c.id].score}` : ""}
            </option>
          ))}
        </SelectField>
        <Button icon={<SkipForward size={16} />} onClick={next}>Next challenge</Button>
        <div className="flex basis-full flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone={challenge.level === "easy" ? "lime" : challenge.level === "medium" ? "warning" : "danger"}>{challenge.level}</Badge>
          <span>{challenge.blurb}</span>
          {best && <Badge tone="success"><Trophy size={12} /> Best {best.score}</Badge>}
        </div>
      </Card>
      <Game key={challenge.id} challenge={challenge} seed={seed} onNewTarget={() => setQuery({ challenge: challenge.id, seed: String(randomSeed()) }, { replace: true })} />
    </>
  );
}
