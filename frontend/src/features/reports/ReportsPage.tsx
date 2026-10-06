import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowsLeftRight,
  ChartBar,
  ChartLine,
  MagnifyingGlass,
  Package,
  ShoppingCart,
  Truck,
  X,
} from "@phosphor-icons/react";
import { categoryApi, reportApi, warehouseApi } from "@/api/endpoints";
import { qk } from "@/hooks/queryKeys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DateRange, type DateRangeValue } from "@/components/ui/DateRange";
import { RankBarChart, TrendAreaChart, chartColors } from "@/components/charts/Charts";
import {
  dateInputOffset,
  diffDays,
  dnStatusTone,
  formatCurrency,
  formatDate,
  poStatusTone,
  roleLabel,
  shiftDateInput,
  todayInput,
} from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type {
  DnStatus,
  MovementAnalysis,
  PoStatus,
  ReportDnRow,
  ReportPoRow,
  ReportProductRow,
  ReportTransactionRow,
  UserActivity,
} from "@/types";
import "./ReportsPage.css";

type ReportTab = "ringkasan" | "persediaan" | "pembelian" | "pengiriman" | "mutasi" | "analitik";

const tabs = [
  { value: "ringkasan" as const, label: "Ringkasan", icon: <ChartLine size={16} /> },
  { value: "persediaan" as const, label: "Persediaan", icon: <Package size={16} /> },
  { value: "pembelian" as const, label: "Pembelian", icon: <ShoppingCart size={16} /> },
  { value: "pengiriman" as const, label: "Pengiriman", icon: <Truck size={16} /> },
  { value: "mutasi" as const, label: "Mutasi", icon: <ArrowsLeftRight size={16} /> },
  { value: "analitik" as const, label: "Analitik", icon: <ChartBar size={16} /> },
];

const PO_STATUSES: PoStatus[] = ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"];
const DN_STATUSES: DnStatus[] = ["DRAFT", "SHIPPED", "DELIVERED", "CANCELLED"];
const TX_TYPES = ["IN", "OUT", "ADJUSTMENT"] as const;
const txLabel: Record<ReportTransactionRow["type"], string> = {
  IN: "Masuk",
  OUT: "Keluar",
  ADJUSTMENT: "Koreksi",
};
const txTone: Record<ReportTransactionRow["type"], "green" | "red" | "yellow"> = {
  IN: "green",
  OUT: "red",
  ADJUSTMENT: "yellow",
};

export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("ringkasan");

  return (
    <div className="reports-page">
      <PageHeader
        title="Laporan"
        description="Analitik stok, tren pergerakan, dan ringkasan operasional"
      />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === "ringkasan" && <RingkasanTab />}
      {tab === "persediaan" && <PersediaanTab />}
      {tab === "pembelian" && <PembelianTab />}
      {tab === "pengiriman" && <PengirimanTab />}
      {tab === "mutasi" && <MutasiTab />}
      {tab === "analitik" && <AnalitikTab />}
    </div>
  );
}

function defaultRange(): DateRangeValue {
  return { from: dateInputOffset(-29), to: todayInput() };
}

function deltaText(value: number): string {
  if (value === 0) return "sama";
  const arrow = value > 0 ? "▲" : "▼";
  return `${arrow} ${new Intl.NumberFormat("id-ID").format(Math.abs(value))}`;
}

function deltaTone(value: number): string | undefined {
  if (value === 0) return undefined;
  return value > 0 ? "reports-page__delta--up" : "reports-page__delta--down";
}

