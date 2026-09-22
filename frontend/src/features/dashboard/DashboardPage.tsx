import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/endpoints";
import { qk } from "@/hooks/queryKeys";
import { Badge, Card, PageHeader, Spinner, StatCard } from "@/components/ui/Card";
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
    { key: "qty", header: "Qty", render: (r) => `${r.quantity} ${r.product?.unit ?? ""}`.trim() },
    { key: "warehouse", header: "Gudang", render: (r) => r.warehouse?.name ?? "-" },
    { key: "by", header: "Dicatat oleh", render: (r) => r.createdBy?.name ?? "-" },
  ];

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Dashboard" description="Ringkasan operasional gudang hari ini" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Produk" value={data?.totalProducts ?? 0} />
        <StatCard label="PO Aktif" value={data?.activePOs ?? 0} tone="amber" />
        <StatCard label="Masuk Hari Ini" value={data?.todayInbound ?? 0} tone="green" />
        <StatCard label="Keluar Hari Ini" value={data?.todayOutbound ?? 0} tone="red" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Stok Kritis{" "}
            <span className="text-slate-400">({data?.lowStockCount ?? 0})</span>
          </h2>
          {lowStock.isLoading ? (
            <p className="text-sm text-slate-400">Memuat...</p>
          ) : lowStock.data && lowStock.data.length > 0 ? (
            <ul className="space-y-2">
              {lowStock.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{p.name}</span>
                  <Badge tone="red">
                    {p.stock} / min {p.minStock}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-emerald-600">Semua stok aman.</p>
          )}
        </Card>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Transaksi Terbaru</h2>
          <DataTable
            columns={columns}
            rows={data?.recentTransactions ?? []}
            rowKey={(r) => r.id}
            empty="Belum ada transaksi"
          />
        </div>
      </div>
    </div>
  );
}
