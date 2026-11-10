import {
  Background,
  type Connection,
  ConnectionMode,
  Controls,
  MarkerType,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useMemo } from "react";
import { cssVar, useResolvedTheme } from "@/hooks/useTheme";
import { transitionLabel } from "../engine/machine";
import type { Machine } from "../engine/types";
import { NODE_SIZE, StateNode, type StateNodeType } from "./StateNode";
import { TransitionEdge, type TransitionEdgeType } from "./TransitionEdge";

export type Selection = { type: "state" | "transition"; id: string } | null;

interface Props {
  machine: Machine;
  onMove: (positions: Map<string, { x: number; y: number }>) => void;
  onConnect: (from: string, to: string) => void;
  onAddState: (x: number, y: number) => void;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  activeStates: Set<string>;
  activeTransitions: Set<string>;
}

const nodeTypes = { state: StateNode };
const edgeTypes = { transition: TransitionEdge };

function Diagram({ machine, onMove, onConnect, onAddState, selection, onSelect, activeStates, activeTransitions }: Props) {
  const theme = useResolvedTheme();
  const flow = useReactFlow();

  const nodes = useMemo<StateNodeType[]>(
    () =>
      machine.states.map((s) => ({
        id: s.id,
        type: "state",
        position: { x: s.x, y: s.y },
        width: NODE_SIZE,
        height: NODE_SIZE,
        measured: { width: NODE_SIZE, height: NODE_SIZE },
        selected: selection?.type === "state" && selection.id === s.id,
        data: {
          label: s.label || s.id,
          isStart: machine.start === s.id,
          isAccept: machine.kind === "pda" && machine.acceptMode === "empty" ? false : machine.accept.includes(s.id),
          active: activeStates.has(s.id),
        },
      })),
    [machine, selection, activeStates],
  );

  const edges = useMemo<TransitionEdgeType[]>(() => {
    const colors = { idle: cssVar("--muted"), active: cssVar("--accent"), selected: cssVar("--accent-strong") };
    const groups = new Map<string, Machine["transitions"]>();
    for (const t of machine.transitions) {
      const key = `${t.from}->${t.to}`;
      groups.set(key, [...(groups.get(key) ?? []), t] as Machine["transitions"]);
    }
    const select = (id: string) => onSelect({ type: "transition", id });
    return [...groups.entries()].map(([key, list]) => {
      const [from, to] = key.split("->");
      const active = list.some((t) => activeTransitions.has(t.id));
      const selected = list.some((t) => selection?.type === "transition" && selection.id === t.id);
      const color = active ? colors.active : selected ? colors.selected : colors.idle;
      return {
        id: `e:${key}`,
        source: from,
        target: to,
        type: "transition",
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        style: { stroke: color, strokeWidth: active ? 3 : selected ? 2.5 : 1.75 },
        data: {
          inline: machine.kind === "dfa" || machine.kind === "nfa",
          curved: from !== to && groups.has(`${to}->${from}`),
          active,
          onSelect: select,
          labels: list.map((t) => ({
            id: t.id,
            text: transitionLabel(t, machine.kind),
            active: activeTransitions.has(t.id),
            selected: selection?.type === "transition" && selection.id === t.id,
          })),
        },
      };
    });
    // theme is a dependency so colours refresh when it changes
  }, [machine, selection, activeTransitions, onSelect, theme]);

  const onNodesChange = useCallback(
    (changes: NodeChange<StateNodeType>[]) => {
      const moved = new Map<string, { x: number; y: number }>();
      for (const change of changes) {
        if (change.type === "position" && change.position) moved.set(change.id, change.position);
        if (change.type === "select" && change.selected) onSelect({ type: "state", id: change.id });
      }
      if (moved.size) onMove(moved);
    },
    [onMove, onSelect],
  );

  const handleConnect = useCallback((c: Connection) => c.source && c.target && onConnect(c.source, c.target), [onConnect]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onConnect={handleConnect}
      onEdgeClick={(_, edge) => {
        const first = (edge.data as TransitionEdgeType["data"])?.labels[0];
        if (first) onSelect({ type: "transition", id: first.id });
      }}
      onPaneClick={(event) => {
        if (event.detail === 2) {
          const p = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
          onAddState(p.x - 28, p.y - 28);
        } else onSelect(null);
      }}
      connectionMode={ConnectionMode.Loose}
      connectionRadius={36}
      deleteKeyCode={null}
      zoomOnDoubleClick={false}
      fitView
      fitViewOptions={{ padding: 0.3, maxZoom: 1.25 }}
      minZoom={0.25}
      maxZoom={2.5}
      colorMode={theme}
    >
      <Background gap={20} size={1} color={cssVar("--grid")} />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export function DiagramEditor(props: Props & { revision: number }) {
  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-line sm:h-[480px]" aria-label="State diagram editor">
      <ReactFlowProvider key={`${props.machine.id}:${props.revision}`}>
        <Diagram {...props} />
      </ReactFlowProvider>
    </div>
  );
}
