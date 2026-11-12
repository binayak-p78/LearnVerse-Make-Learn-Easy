import type { ComponentType } from "react";
import type { LabMode } from "@/services/progressStore";

export type { LabMode };

export type Row = Record<string, number | string>;

export type Eye = "left" | "straight" | "right";

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

export interface Instrument {
  key: string;
  label: string;
  unit: string;
  fields: string[];
  leastCount: number;
  maxZeroError: number;
  analog: boolean;
  digits: number;
}

// The range a well-planned set of readings should cover for one recorded field
export interface Sweep {
  field: string;
  label: string;
  min: number;
  max: number;
}

export interface Target<Truth> {
  symbol: string;
  label: string;
  unit: string;
  value: (truth: Truth) => number;
}

export interface Bench {
  mode: LabMode;
  eye: Eye;
  read: (instrument: string, value: number) => number;
  actual: (instrument: string, reading: number) => number;
}

export interface SimulationProps<Truth> {
  truth: Truth;
  rows: Row[];
  bench: Bench;
  onRecord: (raw: Row) => void;
}

export interface ExperimentDef<Truth = unknown> {
  id: string;
  title: string;
  minReadings: number;
  columns: Column[];
  instruments: Instrument[];
  graph?: GraphSpec;
  sweep?: (truth: Truth) => Sweep;
  consistency?: string;
  target: Target<Truth>;
  setup: (mode: LabMode) => Truth;
  Simulation: ComponentType<SimulationProps<Truth>>;
  derive: (raw: Row) => Row;
  results: (rows: Row[], truth: Truth) => ResultLine[];
}
