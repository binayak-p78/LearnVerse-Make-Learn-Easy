import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useId } from "react";

const control =
  "h-10 w-full min-w-0 rounded-2xl border border-line/60 bg-surface-2 px-3.5 text-sm text-ink placeholder:text-muted/70 focus:border-ink/40 focus:outline-none";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-muted">
      {children}
    </label>
  );
}

export function TextField({
  label,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <input id={id} className={control} {...rest} />
    </div>
  );
}

export function SelectField({
  label,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <select id={id} className={control} {...rest}>
        {children}
      </select>
    </div>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  format = (v) => String(v),
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <input
          aria-label={typeof label === "string" ? `${label} value` : undefined}
          type="number"
          className="h-7 w-20 rounded-lg border border-line/60 bg-surface-2 px-1.5 text-right font-mono text-xs focus:border-ink/40 focus:outline-none"
          value={Number.isFinite(value) ? Number(format(value)) : ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          className="w-full"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit && <span className="w-8 shrink-0 text-xs text-muted">{unit}</span>}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-0.5 rounded-full border border-line/60 bg-surface-2 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            value === option.value ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
