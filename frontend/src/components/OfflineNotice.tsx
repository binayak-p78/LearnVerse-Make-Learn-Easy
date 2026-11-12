import { Button } from "./ui/Button";
import { Notice } from "./ui/Card";
import type { ApiError } from "@/services/api";
import { useOnline } from "@/services/offline";

export function LoadError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const online = useOnline();
  const offline = error.code === "OFFLINE";
  if (offline && !online) {
    return (
      <Notice tone="warning" title="You are offline" action={<Button size="sm" onClick={onRetry}>Retry</Button>}>
        This page was not saved on this device. Lessons you have opened before, or saved for offline, still work.
      </Notice>
    );
  }
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

// Quiz answers are checked on the server, so say so instead of failing silently
export function OfflineQuizNote() {
  const online = useOnline();
  if (online) return null;
  return (
    <Notice tone="warning" title="Checking answers needs a connection">
      You can read the questions offline. Answers are checked on the server, so reconnect to submit them.
    </Notice>
  );
}
