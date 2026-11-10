import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover border-transparent shadow-sm",
  accent: "bg-accent text-on-accent hover:bg-accent-strong border-transparent shadow-sm",
  secondary: "bg-surface-2 text-ink border-line/60 hover:bg-line/70",
  ghost: "bg-transparent text-ink border-transparent hover:bg-surface-2",
  danger: "bg-surface-2 text-danger border-transparent hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-xl",
  md: "h-10 px-4 text-sm gap-2 rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className = "",
  ...rest
}: Omit<ButtonProps, "children"> & { label: string }) {
  return (
    <Button
      aria-label={label}
      title={label}
      className={`!px-0 ${rest.size === "sm" ? "w-8" : "w-10"} ${className}`}
      {...rest}
    />
  );
}
