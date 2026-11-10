import type { ExperimentDef } from "../types";
import { lens } from "./lens";
import { meterBridge } from "./meterBridge";
import { ohms } from "./ohms";
import { pendulum } from "./pendulum";
import { rc } from "./rc";
import { seriesParallel } from "./seriesParallel";

export const EXPERIMENTS = [pendulum, ohms, rc, lens, meterBridge, seriesParallel] as ExperimentDef<unknown>[];

export const experimentById = new Map(EXPERIMENTS.map((e) => [e.id, e]));
