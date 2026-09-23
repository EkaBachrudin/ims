import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { partnerApi, poApi, productApi, transactionApi, warehouseApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Textarea } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import type { StockTransaction } from "@/types";
import "./TransactionTypePage.css";

const config: Record<"IN" | "OUT", { title: string; description: string; button: string }> = {
  IN: { title: "Barang Masuk", description: "Catat penerimaan barang", button: "+ Catat Barang Masuk" },
  OUT: { title: "Barang Keluar", description: "Catat pengeluaran barang", button: "+ Catat Barang Keluar" },
};

interface FormState {
  productId: string;
  warehouseId: string;
  quantity: string;
  partnerId: string;
  purchaseOrderId: string;
  referenceNo: string;
  notes: string;
}
const emptyForm: FormState = {
  productId: "",
  warehouseId: "",
  quantity: "1",
  partnerId: "",
  purchaseOrderId: "",
  referenceNo: "",
  notes: "",
};

export function TransactionTypePage({ type }: { type: "IN" | "OUT" }) {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const poParam = searchParams.get("po");
  const prefilledRef = useRef(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [voiding, setVoiding] = useState<StockTransaction | null>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");

  const filters = { page, limit: 20, type };
  const { data, isLoading } = useQuery({
    queryKey: qk.transactions.list(filters),
    queryFn: () => transactionApi.list(filters),
  });
  const products = useQuery({ queryKey: qk.products.list({ all: true }), queryFn: () => productApi.list({ limit: 100 }) });
  const warehouses = useQuery({ queryKey: qk.warehouses.list(), queryFn: () => warehouseApi.list() });
  const partners = useQuery({ queryKey: qk.partners.list({ all: true }), queryFn: () => partnerApi.list({ limit: 100 }) });
  const pos = useQuery({
    queryKey: qk.purchaseOrders.list({ receipt: true }),
    queryFn: () => poApi.list({ status: "CONFIRMED", limit: 100 }),
    enabled: type === "IN",
  });
  const poDetail = useQuery({
    queryKey: qk.purchaseOrders.detail(form.purchaseOrderId),
    queryFn: () => poApi.get(form.purchaseOrderId),
    enabled: type === "IN" && Boolean(form.purchaseOrderId),
  });

  const poRemainingItems =
    type === "IN" && poDetail.data
      ? poDetail.data.items.filter((i) => (i.remainingQuantity ?? i.quantity) > 0)
      : [];
  const selectedProductOptions =
    type === "IN" && form.purchaseOrderId ? poRemainingItems.map((i) => i.product) : products.data?.data ?? [];
  const selectedRemaining = poRemainingItems.find((i) => i.productId === form.productId);

  useEffect(() => {
    if (type !== "IN" || !poDetail.data) return;
    const remaining = poDetail.data.items.filter((i) => (i.remainingQuantity ?? i.quantity) > 0);
    const poWarehouseId = poDetail.data.warehouse?.id ?? "";
    setForm((f) => {
      const next = { ...f };
      if (!next.warehouseId && poWarehouseId) next.warehouseId = poWarehouseId;
      if (remaining.length > 0 && !remaining.some((i) => i.productId === next.productId)) {
        next.productId = remaining[0].productId;
        next.quantity = String(remaining[0].remainingQuantity ?? remaining[0].quantity);
      }
      return next;
    });
  }, [poDetail.data, type]);

  useEffect(() => {
    if (type !== "IN" || !poParam || prefilledRef.current) return;
    prefilledRef.current = true;
    setForm((f) => ({ ...f, purchaseOrderId: poParam }));
    setOpen(true);
  }, [type, poParam]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: qk.transactions.all });
    qc.invalidateQueries({ queryKey: qk.products.all });
    qc.invalidateQueries({ queryKey: qk.dashboard });
    qc.invalidateQueries({ queryKey: qk.reports.lowStock });
  }

  const recordMut = useMutation({
    mutationFn: (body: unknown) => (type === "IN" ? transactionApi.inbound(body) : transactionApi.outbound(body)),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const voidMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => transactionApi.void(id, reason),
    onSuccess: () => {
      invalidate();
      setVoiding(null);
      setReason("");
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function openForm() {
    setForm({
      ...emptyForm,
      productId: products.data?.data[0]?.id ?? "",
      warehouseId: warehouses.data?.[0]?.id ?? "",
    });
    setError("");
    setOpen(true);
  }
  function closeForm() {
    setOpen(false);
    setError("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.productId) {
      setError("Pilih produk terlebih dahulu.");
      return;
    }
    if (!form.warehouseId) {
      setError("Pilih gudang terlebih dahulu.");
      return;
    }
    recordMut.mutate({
      productId: form.productId,
      warehouseId: form.warehouseId,
      quantity: Number(form.quantity),
      partnerId: form.partnerId || null,
      purchaseOrderId: type === "IN" ? form.purchaseOrderId || null : null,
      referenceNo: form.referenceNo || null,
      notes: form.notes || null,
    });
  }

  function renderActions(r: StockTransaction) {
    return r.type === "ADJUSTMENT" ? (
      <span className="txn-page__void-note">koreksi</span>
    ) : (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setError("");
          setVoiding(r);
        }}
      >
        Void
      </Button>
    );
  }

  const isVoid = (r: StockTransaction) => (r.notes ?? "").startsWith("VOID:");

  const columns: Column<StockTransaction>[] = [
    { key: "time", header: "Waktu", render: (r) => formatDateTime(r.createdAt) },
    { key: "product", header: "Produk", render: (r) => `${r.product.name} (${r.product.sku})` },
    {
      key: "qty",
      header: "Qty",
      render: (r) => (
        <span className={type === "IN" ? "txn-page__qty--in" : "txn-page__qty--out"}>
          {type === "IN" ? "+" : "−"}
          {r.quantity} {r.product.unit}
        </span>
      ),
    },
    { key: "warehouse", header: "Gudang", render: (r) => r.warehouse.name },
    { key: "partner", header: "Partner", render: (r) => r.partner?.name ?? "-" },
    {
      key: "ref",
      header: "Referensi",
      render: (r) => r.purchaseOrder?.poNumber ?? r.deliveryNote?.dnNumber ?? r.referenceNo ?? "-",
    },
    { key: "by", header: "Dicatat oleh", render: (r) => r.createdBy.name },
    {
      key: "notes",
      header: "Catatan",
      render: (r) => (isVoid(r) ? <Badge tone="yellow">void</Badge> : (r.notes ?? "-")),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "cell-right",
            render: (r: StockTransaction) => renderActions(r),
          },
        ]
      : []),
  ];

  return (
    <div className="txn-page">
      <PageHeader
        title={config[type].title}
        description={config[type].description}
        actions={canManage && <Button onClick={openForm}>{config[type].button}</Button>}
      />

      <ErrorText>{error && !open ? error : ""}</ErrorText>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        mobileCard={(r) => (
          <div>
            <div className="data-table__card-head">
              <span className="data-table__card-title" title={r.product.name}>
                {r.product.name}
              </span>
              <span
                className={[
                  "txn-page__card-qty",
                  type === "IN" ? "txn-page__card-qty--in" : "txn-page__card-qty--out",
                ].join(" ")}
              >
                {type === "IN" ? "+" : "−"}
                {r.quantity} {r.product.unit}
              </span>
            </div>
            <div className="data-table__card-sub">
              <span className="mono-xs">{r.product.sku}</span>
              {isVoid(r) && <Badge tone="yellow">void</Badge>}
            </div>
            <div className="data-table__card-meta">
              <span>{r.warehouse.name}</span>
              <span>{r.partner?.name ?? "-"}</span>
            </div>
            {!isVoid(r) && r.notes && <p className="txn-page__card-note">{r.notes}</p>}
            <div className="txn-page__card-footer">
              <span>
                {formatDateTime(r.createdAt)} · {r.createdBy.name}
              </span>
              {canManage && renderActions(r)}
            </div>
          </div>
        )}
      />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal
        open={open}
        title={config[type].title}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button form="txn-form" type="submit" loading={recordMut.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="txn-form" onSubmit={submit} className="form">
          <ErrorText>{error}</ErrorText>
          {type === "IN" && (
            <Field label="PO Sumber (opsional)" hint="Penerimaan barang dari supplier">
              <Combobox
                value={form.purchaseOrderId}
                onChange={(v) => setForm({ ...form, purchaseOrderId: v, productId: "", quantity: "1" })}
                placeholder="Tanpa PO"
                searchable
                aria-label="PO Sumber"
                options={(pos.data?.data ?? []).map((p) => ({
                  value: p.id,
                  label: `${p.poNumber} - ${p.partner.name}`,
                }))}
              />
            </Field>
          )}
          <Field label="Produk" required>
            <Combobox
              value={form.productId}
              onChange={(v) => {
                const line = poRemainingItems.find((i) => i.productId === v);
                setForm({
                  ...form,
                  productId: v,
                  quantity: line ? String(line.remainingQuantity ?? line.quantity) : form.quantity,
                });
              }}
              placeholder="Pilih produk"
              searchable
              aria-label="Produk"
              options={selectedProductOptions.map((p) => ({
                value: p.id,
                label: `${p.name}${"stock" in p ? ` (stok ${p.stock} ${p.unit})` : ` (${p.sku})`}`,
              }))}
            />
          </Field>
          {type === "IN" && form.purchaseOrderId && (
            <p className="txn-page__po-hint">
              {poDetail.isLoading
                ? "Memuat sisa pesanan…"
                : poRemainingItems.length === 0
                  ? "Semua item PO sudah diterima."
                  : selectedRemaining
                    ? `Sisa pesanan: ${selectedRemaining.remainingQuantity} ${selectedRemaining.product.unit}`
                    : "Pilih produk sesuai item PO."}
            </p>
          )}
          <Field label="Gudang" required>
            <Combobox
              value={form.warehouseId}
              onChange={(v) => setForm({ ...form, warehouseId: v })}
              placeholder="Pilih gudang"
              aria-label="Gudang"
              options={(warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
            />
          </Field>
          <Field label="Jumlah" required>
            <Input
              type="number"
              min={1}
              max={selectedRemaining ? selectedRemaining.remainingQuantity : undefined}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </Field>
          <Field label={type === "IN" ? "Supplier (opsional)" : "Customer (opsional)"}>
            <Combobox
              value={form.partnerId}
              onChange={(v) => setForm({ ...form, partnerId: v })}
              placeholder="-"
              searchable
              aria-label={type === "IN" ? "Supplier" : "Customer"}
              options={(partners.data?.data ?? [])
                .filter((p) => (type === "IN" ? p.type === "SUPPLIER" : p.type === "CUSTOMER"))
                .map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
          <Field label="No. Referensi">
            <Input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} />
          </Field>
          <Field label="Catatan">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(voiding)}
        title="Batalkan Transaksi (Void)"
        onClose={() => setVoiding(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoiding(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              loading={voidMut.isPending}
              onClick={() => voiding && voidMut.mutate({ id: voiding.id, reason })}
              disabled={!reason.trim()}
            >
              Void Transaksi
            </Button>
          </>
        }
      >
        <div className="txn-page__void">
          <ErrorText>{error}</ErrorText>
          <p className="txn-page__void-text">
            Stok akan dikoreksi otomatis (soft reversal) dan tercatat pada audit log.
          </p>
          <Field label="Alasan" required>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
