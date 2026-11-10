export function Meter({ label, value, unit, digits = 2 }: { label: string; value: number | null; unit: string; digits?: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2" role="status" aria-label={`${label} reading`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-lg tabular-nums">
        {value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits)} <span className="text-sm text-muted">{unit}</span>
      </p>
    </div>
  );
}
