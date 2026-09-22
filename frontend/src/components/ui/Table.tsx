import type { ReactNode } from "react";
import { Button } from "./Button";
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
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${c.className ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                Memuat...
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 text-slate-700 ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
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
    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>
        Halaman {meta.page} dari {meta.totalPages} ({meta.total} data)
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
