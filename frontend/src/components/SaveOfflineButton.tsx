import { Check, CloudDownload } from "lucide-react";
import { useState } from "react";
import { downloadForOffline, offlineSupported, useOnline } from "@/services/offline";
import { Button } from "./ui/Button";

type State = { kind: "idle" } | { kind: "saving"; done: number; total: number } | { kind: "done"; saved: number; failed: number };

export function SaveOfflineButton() {
  const online = useOnline();
  const [state, setState] = useState<State>({ kind: "idle" });
  const supported = offlineSupported();

  const save = async () => {
    setState({ kind: "saving", done: 0, total: 0 });
    const result = await downloadForOffline((p) => setState({ kind: "saving", done: p.done, total: p.total }));
    setState({ kind: "done", saved: result.saved, failed: result.failed.length });
  };

  const label =
    state.kind === "saving" ? `Saving ${state.done}/${state.total || "…"}` :
    state.kind === "done" ? (state.failed ? `Saved ${state.saved}, ${state.failed} failed` : "Saved for offline") :
    "Save lessons for offline";

  return (
    <Button
      size="sm"
      icon={state.kind === "done" && !state.failed ? <Check size={14} /> : <CloudDownload size={14} />}
      disabled={!online || !supported || state.kind === "saving"}
      title={!supported ? "Offline saving works in the installed or built app (not in development mode)." : !online ? "Connect to the internet first." : "Download every lesson and lab so they open without a connection."}
      onClick={() => void save()}
    >
      {label}
    </Button>
  );
}
