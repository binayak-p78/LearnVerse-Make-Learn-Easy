import { ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, Notice } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Field";
import { Tex } from "@/components/ui/Tex";
import { api, ApiError, type Schemas, unwrap } from "@/services/api";

export type SolveRequest =
  | { kind: "derivative"; expression: string }
  | { kind: "integral"; expression: string; lower: string; upper: string; definite: boolean }
  | { kind: "limit"; expression: string; point: string };

function solve(request: SolveRequest, order: number): Promise<Schemas["CalculusResult"]> {
  switch (request.kind) {
    case "derivative":
      return unwrap(api.POST("/api/calculus/derivative", { body: { expression: request.expression, order } }));
    case "integral":
      return unwrap(
        api.POST("/api/calculus/integral", {
          body: request.definite
            ? { expression: request.expression, lower: request.lower, upper: request.upper }
            : { expression: request.expression },
        }),
      );
    case "limit":
      return unwrap(api.POST("/api/calculus/limit", { body: { expression: request.expression, point: request.point } }));
  }
}

export function SolverPanel({ request }: { request: SolveRequest }) {
  const [result, setResult] = useState<Schemas["CalculusResult"]>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<"1" | "2" | "3">("1");
  const key = JSON.stringify(request);

  useEffect(() => {
    setResult(undefined);
    setError(undefined);
  }, [key, order]);

  const run = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setResult(await solve(request, Number(order)));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", String(e), 0));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Step-by-step solution"
        subtitle="Solved symbolically by SymPy on the server"
        actions={
          <>
            {request.kind === "derivative" && (
              <Segmented label="Derivative order" value={order} onChange={setOrder}
                options={[{ value: "1", label: "f′" }, { value: "2", label: "f″" }, { value: "3", label: "f‴" }]} />
            )}
            <Button size="sm" variant="primary" icon={<ListChecks size={14} />} onClick={run} disabled={loading}>
              {loading ? "Solving…" : "Show steps"}
            </Button>
          </>
        }
      />
      <div className="space-y-3 p-4">
        {!result && !error && (
          <p className="text-sm text-muted">
            Press <strong>Show steps</strong> to see which rules apply and in what order.
          </p>
        )}
        {error && (
          <Notice tone={error.code === "OFFLINE" ? "warning" : "danger"} title={error.code === "OFFLINE" ? "Backend offline" : "Could not solve"}>
            {error.message}
          </Notice>
        )}
        {result && (
          <>
            <div className="rounded-lg bg-accent-soft px-3 py-2">
              <Tex block math={`${result.inputLatex} = ${result.resultLatex}`} />
            </div>
            <ol className="space-y-2">
              {result.steps.map((step, i) => (
                <li key={i} className="rounded-lg border border-line px-3 py-2">
                  <p className="text-xs font-semibold text-accent">
                    {i + 1}. {step.rule}
                  </p>
                  <p className="text-xs text-muted">{step.description}</p>
                  <Tex block math={step.latex} className="text-sm" />
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </Card>
  );
}
