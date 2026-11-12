import { AlertTriangle, CheckCircle2, Download, Eye as EyeIcon, Printer, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card, CardHeader, Notice, PageHeader, Skeleton } from "@/components/ui/Card";
import { Segmented, TextField } from "@/components/ui/Field";
import { Markdown } from "@/components/ui/Markdown";
import { Tex } from "@/components/ui/Tex";
import { formatNumber } from "@/components/plot/scale";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { api, unwrap } from "@/services/api";
import { useProgress } from "@/services/progressStore";
import { applyCorrections, makeBench, newApparatus, parseLabMode } from "./bench";
import { diagnose, type Finding, type Grade, gradeMystery } from "./diagnose";
import { experimentById } from "./experiments";
import { percentError } from "./fit";
import { LabGraph } from "./LabGraph";
import type { Column, Eye, ExperimentDef, LabMode, Row } from "./types";

const MODES: { value: LabMode; label: string; blurb: string }[] = [
  { value: "guided", label: "Guided", blurb: "Instruments are well set up and the true value is shown, so you can check your method." },
  { value: "realistic", label: "Realistic", blurb: "Instruments may have a zero error and read differently if your eye is not straight. Check zeros before you start." },
  { value: "mystery", label: "Mystery", blurb: "An unknown sample on imperfect instruments. Submit your answer to be graded. The true value stays hidden until then." },
];

const EYES: { value: Eye; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "straight", label: "Straight" },
  { value: "right", label: "Right" },
];

interface Submission {
  value: number;
  truthValue: number;
  errorPercent: number;
  grade: Grade;
}

const cellText = (row: Row, c: Column) => {
  const value = row[c.key];
  return typeof value === "number" ? value.toFixed(c.digits ?? 2) : String(value);
};

function downloadCsv(name: string, columns: Column[], rows: Row[]) {
  const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [["S.No.", ...columns.map((c) => c.label)], ...rows.map((r, i) => [String(i + 1), ...columns.map((c) => cellText(r, c))])];
  const url = URL.createObjectURL(new Blob([lines.map((l) => l.map(escape).join(",")).join("\n")], { type: "text/csv" }));
  Object.assign(document.createElement("a"), { href: url, download: `${name}-observations.csv` }).click();
  URL.revokeObjectURL(url);
}

const toNumber = (text: string | undefined) => {
  const n = Number(text);
  return text !== undefined && text.trim() !== "" && Number.isFinite(n) ? n : 0;
};

function FindingList({ findings, showDeductions }: { findings: Finding[]; showDeductions: boolean }) {
  if (findings.length === 0) {
    return <Notice tone="success" title="No problems found">Your readings pass every check.</Notice>;
  }
  return (
    <ul className="space-y-2">
      {findings.map((f, i) => (
        <li key={`${f.code}-${i}`} className="flex items-start gap-2.5 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">{f.message}</span>
          {showDeductions && f.deduction > 0 && <Badge tone="warning">−{f.deduction}</Badge>}
        </li>
      ))}
    </ul>
  );
}

function GradeCard({ submission, symbol, unit, onRetry }: { submission: Submission; symbol: string; unit: string; onRetry: () => void }) {
  const { grade } = submission;
  const tone = grade.band === "A" || grade.band === "B" ? "success" : grade.band === "C" ? "warning" : "danger";
  return (
    <Card>
      <CardHeader
        title="Your grade"
        subtitle="Accuracy against the true value, minus deductions for method."
        actions={<Button size="sm" variant="primary" icon={<RotateCcw size={14} />} onClick={onRetry} className="no-print">Try a new sample</Button>}
      />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <p className="text-5xl font-normal tabular-nums">{grade.score}<span className="text-xl text-muted">/100</span></p>
          <Badge tone={tone}>Band {grade.band}</Badge>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            ["Your answer", `${formatNumber(submission.value, 4)} ${unit}`],
            ["True value", `${formatNumber(submission.truthValue, 4)} ${unit}`],
            ["Error", `${submission.errorPercent.toFixed(2)}%`],
            ["Accuracy score", String(grade.accuracy)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-surface-2 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
              <dd className="font-mono tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {grade.deductions.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {grade.deductions.map((d, i) => (
              <li key={i} className="flex gap-2"><span className="w-8 shrink-0 font-mono text-danger">−{d.points}</span><span className="text-muted">{d.message}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No method deductions. Clean work.</p>
        )}
        <p className="text-xs text-muted">Graded on <Tex math={symbol} />. Saved to your progress.</p>
      </div>
    </Card>
  );
}

