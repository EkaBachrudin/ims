import "./Skeleton.css";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={["skeleton", className].filter(Boolean).join(" ")} aria-hidden="true" />;
}

export function TableSkeleton({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="table-skeleton" role="status" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="table-skeleton__row">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={
                c === 0
                  ? "table-skeleton__cell table-skeleton__cell--lead"
                  : "table-skeleton__cell table-skeleton__cell--grow"
              }
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
