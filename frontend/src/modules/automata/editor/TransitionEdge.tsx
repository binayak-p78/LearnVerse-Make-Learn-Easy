import { BaseEdge, type Edge, EdgeLabelRenderer, type EdgeProps, type InternalNode, useInternalNode } from "@xyflow/react";
import { NODE_SIZE } from "./StateNode";

export type TransitionEdgeData = {
  labels: { id: string; text: string; active: boolean; selected: boolean }[];
  inline: boolean;
  curved: boolean;
  active: boolean;
  onSelect: (transitionId: string) => void;
};

export type TransitionEdgeType = Edge<TransitionEdgeData, "transition">;

const RADIUS = NODE_SIZE / 2;

const centre = (node: InternalNode) => ({
  x: node.internals.positionAbsolute.x + (node.measured.width ?? NODE_SIZE) / 2,
  y: node.internals.positionAbsolute.y + (node.measured.height ?? NODE_SIZE) / 2,
});

const towards = (from: { x: number; y: number }, to: { x: number; y: number }, distance: number) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
};

// Floating edge between circle borders; self-loops arc above the state
function geometry(source: InternalNode, target: InternalNode, curved: boolean) {
  const a = centre(source);
  if (source.id === target.id) {
    const p1 = { x: a.x + RADIUS * Math.cos(-2.1), y: a.y + RADIUS * Math.sin(-2.1) };
    const p2 = { x: a.x + RADIUS * Math.cos(-1.04), y: a.y + RADIUS * Math.sin(-1.04) };
    const top = a.y - RADIUS - 62;
    return {
      path: `M ${p1.x} ${p1.y} C ${a.x - 46} ${top}, ${a.x + 46} ${top}, ${p2.x} ${p2.y}`,
      label: { x: a.x, y: top + 8 },
    };
  }
  const b = centre(target);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = curved ? 64 : 0;
  const control = { x: (a.x + b.x) / 2 - (dy / length) * bend, y: (a.y + b.y) / 2 + (dx / length) * bend };
  const start = towards(a, control, RADIUS);
  const end = towards(b, control, RADIUS + 2);
  return {
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    label: { x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y },
  };
}

export function TransitionEdge({ id, source, target, data, markerEnd, style }: EdgeProps<TransitionEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode || !data) return null;
  const { path, label } = geometry(sourceNode, targetNode, data.curved);

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={18} />
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan absolute flex max-w-[180px] rounded-md border border-line bg-surface px-1 py-0.5 font-mono text-[11px] leading-snug shadow-sm ${
            data.inline ? "flex-row flex-wrap justify-center gap-x-1" : "flex-col items-stretch"
          }`}
          style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)`, pointerEvents: "all" }}
        >
          {data.labels.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => data.onSelect(l.id)}
              className={`whitespace-nowrap rounded px-1 text-left ${
                l.active ? "bg-accent text-on-accent" : l.selected ? "bg-accent-soft text-accent" : "text-ink hover:bg-surface-2"
              }`}
            >
              {l.text}
              {data.inline && i < data.labels.length - 1 ? "," : ""}
            </button>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
