import { Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, PageHeader } from "@/components/ui/Card";
import { Segmented, SelectField, SliderField } from "@/components/ui/Field";
import { Tex } from "@/components/ui/Tex";
import { formatNumber } from "@/components/plot/scale";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { cssVar } from "@/hooks/useTheme";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { GRAVITY_PRESETS, type LaunchParams, sampleAt, simulate, vec } from "./engine";
import { type PlottedTrajectory, ProjectileCanvas } from "./ProjectileCanvas";

const SPEEDS = ["0.25", "0.5", "1", "2"] as const;
const COMPARE_COLORS = ["--plot-2", "--plot-3", "--plot-4", "--plot-5"];
const MAX_COMPARISONS = 4;

const num = (value: string | null, fallback: number) => {
  const n = Number(value);
  return value !== null && Number.isFinite(n) ? n : fallback;
};

function Readout({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-sm tabular-nums">
        {formatNumber(value, 2)} <span className="text-muted">{unit}</span>
      </p>
    </div>
  );
}

export default function ProjectilePage() {
  useTrackVisit("Projectile Motion", "projectile");
  const [query] = useSearchParams();
  const [params, setParams] = useState<LaunchParams>(() => ({
    speed: num(query.get("v"), 25),
    angleDeg: num(query.get("angle"), 45),
    height: num(query.get("h"), 0),
    gravity: GRAVITY_PRESETS.Earth,
    drag: 0,
  }));
  const [preset, setPreset] = useState<string>("Earth");
  const [dragOn, setDragOn] = useState(false);
  const [dragK, setDragK] = useState(0.01);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>("1");
  const [showVectors, setShowVectors] = useState(true);
  const [comparisons, setComparisons] = useState<PlottedTrajectory[]>([]);

  const effective = useMemo(() => ({ ...params, drag: dragOn ? dragK : 0 }), [params, dragOn, dragK]);
  const trajectory = useMemo(() => simulate(effective), [effective]);
  const now = sampleAt(trajectory, time);

  const update = (patch: Partial<LaunchParams>) => {
    setParams((p) => ({ ...p, ...patch }));
    setTime(0);
    setPlaying(false);
  };

  const timeRef = useRef(time);
  timeRef.current = time;

  useAnimationLoop(playing, (dt) => {
    const next = timeRef.current + dt * Number(speed);
    if (next >= trajectory.flightTime) {
      setTime(trajectory.flightTime);
      setPlaying(false);
      return false;
    }
    setTime(next);
  });

  const togglePlay = () => {
    if (!playing && time >= trajectory.flightTime) setTime(0);
    setPlaying((p) => !p);
  };

  const addComparison = () =>
    setComparisons((list) => {
      const color = cssVar(COMPARE_COLORS[list.length % COMPARE_COLORS.length]);
      const label = `${effective.speed} m/s @ ${effective.angleDeg}°${effective.drag ? " (drag)" : ""}`;
      return [...list, { trajectory, color, label }].slice(-MAX_COMPARISONS);
    });

  const v0x = effective.speed * Math.cos((effective.angleDeg * Math.PI) / 180);
  const v0y = effective.speed * Math.sin((effective.angleDeg * Math.PI) / 180);
  const g = effective.gravity;

  return (
    <>
      <PageHeader
        title="Projectile Motion Simulator"
        description="Set the launch conditions, play the flight, and compare paths. Drag is modelled as F = −k·|v|·v and integrated with RK4."
        actions={<BookmarkButton title="Projectile Motion" module="projectile" />}
      />

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Launch settings" />
          <div className="space-y-4 p-4">
            <SliderField label="Initial speed" unit="m/s" value={params.speed} min={1} max={100} step={0.5}
              onChange={(speed) => update({ speed })} />
            <SliderField label="Launch angle" unit="°" value={params.angleDeg} min={0} max={90} step={0.5}
              onChange={(angleDeg) => update({ angleDeg })} />
            <SliderField label="Launch height" unit="m" value={params.height} min={0} max={100} step={0.5}
              onChange={(height) => update({ height })} />
            <SelectField
              label="Gravity"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                const value = GRAVITY_PRESETS[e.target.value as keyof typeof GRAVITY_PRESETS];
                if (value) update({ gravity: value });
              }}
            >
              {Object.entries(GRAVITY_PRESETS).map(([name, value]) => (
                <option key={name} value={name}>
                  {name} ({value} m/s²)
                </option>
              ))}
              <option value="custom">Custom</option>
            </SelectField>
            {preset === "custom" && (
              <SliderField label="g" unit="m/s²" value={params.gravity} min={0.5} max={30} step={0.01}
                onChange={(gravity) => update({ gravity })} />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dragOn} onChange={(e) => { setDragOn(e.target.checked); setTime(0); }} />
              Air resistance
            </label>
            {dragOn && (
              <SliderField label="Drag coefficient k" unit="1/m" value={dragK} min={0.001} max={0.1} step={0.001}
                onChange={(k) => { setDragK(k); setTime(0); }} format={(v) => v.toFixed(3)} />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showVectors} onChange={(e) => setShowVectors(e.target.checked)} />
              Show velocity and acceleration vectors
            </label>
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <Button variant="primary" icon={playing ? <Pause size={16} /> : <Play size={16} />} onClick={togglePlay}>
                {playing ? "Pause" : time > 0 && time < trajectory.flightTime ? "Resume" : "Launch"}
              </Button>
              <Button icon={<RotateCcw size={16} />} onClick={() => { setPlaying(false); setTime(0); }}>
                Reset
              </Button>
              <Segmented label="Playback speed" value={speed} onChange={setSpeed}
                options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} />
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" icon={<Plus size={14} />} onClick={addComparison}>
                  Add to comparison
                </Button>
                {comparisons.length > 0 && (
                  <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setComparisons([])}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="p-3">
              <ProjectileCanvas current={trajectory} comparisons={comparisons} time={time} showVectors={showVectors} />
              <input
                type="range"
                aria-label="Scrub time"
                className="mt-3 w-full"
                min={0}
                max={trajectory.flightTime}
                step={trajectory.flightTime / 500}
                value={time}
                onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }}
              />
              {comparisons.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {comparisons.map((c, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="inline-block h-0.5 w-5" style={{ background: c.color }} />
                      {c.label}: R = {formatNumber(c.trajectory.range, 2)} m, H = {formatNumber(c.trajectory.maxHeight, 2)} m
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Live readouts" subtitle={`At t = ${formatNumber(time, 2)} s`} />
              <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                <Readout label="x" value={now.position.x} unit="m" />
                <Readout label="y" value={now.position.y} unit="m" />
                <Readout label="|v|" value={vec.length(now.velocity)} unit="m/s" />
                <Readout label="vx" value={now.velocity.x} unit="m/s" />
                <Readout label="vy" value={now.velocity.y} unit="m/s" />
                <Readout label="Time of flight" value={trajectory.flightTime} unit="s" />
                <Readout label="Max height" value={trajectory.maxHeight} unit="m" />
                <Readout label="Range" value={trajectory.range} unit="m" />
                <Readout label="Impact speed" value={trajectory.impactSpeed} unit="m/s" />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Formulas"
                subtitle={dragOn ? "With drag there is no closed form; values come from RK4 integration." : "Values substituted from the current launch."}
              />
              <div className="space-y-1 overflow-x-auto p-4 text-sm">
                <Tex block math={`u_x = u\\cos\\theta = ${formatNumber(v0x, 2)}\\ \\text{m/s},\\quad u_y = u\\sin\\theta = ${formatNumber(v0y, 2)}\\ \\text{m/s}`} />
                {dragOn ? (
                  <Tex block math={`\\vec a = \\vec g - k\\,|\\vec v|\\,\\vec v,\\quad k = ${dragK}`} />
                ) : (
                  <>
                    <Tex block math={`T = \\frac{u_y + \\sqrt{u_y^2 + 2gh}}{g} = ${formatNumber(trajectory.flightTime, 3)}\\ \\text{s}`} />
                    <Tex block math={`H = h + \\frac{u_y^2}{2g} = ${formatNumber(trajectory.maxHeight, 3)}\\ \\text{m}`} />
                    <Tex block math={`R = u_x T = ${formatNumber(trajectory.range, 3)}\\ \\text{m}`} />
                    <Tex block math={`y = h + x\\tan\\theta - \\frac{g x^2}{2u^2\\cos^2\\theta}\\quad (g = ${g})`} />
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
