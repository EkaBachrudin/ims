import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { categoryApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Card";
import type { Category } from "@/types";
import "./CategoriesPage.css";

export function CategoriesPage() {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: qk.categories.list({ q: debouncedSearch }),
    queryFn: () => categoryApi.list({ q: debouncedSearch || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.categories.all });

  const createMut = useMutation({
    mutationFn: (body: { name: string }) => categoryApi.create(body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => categoryApi.update(id, { name }),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => categoryApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function openCreate() {
    setName("");
    setError("");
    setCreating(true);
  }
  function openEdit(c: Category) {
    setName(c.name);
    setError("");
    setEditing(c);
  }
  function closeForm() {
    setCreating(false);
    setEditing(null);
    setError("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (editing) updateMut.mutate({ id: editing.id, name });
    else createMut.mutate({ name });
  }

  const columns: Column<Category>[] = [
    { key: "name", header: "Nama Kategori", render: (c) => c.name },
    { key: "count", header: "Jumlah Produk", render: (c) => c._count?.products ?? 0 },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "cell-right",
            render: (c: Category) => (
              <div className="row-actions">
                <Button
                  size="icon"
                  variant="accent-ghost"
                  aria-label={`Ubah ${c.name}`}
                  title="Ubah"
                  onClick={() => openEdit(c)}
                >
                  <PencilSimple size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="danger-ghost"
                  aria-label={`Hapus ${c.name}`}
                  title="Hapus"
                  onClick={() => setDeleting(c)}
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
    <div className="categories-page">
      <PageHeader
        title="Kategori"
        description="Kelompok produk gudang"
        actions={canManage && <Button onClick={openCreate}>+ Tambah Kategori</Button>}
      />

      <div className="filter-bar">
        <Input
          aria-label="Cari kategori"
          placeholder="Cari kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-bar__search"
        />
      </div>

      <ErrorText>{error && !creating && !editing ? error : ""}</ErrorText>

      <DataTable columns={columns} rows={data ?? []} loading={isLoading} rowKey={(c) => String(c.id)} />

      <Modal
        open={creating || Boolean(editing)}
        title={editing ? "Ubah Kategori" : "Tambah Kategori"}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button form="category-form" type="submit" loading={createMut.isPending || updateMut.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={submit} className="form">
          <ErrorText>{error}</ErrorText>
          <Field label="Nama" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        title="Hapus Kategori"
        message={`Yakin menghapus "${deleting?.name}"?`}
        loading={deleteMut.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
      />
    </div>
  );
}
