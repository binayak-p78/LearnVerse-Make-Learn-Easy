export const EPSILON = "ε";
export const SCHEMA_VERSION = 1;

export type Kind = "dfa" | "nfa" | "pda" | "tm";
export type Move = "L" | "R" | "S";

export interface State {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface TransitionBase {
  id: string;
  from: string;
  to: string;
  read: string;
}

export type FiniteTransition = TransitionBase;

export interface PDATransition extends TransitionBase {
  pop: string;
  push: string;
}

export interface TMTransition extends TransitionBase {
  write: string;
  move: Move;
}

interface MachineBase {
  id: string;
  name: string;
  description: string;
  alphabet: string[];
  states: State[];
  start: string;
  accept: string[];
}

export interface FiniteMachine extends MachineBase {
  kind: "dfa" | "nfa";
  transitions: FiniteTransition[];
}

export interface PDAMachine extends MachineBase {
  kind: "pda";
  stackAlphabet: string[];
  initialStack: string;
  acceptMode: "final" | "empty";
  transitions: PDATransition[];
}

export interface TMMachine extends MachineBase {
  kind: "tm";
  tapeAlphabet: string[];
  blank: string;
  transitions: TMTransition[];
}

export type Machine = FiniteMachine | PDAMachine | TMMachine;
export type Transition = FiniteTransition | PDATransition | TMTransition;

export interface FiniteStep {
  states: string[];
  inputIndex: number;
  symbol: string | null;
  transitionIds: string[];
}

export interface PDAStep {
  state: string;
  inputIndex: number;
  stack: string[];
  transitionId: string | null;
}

export interface TMStep {
  state: string;
  head: number;
  tape: string;
  tapeOffset: number;
  transitionId: string | null;
}

interface ResultBase {
  accepted: boolean;
  halted: boolean;
  reason: string;
}

export interface FiniteResult extends ResultBase {
  kind: "dfa" | "nfa";
  steps: FiniteStep[];
}

export interface PDAResult extends ResultBase {
  kind: "pda";
  explored: number;
  steps: PDAStep[];
}

export interface TMResult extends ResultBase {
  kind: "tm";
  output: string;
  steps: TMStep[];
}

export type SimulationResult = FiniteResult | PDAResult | TMResult;

export interface Issue {
  code: string;
  message: string;
  ref?: string | null;
}

export interface ValidationReport {
  valid: boolean;
  errors: Issue[];
  warnings: Issue[];
}

export interface SubsetStep {
  from: string;
  symbol: string;
  to: string;
  targetSet: string[];
  isNew: boolean;
}

export interface ConvertResult {
  dfa: FiniteMachine;
  mapping: Record<string, string[]>;
  steps: SubsetStep[];
}