function RingkasanTab() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [shipDate, setShipDate] = useState(todayInput());

  const bucket = useMemo<"day" | "week" | "month">(() => {
    const days = diffDays(range.from, range.to);
    if (days <= 45) return "day";
    if (days <= 200) return "week";
    return "month";
  }, [range.from, range.to]);

  const prevRange = useMemo<DateRangeValue>(() => {
    const days = Math.max(0, diffDays(range.from, range.to));
    const prevTo = shiftDateInput(range.from, -1);
    return { from: shiftDateInput(prevTo, -days), to: prevTo };
  }, [range.from, range.to]);

  const summary = useQuery({
    queryKey: qk.reports.periodSummary(range),
    queryFn: () => reportApi.periodSummary({ from: range.from, to: range.to }),
    enabled: Boolean(range.from && range.to),
  });
  const previous = useQuery({
    queryKey: qk.reports.periodSummary(prevRange),
    queryFn: () => reportApi.periodSummary({ from: prevRange.from, to: prevRange.to }),
    enabled: Boolean(prevRange.from && prevRange.to),
  });
  const trend = useQuery({
    queryKey: qk.reports.stockTrend({ ...range, bucket }),
    queryFn: () => reportApi.stockTrend({ from: range.from, to: range.to, bucket }),
    enabled: Boolean(range.from && range.to),
  });
  const shipments = useQuery({
    queryKey: qk.reports.shipments(shipDate),
    queryFn: () => reportApi.shipments(shipDate),
    enabled: Boolean(shipDate),
  });

  const data = summary.data;
  const prev = previous.data;

  const trendData = (trend.data?.buckets ?? []).map((b) => ({
    period: b.period,
    inbound: b.inbound,
    outbound: b.outbound,
    adjustment: b.adjustment,
  }));
  const partnerData = (data?.topPartners ?? []).map((p) => ({
    partner: p.partner,
    quantity: p.quantity,
  }));

  const periodDays = diffDays(range.from, range.to) + 1;
  const deltaIn = prev ? (data?.inbound.quantity ?? 0) - prev.inbound.quantity : undefined;
  const deltaOut = prev ? (data?.outbound.quantity ?? 0) - prev.outbound.quantity : undefined;

  return (
    <>
      <div className="reports-page__toolbar">
        <DateRange value={range} onChange={setRange} />
      </div>

      <div className="reports-page__kpis">
        <StatCard
          label="Masuk (unit)"
          value={data?.inbound.quantity ?? 0}
          tone="green"
          hint={`${data?.inbound.count ?? 0} transaksi`}
        />
        <StatCard
          label="Keluar (unit)"
          value={data?.outbound.quantity ?? 0}
          tone="red"
          hint={`${data?.outbound.count ?? 0} transaksi`}
        />
        <StatCard label="PO Aktif" value={data?.activePOs ?? 0} tone="amber" />
        <StatCard label="Stok Kritis" value={data?.lowStockCount ?? 0} tone="red" />
        <StatCard label="Total Produk" value={data?.totalProducts ?? 0} tone="indigo" />
      </div>

      {prev && (
        <p className="reports-page__compare">
          <span className="reports-page__compare-label">
            vs {periodDays} hari sebelumnya ({formatDate(prev.from)} – {formatDate(prev.to)})
          </span>
          <span>
            Masuk{" "}
            <strong className={deltaTone(deltaIn ?? 0)}>{deltaText(deltaIn ?? 0)}</strong>
            <span className="reports-page__compare-hint">
              {" "}
              {prev.inbound.quantity}→{data?.inbound.quantity ?? 0}
            </span>
          </span>
          <span>
            Keluar{" "}
            <strong className={deltaTone(deltaOut ?? 0)}>{deltaText(deltaOut ?? 0)}</strong>
            <span className="reports-page__compare-hint">
              {" "}
              {prev.outbound.quantity}→{data?.outbound.quantity ?? 0}
            </span>
          </span>
        </p>
      )}

      <div className="reports-page__panels">
        <Card className="reports-page__panel-wide">
          <h2 className="reports-page__section-title">Tren Pergerakan Stok</h2>
          <TrendAreaChart
            data={trendData}
            xKey="period"
            series={[
              { key: "inbound", label: "Masuk", color: chartColors.inbound },
              { key: "outbound", label: "Keluar", color: chartColors.outbound },
              { key: "adjustment", label: "Koreksi", color: chartColors.adjustment },
            ]}
          />
        </Card>

        <Card>
          <h2 className="reports-page__section-title">Top 5 Tujuan (Keluar)</h2>
          <RankBarChart
            data={partnerData}
            xKey="partner"
            yKey="quantity"
            label="Qty"
            color={chartColors.bar}
          />
        </Card>

        <Card>
          <h2 className="reports-page__section-title">Rekap Pengiriman Harian</h2>
          <Input
            type="date"
            aria-label="Tanggal pengiriman"
            value={shipDate}
            onChange={(e) => setShipDate(e.target.value)}
          />
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
              <li className="reports-page__empty">
                Tidak ada pengiriman pada {formatDate(shipDate)}.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}

