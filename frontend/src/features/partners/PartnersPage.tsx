import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { partnerApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import type { Partner, PartnerType } from "@/types";
import "./PartnersPage.css";

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
  const debouncedSearch = useDebouncedValue(search, 300);
  const [type, setType] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Partner | null>(null);
  const [error, setError] = useState("");

  const filters = { page, limit: 20, q: debouncedSearch || undefined, type: type || undefined };
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

  function renderActions(p: Partner) {
    return (
      <div className="row-actions">
        <Button
          size="icon"
          variant="accent-ghost"
          aria-label={`Ubah ${p.name}`}
          title="Ubah"
          onClick={() => openEdit(p)}
        >
          <PencilSimple size={16} />
        </Button>
        <Button
          size="icon"
          variant="danger-ghost"
          aria-label={`Hapus ${p.name}`}
          title="Hapus"
          onClick={() => setDeleting(p)}
        >
          <Trash size={16} />
        </Button>
      </div>
    );
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
            className: "cell-right",
            render: (p: Partner) => renderActions(p),
          },
        ]
      : []),
  ];

  return (
    <div className="partners-page">
      <PageHeader
        title="Partner"
        description="Supplier & customer"
        actions={canManage && <Button onClick={openCreate}>+ Tambah Partner</Button>}
      />

      <div className="filter-bar">
        <Input
          aria-label="Cari partner"
          placeholder="Cari nama / telepon..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="filter-bar__search"
        />
        <Combobox
          className="filter-bar__select"
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          placeholder="Semua tipe"
          options={[
            { value: "SUPPLIER", label: "Supplier" },
            { value: "CUSTOMER", label: "Customer" },
          ]}
        />
      </div>

      <ErrorText>{error && !creating && !editing ? error : ""}</ErrorText>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        rowKey={(p) => p.id}
        mobileCard={(p) => (
          <div>
            <div className="data-table__card-head">
              <span className="data-table__card-title" title={p.name}>
                {p.name}
              </span>
              {canManage && renderActions(p)}
            </div>
            <div className="data-table__card-sub">
              <Badge tone={p.type === "SUPPLIER" ? "blue" : "indigo"}>
                {p.type === "SUPPLIER" ? "Supplier" : "Customer"}
              </Badge>
            </div>
            <div className="data-table__card-meta">
              <span>Telp: {p.phone ?? "-"}</span>
              <span>Email: {p.email ?? "-"}</span>
            </div>
            <p className="partners-page__card-address">{p.address ?? "-"}</p>
          </div>
        )}
      />
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
        <form id="partner-form" onSubmit={submit} className="form">
          <ErrorText>{error}</ErrorText>
          <Field label="Nama" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Tipe" required>
            <Combobox
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v as PartnerType })}
              clearable={false}
              aria-label="Tipe"
              options={[
                { value: "CUSTOMER", label: "Customer" },
                { value: "SUPPLIER", label: "Supplier" },
              ]}
            />
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
