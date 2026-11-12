import type { SoundPlan } from "./sonify";

type AudioContextCtor = typeof AudioContext;

const Ctor = (): AudioContextCtor | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);

const VOLUME = 0.16;

export class AudioGraph {
  private ctx: AudioContext | null = null;
  private live: AudioScheduledSourceNode[] = [];

  static supported(): boolean {
    return Boolean(Ctor());
  }

  private context(): AudioContext {
    if (!this.ctx) {
      const Make = Ctor();
      if (!Make) throw new Error("Web Audio is not available in this browser.");
      this.ctx = new Make();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  // Routes a node through an optional stereo panner to the speakers
  private output(ctx: AudioContext, pan: number): { input: AudioNode; panner: StereoPannerNode | null } {
    if (typeof ctx.createStereoPanner !== "function") return { input: ctx.destination, panner: null };
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(ctx.destination);
    return { input: panner, panner };
  }

  private track(node: AudioScheduledSourceNode) {
    this.live.push(node);
    node.onended = () => {
      this.live = this.live.filter((n) => n !== node);
    };
  }

  play(plan: SoundPlan) {
    this.stop();
    const ctx = this.context();
    const start = ctx.currentTime + 0.05;
    const { input, panner } = this.output(ctx, plan.points[0]?.pan ?? 0);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(input);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.connect(gain);

    let sounding = false;
    for (const p of plan.points) {
      const when = start + p.t;
      panner?.pan.setValueAtTime(p.pan, when);
      if (p.freq === null) {
        if (sounding) gain.gain.setTargetAtTime(0, when, 0.008);
        sounding = false;
        continue;
      }
      osc.frequency.setValueAtTime(p.freq, when);
      if (!sounding) gain.gain.setTargetAtTime(VOLUME, when, 0.008);
      sounding = true;
    }
    gain.gain.setTargetAtTime(0, start + plan.duration, 0.01);
    osc.start(start);
    osc.stop(start + plan.duration + 0.1);
    this.track(osc);

    for (const click of plan.clicks) {
      const point = plan.points.reduce((best, p) => (Math.abs(p.t - click.t) < Math.abs(best.t - click.t) ? p : best), plan.points[0]);
      this.blip(start + click.t, click.kind === "root" ? 1800 : 520, click.kind === "root" ? 0.035 : 0.09, point?.pan ?? 0, click.kind === "root" ? "square" : "sine");
    }
  }

  private blip(when: number, freq: number, length: number, pan: number, type: OscillatorType) {
    const ctx = this.context();
    const { input } = this.output(ctx, pan);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.22, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    gain.connect(input);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + length + 0.02);
    this.track(osc);
  }

  tone(freq: number | null, pan: number, length = 0.14) {
    const ctx = this.context();
    if (freq === null) {
      this.blip(ctx.currentTime, 140, 0.06, pan, "sawtooth");
      return;
    }
    this.blip(ctx.currentTime, freq, length, pan, "triangle");
  }

  stop() {
    for (const node of this.live) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.live = [];
  }

  close() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
