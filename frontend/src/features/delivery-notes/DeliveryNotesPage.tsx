import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "@phosphor-icons/react";
import { dnApi, partnerApi, productApi, warehouseApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import { dnStatusTone, formatDate, todayInput } from "@/lib/format";
import type { DeliveryNote, DnStatus } from "@/types";
import "./DeliveryNotesPage.css";

interface ItemRow {
  productId: string;
  quantity: string;
}

export function DeliveryNotesPage() {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [shipDate, setShipDate] = useState(todayInput());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ productId: "", quantity: "1" }]);

  const filters = { page, limit: 20, status: status || undefined };
  const { data, isLoading } = useQuery({ queryKey: qk.deliveryNotes.list(filters), queryFn: () => dnApi.list(filters) });
  const partners = useQuery({ queryKey: qk.partners.list({ all: true }), queryFn: () => partnerApi.list({ limit: 100 }) });
  const products = useQuery({ queryKey: qk.products.list({ all: true }), queryFn: () => productApi.list({ limit: 100 }) });
  const warehouses = useQuery({ queryKey: qk.warehouses.list(), queryFn: () => warehouseApi.list() });

  const customers = (partners.data?.data ?? []).filter((p) => p.type === "CUSTOMER");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.deliveryNotes.all });
    qc.invalidateQueries({ queryKey: qk.products.all });
    qc.invalidateQueries({ queryKey: qk.transactions.all });
    qc.invalidateQueries({ queryKey: qk.dashboard });
  };

  const createMut = useMutation({
    mutationFn: (body: unknown) => dnApi.create(body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DnStatus }) => dnApi.updateStatus(id, status),
    onSuccess: () => invalidate(),
    onError: (e) => setError(errorMessage(e)),
  });

  function openForm() {
    setPartnerId(customers[0]?.id ?? "");
    setWarehouseId(warehouses.data?.[0]?.id ?? "");
    setShipDate(todayInput());
    setNotes("");
    setItems([{ productId: products.data?.data[0]?.id ?? "", quantity: "1" }]);
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
    if (!partnerId) {
      setError("Pilih customer terlebih dahulu.");
      return;
    }
    if (!warehouseId) {
      setError("Pilih gudang terlebih dahulu.");
      return;
    }
    const payloadItems = items
      .filter((i) => i.productId && Number(i.quantity) > 0)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }));
    if (payloadItems.length === 0) {
      setError("Tambahkan minimal satu item.");
      return;
    }
    createMut.mutate({ partnerId, warehouseId, shipDate, notes: notes || null, items: payloadItems });
  }

  function renderActions(d: DeliveryNote) {
    return (
      <div className="row-actions">
        {d.status === "DRAFT" && (
          <Button size="sm" onClick={() => statusMut.mutate({ id: d.id, status: "SHIPPED" })}>
            Kirim
          </Button>
        )}
        {d.status === "SHIPPED" && (
          <Button
            size="sm"
            variant="success"
            onClick={() => statusMut.mutate({ id: d.id, status: "DELIVERED" })}
          >
            Terkirim
          </Button>
        )}
        {(d.status === "DRAFT" || d.status === "SHIPPED") && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => statusMut.mutate({ id: d.id, status: "CANCELLED" })}
          >
            Batal
          </Button>
        )}
      </div>
    );
  }

  const columns: Column<DeliveryNote>[] = [
    { key: "dnNumber", header: "No. Surat Jalan", render: (d) => d.dnNumber },
    { key: "status", header: "Status", render: (d) => <Badge tone={dnStatusTone[d.status]}>{d.status}</Badge> },
    { key: "partner", header: "Customer", render: (d) => d.partner.name },
    { key: "warehouse", header: "Gudang", render: (d) => d.warehouse.name },
    { key: "shipDate", header: "Tgl Kirim", render: (d) => formatDate(d.shipDate) },
    { key: "items", header: "Item", render: (d) => d.items.length },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "cell-right",
            render: (d: DeliveryNote) => renderActions(d),
          },
        ]
      : []),
  ];

  return (
    <div className="delivery-page">
      <PageHeader
        title="Surat Jalan"
        description="Pengiriman barang ke customer"
        actions={canManage && <Button onClick={openForm}>+ Buat Surat Jalan</Button>}
      />

      <div className="delivery-page__filter">
        <Combobox
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          placeholder="Semua status"
          options={[
            { value: "DRAFT", label: "DRAFT" },
            { value: "SHIPPED", label: "SHIPPED" },
            { value: "DELIVERED", label: "DELIVERED" },
            { value: "CANCELLED", label: "CANCELLED" },
          ]}
        />
      </div>

      <ErrorText>{error && !open ? error : ""}</ErrorText>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        rowKey={(d) => d.id}
        mobileCard={(d) => (
          <div>
            <div className="data-table__card-head">
              <span className="data-table__card-title" title={d.dnNumber}>
                {d.dnNumber}
              </span>
              <Badge tone={dnStatusTone[d.status]}>{d.status}</Badge>
            </div>
            <div className="data-table__card-sub">
              <span>{d.partner.name}</span>
              <span>{d.items.length} item</span>
            </div>
            <div className="data-table__card-meta">
              <span>{d.warehouse.name}</span>
            </div>
            <div className="delivery-page__card-footer">
              <span>Tgl Kirim {formatDate(d.shipDate)}</span>
              {canManage && (d.status === "DRAFT" || d.status === "SHIPPED") && renderActions(d)}
            </div>
          </div>
        )}
      />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal
        open={open}
        title="Buat Surat Jalan"
        onClose={closeForm}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button form="dn-form" type="submit" loading={createMut.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="dn-form" onSubmit={submit} className="form form--spaced">
          <ErrorText>{error}</ErrorText>
          <div className="form--grid">
            <Field label="Customer" required>
              <Combobox
                value={partnerId}
                onChange={setPartnerId}
                placeholder="Pilih customer"
                searchable
                aria-label="Customer"
                options={customers.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            <Field label="Gudang" required>
              <Combobox
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="Pilih gudang"
                aria-label="Gudang"
                options={(warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
              />
            </Field>
            <Field label="Tanggal Kirim" required>
              <Input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} required />
            </Field>
            <Field label="Catatan">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="delivery-page__items-header">
              <span className="delivery-page__items-title">Item</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setItems([...items, { productId: "", quantity: "1" }])}
              >
                <Plus size={14} weight="bold" /> Item
              </Button>
            </div>
            <div className="delivery-page__items">
              {items.map((item, idx) => (
                <div key={idx} className="delivery-page__item">
                  <Combobox
                    value={item.productId}
                    onChange={(v) => {
                      const next = [...items];
                      next[idx] = { ...item, productId: v };
                      setItems(next);
                    }}
                    placeholder="Pilih produk"
                    searchable
                    aria-label="Produk"
                    className="delivery-page__item-product"
                    options={(products.data?.data ?? []).map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.sku})`,
                    }))}
                  />
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...item, quantity: e.target.value };
                      setItems(next);
                    }}
                    className="delivery-page__item-qty"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    disabled={items.length === 1}
                    aria-label="Hapus item"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {customers.length === 0 && (
            <p className="delivery-page__warning">
              Belum ada partner CUSTOMER. Tambahkan customer terlebih dahulu.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
