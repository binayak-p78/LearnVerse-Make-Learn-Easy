import { Download, Printer, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card, CardHeader, Notice, PageHeader, Skeleton } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { Tex } from "@/components/ui/Tex";
import { formatNumber } from "@/components/plot/scale";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { api, unwrap } from "@/services/api";
import { useProgress } from "@/services/progressStore";
import { experimentById } from "./experiments";
import { percentError } from "./fit";
import { LabGraph } from "./LabGraph";
import type { Column, ExperimentDef, Row } from "./types";

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

function Experiment({ def }: { def: ExperimentDef<unknown> }) {
  const lab = useAsync(() => unwrap(api.GET("/api/labs/{lab_id}", { params: { path: { lab_id: def.id } } })), [def.id]);
  const [truth, setTruth] = useState(() => def.setup());
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState(false);
  const saveExperiment = useProgress((s) => s.saveExperiment);
  const previous = useProgress((s) => s.experiments[def.id]);
  const title = lab.data?.title ?? def.title;
  useTrackVisit(title, "lab");

  const results = rows.length >= def.minReadings ? def.results(rows, truth) : [];
  const Simulation = def.Simulation;

  const save = () => {
    const main = results[0];
    if (!main) return;
    saveExperiment(def.id, {
      title,
      result: results.map((r) => `${r.symbol} = ${formatNumber(r.value, 3)} ${r.unit}`).join(", "),
      errorPercent: main.expected !== undefined ? percentError(main.value, main.expected) : null,
    });
    setSaved(true);
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
              subtitle="Readings include realistic instrument error."
              actions={
                <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => { setTruth(def.setup()); setRows([]); setSaved(false); }}>
                  New apparatus
                </Button>
              }
            />
            <div className="p-4">
              <Simulation truth={truth} rows={rows} onRecord={(row) => { setRows((r) => [...r, row]); setSaved(false); }} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Observation table"
              subtitle={`${rows.length} reading(s); at least ${def.minReadings} needed for a result`}
              actions={rows.length > 0 && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setRows([])} className="no-print">Clear</Button>}
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
                        <IconButton size="sm" variant="ghost" label={`Remove reading ${i + 1}`} icon={<Trash2 size={13} />} onClick={() => setRows((r) => r.filter((_, j) => j !== i))} />
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
              actions={results.length > 0 && (
                <Button size="sm" variant={saved ? "secondary" : "primary"} icon={<Save size={14} />} onClick={save} disabled={saved} className="no-print">
                  {saved ? "Saved to progress" : "Save result"}
                </Button>
              )}
            />
            <div className="space-y-3 p-4">
              {results.length === 0 && <p className="text-sm text-muted">Take at least {def.minReadings} readings to compute the result.</p>}
              {results.map((r) => {
                const error = r.expected !== undefined ? percentError(r.value, r.expected) : null;
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
              {previous && <p className="text-xs text-muted">Last saved: {previous.result} ({new Date(previous.at).toLocaleDateString()})</p>}
            </div>
          </Card>
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
  const def = experimentById.get(experimentId);
  if (!def) {
    return (
      <Notice tone="danger" title="Experiment not found" action={<Link to="/lab" className="text-sm font-medium text-accent">All experiments</Link>}>
        There is no experiment called “{experimentId}”.
      </Notice>
    );
  }
  return <Experiment key={def.id} def={def} />;
}
