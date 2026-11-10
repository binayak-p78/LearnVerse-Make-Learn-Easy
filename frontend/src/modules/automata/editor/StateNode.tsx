import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

export const NODE_SIZE = 56;

export type StateNodeData = {
  label: string;
  isStart: boolean;
  isAccept: boolean;
  active: boolean;
};

export type StateNodeType = Node<StateNodeData, "state">;

export function StateNode({ data, selected }: NodeProps<StateNodeType>) {
  return (
    <div className="relative" style={{ width: NODE_SIZE, height: NODE_SIZE }}>
      {data.isStart && (
        <svg className="absolute -left-8 top-1/2 -translate-y-1/2 text-ink" width="30" height="14" viewBox="0 0 30 14" aria-hidden>
          <path d="M0 7 H22" stroke="currentColor" strokeWidth="2" />
          <path d="M20 1 L29 7 L20 13 Z" fill="currentColor" />
        </svg>
      )}
      <div
        className={`flex h-full w-full items-center justify-center rounded-full border-2 transition-colors duration-200 ${
          data.active ? "border-accent bg-accent text-on-accent shadow-lg shadow-accent/30" : "border-ink/70 bg-surface text-ink"
        } ${selected ? "ring-4 ring-accent/30" : ""}`}
      >
        {data.isAccept && (
          <div className={`pointer-events-none absolute inset-[4px] rounded-full border-2 ${data.active ? "border-on-accent/80" : "border-ink/70"}`} />
        )}
        <span className="max-w-[44px] truncate px-1 text-center text-[11px] font-semibold leading-tight" title={data.label}>
          {data.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-surface !bg-accent"
        title="Drag to another state to add a transition"
      />
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !opacity-0" />
    </div>
  );
}
