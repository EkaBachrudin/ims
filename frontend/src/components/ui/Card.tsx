import type { ReactNode } from "react";

const tones: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
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
    indigo: "text-indigo-600",
    green: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${colors[tone]}`}>{value}</p>
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
      {label}
    </div>
  );
}
