import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge, Card } from "@/components/ui/Card";

export const ago = (at: number) => {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

export function DotMeter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="dots relative h-7 w-full">
      <div className="dots-strong absolute inset-y-0 left-0" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({
  label,
  badge,
  value,
  meter,
  footer,
  tone,
}: {
  label: string;
  badge?: string;
  value: string;
  meter: number;
  footer: string;
  tone: "sun" | "salmon";
}) {
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm text-muted">
        {label}
        {badge && <Badge tone="lime">{badge}</Badge>}
      </p>
      <p className="mb-4 mt-2 text-[44px] font-normal leading-none tracking-tight tabular-nums">{value}</p>
      <DotMeter value={meter} label={label} />
      <p className={`mt-3 truncate rounded-xl px-3 py-2 text-xs font-semibold text-on-bright ${tone === "sun" ? "bg-sun" : "bg-salmon"}`}>{footer}</p>
    </Card>
  );
}

export interface DayActivity {
  key: string;
  label: string;
  actions: number;
}

export function ActivityBars({ days }: { days: DayActivity[] }) {
  const peak = Math.max(4, ...days.map((d) => d.actions));
  const today = days.at(-1)?.key;
  return (
    <ol className="flex h-48 items-end gap-1.5 sm:gap-2" aria-label="Learning actions per day">
      {days.map((d) => (
        <li key={d.key} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2" aria-label={`${d.key}: ${d.actions} actions`} title={`${d.key} · ${d.actions} actions`}>
          <div className="dots relative w-full flex-1 overflow-hidden rounded-full">
            <div
              className={`absolute inset-x-0 bottom-0 rounded-full ${d.key === today ? "bg-primary" : "bg-salmon"}`}
              style={{ height: d.actions ? `${Math.max(8, (d.actions / peak) * 100)}%` : 0 }}
            />
          </div>
          <span className={`text-[10px] font-semibold ${d.key === today ? "text-ink" : "text-muted"}`}>{d.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ListRow({
  to,
  icon,
  title,
  subtitle,
  highlighted = false,
  trailing,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  highlighted?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <li className={`flex items-center gap-1 rounded-2xl pr-1.5 transition-colors ${highlighted ? "card-edge bg-surface-2 shadow-card" : "hover:bg-surface-2/70"}`}>
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${highlighted ? "bg-primary text-on-primary" : "card-edge bg-surface-2 text-ink"}`}>{icon}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="mt-1 block truncate text-xs text-muted">{subtitle}</span>
        </span>
      </Link>
      {trailing}
    </li>
  );
}

export function SectionCard({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={`p-3 sm:p-4 ${className}`}>
      <div className="mb-2 flex items-start justify-between gap-3 px-1.5 pt-1">
        <div className="min-w-0">
          <h2 className="text-base font-medium tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
