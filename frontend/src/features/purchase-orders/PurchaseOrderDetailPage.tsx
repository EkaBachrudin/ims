import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dnApi, poApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/Input";
import { Badge, Card, PageHeader, Spinner } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/Modal";
import { formatCurrency, formatDate, poStatusTone, todayInput } from "@/lib/format";

export function PurchaseOrderDetailPage() {
  const { id = "" } = useParams();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<null | "confirm" | "complete" | "cancel" | "delete">(null);
  const [error, setError] = useState("");
  const [dnLoading, setDnLoading] = useState(false);

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
    mutationFn: async (action: "confirm" | "complete" | "cancel" | "delete") => {
      if (action === "confirm") return poApi.confirm(id);
      if (action === "complete") return poApi.complete(id);
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

  async function createDeliveryNote() {
    if (!po) return;
    setError("");
    setDnLoading(true);
    try {
      const dn = await dnApi.create({
        poId: po.id,
        shipDate: todayInput(),
        notes: `Dari PO ${po.poNumber}`,
      });
      qc.invalidateQueries({ queryKey: qk.deliveryNotes.all });
      navigate(`/delivery-notes`);
      void dn;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDnLoading(false);
    }
  }

  if (isLoading || !po) return <Spinner />;

  const messages: Record<string, string> = {
    confirm: `Konfirmasi PO ${po.poNumber}? Status menjadi CONFIRMED.`,
    complete: `Tandai PO ${po.poNumber} sebagai COMPLETED?`,
    cancel: `Batalkan PO ${po.poNumber}? Tindakan ini final.`,
    delete: `Hapus draft PO ${po.poNumber}? Item ikut terhapus.`,
  };

  return (
    <div>
      <PageHeader
        title={po.poNumber}
        description={`Dibuat oleh ${po.createdBy.name} • ${formatDate(po.createdAt)}`}
        actions={
          <Link to="/purchase-orders" className="text-sm text-indigo-600 hover:underline">
            ← Kembali
          </Link>
        }
      />

      <ErrorText>{error}</ErrorText>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase text-slate-400">Status</p>
              <Badge tone={poStatusTone[po.status]}>{po.status}</Badge>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Sumber</p>
              <p className="font-medium">{po.source === "AI_CHAT" ? "AI Chat" : "Web"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Partner</p>
              <p className="font-medium">{po.partner.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Gudang</p>
              <p className="font-medium">{po.warehouse?.name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Tanggal Target</p>
              <p className="font-medium">{formatDate(po.targetDate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Catatan</p>
              <p className="font-medium">{po.notes ?? "-"}</p>
            </div>
          </div>

          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Produk</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Qty</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Harga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {po.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    {item.product.name} <span className="text-xs text-slate-400">({item.product.sku})</span>
                  </td>
                  <td className="px-3 py-2">
                    {item.quantity} {item.product.unit}
                  </td>
                  <td className="px-3 py-2">{formatCurrency(item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Aksi</h2>
          <div className="space-y-2">
            {po.status === "DRAFT" && (
              <>
                <Button className="w-full" onClick={() => setConfirmAction("confirm")} disabled={!canManage}>
                  Konfirmasi PO
                </Button>
                <Button
                  className="w-full"
                  variant="danger"
                  onClick={() => setConfirmAction("cancel")}
                  disabled={!canManage}
                >
                  Batalkan
                </Button>
                <Button
                  className="w-full"
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
                <Button className="w-full" variant="success" onClick={() => setConfirmAction("complete")} disabled={!canManage}>
                  Tandai Selesai
                </Button>
                <Button className="w-full" variant="secondary" loading={dnLoading} onClick={createDeliveryNote} disabled={!canManage}>
                  Buat Surat Jalan
                </Button>
                <Button
                  className="w-full"
                  variant="danger"
                  onClick={() => setConfirmAction("cancel")}
                  disabled={!canManage}
                >
                  Batalkan
                </Button>
              </>
            )}
            {po.status === "COMPLETED" && (
              <Button className="w-full" variant="secondary" loading={dnLoading} onClick={createDeliveryNote} disabled={!canManage}>
                Buat Surat Jalan
              </Button>
            )}
            {(po.status === "COMPLETED" || po.status === "CANCELLED") && (
              <p className="text-xs text-slate-400">Tidak ada aksi lanjutan untuk status ini.</p>
            )}
            {!canManage && <p className="text-xs text-amber-600">Owner hanya dapat melihat PO.</p>}
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
