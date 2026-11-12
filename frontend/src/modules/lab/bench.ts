import { roundTo } from "./fit";
import type { Bench, Eye, ExperimentDef, Instrument, LabMode, Row } from "./types";

export const parseLabMode = (value: string | null): LabMode => (value === "realistic" || value === "mystery" ? value : "guided");

export interface Apparatus<Truth> {
  truth: Truth;
  zero: Record<string, number>;
  parallax: Record<string, number>;
}

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

// Hidden zero error: a whole number of least counts, absent about a quarter of the time
function zeroErrorFor(instrument: Instrument): number {
  if (Math.random() < 0.25) return 0;
  const steps = Math.max(1, Math.round(instrument.maxZeroError / instrument.leastCount));
  return roundTo((Math.random() < 0.5 ? -1 : 1) * randomInt(1, steps) * instrument.leastCount, instrument.leastCount);
}

export function newApparatus<Truth>(def: ExperimentDef<Truth>, mode: LabMode): Apparatus<Truth> {
  const faulty = mode !== "guided";
  const zero: Record<string, number> = {};
  const parallax: Record<string, number> = {};
  for (const instrument of def.instruments) {
    zero[instrument.key] = faulty ? zeroErrorFor(instrument) : 0;
    parallax[instrument.key] = faulty && instrument.analog ? randomInt(2, 3) * instrument.leastCount : 0;
  }
  return { truth: def.setup(mode), zero, parallax };
}

const EYE_SIGN: Record<Eye, number> = { left: -1, straight: 0, right: 1 };

export function makeBench<Truth>(def: ExperimentDef<Truth>, apparatus: Apparatus<Truth>, mode: LabMode, eye: Eye): Bench {
  const byKey = new Map(def.instruments.map((i) => [i.key, i]));
  const offset = (key: string) => (apparatus.zero[key] ?? 0) + EYE_SIGN[eye] * (apparatus.parallax[key] ?? 0);
  return {
    mode,
    eye,
    read: (key, value) => {
      const instrument = byKey.get(key);
      return instrument ? roundTo(value + offset(key), instrument.leastCount) : value;
    },
    actual: (key, reading) => reading - offset(key),
  };
}

// Subtracts the student's zero corrections from every field an instrument measured
export function applyCorrections(raw: Row, corrections: Record<string, number>, instruments: Instrument[]): Row {
  const row: Row = { ...raw };
  for (const instrument of instruments) {
    const correction = corrections[instrument.key] ?? 0;
    if (!correction) continue;
    for (const field of instrument.fields) {
      const value = row[field];
      if (typeof value === "number") row[field] = value - correction;
    }
  }
  return row;
}
