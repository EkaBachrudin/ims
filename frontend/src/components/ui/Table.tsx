import type { ReactNode } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { Skeleton, TableSkeleton } from "./Skeleton";
import "./Table.css";
import type { Meta } from "@/types";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

function TableCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="data-table__cards" role="status" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="data-table__card">
          <div className="data-table__card-head">
            <Skeleton className="data-table__card-skeleton-title" />
            <Skeleton className="data-table__card-skeleton-badge" />
          </div>
          <Skeleton className="data-table__card-skeleton-line" />
        </div>
      ))}
      <span className="sr-only">Memuat...</span>
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  empty = "Belum ada data",
  rowKey,
  mobileCard,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: string;
  rowKey: (row: T) => string;
  mobileCard?: (row: T) => ReactNode;
}) {
  const hasMobile = Boolean(mobileCard);

  return (
    <div className={["data-table", hasMobile && "data-table--cards"].filter(Boolean).join(" ")}>
      {loading ? (
        <>
          <div className={hasMobile ? "data-table__desktop" : undefined}>
            <TableSkeleton columns={Math.min(columns.length, 5)} />
          </div>
          {hasMobile && <TableCardSkeleton />}
        </>
      ) : (
        <>
          <div className={["data-table__scroll", hasMobile && "data-table__desktop"].filter(Boolean).join(" ")}>
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

          {mobileCard &&
            (rows.length === 0 ? (
              <div className="data-table__cards">
                <div className="data-table__card">
                  <EmptyState title={empty} description="Data akan muncul setelah ada aktivitas." />
                </div>
              </div>
            ) : (
              <ul className="data-table__cards">
                {rows.map((row) => (
                  <li key={rowKey(row)} className="data-table__card">
                    {mobileCard(row)}
                  </li>
                ))}
              </ul>
            ))}
        </>
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
