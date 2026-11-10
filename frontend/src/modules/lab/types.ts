import type { ComponentType } from "react";

export type Row = Record<string, number | string>;

export interface Column {
  key: string;
  label: string;
  digits?: number;
}

export interface ResultLine {
  label: string;
  symbol: string;
  value: number;
  unit: string;
  expected?: number;
  expectedLabel?: string;
}

export interface GraphSpec {
  x: string;
  y: string;
  xLabel: string;
  yLabel: string;
  fit: "linear" | "origin" | "none";
}

export interface SimulationProps<Truth> {
  truth: Truth;
  rows: Row[];
  onRecord: (row: Row) => void;
}

export interface ExperimentDef<Truth = unknown> {
  id: string;
  title: string;
  minReadings: number;
  columns: Column[];
  graph?: GraphSpec;
  setup: () => Truth;
  Simulation: ComponentType<SimulationProps<Truth>>;
  results: (rows: Row[], truth: Truth) => ResultLine[];
}
