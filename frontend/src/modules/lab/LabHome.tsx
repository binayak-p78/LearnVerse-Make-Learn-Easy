import { CheckCircle2, Clock, FlaskConical, Zap } from "lucide-react";
import { Link } from "react-router";
import { Badge, Card, PageHeader } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { api, unwrap } from "@/services/api";
import { useProgress } from "@/services/progressStore";
import { EXPERIMENTS } from "./experiments";

export default function LabHome() {
  useTrackVisit("Engineering Lab", "lab");
  const labs = useAsync(() => unwrap(api.GET("/api/labs")), []);
  const done = useProgress((s) => s.experiments);
  const meta = new Map(labs.data?.map((l) => [l.id, l]));

  return (
    <>
      <PageHeader
        title="Engineering Practical Lab"
        description="Virtual versions of standard physics and circuits practicals. Each has an observation table, an auto-plotted graph, a result with % error and viva questions. Switch to Realistic for zero errors and parallax, or Mystery to be graded on an unknown sample."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {EXPERIMENTS.map((e) => {
          const info = meta.get(e.id);
          const record = done[e.id];
          const Icon = info?.subject === "electrical" ? Zap : FlaskConical;
          return (
            <Link key={e.id} to={`/lab/${e.id}`} className="group">
              <Card className="flex h-full flex-col p-4 transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon size={20} aria-hidden /></span>
                  {record ? (
                    <Badge tone="success"><CheckCircle2 size={12} /> {record.mode === "mystery" && record.score !== undefined ? `Mystery ${record.score}/100` : "Done"}</Badge>
                  ) : info && <Badge>{info.subject}</Badge>}
                </div>
                <h2 className="mt-3 font-semibold">{info?.title ?? e.title}</h2>
                <p className="mt-1 flex-1 text-sm text-muted">{info?.aim ?? "Open to run the simulation."}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  {info && <span className="flex items-center gap-1"><Clock size={12} aria-hidden /> ~{info.minutes} min</span>}
                  {record && <span className="truncate font-mono">{record.result}</span>}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
