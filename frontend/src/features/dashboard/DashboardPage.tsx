import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/endpoints";
import { qk } from "@/hooks/queryKeys";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/ui/Table";
import { formatDateTime } from "@/lib/format";
import type { StockTransaction } from "@/types";

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
        <span className="font-mono tabular-nums">{`${r.quantity} ${r.product?.unit ?? ""}`.trim()}</span>
      ),
    },
    { key: "warehouse", header: "Gudang", render: (r) => r.warehouse?.name ?? "-" },
    { key: "by", header: "Dicatat oleh", render: (r) => r.createdBy?.name ?? "-" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Ringkasan operasional gudang hari ini" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-16" />
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

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Stok Kritis{" "}
            <span className="font-mono tabular-nums text-muted-foreground">
              ({data?.lowStockCount ?? 0})
            </span>
          </h2>
          {lowStock.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : lowStock.data && lowStock.data.length > 0 ? (
            <ul className="space-y-2">
              {lowStock.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.name}</span>
                  <Badge tone="red">
                    <span className="font-mono tabular-nums">
                      {p.stock} / min {p.minStock}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-success">Semua stok aman.</p>
          )}
        </Card>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Transaksi Terbaru</h2>
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
