import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dnApi, poApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import { dnStatusTone, formatDate, todayInput } from "@/lib/format";
import type { DeliveryNote, DnStatus } from "@/types";
import "./DeliveryNotesPage.css";

export function DeliveryNotesPage() {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [poId, setPoId] = useState("");
  const [shipDate, setShipDate] = useState(todayInput());
  const [notes, setNotes] = useState("");

  const filters = { page, limit: 20, status: status || undefined };
  const { data, isLoading } = useQuery({ queryKey: qk.deliveryNotes.list(filters), queryFn: () => dnApi.list(filters) });
  const pos = useQuery({ queryKey: qk.purchaseOrders.list({ dn: true }), queryFn: () => poApi.list({ limit: 100 }) });

  const eligiblePos = (pos.data?.data ?? []).filter((p) => p.status === "CONFIRMED" || p.status === "COMPLETED");

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
    setPoId(eligiblePos[0]?.id ?? "");
    setShipDate(todayInput());
    setNotes("");
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
    if (!poId) {
      setError("Pilih PO sumber terlebih dahulu.");
      return;
    }
    createMut.mutate({ poId, shipDate, notes: notes || null });
  }

  const columns: Column<DeliveryNote>[] = [
    { key: "dnNumber", header: "No. Surat Jalan", render: (d) => d.dnNumber },
    { key: "status", header: "Status", render: (d) => <Badge tone={dnStatusTone[d.status]}>{d.status}</Badge> },
    { key: "po", header: "PO", render: (d) => d.po?.poNumber ?? "-" },
    { key: "partner", header: "Customer", render: (d) => d.partner.name },
    { key: "shipDate", header: "Tgl Kirim", render: (d) => formatDate(d.shipDate) },
    { key: "items", header: "Item", render: (d) => d.items.length },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "cell-right",
            render: (d: DeliveryNote) => (
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
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="delivery-page">
      <PageHeader
        title="Surat Jalan"
        description="Delivery note dari PO"
        actions={canManage && <Button onClick={openForm}>+ Buat Surat Jalan</Button>}
      />

      <div className="delivery-page__filter">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua status</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SHIPPED">SHIPPED</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="CANCELLED">CANCELLED</option>
        </Select>
      </div>

      <ErrorText>{error && !open ? error : ""}</ErrorText>

      <DataTable columns={columns} rows={data?.data ?? []} loading={isLoading} rowKey={(d) => d.id} />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal
        open={open}
        title="Buat Surat Jalan"
        onClose={closeForm}
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
        <form id="dn-form" onSubmit={submit} className="form">
          <ErrorText>{error}</ErrorText>
          <Field label="PO Sumber" required hint="Hanya PO berstatus CONFIRMED/COMPLETED">
            <Select value={poId} onChange={(e) => setPoId(e.target.value)} required>
              <option value="">Pilih PO</option>
              {eligiblePos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber} - {p.partner.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tanggal Kirim" required>
            <Input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} required />
          </Field>
          <Field label="Catatan">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {eligiblePos.length === 0 && (
            <p className="delivery-page__warning">
              Belum ada PO CONFIRMED/COMPLETED. Konfirmasi PO terlebih dahulu.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
