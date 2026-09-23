import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "@phosphor-icons/react";
import { poApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/Input";
import { Badge, Card, PageHeader, Spinner } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/Modal";
import { formatCurrency, formatDate, poStatusTone } from "@/lib/format";
import "./PurchaseOrderDetailPage.css";

export function PurchaseOrderDetailPage() {
  const { id = "" } = useParams();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<null | "confirm" | "cancel" | "delete">(null);
  const [error, setError] = useState("");

  const { data: po, isLoading } = useQuery({
    queryKey: qk.purchaseOrders.detail(id),
    queryFn: () => poApi.get(id),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.purchaseOrders.all });
    qc.invalidateQueries({ queryKey: qk.dashboard });
  };

  const actionMut = useMutation({
    mutationFn: async (action: "confirm" | "cancel" | "delete") => {
      if (action === "confirm") return poApi.confirm(id);
      if (action === "cancel") return poApi.cancel(id);
      return poApi.remove(id);
    },
    onSuccess: (_res, action) => {
      invalidate();
      setConfirmAction(null);
      if (action === "delete") navigate("/purchase-orders");
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (isLoading || !po) return <Spinner />;

  const messages: Record<string, string> = {
    confirm: `Konfirmasi PO ${po.poNumber}? Status menjadi CONFIRMED.`,
    cancel: `Batalkan PO ${po.poNumber}? Tindakan ini final.`,
    delete: `Hapus draft PO ${po.poNumber}? Item ikut terhapus.`,
  };

  return (
    <div className="po-detail-page">
      <PageHeader
        title={po.poNumber}
        description={`Dibuat oleh ${po.createdBy.name} • ${formatDate(po.createdAt)}`}
        actions={
          <Link to="/purchase-orders" className="po-detail-page__back">
            <ArrowLeft size={15} /> Kembali
          </Link>
        }
      />

      <ErrorText>{error}</ErrorText>

      <div className="po-detail-page__grid">
        <Card className="po-detail-page__main">
          <div className="po-detail-page__meta">
            <div>
              <p className="po-detail-page__meta-label">Status</p>
              <Badge tone={poStatusTone[po.status]}>{po.status}</Badge>
            </div>
            <div>
              <p className="po-detail-page__meta-label">Sumber</p>
              <p className="po-detail-page__meta-value">{po.source === "AI_CHAT" ? "AI Chat" : "Web"}</p>
            </div>
            <div>
              <p className="po-detail-page__meta-label">Partner</p>
              <p className="po-detail-page__meta-value">{po.partner.name}</p>
            </div>
            <div>
              <p className="po-detail-page__meta-label">Gudang</p>
              <p className="po-detail-page__meta-value">{po.warehouse?.name ?? "-"}</p>
            </div>
            <div>
              <p className="po-detail-page__meta-label">Tanggal Target</p>
              <p className="po-detail-page__meta-value">{formatDate(po.targetDate)}</p>
            </div>
            <div className="po-detail-page__meta-item--full">
              <p className="po-detail-page__meta-label">Catatan</p>
              <p className="po-detail-page__meta-value">{po.notes ?? "-"}</p>
            </div>
          </div>

          <div className="po-detail-page__table-wrap">
            <table className="po-detail-page__table">
              <thead className="po-detail-page__thead">
                <tr>
                  <th className="po-detail-page__th">Produk</th>
                  <th className="po-detail-page__th">Dipesan</th>
                  <th className="po-detail-page__th">Diterima</th>
                  <th className="po-detail-page__th">Sisa</th>
                  <th className="po-detail-page__th">Harga</th>
                </tr>
              </thead>
              <tbody className="po-detail-page__tbody">
                {po.items.map((item) => (
                  <tr key={item.id}>
                    <td className="po-detail-page__td">
                      {item.product.name} <span className="po-detail-page__sku">({item.product.sku})</span>
                    </td>
                    <td className="po-detail-page__td">
                      {item.quantity} {item.product.unit}
                    </td>
                    <td className="po-detail-page__td">
                      {item.receivedQuantity ?? 0} {item.product.unit}
                    </td>
                    <td className="po-detail-page__td">
                      {item.remainingQuantity ?? item.quantity} {item.product.unit}
                    </td>
                    <td className="po-detail-page__td">{formatCurrency(item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="po-detail-page__items-mobile">
            {po.items.map((item) => (
              <li key={item.id} className="po-detail-page__item-card">
                <div className="po-detail-page__item-card-head">
                  <p className="po-detail-page__item-card-name" title={item.product.name}>
                    {item.product.name}
                  </p>
                  <span className="po-detail-page__item-card-sku">{item.product.sku}</span>
                </div>
                <div className="po-detail-page__item-card-meta">
                  <span>
                    Dipesan{" "}
                    <span className="po-detail-page__item-card-qty">
                      {item.quantity} {item.product.unit}
                    </span>
                  </span>
                  <span>
                    Diterima{" "}
                    <span className="po-detail-page__item-card-qty">
                      {item.receivedQuantity ?? 0} {item.product.unit}
                    </span>
                  </span>
                  <span>
                    Sisa{" "}
                    <span className="po-detail-page__item-card-qty">
                      {item.remainingQuantity ?? item.quantity} {item.product.unit}
                    </span>
                  </span>
                </div>
                <div className="po-detail-page__item-card-footer">
                  <span>Harga</span>
                  <span className="po-detail-page__item-card-price">{formatCurrency(item.unitPrice)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="po-detail-page__actions-card">
          <h2 className="po-detail-page__actions-title">Aksi</h2>
          <div className="po-detail-page__actions">
            {po.status === "DRAFT" && (
              <>
                <Button className="po-detail-page__action" onClick={() => setConfirmAction("confirm")} disabled={!canManage}>
                  Konfirmasi PO
                </Button>
                <Button
                  className="po-detail-page__action"
                  variant="danger"
                  onClick={() => setConfirmAction("cancel")}
                  disabled={!canManage}
                >
                  Batalkan
                </Button>
                <Button
                  className="po-detail-page__action"
                  variant="secondary"
                  onClick={() => setConfirmAction("delete")}
                  disabled={!canManage}
                >
                  Hapus Draft
                </Button>
              </>
            )}
            {po.status === "CONFIRMED" && (
              <>
                <Button
                  className="po-detail-page__action"
                  variant="success"
                  onClick={() => navigate(`/inbound?po=${po.id}`)}
                  disabled={!canManage}
                >
                  Terima Barang
                </Button>
                <Button
                  className="po-detail-page__action"
                  variant="danger"
                  onClick={() => setConfirmAction("cancel")}
                  disabled={!canManage}
                >
                  Batalkan
                </Button>
              </>
            )}
            {(po.status === "COMPLETED" || po.status === "CANCELLED") && (
              <p className="po-detail-page__note">Tidak ada aksi lanjutan untuk status ini.</p>
            )}
            {!canManage && <p className="po-detail-page__warning">Owner hanya dapat melihat PO.</p>}
          </div>
        </Card>
      </div>

      <ConfirmModal
        open={Boolean(confirmAction)}
        title="Konfirmasi"
        message={confirmAction ? messages[confirmAction] : ""}
        loading={actionMut.isPending}
        confirmLabel={confirmAction === "delete" || confirmAction === "cancel" ? "Ya, lanjutkan" : "Ya"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && actionMut.mutate(confirmAction)}
      />
    </div>
  );
}
