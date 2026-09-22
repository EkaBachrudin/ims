import type { ReactNode } from "react";

const tones: Record<string, string> = {
  slate: "bg-muted text-muted-foreground",
  neutral: "bg-muted text-muted-foreground",
  green: "bg-success-subtle text-success-foreground",
  red: "bg-danger-subtle text-danger-foreground",
  yellow: "bg-warning-subtle text-warning-foreground",
  blue: "bg-info-subtle text-info-foreground",
  indigo: "bg-accent-subtle text-accent-subtle-foreground",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}
    >
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 shadow-card ${className}`}>
      {children}
    </div>
  );
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
  const colors = {
    indigo: "text-accent",
    green: "text-success",
    red: "text-danger",
    amber: "text-warning",
  };
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${colors[tone]}`}>{value}</p>
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
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label}
    </div>
  );
}
