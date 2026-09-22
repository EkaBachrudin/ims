import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryApi, reportApi } from "@/api/endpoints";
import { qk } from "@/hooks/queryKeys";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/Table";
import { Badge, Card, PageHeader } from "@/components/ui/Card";
import { formatDate, todayInput } from "@/lib/format";
import type { StockReportRow } from "@/types";

export function ReportsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayInput());

  const stock = useQuery({
    queryKey: qk.reports.stock({ search, categoryId }),
    queryFn: () => reportApi.stock({ q: search || undefined, categoryId: categoryId || undefined }),
  });
  const categories = useQuery({ queryKey: qk.categories.list({}), queryFn: () => categoryApi.list() });
  const shipments = useQuery({
    queryKey: qk.reports.shipments(date),
    queryFn: () => reportApi.shipments(date),
    enabled: Boolean(date),
  });

  function exportCsv() {
    const rows = stock.data ?? [];
    const header = ["SKU", "Nama", "Kategori", "Satuan", "Stok", "Min", "Status"];
    const lines = rows.map((r) =>
      [r.sku, r.name, r.category.name, r.unit, r.stock, r.minStock, r.lowStock ? "LOW" : "OK"]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-stok-${todayInput()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stockColumns: Column<StockReportRow>[] = [
    { key: "sku", header: "SKU", render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
    { key: "name", header: "Nama", render: (r) => r.name },
    { key: "category", header: "Kategori", render: (r) => r.category.name },
    {
      key: "stock",
      header: "Stok",
      render: (r) => (
        <span className={r.lowStock ? "font-semibold text-danger" : ""}>
          {r.stock} {r.unit}
        </span>
      ),
    },
    { key: "min", header: "Min", render: (r) => r.minStock },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={r.lowStock ? "red" : "green"}>{r.lowStock ? "Kritis" : "Aman"}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Laporan"
        description="Stok terkini & rekap pengiriman"
        actions={<Button variant="secondary" onClick={exportCsv}>Export CSV</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="w-56">
              <Field label="Cari">
                <Input aria-label="Cari laporan" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama / SKU" />
              </Field>
            </div>
            <div className="w-48">
              <Field label="Kategori">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Semua</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
          <DataTable
            columns={stockColumns}
            rows={stock.data ?? []}
            loading={stock.isLoading}
            rowKey={(r) => r.id}
          />
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Rekap Pengiriman Harian</h2>
          <Field label="Tanggal">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <p className="mt-2 text-xs text-muted-foreground">Data: {shipments.data?.date ?? "-"}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {shipments.data?.shipments.length ? (
              shipments.data.shipments.map((s, i) => (
                <li key={i} className="rounded-lg border border-border p-2">
                  <p className="font-medium text-foreground">{s.partner}</p>
                  <p className="text-muted-foreground">
                    {s.qty} {s.unit} {s.product} • {s.warehouse}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">Tidak ada pengiriman pada {formatDate(date)}.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
