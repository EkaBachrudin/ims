import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Prohibit } from "@phosphor-icons/react";
import { userApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import { roleLabel } from "@/lib/format";
import type { Role, User } from "@/types";
import "./UsersPage.css";

interface FormState {
  email: string;
  name: string;
  password: string;
  role: Role;
  telegramId: string;
  whatsappNumber: string;
  isActive: boolean;
}
const emptyForm: FormState = {
  email: "",
  name: "",
  password: "",
  role: "ADMIN",
  telegramId: "",
  whatsappNumber: "",
  isActive: true,
};

export function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [error, setError] = useState("");

  const filters = { page, limit: 20, q: search || undefined };
  const { data, isLoading } = useQuery({ queryKey: qk.users.list(filters), queryFn: () => userApi.list(filters) });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.users.all });

  const createMut = useMutation({
    mutationFn: (body: unknown) => userApi.create(body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => userApi.update(id, body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const deactivateMut = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeactivating(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setCreating(true);
  }
  function openEdit(u: User) {
    setForm({
      email: u.email,
      name: u.name,
      password: "",
      role: u.role,
      telegramId: u.telegramId ?? "",
      whatsappNumber: u.whatsappNumber ?? "",
      isActive: u.isActive,
    });
    setError("");
    setEditing(u);
  }
  function closeForm() {
    setCreating(false);
    setEditing(null);
    setError("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        body: {
          email: form.email,
          name: form.name,
          role: form.role,
          telegramId: form.telegramId || null,
          whatsappNumber: form.whatsappNumber || null,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        },
      });
    } else {
      createMut.mutate({
        email: form.email,
        name: form.name,
        password: form.password,
        role: form.role,
        telegramId: form.telegramId || null,
        whatsappNumber: form.whatsappNumber || null,
      });
    }
  }

  const columns: Column<User>[] = [
    { key: "name", header: "Nama", render: (u) => u.name },
    { key: "email", header: "Email", render: (u) => u.email },
    { key: "role", header: "Role", render: (u) => <Badge tone="indigo">{roleLabel[u.role]}</Badge> },
    { key: "telegram", header: "Telegram ID", render: (u) => u.telegramId ?? "-" },
    {
      key: "status",
      header: "Status",
      render: (u) => <Badge tone={u.isActive ? "green" : "slate"}>{u.isActive ? "Aktif" : "Nonaktif"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "cell-right",
      render: (u) => (
        <div className="row-actions">
          <Button
            size="icon"
            variant="secondary"
            aria-label={`Ubah ${u.name}`}
            title="Ubah"
            onClick={() => openEdit(u)}
          >
            <PencilSimple size={16} />
          </Button>
          {u.isActive && (
            <Button
              size="icon"
              variant="danger-ghost"
              aria-label={`Nonaktifkan ${u.name}`}
              title="Nonaktifkan"
              onClick={() => setDeactivating(u)}
            >
              <Prohibit size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="users-page">
      <PageHeader
        title="Pengguna"
        description="Kelola user & role"
        actions={<Button onClick={openCreate}>+ Tambah User</Button>}
      />

      <div className="filter-bar">
        <Input
          aria-label="Cari pengguna"
          placeholder="Cari nama / email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-bar__search"
        />
      </div>

      <ErrorText>{error && !creating && !editing ? error : ""}</ErrorText>

      <DataTable columns={columns} rows={data?.data ?? []} loading={isLoading} rowKey={(u) => u.id} />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal
        open={creating || Boolean(editing)}
        title={editing ? "Ubah User" : "Tambah User"}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button form="user-form" type="submit" loading={createMut.isPending || updateMut.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={submit} className="form">
          <ErrorText>{error}</ErrorText>
          <Field label="Nama" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label={editing ? "Password (kosongkan bila tidak diubah)" : "Password"} required={!editing}>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
            />
          </Field>
          <Field label="Role" required>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="ADMIN">Admin Gudang</option>
              <option value="OWNER">Owner</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </Select>
          </Field>
          <Field label="Telegram ID" hint="Untuk mapping chat asisten AI">
            <Input value={form.telegramId} onChange={(e) => setForm({ ...form, telegramId: e.target.value })} />
          </Field>
          <Field label="WhatsApp Number">
            <Input value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} />
          </Field>
          {editing && (
            <label className="users-page__check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Aktif
            </label>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deactivating)}
        title="Nonaktifkan User"
        message={`Nonaktifkan "${deactivating?.name}"? User tidak akan bisa login.`}
        loading={deactivateMut.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivateMut.mutate(deactivating.id)}
      />
    </div>
  );
}
