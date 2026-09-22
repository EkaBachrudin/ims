import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { partnerApi, productApi, transactionApi, warehouseApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import type { StockTransaction } from "@/types";

const config: Record<"IN" | "OUT", { title: string; description: string; button: string }> = {
  IN: { title: "Barang Masuk", description: "Catat penerimaan barang", button: "+ Catat Barang Masuk" },
  OUT: { title: "Barang Keluar", description: "Catat pengeluaran barang", button: "+ Catat Barang Keluar" },
};

interface FormState {
  productId: string;
  warehouseId: string;
  quantity: string;
  partnerId: string;
  referenceNo: string;
  notes: string;
}
const emptyForm: FormState = {
  productId: "",
  warehouseId: "",
  quantity: "1",
  partnerId: "",
  referenceNo: "",
  notes: "",
};

export function TransactionTypePage({ type }: { type: "IN" | "OUT" }) {
  const canManage = useCanManage();
  const qc = useQueryClient();
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
    recordMut.mutate({
      productId: form.productId,
      warehouseId: form.warehouseId,
      quantity: Number(form.quantity),
      partnerId: form.partnerId || null,
      referenceNo: form.referenceNo || null,
      notes: form.notes || null,
    });
  }

  const columns: Column<StockTransaction>[] = [
    { key: "time", header: "Waktu", render: (r) => formatDateTime(r.createdAt) },
    { key: "product", header: "Produk", render: (r) => `${r.product.name} (${r.product.sku})` },
    {
      key: "qty",
      header: "Qty",
      render: (r) => (
        <span className={type === "IN" ? "font-medium text-success" : "font-medium text-danger"}>
          {type === "IN" ? "+" : "−"}
          {r.quantity} {r.product.unit}
        </span>
      ),
    },
    { key: "warehouse", header: "Gudang", render: (r) => r.warehouse.name },
    { key: "partner", header: "Partner", render: (r) => r.partner?.name ?? "-" },
    { key: "by", header: "Dicatat oleh", render: (r) => r.createdBy.name },
    {
      key: "notes",
      header: "Catatan",
      render: (r) =>
        (r.notes ?? "").startsWith("VOID:") ? <Badge tone="yellow">void</Badge> : (r.notes ?? "-"),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (r: StockTransaction) =>
              r.type === "ADJUSTMENT" ? (
                <span className="text-xs text-muted-foreground">koreksi</span>
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
              ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={config[type].title}
        description={config[type].description}
        actions={canManage && <Button onClick={openForm}>{config[type].button}</Button>}
      />

      <ErrorText>{error && !open ? error : ""}</ErrorText>

      <DataTable columns={columns} rows={data?.data ?? []} loading={isLoading} rowKey={(r) => r.id} />
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
        <form id="txn-form" onSubmit={submit} className="space-y-3">
          <ErrorText>{error}</ErrorText>
          <Field label="Produk" required>
            <Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
              <option value="">Pilih produk</option>
              {products.data?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (stok {p.stock} {p.unit})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gudang" required>
            <Select
              value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              required
            >
              <option value="">Pilih gudang</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jumlah" required>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </Field>
          <Field label={type === "IN" ? "Supplier (opsional)" : "Customer (opsional)"}>
            <Select value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
              <option value="">-</option>
              {partners.data?.data
                .filter((p) => (type === "IN" ? p.type === "SUPPLIER" : p.type === "CUSTOMER"))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
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
        <div className="space-y-3">
          <ErrorText>{error}</ErrorText>
          <p className="text-sm text-muted-foreground">
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
