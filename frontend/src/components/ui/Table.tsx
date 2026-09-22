import type { ReactNode } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { TableSkeleton } from "./Skeleton";
import "./Table.css";
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
    <div className="data-table">
      {loading ? (
        <TableSkeleton columns={Math.min(columns.length, 5)} />
      ) : (
        <div className="data-table__scroll">
          <table className="data-table__table">
            <thead className="data-table__head">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={["data-table__th", c.className].filter(Boolean).join(" ")}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="data-table__body">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState title={empty} description="Data akan muncul setelah ada aktivitas." />
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={rowKey(row)} className="data-table__row">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={["data-table__td", c.className].filter(Boolean).join(" ")}
                    >
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
    <div className="pagination">
      <span>
        Halaman <span className="pagination__value">{meta.page}</span> dari{" "}
        <span className="pagination__value">{meta.totalPages}</span> (
        <span className="pagination__value">{meta.total}</span> data)
      </span>
      <div className="pagination__actions">
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
