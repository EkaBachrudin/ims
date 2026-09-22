import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { partnerApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import type { Partner, PartnerType } from "@/types";

interface FormState {
  name: string;
  type: PartnerType;
  phone: string;
  email: string;
  address: string;
}
const emptyForm: FormState = { name: "", type: "CUSTOMER", phone: "", email: "", address: "" };

export function PartnersPage() {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Partner | null>(null);
  const [error, setError] = useState("");

  const filters = { page, limit: 20, q: search || undefined, type: type || undefined };
  const { data, isLoading } = useQuery({
    queryKey: qk.partners.list(filters),
    queryFn: () => partnerApi.list(filters),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.partners.all });

  const createMut = useMutation({
    mutationFn: (body: unknown) => partnerApi.create(body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => partnerApi.update(id, body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => partnerApi.remove(id),
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
  function openEdit(p: Partner) {
    setForm({
      name: p.name,
      type: p.type,
      phone: p.phone ?? "",
      email: p.email ?? "",
      address: p.address ?? "",
    });
    setError("");
    setEditing(p);
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
      name: form.name,
      type: form.type,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
    };
    if (editing) updateMut.mutate({ id: editing.id, body });
    else createMut.mutate(body);
  }

  const columns: Column<Partner>[] = [
    { key: "name", header: "Nama", render: (p) => p.name },
    {
      key: "type",
      header: "Tipe",
      render: (p) => (
        <Badge tone={p.type === "SUPPLIER" ? "blue" : "indigo"}>
          {p.type === "SUPPLIER" ? "Supplier" : "Customer"}
        </Badge>
      ),
    },
    { key: "phone", header: "Telepon", render: (p) => p.phone ?? "-" },
    { key: "email", header: "Email", render: (p) => p.email ?? "-" },
    { key: "address", header: "Alamat", render: (p) => p.address ?? "-" },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (p: Partner) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                  Ubah
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleting(p)}>
                  Hapus
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Partner"
        description="Supplier & customer"
        actions={canManage && <Button onClick={openCreate}>+ Tambah Partner</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          aria-label="Cari partner"
          placeholder="Cari nama / telepon..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        >
          <option value="">Semua tipe</option>
          <option value="SUPPLIER">Supplier</option>
          <option value="CUSTOMER">Customer</option>
        </Select>
      </div>

      <ErrorText>{error && !creating && !editing ? error : ""}</ErrorText>

      <DataTable columns={columns} rows={data?.data ?? []} loading={isLoading} rowKey={(p) => p.id} />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal
        open={creating || Boolean(editing)}
        title={editing ? "Ubah Partner" : "Tambah Partner"}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button form="partner-form" type="submit" loading={createMut.isPending || updateMut.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="partner-form" onSubmit={submit} className="space-y-3">
          <ErrorText>{error}</ErrorText>
          <Field label="Nama" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Tipe" required>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PartnerType })}>
              <option value="CUSTOMER">Customer</option>
              <option value="SUPPLIER">Supplier</option>
            </Select>
          </Field>
          <Field label="Telepon">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Alamat">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        title="Hapus Partner"
        message={`Yakin menghapus "${deleting?.name}"?`}
        loading={deleteMut.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
      />
    </div>
  );
}
