import type { ReactNode } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { TableSkeleton } from "./Skeleton";
import type { Meta } from "@/types";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  empty = "Belum ada data",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: string;
  rowKey: (row: T) => string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      {loading ? (
        <TableSkeleton columns={Math.min(columns.length, 5)} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm tabular-nums">
            <thead className="bg-muted">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${c.className ?? ""}`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState title={empty} description="Data akan muncul setelah ada aktivitas." />
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-muted/60">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2.5 text-foreground ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Pagination({
  meta,
  onPage,
}: {
  meta?: Meta;
  onPage: (page: number) => void;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Halaman <span className="font-mono tabular-nums">{meta.page}</span> dari{" "}
        <span className="font-mono tabular-nums">{meta.totalPages}</span> (
        <span className="font-mono tabular-nums">{meta.total}</span> data)
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
