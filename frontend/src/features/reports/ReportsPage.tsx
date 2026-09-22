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
import "./ReportsPage.css";

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
    { key: "sku", header: "SKU", render: (r) => <span className="mono-xs">{r.sku}</span> },
    { key: "name", header: "Nama", render: (r) => r.name },
    { key: "category", header: "Kategori", render: (r) => r.category.name },
    {
      key: "stock",
      header: "Stok",
      render: (r) => (
        <span className={r.lowStock ? "reports-page__stock--low" : undefined}>
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
    <div className="reports-page">
      <PageHeader
        title="Laporan"
        description="Stok terkini & rekap pengiriman"
        actions={<Button variant="secondary" onClick={exportCsv}>Export CSV</Button>}
      />

      <div className="reports-page__grid">
        <Card className="reports-page__main">
          <div className="reports-page__filters">
            <div className="reports-page__field-search">
              <Field label="Cari">
                <Input aria-label="Cari laporan" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama / SKU" />
              </Field>
            </div>
            <div className="reports-page__field-category">
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
          <h2 className="reports-page__section-title">Rekap Pengiriman Harian</h2>
          <Field label="Tanggal">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <p className="reports-page__date">Data: {shipments.data?.date ?? "-"}</p>
          <ul className="reports-page__shipments">
            {shipments.data?.shipments.length ? (
              shipments.data.shipments.map((s, i) => (
                <li key={i} className="reports-page__shipment">
                  <p className="reports-page__shipment-partner">{s.partner}</p>
                  <p className="reports-page__shipment-meta">
                    {s.qty} {s.unit} {s.product} • {s.warehouse}
                  </p>
                </li>
              ))
            ) : (
              <li className="reports-page__empty">Tidak ada pengiriman pada {formatDate(date)}.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
