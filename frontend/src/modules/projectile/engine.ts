export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export const vec = {
  of: (x: number, y: number): Vector2 => ({ x, y }),
  add: (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y }),
  scale: (a: Vector2, k: number): Vector2 => ({ x: a.x * k, y: a.y * k }),
  length: (a: Vector2) => Math.hypot(a.x, a.y),
  lerp: (a: Vector2, b: Vector2, t: number): Vector2 => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }),
};

export interface LaunchParams {
  speed: number;
  angleDeg: number;
  height: number;
  gravity: number;
  drag: number;
}

export interface Sample {
  t: number;
  position: Vector2;
  velocity: Vector2;
}

export interface Trajectory {
  params: LaunchParams;
  samples: Sample[];
  flightTime: number;
  maxHeight: number;
  peakTime: number;
  range: number;
  impactSpeed: number;
}

export const GRAVITY_PRESETS = {
  Earth: 9.81,
  Moon: 1.62,
  Mars: 3.71,
  Jupiter: 24.79,
} as const;

const MAX_TIME = 600;

export function initialVelocity({ speed, angleDeg }: LaunchParams): Vector2 {
  const angle = (angleDeg * Math.PI) / 180;
  return vec.of(speed * Math.cos(angle), speed * Math.sin(angle));
}

export function analyticSummary(params: LaunchParams) {
  const { x: vx, y: vy } = initialVelocity(params);
  const g = params.gravity;
  const flightTime = (vy + Math.sqrt(vy * vy + 2 * g * params.height)) / g;
  const peakTime = Math.max(0, vy / g);
  return {
    flightTime,
    peakTime,
    maxHeight: params.height + (vy > 0 ? (vy * vy) / (2 * g) : 0),
    range: vx * flightTime,
  };
}

export function analyticState(params: LaunchParams, t: number): Sample {
  const v0 = initialVelocity(params);
  const g = params.gravity;
  return {
    t,
    position: vec.of(v0.x * t, params.height + v0.y * t - 0.5 * g * t * t),
    velocity: vec.of(v0.x, v0.y - g * t),
  };
}

// Quadratic air drag: a = g − k·|v|·v
function acceleration(velocity: Vector2, params: LaunchParams): Vector2 {
  const speed = vec.length(velocity);
  return vec.of(-params.drag * speed * velocity.x, -params.gravity - params.drag * speed * velocity.y);
}

// Classic fourth-order Runge–Kutta step on (position, velocity)
function rk4Step(s: Sample, dt: number, params: LaunchParams): Sample {
  const a1 = acceleration(s.velocity, params);
  const v1 = s.velocity;
  const v2 = vec.add(s.velocity, vec.scale(a1, dt / 2));
  const a2 = acceleration(v2, params);
  const v3 = vec.add(s.velocity, vec.scale(a2, dt / 2));
  const a3 = acceleration(v3, params);
  const v4 = vec.add(s.velocity, vec.scale(a3, dt));
  const a4 = acceleration(v4, params);

  const dp = vec.scale(vec.add(vec.add(v1, vec.scale(v2, 2)), vec.add(vec.scale(v3, 2), v4)), dt / 6);
  const dv = vec.scale(vec.add(vec.add(a1, vec.scale(a2, 2)), vec.add(vec.scale(a3, 2), a4)), dt / 6);
  return { t: s.t + dt, position: vec.add(s.position, dp), velocity: vec.add(s.velocity, dv) };
}

function summarize(params: LaunchParams, samples: Sample[]): Trajectory {
  let peak = samples[0];
  for (const s of samples) if (s.position.y > peak.position.y) peak = s;
  const last = samples[samples.length - 1];
  return {
    params,
    samples,
    flightTime: last.t,
    maxHeight: peak.position.y,
    peakTime: peak.t,
    range: last.position.x,
    impactSpeed: vec.length(last.velocity),
  };
}

export function simulate(params: LaunchParams, dt = 1 / 240): Trajectory {
  if (params.drag <= 0) {
    const summary = analyticSummary(params);
    const count = Math.max(2, Math.ceil(summary.flightTime / dt));
    const samples = Array.from({ length: count + 1 }, (_, i) =>
      analyticState(params, (summary.flightTime * i) / count),
    );
    return { ...summarize(params, samples), ...summary, params, samples };
  }

  const samples: Sample[] = [{ t: 0, position: vec.of(0, params.height), velocity: initialVelocity(params) }];
  let current = samples[0];
  while (current.t < MAX_TIME) {
    const next = rk4Step(current, dt, params);
    if (next.position.y < 0) {
      // Interpolate the exact ground crossing between the last two steps
      const f = current.position.y / (current.position.y - next.position.y);
      samples.push({
        t: current.t + dt * f,
        position: vec.of(current.position.x + (next.position.x - current.position.x) * f, 0),
        velocity: vec.lerp(current.velocity, next.velocity, f),
      });
      break;
    }
    samples.push(next);
    current = next;
  }
  return summarize(params, samples);
}

export function sampleAt(trajectory: Trajectory, t: number): Sample {
  const { samples } = trajectory;
  if (t <= 0) return samples[0];
  if (t >= trajectory.flightTime) return samples[samples.length - 1];
  let low = 0;
  let high = samples.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (samples[mid].t <= t) low = mid;
    else high = mid;
  }
  const a = samples[low];
  const b = samples[high];
  const f = (t - a.t) / (b.t - a.t || 1);
  return { t, position: vec.lerp(a.position, b.position, f), velocity: vec.lerp(a.velocity, b.velocity, f) };
}

export function accelerationAt(sample: Sample, params: LaunchParams): Vector2 {
  return acceleration(sample.velocity, params);
}
