import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`glass rounded-[26px] shadow-card ${className}`} {...rest} />;
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-1 pt-4 sm:px-5 sm:pt-5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "lime" | "success" | "danger" | "warning";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    lime: "bg-lime text-on-lime",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = "neutral",
  title,
  children,
  action,
}: {
  tone?: "neutral" | "danger" | "warning" | "success";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    neutral: "border-line bg-surface-2",
    danger: "border-danger/30 bg-danger-soft",
    warning: "border-warning/30 bg-warning-soft",
    success: "border-success/30 bg-success-soft",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}
    >
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`glass animate-pulse rounded-[26px] ${className}`} />;
}
