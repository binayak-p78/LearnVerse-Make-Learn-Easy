import { BookOpen, CheckCircle2, Circle, CircleDot, Crosshair, FlaskConical, KeyRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/Button";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { dayKey, useProgress } from "@/services/progressStore";
import { decodeAssignment, evaluate, makeCode, type Task, taskHref } from "./assignment";
import { useAssignments } from "./store";

const ICON: Record<Task["kind"], typeof BookOpen> = { quiz: BookOpen, lab: FlaskConical, match: Crosshair };

export default function AssignmentPage() {
  const { hash } = useLocation();
  const assignment = useMemo(() => decodeAssignment(hash.replace(/^#/, "")), [hash]);
  useTrackVisit(assignment?.title ? `Assignment: ${assignment.title}` : undefined, "assign");
  const receive = useAssignments((s) => s.receive);
  const studentName = useAssignments((s) => s.studentName);
  const setStudentName = useAssignments((s) => s.setStudentName);
  const progress = useProgress();
  const [since, setSince] = useState<number | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (assignment) setSince(receive(assignment));
  }, [assignment, receive]);

  if (!assignment) {
    return (
      <Notice tone="danger" title="This assignment link is incomplete or damaged." action={<Link to="/assign" className="text-sm font-medium text-accent">Assignments</Link>}>
        Ask your teacher to send the link again, and copy the whole thing including the part after “#”.
      </Notice>
    );
  }

  const statuses = assignment.tasks.map((t) => evaluate(t, progress, since ?? Date.now()));
  const passed = statuses.filter((s) => s.passed).length;
  const overdue = assignment.due !== null && assignment.due < dayKey();

  const generate = () => setCode(makeCode({ assignmentId: assignment.id, name: studentName.trim(), scores: statuses.map((s) => s.score), at: Date.now() }));
  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy your code", code);
    }
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted">
        <Link to="/assign" className="hover:text-accent">Assignments</Link> / {assignment.title}
      </nav>
      <PageHeader
        title={assignment.title}
        description={[assignment.teacher && `From ${assignment.teacher}`, assignment.due && `Due ${new Date(`${assignment.due}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`].filter(Boolean).join(" · ") || undefined}
        actions={<>{overdue && <Badge tone="danger">Past due</Badge>}<Badge tone={passed === assignment.tasks.length ? "lime" : "neutral"}>{passed}/{assignment.tasks.length} passed</Badge></>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Tasks" subtitle="Only attempts made after you first opened this assignment count. Open a task, finish it, then come back here." />
          <ol className="space-y-2 p-4">
            {assignment.tasks.map((task, i) => {
              const status = statuses[i];
              const Icon = ICON[task.kind];
              return (
                <li key={i} className="card-edge flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 px-3 py-3">
                  {status.passed ? <CheckCircle2 size={18} className="text-success" aria-label="Passed" /> : status.attempted ? <CircleDot size={18} className="text-warning" aria-label="Attempted" /> : <Circle size={18} className="text-muted" aria-label="Not started" />}
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary"><Icon size={16} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{task.title}</span>
                    <span className="text-[11px] text-muted">Pass at {task.pass}%{status.score !== null && ` · your score ${status.score}%`}</span>
                  </span>
                  <Link to={taskHref(task)} className="inline-flex h-8 items-center rounded-xl bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-hover">
                    {status.attempted ? "Improve" : "Open"}
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Hand in" subtitle="Your scores are packed into a code with a checksum. Send it to your teacher." />
          <div className="space-y-3 p-4">
            <TextField label="Your name" value={studentName} onChange={(e) => { setStudentName(e.target.value); setCode(null); }} maxLength={60} placeholder="Name and roll number" />
            <Button variant="primary" icon={<KeyRound size={16} />} disabled={!studentName.trim()} onClick={generate}>
              {code ? "Regenerate code" : "Get verification code"}
            </Button>
            {passed < assignment.tasks.length && !code && <p className="text-xs text-muted">You can hand in now, but unfinished tasks will show as blank.</p>}
            {code && (
              <>
                <p className="break-all rounded-2xl bg-surface-2 p-3 font-mono text-xs" aria-label="Verification code">{code}</p>
                <Button size="sm" onClick={() => void copy()}>{copied ? "Copied" : "Copy code"}</Button>
              </>
            )}
            <p className="text-[11px] text-muted">Progress is stored in this browser only. Use the same device until you hand in.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
