import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "@phosphor-icons/react";
import { partnerApi, poApi, productApi, warehouseApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import { formatDate, poStatusTone } from "@/lib/format";
import type { PoStatus, PurchaseOrder } from "@/types";
import "./PurchaseOrdersPage.css";

interface ItemRow {
  productId: string;
  quantity: string;
}

export function PurchaseOrdersPage() {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const [partnerId, setPartnerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ productId: "", quantity: "1" }]);

  const filters = { page, limit: 20, status: status || undefined };
  const { data, isLoading } = useQuery({ queryKey: qk.purchaseOrders.list(filters), queryFn: () => poApi.list(filters) });
  const partners = useQuery({ queryKey: qk.partners.list({ all: true }), queryFn: () => partnerApi.list({ limit: 100 }) });
  const products = useQuery({ queryKey: qk.products.list({ all: true }), queryFn: () => productApi.list({ limit: 100 }) });
  const warehouses = useQuery({ queryKey: qk.warehouses.list(), queryFn: () => warehouseApi.list() });

  const createMut = useMutation({
    mutationFn: (body: unknown) => poApi.create(body),
    onSuccess: (po) => {
      qc.invalidateQueries({ queryKey: qk.purchaseOrders.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      closeForm();
      navigate(`/purchase-orders/${po.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function openForm() {
    setPartnerId(partners.data?.data[0]?.id ?? "");
    setWarehouseId(warehouses.data?.[0]?.id ?? "");
    setTargetDate("");
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
      setError("Pilih partner terlebih dahulu.");
      return;
    }
    const payload = {
      partnerId,
      warehouseId: warehouseId || null,
      targetDate: targetDate || null,
      notes: notes || null,
      source: "WEB",
      items: items
        .filter((i) => i.productId && Number(i.quantity) > 0)
        .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
    };
    if (payload.items.length === 0) {
      setError("Tambahkan minimal satu item.");
      return;
    }
    createMut.mutate(payload);
  }

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "poNumber",
      header: "No. PO",
      render: (po) => (
        <Link to={`/purchase-orders/${po.id}`} className="link">
          {po.poNumber}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (po) => <Badge tone={poStatusTone[po.status as PoStatus]}>{po.status}</Badge>,
    },
    {
      key: "source",
      header: "Sumber",
      render: (po) => (po.source === "AI_CHAT" ? <Badge tone="indigo">AI Chat</Badge> : <span>Web</span>),
    },
    { key: "partner", header: "Partner", render: (po) => po.partner.name },
    { key: "items", header: "Item", render: (po) => po.items.length },
    { key: "target", header: "Target", render: (po) => formatDate(po.targetDate) },
    { key: "created", header: "Dibuat", render: (po) => formatDate(po.createdAt) },
  ];

  return (
    <div className="po-page">
      <PageHeader
        title="Purchase Order"
        description="Pesanan pembelian / pengiriman"
        actions={canManage && <Button onClick={openForm}>+ Buat PO</Button>}
      />

      <div className="po-page__filter">
        <Combobox
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          placeholder="Semua status"
          options={[
            { value: "DRAFT", label: "DRAFT" },
            { value: "CONFIRMED", label: "CONFIRMED" },
            { value: "COMPLETED", label: "COMPLETED" },
            { value: "CANCELLED", label: "CANCELLED" },
          ]}
        />
      </div>

      <ErrorText>{error && !open ? error : ""}</ErrorText>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        rowKey={(po) => po.id}
        mobileCard={(po) => (
          <div>
            <div className="data-table__card-head">
              <Link
                to={`/purchase-orders/${po.id}`}
                className="po-page__card-link"
                title={po.poNumber}
              >
                {po.poNumber}
              </Link>
              <Badge tone={poStatusTone[po.status as PoStatus]}>{po.status}</Badge>
            </div>
            <div className="data-table__card-sub">
              {po.source === "AI_CHAT" ? <Badge tone="indigo">AI Chat</Badge> : <span>Web</span>}
              <span>{po.items.length} item</span>
            </div>
            <div className="data-table__card-meta">
              <span>{po.partner.name}</span>
            </div>
            <div className="po-page__card-footer">
              <span>Target {formatDate(po.targetDate)}</span>
              <span>Dibuat {formatDate(po.createdAt)}</span>
            </div>
          </div>
        )}
      />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal
        open={open}
        title="Buat Purchase Order"
        onClose={closeForm}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button form="po-form" type="submit" loading={createMut.isPending}>
              Simpan Draft
            </Button>
          </>
        }
      >
        <form id="po-form" onSubmit={submit} className="form form--spaced">
          <ErrorText>{error}</ErrorText>
          <div className="form--grid">
            <Field label="Partner" required>
              <Combobox
                value={partnerId}
                onChange={setPartnerId}
                placeholder="Pilih partner"
                searchable
                aria-label="Partner"
                options={(partners.data?.data ?? []).map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.type})`,
                }))}
              />
            </Field>
            <Field label="Gudang">
              <Combobox
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="-"
                aria-label="Gudang"
                options={(warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
              />
            </Field>
            <Field label="Tanggal Target">
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </Field>
            <Field label="Catatan">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="po-page__items-header">
              <span className="po-page__items-title">Item</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setItems([...items, { productId: "", quantity: "1" }])}
                >
                  <Plus size={14} weight="bold" /> Item
                </Button>
            </div>
            <div className="po-page__items">
              {items.map((item, idx) => (
                <div key={idx} className="po-page__item">
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
                    className="po-page__item-product"
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
                    className="po-page__item-qty"
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
        </form>
      </Modal>
    </div>
  );
}
