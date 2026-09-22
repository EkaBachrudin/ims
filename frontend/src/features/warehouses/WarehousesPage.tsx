import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { warehouseApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import type { Warehouse } from "@/types";
import "./WarehousesPage.css";

interface FormState {
  code: string;
  name: string;
  address: string;
  isActive: boolean;
}
const emptyForm: FormState = { code: "", name: "", address: "", isActive: true };

export function WarehousesPage() {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: qk.warehouses.list({ q: search }),
    queryFn: () => warehouseApi.list({ q: search || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.warehouses.all });

  const createMut = useMutation({
    mutationFn: (body: unknown) => warehouseApi.create(body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => warehouseApi.update(id, body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => warehouseApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setCreating(true);
  }
  function openEdit(w: Warehouse) {
    setForm({ code: w.code, name: w.name, address: w.address ?? "", isActive: w.isActive });
    setError("");
    setEditing(w);
  }
  function closeForm() {
    setCreating(false);
    setEditing(null);
    setError("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      code: form.code,
      name: form.name,
      address: form.address || null,
      isActive: form.isActive,
    };
    if (editing) updateMut.mutate({ id: editing.id, body });
    else createMut.mutate(body);
  }

  const columns: Column<Warehouse>[] = [
    { key: "code", header: "Kode", render: (w) => <span className="mono-xs">{w.code}</span> },
    { key: "name", header: "Nama", render: (w) => w.name },
    { key: "address", header: "Alamat", render: (w) => w.address ?? "-" },
    {
      key: "status",
      header: "Status",
      render: (w) => <Badge tone={w.isActive ? "green" : "slate"}>{w.isActive ? "Aktif" : "Nonaktif"}</Badge>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "cell-right",
            render: (w: Warehouse) => (
              <div className="row-actions">
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label={`Ubah ${w.name}`}
                  title="Ubah"
                  onClick={() => openEdit(w)}
                >
                  <PencilSimple size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="danger-ghost"
                  aria-label={`Hapus ${w.name}`}
                  title="Hapus"
                  onClick={() => setDeleting(w)}
                >
                  <Trash size={16} />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="warehouses-page">
      <PageHeader
        title="Gudang"
        description="Lokasi penyimpanan"
        actions={canManage && <Button onClick={openCreate}>+ Tambah Gudang</Button>}
      />

      <div className="filter-bar">
        <Input
          aria-label="Cari gudang"
          placeholder="Cari gudang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-bar__search"
        />
      </div>

      <ErrorText>{error && !creating && !editing ? error : ""}</ErrorText>

      <DataTable columns={columns} rows={data ?? []} loading={isLoading} rowKey={(w) => w.id} />

      <Modal
        open={creating || Boolean(editing)}
        title={editing ? "Ubah Gudang" : "Tambah Gudang"}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button form="warehouse-form" type="submit" loading={createMut.isPending || updateMut.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="warehouse-form" onSubmit={submit} className="form">
          <ErrorText>{error}</ErrorText>
          <Field label="Kode" required>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </Field>
          <Field label="Nama" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Alamat">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <label className="warehouses-page__check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Aktif
          </label>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        title="Hapus Gudang"
        message={`Yakin menghapus "${deleting?.name}"?`}
        loading={deleteMut.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
      />
    </div>
  );
}