function ZeroCheckCard({ def, read, checked, corrections, onCheck, onCorrection }: {
  def: ExperimentDef<unknown>;
  read: (key: string) => number;
  checked: Record<string, boolean>;
  corrections: Record<string, string>;
  onCheck: (key: string) => void;
  onCorrection: (key: string, text: string) => void;
}) {
  return (
    <Card className="no-print">
      <CardHeader title="Zero check" subtitle="Read each instrument with nothing connected, then enter its zero error. Corrected reading = observed − zero error." />
      <ul className="space-y-2 p-4">
        {def.instruments.map((instrument) => (
          <li key={instrument.key} className="grid items-end gap-3 rounded-2xl bg-surface-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_160px]">
            <div className="min-w-0">
              <p className="text-sm font-medium">{instrument.label}</p>
              <p className="text-xs text-muted">Least count {instrument.leastCount} {instrument.unit}{instrument.analog ? " · analog, watch for parallax" : ""}</p>
            </div>
            {checked[instrument.key] ? (
              <p className="font-mono text-lg tabular-nums" role="status" aria-label={`${instrument.label} zero reading`}>
                {read(instrument.key).toFixed(instrument.digits)} <span className="text-sm text-muted">{instrument.unit}</span>
              </p>
            ) : (
              <Button size="sm" onClick={() => onCheck(instrument.key)}>Check zero</Button>
            )}
            <TextField
              label={`Zero error (${instrument.unit})`}
              inputMode="decimal"
              placeholder="0"
              value={corrections[instrument.key] ?? ""}
              onChange={(e) => onCorrection(instrument.key, e.target.value)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Experiment({ def, mode, onModeChange }: { def: ExperimentDef<unknown>; mode: LabMode; onModeChange: (mode: LabMode) => void }) {
  const lab = useAsync(() => unwrap(api.GET("/api/labs/{lab_id}", { params: { path: { lab_id: def.id } } })), [def.id]);
  const [apparatus, setApparatus] = useState(() => newApparatus(def, mode));
  const [eye, setEye] = useState<Eye>("straight");
  const [raw, setRaw] = useState<Row[]>([]);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [answer, setAnswer] = useState("");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [saved, setSaved] = useState(false);
  const saveExperiment = useProgress((s) => s.saveExperiment);
  const previous = useProgress((s) => s.experiments[def.id]);
  const title = lab.data?.title ?? def.title;
  useTrackVisit(title, "lab");

  const faulty = mode !== "guided";
  const reveal = mode !== "mystery" || submission !== null;
  const bench = useMemo(() => makeBench(def, apparatus, mode, faulty ? eye : "straight"), [def, apparatus, mode, faulty, eye]);
  const correctionValues = useMemo(
    () => (faulty ? Object.fromEntries(def.instruments.map((i) => [i.key, toNumber(corrections[i.key])])) : {}),
    [faulty, def.instruments, corrections],
  );
  const rows = useMemo(() => raw.map((r) => def.derive(applyCorrections(r, correctionValues, def.instruments))), [raw, def, correctionValues]);
  const corrected = Object.values(correctionValues).some((v) => v !== 0);
  const enough = rows.length >= def.minReadings;
  const results = enough ? def.results(rows, apparatus.truth) : [];
  const findings = useMemo(
    () => diagnose({
      mode,
      raw,
      rows,
      instruments: def.instruments,
      graph: def.graph,
      sweep: def.sweep?.(apparatus.truth),
      consistency: def.consistency,
      zero: { checked, corrections: correctionValues, actual: apparatus.zero },
    }),
    [mode, raw, rows, def, apparatus, checked, correctionValues],
  );
  const Simulation = def.Simulation;
  const target = def.target;

  const reset = () => {
    setApparatus(newApparatus(def, mode));
    setRaw([]);
    setCorrections({});
    setChecked({});
    setAnswer("");
    setSubmission(null);
    setSaved(false);
  };

  const save = () => {
    const main = results[0];
    if (!main) return;
    saveExperiment(def.id, {
      title,
      result: results.map((r) => `${r.symbol} = ${formatNumber(r.value, 3)} ${r.unit}`).join(", "),
      errorPercent: main.expected !== undefined ? percentError(main.value, main.expected) : null,
      mode,
    });
    setSaved(true);
  };

  const answerValue = Number(answer);
  const canSubmit = enough && answer.trim() !== "" && Number.isFinite(answerValue) && answerValue !== 0 && !submission;
  const computed = results.find((r) => r.symbol === target.symbol);

  const submit = () => {
    if (!canSubmit) return;
    const truthValue = target.value(apparatus.truth);
    const errorPercent = percentError(answerValue, truthValue);
    const grade = gradeMystery(errorPercent, findings);
    setSubmission({ value: answerValue, truthValue, errorPercent, grade });
    saveExperiment(def.id, {
      title,
      result: `${target.symbol} = ${formatNumber(answerValue, 3)} ${target.unit} (score ${grade.score}, band ${grade.band})`,
      errorPercent,
      mode: "mystery",
      score: grade.score,
    });
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="no-print mb-2 text-xs text-muted">
        <Link to="/lab" className="hover:text-accent">Engineering Lab</Link> / {title}
      </nav>
      <PageHeader
        title={title}
        description={lab.data?.aim}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <BookmarkButton title={title} module="lab" />
            <Button size="sm" icon={<Download size={14} />} disabled={!rows.length} onClick={() => downloadCsv(def.id, def.columns, rows)}>CSV</Button>
            <Button size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>Print / PDF</Button>
          </div>
        }
      />

      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Segmented label="Lab mode" value={mode} onChange={onModeChange} options={MODES.map((m) => ({ value: m.value, label: m.label }))} />
        <p className="min-w-0 basis-full text-xs text-muted sm:basis-0 sm:flex-1">{MODES.find((m) => m.value === mode)?.blurb}</p>
      </div>

      {lab.error && (
        <div className="mb-4">
          <Notice tone="warning" title="Theory and viva need the backend">The simulation below works offline. {lab.error.code !== "OFFLINE" && lab.error.message}</Notice>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Card className="no-print">
            <CardHeader
              title="Simulation"
              subtitle={faulty ? "Readings include random error, possible zero error and parallax." : "Readings include realistic random error."}
              actions={
                <>
                  {faulty && (
                    <span className="flex items-center gap-1.5">
                      <EyeIcon size={14} className="text-muted" aria-hidden />
                      <Segmented label="Eye position" value={eye} onChange={setEye} options={EYES} />
                    </span>
                  )}
                  <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset}>New apparatus</Button>
                </>
              }
            />
            <div className="p-4">
              <Simulation
                truth={apparatus.truth}
                rows={rows}
                bench={bench}
                onRecord={(row) => { setRaw((r) => [...r, faulty ? { ...row, eye } : row]); setSaved(false); }}
              />
            </div>
          </Card>

          {faulty && def.instruments.length > 0 && (
            <ZeroCheckCard
              def={def}
              read={(key) => bench.read(key, 0)}
              checked={checked}
              corrections={corrections}
              onCheck={(key) => setChecked((c) => ({ ...c, [key]: true }))}
              onCorrection={(key, text) => setCorrections((c) => ({ ...c, [key]: text }))}
            />
          )}

          <Card>
            <CardHeader
              title="Observation table"
              subtitle={`${rows.length} reading(s); at least ${def.minReadings} needed for a result${corrected ? ". Values corrected for zero error." : ""}`}
              actions={raw.length > 0 && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setRaw([])} className="no-print">Clear</Button>}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2">S.No.</th>
                    {def.columns.map((c) => <th key={c.key} className="px-3 py-2">{c.label}</th>)}
                    <th className="no-print px-3 py-2"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {rows.length === 0 && (
                    <tr><td colSpan={def.columns.length + 2} className="px-3 py-6 text-center font-sans text-muted">Use the simulation to record readings.</td></tr>
                  )}
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-1.5">{i + 1}</td>
                      {def.columns.map((c) => <td key={c.key} className="px-3 py-1.5">{cellText(row, c)}</td>)}
                      <td className="no-print px-3 py-1 text-right">
                        <IconButton size="sm" variant="ghost" label={`Remove reading ${i + 1}`} icon={<Trash2 size={13} />} onClick={() => setRaw((r) => r.filter((_, j) => j !== i))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {def.graph && (
            <Card>
              <CardHeader title="Graph" subtitle={`${def.graph.yLabel} against ${def.graph.xLabel}`} />
              <div className="p-4"><LabGraph rows={rows} spec={def.graph} /></div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Result"
              actions={results.length > 0 && mode !== "mystery" && (
                <Button size="sm" variant={saved ? "secondary" : "primary"} icon={<Save size={14} />} onClick={save} disabled={saved} className="no-print">
                  {saved ? "Saved to progress" : "Save result"}
                </Button>
              )}
            />
            <div className="space-y-3 p-4">
              {results.length === 0 && <p className="text-sm text-muted">Take at least {def.minReadings} readings to compute the result.</p>}
              {results.map((r) => {
                const error = reveal && r.expected !== undefined ? percentError(r.value, r.expected) : null;
                return (
                  <div key={r.symbol} className="rounded-lg bg-surface-2 p-3">
                    <p className="text-xs text-muted">{r.label}</p>
                    <p className="mt-1 text-lg"><Tex math={`${r.symbol} = ${formatNumber(r.value, 4)}\\ \\text{${r.unit}}`} /></p>
                    {r.expected !== undefined && error !== null && (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {r.expectedLabel}: {formatNumber(r.expected, 4)} {r.unit}
                        <Badge tone={error < 2 ? "success" : error < 5 ? "warning" : "danger"}>error {error.toFixed(2)}%</Badge>
                      </p>
                    )}
                  </div>
                );
              })}

              {mode === "mystery" && !submission && (
                <form
                  className="no-print space-y-2 rounded-2xl border border-line p-3"
                  onSubmit={(e) => { e.preventDefault(); submit(); }}
                >
                  <p className="text-sm font-medium">Submit your answer: {target.label} (<Tex math={target.symbol} />)</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <TextField
                      label={`Your value (${target.unit})`}
                      inputMode="decimal"
                      className="w-40"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                    {computed && (
                      <Button size="md" onClick={() => setAnswer(String(Number(computed.value.toPrecision(4))))}>Use computed value</Button>
                    )}
                    <Button type="submit" variant="primary" icon={<Send size={14} />} disabled={!canSubmit}>Submit for grading</Button>
                  </div>
                  {!enough && <p className="text-xs text-muted">Take at least {def.minReadings} readings before submitting.</p>}
                </form>
              )}
              {previous && <p className="text-xs text-muted">Last saved{previous.mode ? ` (${previous.mode})` : ""}: {previous.result} ({new Date(previous.at).toLocaleDateString()})</p>}
            </div>
          </Card>

          {submission && <GradeCard submission={submission} symbol={target.symbol} unit={target.unit} onRetry={reset} />}

          {enough && (
            <Card>
              <CardHeader
                title="Diagnosis"
                subtitle={mode === "mystery" && !submission ? "Rule-based checks on your method. Fix these before you submit to avoid deductions." : "Rule-based checks on your method."}
                actions={findings.length === 0 && <CheckCircle2 size={18} className="text-success" aria-hidden />}
              />
              <div className="p-4">
                <FindingList findings={findings} showDeductions={mode === "mystery"} />
              </div>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {lab.loading && <Skeleton className="h-96" />}
          {lab.data && (
            <>
              <Card>
                <CardHeader title="Theory" />
                <div className="space-y-3 p-4">
                  <Markdown>{lab.data.theory}</Markdown>
                  <div className="rounded-lg bg-accent-soft px-3 py-1"><Tex block math={lab.data.formula} /></div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Apparatus</p>
                    <ul className="mt-1 list-disc pl-5 text-sm">{lab.data.apparatus.map((a) => <li key={a}>{a}</li>)}</ul>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Procedure" />
                <div className="space-y-3 p-4 text-sm">
                  <ol className="list-decimal space-y-1 pl-5">{lab.data.procedure.map((p) => <li key={p}>{p}</li>)}</ol>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Precautions</p>
                  <ul className="list-disc space-y-1 pl-5">{lab.data.precautions.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              </Card>
              <Card>
                <CardHeader title="Viva voce" subtitle="Answer aloud, then reveal." />
                <div className="space-y-2 p-4">
                  {lab.data.viva.map((v) => (
                    <details key={v.question} className="rounded-lg border border-line">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{v.question}</summary>
                      <p className="border-t border-line px-3 py-2 text-sm text-muted">{v.answer}</p>
                    </details>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function ExperimentPage() {
  const { experimentId = "" } = useParams();
  const [query, setQuery] = useSearchParams();
  const mode = parseLabMode(query.get("mode"));
  const def = experimentById.get(experimentId);

  const changeMode = (next: LabMode) => {
    const params = new URLSearchParams(query);
    if (next === "guided") params.delete("mode");
    else params.set("mode", next);
    setQuery(params, { replace: true });
  };

  if (!def) {
    return (
      <Notice tone="danger" title="Experiment not found" action={<Link to="/lab" className="text-sm font-medium text-accent">All experiments</Link>}>
        There is no experiment called “{experimentId}”.
      </Notice>
    );
  }
  return <Experiment key={`${def.id}:${mode}`} def={def} mode={mode} onModeChange={changeMode} />;
}
