import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/endpoints";
import { qk } from "@/hooks/queryKeys";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/ui/Table";
import { formatDateTime } from "@/lib/format";
import type { StockTransaction } from "@/types";
import "./DashboardPage.css";

const txTone: Record<StockTransaction["type"], "green" | "red" | "yellow"> = {
  IN: "green",
  OUT: "red",
  ADJUSTMENT: "yellow",
};

const txLabel: Record<StockTransaction["type"], string> = {
  IN: "Masuk",
  OUT: "Keluar",
  ADJUSTMENT: "Koreksi",
};

function stockLevel(stock: number, minStock: number) {
  if (minStock <= 0) return 100;
  return Math.min(100, Math.max(4, Math.round((stock / minStock) * 100)));
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: qk.dashboard, queryFn: reportApi.dashboard });
  const lowStock = useQuery({ queryKey: qk.reports.lowStock, queryFn: reportApi.lowStock });

  const columns: Column<StockTransaction>[] = [
    { key: "time", header: "Waktu", render: (r) => formatDateTime(r.createdAt) },
    {
      key: "type",
      header: "Tipe",
      render: (r) => <Badge tone={txTone[r.type]}>{txLabel[r.type]}</Badge>,
    },
    { key: "product", header: "Produk", render: (r) => r.product?.name ?? "-" },
    {
      key: "qty",
      header: "Qty",
      render: (r) => (
        <span className="mono-num">{`${r.quantity} ${r.product?.unit ?? ""}`.trim()}</span>
      ),
    },
    { key: "warehouse", header: "Gudang", render: (r) => r.warehouse?.name ?? "-" },
    { key: "by", header: "Dicatat oleh", render: (r) => r.createdBy?.name ?? "-" },
  ];

  return (
    <div className="dashboard-page">
      <PageHeader title="Dashboard" description="Ringkasan operasional gudang hari ini" />

      <div className="dashboard-page__stats">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="dashboard-page__skeleton-label" />
                <Skeleton className="dashboard-page__skeleton-value" />
              </Card>
            ))
          : (
            <>
              <StatCard label="Total Produk" value={data?.totalProducts ?? 0} />
              <StatCard label="PO Aktif" value={data?.activePOs ?? 0} tone="amber" />
              <StatCard label="Masuk Hari Ini" value={data?.todayInbound ?? 0} tone="green" />
              <StatCard label="Keluar Hari Ini" value={data?.todayOutbound ?? 0} tone="red" />
            </>
          )}
      </div>

      <div className="dashboard-page__panels">
        <Card className="dashboard-page__panel-side">
          <h2 className="dashboard-page__section-title">
            Stok Kritis{" "}
            <span className="dashboard-page__count">
              ({data?.lowStockCount ?? 0})
            </span>
          </h2>
          {lowStock.isLoading ? (
            <div className="dashboard-page__low-stock-skeleton">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="dashboard-page__low-stock-skeleton-row">
                  <Skeleton className="dashboard-page__skeleton-text" />
                  <Skeleton className="dashboard-page__skeleton-pill" />
                </div>
              ))}
            </div>
          ) : lowStock.data && lowStock.data.length > 0 ? (
            <ul className="dashboard-page__low-stock">
              {lowStock.data.map((p) => (
                <li key={p.id} className="dashboard-page__low-stock-item">
                  <div className="dashboard-page__low-stock-main">
                    <span className="dashboard-page__low-stock-name" title={p.name}>
                      {p.name}
                    </span>
                    <div className="dashboard-page__low-stock-bar" aria-hidden="true">
                      <span
                        className="dashboard-page__low-stock-bar-fill"
                        style={{ width: `${stockLevel(p.stock, p.minStock)}%` }}
                      />
                    </div>
                  </div>
                  <span className="dashboard-page__low-stock-badge">
                    <Badge tone="red">
                      <span className="mono-num">
                        {p.stock} / min {p.minStock}
                      </span>
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-page__safe">Semua stok aman.</p>
          )}
        </Card>

        <div className="dashboard-page__panel-main">
          <h2 className="dashboard-page__section-title">Transaksi Terbaru</h2>

          <div className="dashboard-page__table">
            <DataTable
              columns={columns}
              rows={data?.recentTransactions ?? []}
              loading={isLoading}
              rowKey={(r) => r.id}
              empty="Belum ada transaksi"
            />
          </div>

          <div className="dashboard-page__tx-list">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="dashboard-page__tx-card">
                  <div className="dashboard-page__tx-card-head">
                    <Skeleton className="dashboard-page__tx-skeleton-product" />
                    <Skeleton className="dashboard-page__tx-skeleton-badge" />
                  </div>
                  <Skeleton className="dashboard-page__tx-skeleton-line" />
                  <Skeleton className="dashboard-page__tx-skeleton-line dashboard-page__tx-skeleton-line--short" />
                </div>
              ))
            ) : data?.recentTransactions && data.recentTransactions.length > 0 ? (
              <ul className="dashboard-page__tx-items">
                {data.recentTransactions.map((t) => (
                  <li key={t.id} className="dashboard-page__tx-card">
                    <div className="dashboard-page__tx-card-head">
                      <div className="dashboard-page__tx-title">
                        <span className="dashboard-page__tx-product" title={t.product?.name ?? "-"}>
                          {t.product?.name ?? "-"}
                        </span>
                        {t.product?.sku && (
                          <span className="dashboard-page__tx-sku">{t.product.sku}</span>
                        )}
                      </div>
                      <span className="dashboard-page__tx-badge">
                        <Badge tone={txTone[t.type]}>{txLabel[t.type]}</Badge>
                      </span>
                    </div>
                    <div className="dashboard-page__tx-meta">
                      <span className="dashboard-page__tx-qty">
                        {`${t.quantity} ${t.product?.unit ?? ""}`.trim()}
                      </span>
                      <span className="dashboard-page__tx-warehouse">
                        {t.warehouse?.name ?? "-"}
                      </span>
                    </div>
                    <div className="dashboard-page__tx-footer">
                      <span>{formatDateTime(t.createdAt)}</span>
                      <span>{t.createdBy?.name ?? "-"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Belum ada transaksi"
                description="Data akan muncul setelah ada aktivitas."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
