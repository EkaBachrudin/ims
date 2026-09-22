import type { ReactNode } from "react";
import "./Card.css";

const tones: Record<string, string> = {
  slate: "badge--slate",
  neutral: "badge--neutral",
  green: "badge--green",
  red: "badge--red",
  yellow: "badge--yellow",
  blue: "badge--blue",
  indigo: "badge--indigo",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={["badge", tones[tone] ?? tones.slate].filter(Boolean).join(" ")}>{children}</span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={["card", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function StatCard({
  label,
  value,
  tone = "indigo",
}: {
  label: string;
  value: number | string;
  tone?: "indigo" | "green" | "red" | "amber";
}) {
  return (
    <Card className={`stat-card stat-card--${tone}`}>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__text">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__icon" />
      {label}
    </div>
  );
}
