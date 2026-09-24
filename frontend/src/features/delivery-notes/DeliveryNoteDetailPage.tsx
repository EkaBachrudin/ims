import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Printer, X } from "@phosphor-icons/react";
import { dnApi, partnerApi, productApi, transactionApi, warehouseApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Badge, Card, PageHeader, Spinner } from "@/components/ui/Card";
import { dateInput, dnStatusTone, formatDate, formatDateTime } from "@/lib/format";
import type { DeliveryNote, DnStatus } from "@/types";
import "./DeliveryNoteDetailPage.css";

interface EditItemRow {
  productId: string;
  quantity: string;
}

export function DeliveryNoteDetailPage() {
  const { id = "" } = useParams();
  const canManage = useCanManage();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | DnStatus>(null);
  const [error, setError] = useState("");

  const [partnerId, setPartnerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EditItemRow[]>([]);

  const { data: dn, isLoading } = useQuery({
    queryKey: qk.deliveryNotes.detail(id),
    queryFn: () => dnApi.get(id),
    enabled: Boolean(id),
  });

  const related = useQuery({
    queryKey: qk.transactions.list({ deliveryNoteId: id }),
    queryFn: () => transactionApi.list({ deliveryNoteId: id, limit: 100 }),
    enabled: Boolean(id),
  });

  const partners = useQuery({
    queryKey: qk.partners.list({ all: true }),
    queryFn: () => partnerApi.list({ limit: 100 }),
    enabled: editOpen,
  });
  const products = useQuery({
    queryKey: qk.products.list({ all: true }),
    queryFn: () => productApi.list({ limit: 100 }),
    enabled: editOpen,
  });
  const warehouses = useQuery({
    queryKey: qk.warehouses.list(),
    queryFn: () => warehouseApi.list(),
    enabled: editOpen,
  });

  const customers = (partners.data?.data ?? []).filter((p) => p.type === "CUSTOMER");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.deliveryNotes.all });
    qc.invalidateQueries({ queryKey: qk.transactions.all });
    qc.invalidateQueries({ queryKey: qk.products.all });
    qc.invalidateQueries({ queryKey: qk.dashboard });
  };

  const statusMut = useMutation({
    mutationFn: (status: DnStatus) => dnApi.updateStatus(id, status),
    onSuccess: () => {
      invalidate();
      setConfirmAction(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (body: unknown) => dnApi.update(id, body),
    onSuccess: () => {
      invalidate();
      setEditOpen(false);
      setError("");
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function openEdit(d: DeliveryNote) {
    setPartnerId(d.partner.id);
    setWarehouseId(d.warehouse.id);
    setShipDate(dateInput(d.shipDate));
    setNotes(d.notes ?? "");
    setItems(d.items.map((i) => ({ productId: i.product.id, quantity: String(i.quantity) })));
    setError("");
    setEditOpen(true);
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const payloadItems = items
      .filter((i) => i.productId && Number(i.quantity) > 0)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }));
    if (payloadItems.length === 0) {
      setError("Tambahkan minimal satu item.");
      return;
    }
    updateMut.mutate({
      partnerId,
      warehouseId,
      shipDate,
      notes: notes || null,
      items: payloadItems,
    });
  }

  if (isLoading || !dn) return <Spinner />;

  const messages: Record<DnStatus, string> = {
    DRAFT: "",
    SHIPPED: `Kirim Surat Jalan ${dn.dnNumber}? Stok akan berkurang dan transaksi OUT dibuat.`,
    DELIVERED: `Tandai Surat Jalan ${dn.dnNumber} sebagai DELIVERED?`,
    CANCELLED: `Batalkan Surat Jalan ${dn.dnNumber}? Tindakan ini final.`,
  };

  return (
    <div className="dn-detail-page">
      <PageHeader
        title={dn.dnNumber}
        description={`Dibuat oleh ${dn.createdBy.name} • ${formatDate(dn.createdAt)}`}
        actions={
          <Link to="/delivery-notes" className="dn-detail-page__back">
            <ArrowLeft size={15} /> Kembali
          </Link>
        }
      />

      <ErrorText>{error && !editOpen ? error : ""}</ErrorText>

      <div className="dn-detail-page__grid">
        <Card className="dn-detail-page__main dn-print">
          <div className="dn-detail-page__print-head">
            <h1 className="dn-detail-page__print-title">SURAT JALAN</h1>
            <p className="dn-detail-page__print-number">{dn.dnNumber}</p>
          </div>

          <div className="dn-detail-page__meta">
            <div>
              <p className="dn-detail-page__meta-label">Status</p>
              <Badge tone={dnStatusTone[dn.status]}>{dn.status}</Badge>
            </div>
            <div>
              <p className="dn-detail-page__meta-label">Customer</p>
              <p className="dn-detail-page__meta-value">{dn.partner.name}</p>
            </div>
            <div>
              <p className="dn-detail-page__meta-label">Gudang</p>
              <p className="dn-detail-page__meta-value">{dn.warehouse.name}</p>
            </div>
            <div>
              <p className="dn-detail-page__meta-label">Tanggal Kirim</p>
              <p className="dn-detail-page__meta-value">{formatDate(dn.shipDate)}</p>
            </div>
            {dn.po && (
              <div>
                <p className="dn-detail-page__meta-label">PO Terkait</p>
                <p className="dn-detail-page__meta-value">
                  <Link to={`/purchase-orders/${dn.po.id}`} className="link">
                    {dn.po.poNumber}
                  </Link>
                </p>
              </div>
            )}
            <div className="dn-detail-page__meta-item--full">
              <p className="dn-detail-page__meta-label">Catatan</p>
              <p className="dn-detail-page__meta-value">{dn.notes ?? "-"}</p>
            </div>
          </div>

          <div className="dn-detail-page__table-wrap">
            <table className="dn-detail-page__table">
              <thead className="dn-detail-page__thead">
                <tr>
                  <th className="dn-detail-page__th">Produk</th>
                  <th className="dn-detail-page__th">SKU</th>
                  <th className="dn-detail-page__th">Jumlah</th>
                  <th className="dn-detail-page__th">Satuan</th>
                </tr>
              </thead>
              <tbody className="dn-detail-page__tbody">
                {dn.items.map((item) => (
                  <tr key={item.id}>
                    <td className="dn-detail-page__td">{item.product.name}</td>
                    <td className="dn-detail-page__td dn-detail-page__sku">{item.product.sku}</td>
                    <td className="dn-detail-page__td dn-detail-page__qty">{item.quantity}</td>
                    <td className="dn-detail-page__td">{item.product.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="dn-detail-page__items-mobile">
            {dn.items.map((item) => (
              <li key={item.id} className="dn-detail-page__item-card">
                <div className="dn-detail-page__item-card-head">
                  <p className="dn-detail-page__item-card-name" title={item.product.name}>
                    {item.product.name}
                  </p>
                  <span className="dn-detail-page__item-card-sku">{item.product.sku}</span>
                </div>
                <div className="dn-detail-page__item-card-meta">
                  <span>
                    Jumlah{" "}
                    <span className="dn-detail-page__item-card-qty">
                      {item.quantity} {item.product.unit}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="dn-detail-page__signature">
            <div>
              <p>Penerima,</p>
              <div className="dn-detail-page__signature-line" />
            </div>
            <div>
              <p>Pengirim,</p>
              <div className="dn-detail-page__signature-line" />
            </div>
          </div>
        </Card>

        <Card className="dn-detail-page__actions-card">
          <h2 className="dn-detail-page__actions-title">Aksi</h2>
          <div className="dn-detail-page__actions">
            <Button
              className="dn-detail-page__action"
              variant="secondary"
              onClick={() => window.print()}
            >
              <Printer size={16} /> Cetak
            </Button>

            {dn.status === "DRAFT" && (
              <>
                <Button
                  className="dn-detail-page__action"
                  onClick={() => setConfirmAction("SHIPPED")}
                  disabled={!canManage}
                >
                  Kirim
                </Button>
                <Button
                  className="dn-detail-page__action"
                  variant="secondary"
                  onClick={() => openEdit(dn)}
                  disabled={!canManage}
                >
                  <Pencil size={16} /> Edit
                </Button>
                <Button
                  className="dn-detail-page__action"
                  variant="danger"
                  onClick={() => setConfirmAction("CANCELLED")}
                  disabled={!canManage}
                >
                  Batal
                </Button>
              </>
            )}

            {dn.status === "SHIPPED" && (
              <>
                <Button
                  className="dn-detail-page__action"
                  variant="success"
                  onClick={() => setConfirmAction("DELIVERED")}
                  disabled={!canManage}
                >
                  Terkirim
                </Button>
                <Button
                  className="dn-detail-page__action"
                  variant="danger"
                  onClick={() => setConfirmAction("CANCELLED")}
                  disabled={!canManage}
                >
                  Batal
                </Button>
              </>
            )}

            {(dn.status === "DELIVERED" || dn.status === "CANCELLED") && (
              <p className="dn-detail-page__note">Tidak ada aksi lanjutan untuk status ini.</p>
            )}
            {!canManage && <p className="dn-detail-page__warning">Owner hanya dapat melihat.</p>}
          </div>
        </Card>
      </div>

      <Card className="dn-detail-page__related">
        <h2 className="dn-detail-page__actions-title">Transaksi OUT Terkait</h2>
        {(related.data?.data ?? []).length === 0 ? (
          <p className="dn-detail-page__note">
            Belum ada transaksi OUT. Transaksi dibuat otomatis saat Surat Jalan dikirim (SHIPPED).
          </p>
        ) : (
          <div className="dn-detail-page__table-wrap">
            <table className="dn-detail-page__table">
              <thead className="dn-detail-page__thead">
                <tr>
                  <th className="dn-detail-page__th">Tanggal</th>
                  <th className="dn-detail-page__th">Produk</th>
                  <th className="dn-detail-page__th">Jumlah</th>
                  <th className="dn-detail-page__th">Gudang</th>
                  <th className="dn-detail-page__th">Oleh</th>
                </tr>
              </thead>
              <tbody className="dn-detail-page__tbody">
                {related.data?.data.map((t) => (
                  <tr key={t.id}>
                    <td className="dn-detail-page__td">{formatDateTime(t.createdAt)}</td>
                    <td className="dn-detail-page__td">{t.product.name}</td>
                    <td className="dn-detail-page__td dn-detail-page__qty">
                      {t.quantity} {t.product.unit}
                    </td>
                    <td className="dn-detail-page__td">{t.warehouse.name}</td>
                    <td className="dn-detail-page__td">{t.createdBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={editOpen}
        title={`Edit Surat Jalan ${dn.dnNumber}`}
        onClose={() => setEditOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button form="dn-edit-form" type="submit" loading={updateMut.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="dn-edit-form" onSubmit={submitEdit} className="form form--spaced">
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
              <Input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Catatan">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="dn-detail-page__items-header">
              <span className="dn-detail-page__items-title">Item</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setItems([...items, { productId: "", quantity: "1" }])}
              >
                <Plus size={14} weight="bold" /> Item
              </Button>
            </div>
            <div className="dn-detail-page__items">
              {items.map((item, idx) => (
                <div key={idx} className="dn-detail-page__item">
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
                    className="dn-detail-page__item-product"
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
                    className="dn-detail-page__item-qty"
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

      <ConfirmModal
        open={Boolean(confirmAction)}
        title="Konfirmasi"
        message={confirmAction ? messages[confirmAction] : ""}
        loading={statusMut.isPending}
        confirmLabel="Ya, lanjutkan"
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && statusMut.mutate(confirmAction)}
      />
    </div>
  );
}
