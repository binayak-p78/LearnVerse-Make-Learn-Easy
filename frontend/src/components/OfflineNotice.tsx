import { Button } from "./ui/Button";
import { Notice } from "./ui/Card";
import type { ApiError } from "@/services/api";

export function LoadError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const offline = error.code === "OFFLINE";
  return (
    <Notice
      tone={offline ? "warning" : "danger"}
      title={offline ? "Lessons need the backend" : "Could not load this page"}
      action={<Button size="sm" onClick={onRetry}>Retry</Button>}
    >
      {offline ? (
        <>
          Start it with <code className="font-mono">uvicorn app.main:app --reload</code> in the <code className="font-mono">backend</code> folder. The simulators keep working offline.
        </>
      ) : (
        error.message
      )}
    </Notice>
  );
}
