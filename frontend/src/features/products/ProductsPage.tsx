import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { categoryApi, productApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useCanManage } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Badge, PageHeader } from "@/components/ui/Card";
import type { Product } from "@/types";
import "./ProductsPage.css";

interface FormState {
  sku: string;
  name: string;
  description: string;
  unit: string;
  minStock: string;
  categoryId: string;
}

const emptyForm: FormState = { sku: "", name: "", description: "", unit: "pack", minStock: "0", categoryId: "" };

export function ProductsPage() {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [error, setError] = useState("");

  const filters = { page, limit: 20, q: search || undefined, categoryId: categoryId || undefined, lowStock };
  const { data, isLoading } = useQuery({
    queryKey: qk.products.list(filters),
    queryFn: () => productApi.list(filters),
  });
  const categories = useQuery({
    queryKey: qk.categories.list({}),
    queryFn: () => categoryApi.list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.products.all });
    qc.invalidateQueries({ queryKey: qk.dashboard });
  };

  const createMut = useMutation({
    mutationFn: (body: unknown) => productApi.create(body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => productApi.update(id, body),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => productApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function openCreate() {
    setForm({ ...emptyForm, categoryId: categories.data?.[0] ? String(categories.data[0].id) : "" });
    setError("");
    setCreating(true);
  }
  function openEdit(p: Product) {
    setForm({
      sku: p.sku,
      name: p.name,
      description: p.description ?? "",
      unit: p.unit,
      minStock: String(p.minStock),
      categoryId: String(p.categoryId),
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
      sku: form.sku,
      name: form.name,
      description: form.description || null,
      unit: form.unit,
      minStock: Number(form.minStock),
      categoryId: Number(form.categoryId),
    };
    if (editing) updateMut.mutate({ id: editing.id, body });
    else createMut.mutate(body);
  }

  function renderActions(p: Product) {
    return (
      <div className="row-actions">
        <Button
          size="icon"
          variant="secondary"
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

  const columns: Column<Product>[] = [
    { key: "sku", header: "SKU", render: (p) => <span className="mono-xs">{p.sku}</span> },
    { key: "name", header: "Nama", render: (p) => p.name },
    { key: "category", header: "Kategori", render: (p) => p.category.name },
    { key: "unit", header: "Satuan", render: (p) => p.unit },
    {
      key: "stock",
      header: "Stok",
      render: (p) => (
        <span className={p.stock <= p.minStock ? "products-page__stock--low" : "products-page__stock"}>
          {p.stock}
          {p.stock <= p.minStock && <Badge tone="red">low</Badge>}
        </span>
      ),
    },
    { key: "minStock", header: "Min", render: (p) => p.minStock },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "cell-right",
            render: (p: Product) => renderActions(p),
          },
        ]
      : []),
  ];

  return (
    <div className="products-page">
      <PageHeader
        title="Produk"
        description="Master barang gudang"
        actions={canManage && <Button onClick={openCreate}>+ Tambah Produk</Button>}
      />

      <div className="filter-bar">
        <Input
          aria-label="Cari produk"
          placeholder="Cari nama / SKU..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="filter-bar__search"
        />
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="filter-bar__select"
        >
          <option value="">Semua kategori</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="filter-bar__check">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => {
              setLowStock(e.target.checked);
              setPage(1);
            }}
          />
          Hanya stok kritis
        </label>
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
              <span className="mono-xs">{p.sku}</span>
              <Badge tone="slate">{p.category.name}</Badge>
            </div>
            <div className="data-table__card-meta">
              <span>
                Stok{" "}
                <span
                  className={p.stock <= p.minStock ? "products-page__stock--low" : "products-page__stock"}
                >
                  {p.stock}
                </span>{" "}
                {p.unit}
              </span>
              <span>Min {p.minStock}</span>
              {p.stock <= p.minStock && <Badge tone="red">low</Badge>}
            </div>
          </div>
        )}
      />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal
        open={creating || Boolean(editing)}
        title={editing ? "Ubah Produk" : "Tambah Produk"}
        onClose={closeForm}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button form="product-form" type="submit" loading={createMut.isPending || updateMut.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={submit} className="form form--grid">
          <ErrorText>{error}</ErrorText>
          <Field label="SKU" required>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          </Field>
          <Field label="Nama" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Kategori" required>
            <Select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              <option value="">Pilih kategori</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Satuan" required>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
          </Field>
          <Field label="Min. Stok" hint="Ambang peringatan stok kritis">
            <Input
              type="number"
              min={0}
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
          </Field>
          <div className="form__full">
            <Field label="Deskripsi">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          {editing && (
            <p className="products-page__note">Stok hanya berubah melalui transaksi masuk/keluar.</p>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        title="Hapus Produk"
        message={`Yakin menghapus "${deleting?.name}"?`}
        loading={deleteMut.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
      />
    </div>
  );
}