function PersediaanTab() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);

  const summary = useQuery({ queryKey: qk.reports.stockSummary, queryFn: reportApi.stockSummary });
  const categories = useQuery({ queryKey: qk.categories.list({}), queryFn: () => categoryApi.list() });
  const lowStock = useQuery({ queryKey: qk.reports.lowStock, queryFn: reportApi.lowStock });

  const filters = {
    q: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    page,
    limit: 20,
  };
  const products = useQuery({
    queryKey: qk.reports.products(filters),
    queryFn: () => reportApi.products(filters),
  });

  const columns: Column<ReportProductRow>[] = [
    { key: "sku", header: "SKU", render: (r) => <span className="mono-xs">{r.sku}</span> },
    { key: "name", header: "Nama", render: (r) => r.name },
    { key: "category", header: "Kategori", render: (r) => r.category ?? "-" },
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

  function exportCsv() {
    const rows = (products.data?.data ?? []).map((r) => [
      r.sku,
      r.name,
      r.category ?? "-",
      r.unit,
      r.stock,
      r.minStock,
      r.lowStock ? "KRITIS" : "AMAN",
    ]);
    downloadCsv(
      `laporan-persediaan-${todayInput()}.csv`,
      ["SKU", "Nama", "Kategori", "Satuan", "Stok", "Min", "Status"],
      rows,
    );
  }

  return (
    <>
      <div className="reports-page__toolbar">
        <div className="reports-page__search">
          <MagnifyingGlass size={16} className="reports-page__search-icon" aria-hidden="true" />
          <Input
            aria-label="Cari produk"
            placeholder="Cari nama / SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="reports-page__search-input"
          />
          {search && (
            <button
              type="button"
              className="reports-page__search-clear"
              aria-label="Bersihkan pencarian"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
        <Combobox
          className="reports-page__select"
          aria-label="Kategori"
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            setPage(1);
          }}
          placeholder="Semua kategori"
          options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
        />
        <Button variant="secondary" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="reports-page__kpis reports-page__kpis--three">
        <StatCard label="Total Produk" value={summary.data?.totalProducts ?? 0} tone="indigo" />
        <StatCard
          label="Total Unit"
          value={summary.data?.totalUnits ?? 0}
          tone="green"
          hint="seluruh gudang"
        />
        <StatCard label="Stok Kritis" value={summary.data?.lowStockCount ?? 0} tone="red" />
      </div>

      <div className="reports-page__panels">
        <Card>
          <h2 className="reports-page__section-title">Stok per Gudang</h2>
          <RankBarChart
            data={summary.data?.byWarehouse ?? []}
            xKey="warehouse"
            yKey="units"
            label="Unit"
            color={chartColors.bar}
          />
        </Card>
        <Card>
          <h2 className="reports-page__section-title">Stok per Kategori</h2>
          <RankBarChart
            data={summary.data?.byCategory ?? []}
            xKey="category"
            yKey="units"
            label="Unit"
            color={chartColors.inbound}
          />
        </Card>
      </div>

      <Card className="reports-page__table-card">
        <h2 className="reports-page__section-title">Daftar Persediaan</h2>
        <DataTable
          columns={columns}
          rows={products.data?.data ?? []}
          loading={products.isLoading}
          rowKey={(r) => r.sku}
          empty="Belum ada produk"
          mobileCard={(r) => (
            <div>
              <div className="data-table__card-head">
                <span className="data-table__card-title" title={r.name}>
                  {r.name}
                </span>
                <Badge tone={r.lowStock ? "red" : "green"}>{r.lowStock ? "Kritis" : "Aman"}</Badge>
              </div>
              <div className="data-table__card-sub">
                <span className="mono-xs">{r.sku}</span>
                <span>{r.category ?? "-"}</span>
              </div>
              <div className="data-table__card-meta">
                <span>
                  Stok{" "}
                  <span className={r.lowStock ? "reports-page__stock--low" : undefined}>
                    {r.stock} {r.unit}
                  </span>
                </span>
                <span>Min {r.minStock}</span>
              </div>
            </div>
          )}
        />
        <Pagination meta={products.data?.meta} onPage={setPage} />
      </Card>

      <Card className="reports-page__table-card">
        <h2 className="reports-page__section-title">
          Perlu Restock <span className="reports-page__count">({lowStock.data?.length ?? 0})</span>
        </h2>
        {lowStock.data?.length ? (
          <ul className="reports-page__restock">
            {lowStock.data.map((p) => {
              const suggested = Math.max(0, p.minStock * 2 - p.stock);
              return (
                <li key={p.id} className="reports-page__restock-item">
                  <span className="reports-page__restock-name" title={p.name}>
                    {p.name}
                  </span>
                  <span className="reports-page__restock-meta mono-xs">{p.sku}</span>
                  <Badge tone="red">
                    <span className="mono-num">
                      {p.stock} / min {p.minStock}
                    </span>
                  </Badge>
                  <span className="reports-page__restock-hint">usul +{suggested}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="reports-page__empty">Semua stok aman.</p>
        )}
      </Card>
    </>
  );
}

function StatusPills<T extends string>({
  items,
  tone,
}: {
  items: { status: T; count: number }[];
  tone: Record<T, "slate" | "blue" | "green" | "red">;
}) {
  if (items.length === 0) return null;
  return (
    <div className="reports-page__pills">
      {items.map((s) => (
        <Badge key={s.status} tone={tone[s.status] ?? "slate"}>
          {s.status} · {s.count}
        </Badge>
      ))}
    </div>
  );
}

function PembelianTab() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [partner, setPartner] = useState("");
  const debouncedPartner = useDebouncedValue(partner, 300);

  const summary = useQuery({
    queryKey: qk.reports.poSummary(range),
    queryFn: () => reportApi.poSummary({ from: range.from, to: range.to }),
    enabled: Boolean(range.from && range.to),
  });

  const filters = {
    from: range.from || undefined,
    to: range.to || undefined,
    status: status || undefined,
    partnerName: debouncedPartner || undefined,
    page,
    limit: 20,
  };
  const list = useQuery({
    queryKey: qk.reports.purchaseOrders(filters),
    queryFn: () => reportApi.purchaseOrders(filters),
    enabled: Boolean(range.from && range.to),
  });

  const columns: Column<ReportPoRow>[] = [
    { key: "poNumber", header: "Nomor", render: (r) => <span className="mono-xs">{r.poNumber}</span> },
    { key: "partner", header: "Supplier", render: (r) => r.partner },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={poStatusTone[r.status]}>{r.status}</Badge>,
    },
    { key: "target", header: "Target", render: (r) => formatDate(r.targetDate) },
    { key: "qty", header: "Qty", render: (r) => <span className="mono-num">{r.totalQuantity}</span> },
    {
      key: "value",
      header: "Nilai",
      className: "cell-right",
      render: (r) => (r.totalValue > 0 ? formatCurrency(r.totalValue) : "-"),
    },
  ];

  const summaryData = summary.data;
  const statusData = (summaryData?.byStatus ?? []).map((s) => ({ status: s.status, count: s.count }));
  const supplierData = (summaryData?.topSuppliers ?? []).map((s) => ({
    supplier: s.supplier,
    value: s.value,
    qty: s.qty,
  }));

  function exportCsv() {
    const rows = (list.data?.data ?? []).map((r) => [
      r.poNumber,
      r.partner,
      r.status,
      r.targetDate ?? "-",
      r.totalQuantity,
      r.totalValue,
    ]);
    downloadCsv(
      `laporan-pembelian-${todayInput()}.csv`,
      ["Nomor", "Supplier", "Status", "Target", "Qty", "Nilai"],
      rows,
    );
  }

  return (
    <>
      <div className="reports-page__toolbar">
        <DateRange value={range} onChange={setRange} />
      </div>

      <div className="reports-page__kpis reports-page__kpis--three">
        <StatCard label="Total PO" value={summaryData?.totalPos ?? 0} tone="indigo" />
        <StatCard label="Total Qty Pesan" value={summaryData?.totalOrderedQty ?? 0} tone="green" />
        <StatCard
          label="Nilai PO"
          value={formatCurrency(summaryData?.totalValue ?? 0)}
          tone="amber"
          hint="hanya item berharga"
        />
      </div>

      <StatusPills items={statusData} tone={poStatusTone} />

      <div className="reports-page__panels">
        <Card>
          <h2 className="reports-page__section-title">PO per Status</h2>
          <RankBarChart data={statusData} xKey="status" yKey="count" label="PO" color={chartColors.bar} />
        </Card>
        <Card>
          <h2 className="reports-page__section-title">Top 5 Supplier (Nilai)</h2>
          <RankBarChart
            data={supplierData}
            xKey="supplier"
            yKey="value"
            label="Nilai (Rp)"
            color={chartColors.inbound}
          />
        </Card>
      </div>

      <Card className="reports-page__table-card">
        <div className="reports-page__table-head">
          <h2 className="reports-page__section-title">Daftar Purchase Order</h2>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
        <div className="reports-page__filters">
          <Combobox
            className="reports-page__select"
            aria-label="Filter status PO"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            placeholder="Semua status"
            options={PO_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <div className="reports-page__search">
            <MagnifyingGlass size={16} className="reports-page__search-icon" aria-hidden="true" />
            <Input
              aria-label="Cari supplier"
              placeholder="Cari supplier..."
              value={partner}
              onChange={(e) => {
                setPartner(e.target.value);
                setPage(1);
              }}
              className="reports-page__search-input"
            />
            {partner && (
              <button
                type="button"
                className="reports-page__search-clear"
                aria-label="Bersihkan pencarian"
                onClick={() => {
                  setPartner("");
                  setPage(1);
                }}
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.data ?? []}
          loading={list.isLoading}
          rowKey={(r) => r.poNumber}
          empty="Belum ada PO"
          mobileCard={(r) => (
            <div>
              <div className="data-table__card-head">
                <span className="data-table__card-title mono-xs">{r.poNumber}</span>
                <Badge tone={poStatusTone[r.status]}>{r.status}</Badge>
              </div>
              <div className="data-table__card-sub">
                <span>{r.partner}</span>
              </div>
              <div className="data-table__card-meta">
                <span>Target {formatDate(r.targetDate)}</span>
                <span>{r.totalQuantity} unit</span>
                <span>{r.totalValue > 0 ? formatCurrency(r.totalValue) : "-"}</span>
              </div>
            </div>
          )}
        />
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}

function PengirimanTab() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const summary = useQuery({
    queryKey: qk.reports.dnSummary(range),
    queryFn: () => reportApi.dnSummary({ from: range.from, to: range.to }),
    enabled: Boolean(range.from && range.to),
  });

  const filters = {
    from: range.from || undefined,
    to: range.to || undefined,
    status: status || undefined,
    page,
    limit: 20,
  };
  const list = useQuery({
    queryKey: qk.reports.deliveryNotes(filters),
    queryFn: () => reportApi.deliveryNotes(filters),
    enabled: Boolean(range.from && range.to),
  });

  const columns: Column<ReportDnRow>[] = [
    { key: "dnNumber", header: "Nomor", render: (r) => <span className="mono-xs">{r.dnNumber}</span> },
    { key: "shipDate", header: "Tanggal", render: (r) => formatDate(r.shipDate) },
    { key: "partner", header: "Tujuan", render: (r) => r.partner },
    { key: "warehouse", header: "Gudang", render: (r) => r.warehouse },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={dnStatusTone[r.status]}>{r.status}</Badge>,
    },
    {
      key: "qty",
      header: "Qty",
      className: "cell-right",
      render: (r) => <span className="mono-num">{r.totalQuantity}</span>,
    },
  ];

  const summaryData = summary.data;
  const statusData = (summaryData?.byStatus ?? []).map((s) => ({ status: s.status, count: s.count }));
  const customerData = (summaryData?.topCustomers ?? []).map((c) => ({ customer: c.customer, qty: c.qty }));
  const productData = (summaryData?.topProducts ?? []).map((p) => ({ product: p.product, qty: p.qty }));
  const warehouseData = (summaryData?.byWarehouse ?? []).map((w) => ({ warehouse: w.warehouse, qty: w.qty }));

  function exportCsv() {
    const rows = (list.data?.data ?? []).map((r) => [
      r.dnNumber,
      r.shipDate,
      r.partner,
      r.warehouse,
      r.status,
      r.totalQuantity,
    ]);
    downloadCsv(
      `laporan-pengiriman-${todayInput()}.csv`,
      ["Nomor", "Tanggal", "Tujuan", "Gudang", "Status", "Qty"],
      rows,
    );
  }

  return (
    <>
      <div className="reports-page__toolbar">
        <DateRange value={range} onChange={setRange} />
      </div>

      <div className="reports-page__kpis reports-page__kpis--three">
        <StatCard label="Total Surat Jalan" value={summaryData?.totalDns ?? 0} tone="indigo" />
        <StatCard label="Total Qty Kirim" value={summaryData?.totalQty ?? 0} tone="green" />
      </div>

      <StatusPills items={statusData} tone={dnStatusTone} />

      <div className="reports-page__panels">
        <Card>
          <h2 className="reports-page__section-title">DN per Status</h2>
          <RankBarChart data={statusData} xKey="status" yKey="count" label="DN" color={chartColors.bar} />
        </Card>
        <Card>
          <h2 className="reports-page__section-title">Top 5 Tujuan</h2>
          <RankBarChart
            data={customerData}
            xKey="customer"
            yKey="qty"
            label="Qty"
            color={chartColors.outbound}
          />
        </Card>
        <Card>
          <h2 className="reports-page__section-title">Top 5 Produk</h2>
          <RankBarChart
            data={productData}
            xKey="product"
            yKey="qty"
            label="Qty"
            color={chartColors.inbound}
          />
        </Card>
        <Card>
          <h2 className="reports-page__section-title">Pengiriman per Gudang</h2>
          <RankBarChart
            data={warehouseData}
            xKey="warehouse"
            yKey="qty"
            label="Qty"
            color={chartColors.adjustment}
          />
        </Card>
      </div>

      <Card className="reports-page__table-card">
        <div className="reports-page__table-head">
          <h2 className="reports-page__section-title">Daftar Surat Jalan</h2>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
        <div className="reports-page__filters">
          <Combobox
            className="reports-page__select"
            aria-label="Filter status DN"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            placeholder="Semua status"
            options={DN_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.data ?? []}
          loading={list.isLoading}
          rowKey={(r) => r.dnNumber}
          empty="Belum ada surat jalan"
          mobileCard={(r) => (
            <div>
              <div className="data-table__card-head">
                <span className="data-table__card-title mono-xs">{r.dnNumber}</span>
                <Badge tone={dnStatusTone[r.status]}>{r.status}</Badge>
              </div>
              <div className="data-table__card-sub">
                <span>{r.partner}</span>
                <span>{r.warehouse}</span>
              </div>
              <div className="data-table__card-meta">
                <span>{formatDate(r.shipDate)}</span>
                <span>{r.totalQuantity} unit</span>
              </div>
            </div>
          )}
        />
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}

function MutasiTab() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [product, setProduct] = useState("");
  const [partner, setPartner] = useState("");
  const debouncedProduct = useDebouncedValue(product, 300);
  const debouncedPartner = useDebouncedValue(partner, 300);

  const [cardInput, setCardInput] = useState("");
  const debouncedCard = useDebouncedValue(cardInput, 400);

  const warehouses = useQuery({
    queryKey: qk.warehouses.list({}),
    queryFn: () => warehouseApi.list(),
  });

  const card = useQuery({
    queryKey: qk.reports.stockCard({ name: debouncedCard, ...range }),
    queryFn: () =>
      reportApi.stockCard({ productName: debouncedCard, from: range.from, to: range.to }),
    enabled: debouncedCard.trim().length >= 2,
  });

  const filters = {
    from: range.from || undefined,
    to: range.to || undefined,
    type: type || undefined,
    warehouseCode: warehouse || undefined,
    productName: debouncedProduct || undefined,
    partnerName: debouncedPartner || undefined,
    page,
    limit: 20,
  };
  const list = useQuery({
    queryKey: qk.reports.transactions(filters),
    queryFn: () => reportApi.transactions(filters),
    enabled: Boolean(range.from && range.to),
  });

  const columns: Column<ReportTransactionRow>[] = [
    { key: "date", header: "Waktu", render: (r) => <span className="mono-xs">{r.date}</span> },
    {
      key: "type",
      header: "Tipe",
      render: (r) => <Badge tone={txTone[r.type]}>{txLabel[r.type]}</Badge>,
    },
    {
      key: "product",
      header: "Produk",
      render: (r) => (
        <span title={r.product}>
          {r.sku} · {r.product}
        </span>
      ),
    },
    { key: "qty", header: "Qty", render: (r) => <span className="mono-num">{r.quantity} {r.unit}</span> },
    { key: "warehouse", header: "Gudang", render: (r) => r.warehouse },
    { key: "partner", header: "Partner", render: (r) => r.partner ?? "-" },
    {
      key: "ref",
      header: "Ref",
      render: (r) => <span className="mono-xs">{r.poNumber ?? r.dnNumber ?? "-"}</span>,
    },
    { key: "by", header: "Oleh", render: (r) => r.createdBy },
  ];

  function exportCsv() {
    const rows = (list.data?.data ?? []).map((r) => [
      r.date,
      txLabel[r.type],
      r.sku,
      r.product,
      r.quantity,
      r.unit,
      r.warehouse,
      r.partner ?? "-",
      r.poNumber ?? r.dnNumber ?? "-",
      r.createdBy,
    ]);
    downloadCsv(
      `laporan-mutasi-${todayInput()}.csv`,
      ["Waktu", "Tipe", "SKU", "Produk", "Qty", "Satuan", "Gudang", "Partner", "Ref", "Oleh"],
      rows,
    );
  }

  const cardData = card.data;
  const cardSeries = (cardData?.movements ?? []).map((m) => ({ date: m.date, balance: m.balance }));

  return (
    <>
      <div className="reports-page__toolbar">
        <DateRange value={range} onChange={setRange} />
      </div>

      <Card className="reports-page__table-card">
        <h2 className="reports-page__section-title">Kartu Stok</h2>
        <div className="reports-page__filters">
          <div className="reports-page__search">
            <MagnifyingGlass size={16} className="reports-page__search-icon" aria-hidden="true" />
            <Input
              aria-label="Cari produk untuk kartu stok"
              placeholder="Cari nama / SKU produk..."
              value={cardInput}
              onChange={(e) => setCardInput(e.target.value)}
              className="reports-page__search-input"
            />
            {cardInput && (
              <button
                type="button"
                className="reports-page__search-clear"
                aria-label="Bersihkan"
                onClick={() => setCardInput("")}
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {!debouncedCard.trim() ? (
          <p className="reports-page__empty">Ketik nama/SKU produk untuk melihat kartu stok.</p>
        ) : cardData?.status === "ambiguous" ? (
          <p className="reports-page__empty">
            Produk ambigu — pilih salah satu: {cardData.candidates.map((c) => c.name).join(", ")}
          </p>
        ) : cardData?.status === "none" ? (
          <p className="reports-page__empty">
            Produk tidak ditemukan
            {cardData.suggestions.length
              ? ` — mungkin: ${cardData.suggestions.map((s) => s.name).join(", ")}`
              : ""}
            .
          </p>
        ) : cardData ? (
          <>
            <div className="reports-page__kpis reports-page__kpis--three">
              <StatCard
                label="Saldo Awal"
                value={cardData.opening}
                tone="indigo"
                hint={cardData.product?.name ?? ""}
              />
              <StatCard
                label="Saldo Akhir"
                value={cardData.closing}
                tone="green"
                hint={cardData.product?.unit ?? ""}
              />
              <StatCard label="Mutasi" value={cardData.movements.length} tone="amber" hint="transaksi" />
            </div>
            <TrendAreaChart
              data={cardSeries}
              xKey="date"
              series={[{ key: "balance", label: "Saldo", color: chartColors.bar }]}
            />
          </>
        ) : null}
      </Card>

      <Card className="reports-page__table-card">
        <div className="reports-page__table-head">
          <h2 className="reports-page__section-title">Log Mutasi</h2>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
        <div className="reports-page__filters">
          <Combobox
            className="reports-page__select"
            aria-label="Tipe transaksi"
            value={type}
            onChange={(v) => {
              setType(v);
              setPage(1);
            }}
            placeholder="Semua tipe"
            options={TX_TYPES.map((t) => ({ value: t, label: txLabel[t] }))}
          />
          <Combobox
            className="reports-page__select"
            aria-label="Gudang"
            value={warehouse}
            onChange={(v) => {
              setWarehouse(v);
              setPage(1);
            }}
            placeholder="Semua gudang"
            options={(warehouses.data ?? []).map((w) => ({ value: w.code, label: w.name }))}
          />
          <div className="reports-page__search">
            <MagnifyingGlass size={16} className="reports-page__search-icon" aria-hidden="true" />
            <Input
              aria-label="Cari produk"
              placeholder="Cari produk..."
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                setPage(1);
              }}
              className="reports-page__search-input"
            />
            {product && (
              <button
                type="button"
                className="reports-page__search-clear"
                aria-label="Bersihkan pencarian produk"
                onClick={() => {
                  setProduct("");
                  setPage(1);
                }}
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
          <div className="reports-page__search">
            <MagnifyingGlass size={16} className="reports-page__search-icon" aria-hidden="true" />
            <Input
              aria-label="Cari partner"
              placeholder="Cari partner..."
              value={partner}
              onChange={(e) => {
                setPartner(e.target.value);
                setPage(1);
              }}
              className="reports-page__search-input"
            />
            {partner && (
              <button
                type="button"
                className="reports-page__search-clear"
                aria-label="Bersihkan pencarian partner"
                onClick={() => {
                  setPartner("");
                  setPage(1);
                }}
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.data ?? []}
          loading={list.isLoading}
          rowKey={(r) => `${r.date}-${r.sku}-${r.warehouse}-${r.quantity}`}
          empty="Belum ada mutasi"
          mobileCard={(r) => (
            <div>
              <div className="data-table__card-head">
                <span className="data-table__card-title">{r.product}</span>
                <Badge tone={txTone[r.type]}>{txLabel[r.type]}</Badge>
              </div>
              <div className="data-table__card-sub">
                <span className="mono-xs">{r.sku}</span>
                <span>{r.warehouse}</span>
              </div>
              <div className="data-table__card-meta">
                <span>{r.date}</span>
                <span>
                  {r.quantity} {r.unit}
                </span>
                <span>{r.createdBy}</span>
              </div>
            </div>
          )}
        />
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}

function AnalitikTab() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [deadDays, setDeadDays] = useState("30");
  const days = Math.max(1, Number(deadDays) || 30);

  const analysis = useQuery({
    queryKey: qk.reports.movementAnalysis({ ...range, deadDays: days }),
    queryFn: () =>
      reportApi.movementAnalysis({ from: range.from, to: range.to, deadDays: days, top: 10 }),
    enabled: Boolean(range.from && range.to),
  });
  const activity = useQuery({
    queryKey: qk.reports.userActivity(range),
    queryFn: () => reportApi.userActivity({ from: range.from, to: range.to }),
    enabled: Boolean(range.from && range.to),
  });

  const data = analysis.data;
  const totalOut = (data?.abc ?? []).reduce((sum, a) => sum + a.qty, 0);
  const abcByClass = ["A", "B", "C"].map((cls) => ({
    kelas: cls,
    qty: (data?.abc ?? [])
      .filter((a) => a.class === cls)
      .reduce((sum, a) => sum + a.qty, 0),
  }));
  const moverData = (data?.topMovers ?? []).map((m) => ({ product: m.product, qty: m.qty }));

  const deadColumns: Column<MovementAnalysis["deadStock"][number]>[] = [
    { key: "sku", header: "SKU", render: (r) => <span className="mono-xs">{r.sku}</span> },
    { key: "product", header: "Produk", render: (r) => r.product },
    { key: "stock", header: "Stok", render: (r) => <span className="mono-num">{r.stock} {r.unit}</span> },
    { key: "last", header: "Terakhir Keluar", render: (r) => r.lastOutDate ?? "-" },
    { key: "days", header: "Hari", render: (r) => r.daysSinceOut ?? "-" },
  ];

  const abcColumns: Column<MovementAnalysis["abc"][number]>[] = [
    { key: "sku", header: "SKU", render: (r) => <span className="mono-xs">{r.sku}</span> },
    { key: "product", header: "Produk", render: (r) => r.product },
    { key: "qty", header: "Qty Keluar", render: (r) => <span className="mono-num">{r.qty}</span> },
    { key: "share", header: "Porsi", render: (r) => `${(r.share * 100).toFixed(1)}%` },
    {
      key: "class",
      header: "Kelas",
      render: (r) => (
        <Badge tone={r.class === "A" ? "green" : r.class === "B" ? "blue" : "slate"}>
          {r.class}
        </Badge>
      ),
    },
  ];

  const userColumns: Column<UserActivity["users"][number]>[] = [
    { key: "user", header: "Pengguna", render: (r) => r.user },
    { key: "role", header: "Peran", render: (r) => roleLabel[r.role] ?? r.role },
    {
      key: "in",
      header: "Masuk (trx/qty)",
      render: (r) => <span className="mono-num">{r.inCount} / {r.inQty}</span>,
    },
    {
      key: "out",
      header: "Keluar (trx/qty)",
      render: (r) => <span className="mono-num">{r.outCount} / {r.outQty}</span>,
    },
    { key: "adj", header: "Koreksi", render: (r) => r.adjustmentCount },
    { key: "total", header: "Total", render: (r) => <span className="mono-num">{r.total}</span> },
  ];

  function exportDead() {
    const rows = (data?.deadStock ?? []).map((r) => [
      r.sku,
      r.product,
      r.stock,
      r.unit,
      r.lastOutDate ?? "-",
      r.daysSinceOut ?? "-",
    ]);
    downloadCsv(
      `laporan-dead-stock-${todayInput()}.csv`,
      ["SKU", "Produk", "Stok", "Satuan", "Terakhir Keluar", "Hari"],
      rows,
    );
  }

  function exportUsers() {
    const rows = (activity.data?.users ?? []).map((r) => [
      r.user,
      roleLabel[r.role] ?? r.role,
      r.inCount,
      r.inQty,
      r.outCount,
      r.outQty,
      r.adjustmentCount,
      r.total,
    ]);
    downloadCsv(
      `laporan-aktivitas-user-${todayInput()}.csv`,
      ["Pengguna", "Peran", "Masuk trx", "Masuk qty", "Keluar trx", "Keluar qty", "Koreksi", "Total"],
      rows,
    );
  }

  return (
    <>
      <div className="reports-page__toolbar">
        <DateRange value={range} onChange={setRange} />
        <label className="reports-page__inline-field">
          <span>Dead stock (hari)</span>
          <Input
            type="number"
            min={1}
            max={3650}
            value={deadDays}
            onChange={(e) => setDeadDays(e.target.value)}
            aria-label="Ambang dead stock dalam hari"
            className="reports-page__number"
          />
        </label>
      </div>

      <div className="reports-page__kpis reports-page__kpis--three">
        <StatCard label="Total Qty Keluar" value={totalOut} tone="red" />
        <StatCard
          label="Dead Stock"
          value={data?.deadStock.length ?? 0}
          tone="amber"
          hint={`tanpa keluar ${days} hari`}
        />
        <StatCard label="Pengguna Aktif" value={activity.data?.users.length ?? 0} tone="indigo" />
      </div>

      <div className="reports-page__panels">
        <Card>
          <h2 className="reports-page__section-title">Top 10 Produk Keluar</h2>
          <RankBarChart
            data={moverData}
            xKey="product"
            yKey="qty"
            label="Qty"
            color={chartColors.outbound}
          />
        </Card>
        <Card>
          <h2 className="reports-page__section-title">Distribusi ABC</h2>
          <RankBarChart data={abcByClass} xKey="kelas" yKey="qty" label="Qty" color={chartColors.bar} />
        </Card>
      </div>

      <Card className="reports-page__table-card">
        <div className="reports-page__table-head">
          <h2 className="reports-page__section-title">Dead Stock</h2>
          <Button variant="secondary" onClick={exportDead}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={deadColumns}
          rows={data?.deadStock ?? []}
          loading={analysis.isLoading}
          rowKey={(r) => r.sku}
          empty="Tidak ada dead stock"
        />
      </Card>

      <Card className="reports-page__table-card">
        <h2 className="reports-page__section-title">Analisis ABC (Top 20)</h2>
        <DataTable
          columns={abcColumns}
          rows={(data?.abc ?? []).slice(0, 20)}
          loading={analysis.isLoading}
          rowKey={(r) => r.sku}
          empty="Belum ada data"
        />
      </Card>

      <Card className="reports-page__table-card">
        <div className="reports-page__table-head">
          <h2 className="reports-page__section-title">Aktivitas per Pengguna</h2>
          <Button variant="secondary" onClick={exportUsers}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={userColumns}
          rows={activity.data?.users ?? []}
          loading={activity.isLoading}
          rowKey={(r) => r.user}
          empty="Belum ada aktivitas"
        />
      </Card>
    </>
  );
}
