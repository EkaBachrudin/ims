import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

type Variant = "primary" | "secondary" | "danger" | "danger-ghost" | "accent-ghost" | "ghost" | "success";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "btn--primary",
  secondary: "btn--secondary",
  danger: "btn--danger",
  "danger-ghost": "btn--danger-ghost",
  "accent-ghost": "btn--accent-ghost",
  success: "btn--success",
  ghost: "btn--ghost",
};

const sizes: Record<Size, string> = {
  sm: "btn--sm",
  md: "btn--md",
  icon: "btn--icon",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      className={["btn", variants[variant], sizes[size], className].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="btn__spinner" />}
      {children}
    </button>
  );
}
