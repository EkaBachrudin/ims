import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/endpoints";
import { qk } from "@/hooks/queryKeys";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/ui/Table";
import { formatDateTime } from "@/lib/format";
import type { StockTransaction } from "@/types";
import "./DashboardPage.css";

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: qk.dashboard, queryFn: reportApi.dashboard });
  const lowStock = useQuery({ queryKey: qk.reports.lowStock, queryFn: reportApi.lowStock });

  const columns: Column<StockTransaction>[] = [
    { key: "time", header: "Waktu", render: (r) => formatDateTime(r.createdAt) },
    {
      key: "type",
      header: "Tipe",
      render: (r) => (
        <Badge tone={r.type === "IN" ? "green" : r.type === "OUT" ? "red" : "yellow"}>
          {r.type === "IN" ? "Masuk" : r.type === "OUT" ? "Keluar" : "Koreksi"}
        </Badge>
      ),
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
                  <span className="dashboard-page__low-stock-name">{p.name}</span>
                  <Badge tone="red">
                    <span className="mono-num">
                      {p.stock} / min {p.minStock}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-page__safe">Semua stok aman.</p>
          )}
        </Card>

        <div className="dashboard-page__panel-main">
          <h2 className="dashboard-page__section-title">Transaksi Terbaru</h2>
          <DataTable
            columns={columns}
            rows={data?.recentTransactions ?? []}
            loading={isLoading}
            rowKey={(r) => r.id}
            empty="Belum ada transaksi"
          />
        </div>
      </div>
    </div>
  );
}
