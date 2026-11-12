import { Check, ClipboardCheck, Copy, Download, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { LoadError } from "@/components/OfflineNotice";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui/Card";
import { Label, Segmented, SelectField, SliderField, TextField } from "@/components/ui/Field";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { CHALLENGES } from "@/modules/graph/challenges";
import { fetchChapter } from "@/modules/ncert/content";
import { api, unwrap } from "@/services/api";
import { type LabMode, useProgress } from "@/services/progressStore";
import { type Assignment, type CodeCheck, decodeAssignment, encodeAssignment, evaluate, newAssignmentId, readCode, type Task } from "./assignment";
import { assignmentUrl, useAssignments } from "./store";

type Tab = "create" | "check" | "mine";
type Kind = Task["kind"];

const KIND_LABEL: Record<Kind, string> = { quiz: "NCERT quiz", lab: "Lab experiment", match: "Graph match" };
const MODE_LABEL: Record<LabMode, string> = { guided: "Guided", realistic: "Realistic", mystery: "Mystery" };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this", text);
    }
  };
  return <Button size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copy()}>{copied ? "Copied" : label}</Button>;
}

function TaskPicker({ onAdd }: { onAdd: (task: Task) => void }) {
  const [kind, setKind] = useState<Kind>("quiz");
  const [pass, setPass] = useState(60);
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [labId, setLabId] = useState("");
  const [mode, setMode] = useState<LabMode>("mystery");
  const [challengeId, setChallengeId] = useState(CHALLENGES[0].id);
  const map = useAsync(() => unwrap(api.GET("/api/content/map")), []);
  const labs = useAsync(() => unwrap(api.GET("/api/labs")), []);
  const chapter = useAsync(() => (chapterId ? fetchChapter(chapterId) : Promise.resolve(null)), [chapterId]);
  const chapters = map.data?.nodes.filter((n) => n.available) ?? [];
  const topics = chapter.data?.topics.filter((t) => t.quiz.length > 0) ?? [];

  const add = () => {
    if (kind === "quiz") {
      const topic = topics.find((t) => t.id === topicId);
      if (!chapter.data || !topic) return;
      onAdd({ kind, chapterId, topicId, title: `${chapter.data.title}: ${topic.title}`, pass });
    } else if (kind === "lab") {
      const lab = labs.data?.find((l) => l.id === labId);
      if (!lab) return;
      onAdd({ kind, experimentId: lab.id, mode, title: `${lab.title} (${MODE_LABEL[mode]})`, pass });
    } else {
      const challenge = CHALLENGES.find((c) => c.id === challengeId)!;
      onAdd({ kind, challengeId, title: `Graph match: ${challenge.title}`, pass });
    }
  };

  const ready = kind === "quiz" ? Boolean(topicId) : kind === "lab" ? Boolean(labId) : true;
  const passHelp = kind === "quiz" ? "Minimum quiz score" : kind === "lab" ? (mode === "mystery" ? "Minimum mystery grade" : "Score = 100 − 5 × % error") : "Minimum match score";

  return (
    <div className="space-y-3 rounded-2xl border border-line/70 bg-surface-2 p-3">
      <Segmented label="Task type" value={kind} onChange={setKind} options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
      {(map.error || labs.error) && kind !== "match" && <LoadError error={(map.error ?? labs.error)!} onRetry={() => { map.reload(); labs.reload(); }} />}
      {kind === "quiz" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Chapter" value={chapterId} onChange={(e) => { setChapterId(e.target.value); setTopicId(""); }}>
            <option value="">Choose a chapter…</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>Class {c.grade} · {c.title}</option>)}
          </SelectField>
          <SelectField label="Topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!chapter.data}>
            <option value="">{chapter.loading && chapterId ? "Loading…" : "Choose a topic…"}</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.quiz.length} questions)</option>)}
          </SelectField>
        </div>
      )}
      {kind === "lab" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Experiment" value={labId} onChange={(e) => setLabId(e.target.value)}>
            <option value="">Choose an experiment…</option>
            {labs.data?.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </SelectField>
          <div>
            <Label>Mode</Label>
            <Segmented label="Lab mode" value={mode} onChange={setMode} options={(Object.keys(MODE_LABEL) as LabMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
          </div>
        </div>
      )}
      {kind === "match" && (
        <SelectField label="Challenge" value={challengeId} onChange={(e) => setChallengeId(e.target.value)}>
          {(["easy", "medium", "hard"] as const).map((level) => (
            <optgroup key={level} label={level[0].toUpperCase() + level.slice(1)}>
              {CHALLENGES.filter((c) => c.level === level).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </optgroup>
          ))}
        </SelectField>
      )}
      <SliderField label={`Pass mark · ${passHelp}`} value={pass} min={0} max={100} step={5} unit="%" onChange={setPass} />
      <Button variant="primary" size="sm" icon={<Plus size={14} />} disabled={!ready} onClick={add}>Add task</Button>
    </div>
  );
}

function CreateTab() {
  const saveCreated = useAssignments((s) => s.saveCreated);
  const [title, setTitle] = useState("");
  const [teacher, setTeacher] = useState("");
  const [due, setDue] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [created, setCreated] = useState<Assignment | null>(null);

  const create = () => {
    const assignment: Assignment = { v: 1, id: newAssignmentId(), title: title.trim(), teacher: teacher.trim(), due: due || null, tasks };
    saveCreated(assignment);
    setCreated(assignment);
  };

  if (created) {
    const url = assignmentUrl(encodeAssignment(created));
    return (
      <div className="space-y-3 p-4">
        <Notice tone="success" title={`“${created.title}” is ready.`}>Share this link with your students. Everything they need is inside the link; nothing is uploaded.</Notice>
        <p className="break-all rounded-2xl bg-surface-2 p-3 font-mono text-xs">{url}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={url} label="Copy link" />
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line/60 bg-surface-2 px-3 text-xs font-semibold hover:bg-line/70">
            <ExternalLink size={14} aria-hidden /> Preview as student
          </a>
          <Button size="sm" variant="ghost" onClick={() => { setCreated(null); setTasks([]); setTitle(""); }}>Create another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div className="space-y-3">
        <TextField label="Assignment title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3: derivatives" maxLength={80} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Teacher (optional)" value={teacher} onChange={(e) => setTeacher(e.target.value)} maxLength={60} />
          <TextField label="Due date (optional)" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <TaskPicker onAdd={(task) => setTasks((t) => [...t, task])} />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted">Tasks ({tasks.length})</p>
        {tasks.length === 0 && <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">Add quizzes, lab experiments or graph challenges.</p>}
        <ol className="space-y-2">
          {tasks.map((t, i) => (
            <li key={i} className="card-edge flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{i + 1}. {t.title}</span>
                <span className="text-[11px] text-muted">{KIND_LABEL[t.kind]} · pass at {t.pass}%</span>
              </span>
              <IconButton size="sm" variant="ghost" label={`Remove task ${i + 1}`} icon={<X size={14} />} onClick={() => setTasks((list) => list.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ol>
        <Button variant="primary" disabled={!title.trim() || tasks.length === 0} onClick={create}>Create assignment link</Button>
      </div>
    </div>
  );
}

function downloadCsv(assignment: Assignment, rows: { name: string; scores: (number | null)[]; at: number }[]) {
  const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["Student", ...assignment.tasks.map((t) => t.title), "Passed", "Submitted"];
  const lines = rows.map((r) => [
    r.name,
    ...r.scores.map((s) => (s === null ? "" : String(s))),
    String(r.scores.filter((s, i) => s !== null && s >= assignment.tasks[i].pass).length),
    new Date(r.at).toISOString(),
  ]);
  const url = URL.createObjectURL(new Blob([[header, ...lines].map((l) => l.map(escape).join(",")).join("\n")], { type: "text/csv" }));
  Object.assign(document.createElement("a"), { href: url, download: `${assignment.id}-results.csv` }).click();
  URL.revokeObjectURL(url);
}

function CheckTab() {
  const created = useAssignments((s) => s.created);
  const saveCreated = useAssignments((s) => s.saveCreated);
  const list = Object.values(created).sort((a, b) => b.at - a.at);
  const [selected, setSelected] = useState(list[0]?.assignment.id ?? "");
  const [link, setLink] = useState("");
  const [codes, setCodes] = useState("");
  const assignment = created[selected]?.assignment;

  const importLink = () => {
    const decoded = decodeAssignment(link.split("#").pop() ?? "");
    if (!decoded) return;
    saveCreated(decoded);
    setSelected(decoded.id);
    setLink("");
  };

  const checks = useMemo(() => {
    if (!assignment) return [];
    return codes.split(/\n+/).map((c) => c.trim()).filter(Boolean).map((code): [string, CodeCheck] => [code, readCode(code, assignment)]);
  }, [codes, assignment]);
  // Latest valid code per student wins
  const valid = [...new Map(checks.flatMap(([, c]) => (c.ok ? [c.submission] : [])).sort((a, b) => a.at - b.at).map((s) => [s.name.toLowerCase(), s])).values()];
  const invalid = checks.filter(([, c]) => !c.ok) as [string, { ok: false; reason: string }][];

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <SelectField label="Assignment" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {list.length === 0 && <option value="">No assignments on this device yet</option>}
          {list.map((s) => <option key={s.assignment.id} value={s.assignment.id}>{s.assignment.title} ({s.assignment.tasks.length} tasks)</option>)}
        </SelectField>
        <div className="flex items-end gap-2">
          <TextField className="flex-1" label="Or paste an assignment link" value={link} onChange={(e) => setLink(e.target.value)} placeholder=".../assignment#…" />
          <Button size="md" disabled={!decodeAssignment(link.split("#").pop() ?? "")} onClick={importLink}>Import</Button>
        </div>
      </div>
      {assignment && (
        <>
          <div>
            <Label htmlFor="codes">Student codes, one per line</Label>
            <textarea id="codes" value={codes} onChange={(e) => setCodes(e.target.value)} rows={5} spellCheck={false}
              className="w-full rounded-2xl border border-line/60 bg-surface-2 p-3 font-mono text-xs focus:border-ink/40 focus:outline-none" placeholder="MLE1.…" />
          </div>
          {invalid.length > 0 && (
            <Notice tone="danger" title={`${invalid.length} code${invalid.length === 1 ? "" : "s"} rejected`}>
              <ul className="mt-1 space-y-0.5">{invalid.map(([code, c], i) => <li key={i} className="truncate"><span className="font-mono">{code.slice(0, 18)}…</span> {c.reason}</li>)}</ul>
            </Notice>
          )}
          {valid.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{valid.length} student{valid.length === 1 ? "" : "s"}</p>
                <Button size="sm" icon={<Download size={14} />} onClick={() => downloadCsv(assignment, valid)}>CSV</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-surface-2 text-left text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      {assignment.tasks.map((t, i) => <th key={i} className="px-3 py-2" title={t.title}>Task {i + 1}</th>)}
                      <th className="px-3 py-2">Passed</th>
                      <th className="px-3 py-2">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valid.map((s) => (
                      <tr key={s.name} className="border-t border-line">
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        {s.scores.map((score, i) => (
                          <td key={i} className="px-3 py-2">
                            {score === null ? <span className="text-muted">—</span> : <Badge tone={score >= assignment.tasks[i].pass ? "success" : "danger"}>{score}</Badge>}
                          </td>
                        ))}
                        <td className="px-3 py-2 tabular-nums">{s.scores.filter((x, i) => x !== null && x >= assignment.tasks[i].pass).length}/{assignment.tasks.length}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{new Date(s.at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ol className="text-xs text-muted">{assignment.tasks.map((t, i) => <li key={i}>Task {i + 1}: {t.title} (pass {t.pass}%)</li>)}</ol>
            </div>
          )}
          <p className="text-xs text-muted">Codes carry a checksum, so edited or mistyped codes are rejected. There is no server, so this stops casual editing, not a determined forger.</p>
        </>
      )}
    </div>
  );
}

function MineTab() {
  const received = useAssignments((s) => s.received);
  const removeReceived = useAssignments((s) => s.removeReceived);
  const progress = useProgress();
  const list = Object.values(received).sort((a, b) => b.at - a.at);
  if (list.length === 0) return <p className="p-4 text-sm text-muted">Assignments your teacher sends you appear here once you open the link.</p>;
  return (
    <ul className="space-y-2 p-4">
      {list.map(({ assignment, at }) => {
        const statuses = assignment.tasks.map((t) => evaluate(t, progress, at));
        const passed = statuses.filter((s) => s.passed).length;
        return (
          <li key={assignment.id} className="card-edge flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
            <Link to={`/assignment#${encodeAssignment(assignment)}`} className="min-w-0 hover:underline">
              <span className="block truncate text-sm font-medium">{assignment.title}</span>
              <span className="text-[11px] text-muted">{assignment.teacher && `${assignment.teacher} · `}{passed}/{assignment.tasks.length} passed{assignment.due && ` · due ${assignment.due}`}</span>
            </Link>
            <IconButton size="sm" variant="ghost" label={`Remove ${assignment.title}`} icon={<Trash2 size={14} />} onClick={() => removeReceived(assignment.id)} />
          </li>
        );
      })}
    </ul>
  );
}

export default function AssignmentBuilder() {
  useTrackVisit("Assignments", "assign");
  const [tab, setTab] = useState<Tab>("create");
  return (
    <>
      <PageHeader
        title="Assignments"
        description="Teachers build a task list and share it as a link. Students work through it here and send back a short verification code. No accounts, no uploads: the link carries the assignment and the code carries the scores."
        actions={<Segmented label="Section" value={tab} onChange={setTab} options={[
          { value: "create", label: "Create" },
          { value: "check", label: "Check codes" },
          { value: "mine", label: "My assignments" },
        ]} />}
      />
      <Card>
        <CardHeader
          title={tab === "create" ? "New assignment" : tab === "check" ? "Check student codes" : "Assignments I received"}
          actions={tab === "check" && <ClipboardCheck size={18} className="text-muted" aria-hidden />}
        />
        {tab === "create" && <CreateTab />}
        {tab === "check" && <CheckTab />}
        {tab === "mine" && <MineTab />}
      </Card>
    </>
  );
}
