import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwise, PencilSimple, Prohibit, UploadSimple } from "@phosphor-icons/react";
import { knowledgeApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { qk } from "@/hooks/queryKeys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Badge, PageHeader, StatCard } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import { DOC_TYPES, type DocType, type IngestJobState, type KnowledgeChunkRow, type KnowledgeDocument } from "@/types";
import "./KnowledgePage.css";

const docTypeLabel: Record<string, string> = {
  sop: "SOP",
  faq: "FAQ",
  kebijakan: "Kebijakan",
  runbook: "Runbook",
  "panduan-produk": "Panduan Produk",
  onboarding: "Onboarding",
  "catatan-partner": "Catatan Partner",
  "kontrak": "Kontrak",
};

type Tab = "documents" | "index" | "ingest";

const statusTone: Record<IngestJobState["status"], "slate" | "blue" | "green" | "red"> = {
  idle: "slate",
  running: "blue",
  done: "green",
  error: "red",
};

interface FormState {
  title: string;
  docType: DocType;
  content: string;
  isActive: boolean;
}

const emptyForm: FormState = { title: "", docType: "sop", content: "", isActive: true };

export function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("documents");

  return (
    <div className="knowledge-page">
      <PageHeader
        title="Knowledge Base"
        description="Kelola dokumen SOP/FAQ/kebijakan & re-ingest ke index RAG"
      />

      <div className="knowledge-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "documents"}
          className={["knowledge-tab", tab === "documents" && "is-active"].filter(Boolean).join(" ")}
          onClick={() => setTab("documents")}
        >
          Dokumen
        </button>
        <button
          role="tab"
          aria-selected={tab === "index"}
          className={["knowledge-tab", tab === "index" && "is-active"].filter(Boolean).join(" ")}
          onClick={() => setTab("index")}
        >
          Index
        </button>
        <button
          role="tab"
          aria-selected={tab === "ingest"}
          className={["knowledge-tab", tab === "ingest" && "is-active"].filter(Boolean).join(" ")}
          onClick={() => setTab("ingest")}
        >
          Ingest
        </button>
      </div>

      {tab === "documents" && <DocumentsTab />}
      {tab === "index" && <IndexTab />}
      {tab === "ingest" && <IngestTab />}
    </div>
  );
}

function DocumentsTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [docType, setDocType] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<KnowledgeDocument | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filters = {
    page,
    limit: 20,
    q: debouncedSearch || undefined,
    docType: docType || undefined,
  };
  const { data, isLoading } = useQuery({
    queryKey: qk.knowledge.documents(filters),
    queryFn: () => knowledgeApi.listDocuments(filters),
  });

  const { data: detail } = useQuery({
    queryKey: qk.knowledge.detail(editingId ?? ""),
    queryFn: () => knowledgeApi.getDocument(editingId as string),
    enabled: Boolean(editingId),
  });

  useEffect(() => {
    if (editingId && detail) {
      setForm({
        title: detail.title,
        docType: detail.docType,
        content: detail.content,
        isActive: detail.isActive,
      });
    }
  }, [editingId, detail]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.knowledge.all });
  };

  const createMut = useMutation({
    mutationFn: (body: FormData) => knowledgeApi.createDocument(body),
    onSuccess: () => {
      invalidate();
      closeForm();
      setNotice("Dokumen disimpan — re-ingest dijadwalkan otomatis.");
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => knowledgeApi.updateDocument(id, body),
    onSuccess: () => {
      invalidate();
      closeForm();
      setNotice("Dokumen diperbarui — re-ingest dijadwalkan otomatis.");
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => knowledgeApi.removeDocument(id),
    onSuccess: () => {
      invalidate();
      setDeactivating(null);
      setNotice("Dokumen dinonaktifkan — chunk-nya dibersihkan dari index.");
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const reingestMut = useMutation({
    mutationFn: (documentId: string) => knowledgeApi.ingest({ documentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.knowledge.ingest }),
    onError: (e) => setError(errorMessage(e)),
  });

  function openCreate() {
    setForm(emptyForm);
    setFile(null);
    setError("");
    setNotice("");
    setCreating(true);
  }
  function openEdit(doc: KnowledgeDocument) {
    setForm(emptyForm);
    setError("");
    setNotice("");
    setEditingId(doc.id);
  }
  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setFile(null);
    setError("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (editingId) {
      updateMut.mutate({
        id: editingId,
        body: {
          title: form.title,
          docType: form.docType,
          content: form.content,
          isActive: form.isActive,
        },
      });
      return;
    }
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("docType", form.docType);
    if (file) fd.append("file", file);
    else fd.append("content", form.content);
    createMut.mutate(fd);
  }

  function renderActions(doc: KnowledgeDocument) {
    return (
      <div className="row-actions">
        <Button
          size="icon"
          variant="accent-ghost"
          aria-label={`Re-ingest ${doc.title}`}
          title="Re-ingest"
          disabled={reingestMut.isPending}
          onClick={() => reingestMut.mutate(doc.id)}
        >
          <ArrowsClockwise size={16} />
        </Button>
        <Button
          size="icon"
          variant="accent-ghost"
          aria-label={`Ubah ${doc.title}`}
          title="Ubah"
          onClick={() => openEdit(doc)}
        >
          <PencilSimple size={16} />
        </Button>
        {doc.isActive && (
          <Button
            size="icon"
            variant="danger-ghost"
            aria-label={`Nonaktifkan ${doc.title}`}
            title="Nonaktifkan"
            onClick={() => setDeactivating(doc)}
          >
            <Prohibit size={16} />
          </Button>
        )}
      </div>
    );
  }

  const columns: Column<KnowledgeDocument>[] = [
    { key: "title", header: "Judul", render: (d) => d.title },
    { key: "file", header: "File", render: (d) => <span className="mono-xs">{d.filename}</span> },
    {
      key: "type",
      header: "Jenis",
      render: (d) => <Badge tone="indigo">{docTypeLabel[d.docType] ?? d.docType}</Badge>,
    },
    { key: "version", header: "Versi", render: (d) => `v${d.version}` },
    { key: "chunks", header: "Chunk", render: (d) => d._count?.chunks ?? 0 },
    {
      key: "status",
      header: "Status",
      render: (d) => (
        <Badge tone={d.isActive ? "green" : "slate"}>{d.isActive ? "Aktif" : "Nonaktif"}</Badge>
      ),
    },
    { key: "updated", header: "Diperbarui", render: (d) => formatDateTime(d.updatedAt) },
    { key: "actions", header: "", className: "cell-right", render: renderActions },
  ];

  return (
    <>
      <div className="filter-bar">
        <Input
          aria-label="Cari dokumen"
          placeholder="Cari judul / file..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="filter-bar__search"
        />
        <Select
          aria-label="Filter jenis"
          value={docType}
          onChange={(e) => {
            setDocType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua jenis</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {docTypeLabel[t]}
            </option>
          ))}
        </Select>
        <Button onClick={openCreate}>
          <UploadSimple size={16} /> Unggah Dokumen
        </Button>
      </div>

      <ErrorText>{error && !creating && !editingId ? error : ""}</ErrorText>

      {notice && <p className="knowledge-ingest-hint">{notice}</p>}

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        rowKey={(d) => d.id}
        empty="Belum ada dokumen knowledge"
        mobileCard={(d) => (
          <div>
            <div className="data-table__card-head">
              <span className="data-table__card-title">{d.title}</span>
              {renderActions(d)}
            </div>
            <div className="data-table__card-sub">
              <Badge tone="indigo">{docTypeLabel[d.docType] ?? d.docType}</Badge>
              <Badge tone={d.isActive ? "green" : "slate"}>{d.isActive ? "Aktif" : "Nonaktif"}</Badge>
            </div>
            <div className="data-table__card-meta">
              <span>{d.filename}</span>
              <span>
                v{d.version} · {d._count?.chunks ?? 0} chunk
              </span>
            </div>
          </div>
        )}
      />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal
        open={creating || Boolean(editingId)}
        title={editingId ? "Ubah Dokumen" : "Unggah Dokumen"}
        onClose={closeForm}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Batal
            </Button>
            <Button
              form="knowledge-form"
              type="submit"
              loading={createMut.isPending || updateMut.isPending}
            >
              Simpan
            </Button>
          </>
        }
      >
        <form id="knowledge-form" onSubmit={submit} className="form">
          <ErrorText>{error}</ErrorText>
          <Field label="Judul" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Jenis" required>
            <Select
              value={form.docType}
              onChange={(e) => setForm({ ...form, docType: e.target.value as DocType })}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {docTypeLabel[t]}
                </option>
              ))}
            </Select>
          </Field>
          {editingId ? (
            <>
              <Field label="Isi Dokumen" required>
                <Textarea
                  rows={12}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  required
                />
              </Field>
              <label className="knowledge-page__check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Aktif
              </label>
            </>
          ) : (
            <>
              <Field label="Berkas (.md / .txt)" hint="Opsional — atau tulis isi di bawah">
                <input
                  type="file"
                  accept=".md,.txt,text/markdown,text/plain"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Field label="Isi Dokumen" hint={file ? "Diabaikan karena berkas dipilih" : undefined}>
                <Textarea
                  rows={10}
                  value={form.content}
                  disabled={Boolean(file)}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </Field>
            </>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deactivating)}
        title="Nonaktifkan Dokumen"
        message={`Nonaktifkan "${deactivating?.title}"? Dokumen akan dinonaktifkan dan chunk-nya dihapus dari index RAG.`}
        loading={removeMut.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && removeMut.mutate(deactivating.id)}
      />
    </>
  );
}

function IndexTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [docType, setDocType] = useState("");

  const { data: stats } = useQuery({ queryKey: qk.knowledge.stats, queryFn: knowledgeApi.stats });

  const filters = { page, limit: 20, q: debouncedSearch || undefined, docType: docType || undefined };
  const { data, isLoading } = useQuery({
    queryKey: qk.knowledge.chunks(filters),
    queryFn: () => knowledgeApi.chunks(filters),
  });

  const columns: Column<KnowledgeChunkRow>[] = [
    {
      key: "source",
      header: "Sumber",
      render: (r) => <span className="mono-xs">{r.title ?? r.source}</span>,
    },
    {
      key: "type",
      header: "Jenis",
      render: (r) => (r.docType ? <Badge tone="indigo">{docTypeLabel[r.docType] ?? r.docType}</Badge> : "-"),
    },
    {
      key: "content",
      header: "Isi",
      render: (r) => <span className="knowledge-chunk-preview">{r.content}</span>,
    },
    { key: "created", header: "Diindeks", render: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <>
      <div className="knowledge-stats">
        <StatCard label="Dokumen terindeks" value={stats?.totalDocuments ?? 0} tone="indigo" />
        <StatCard label="Total chunk" value={stats?.totalChunks ?? 0} tone="green" />
        <StatCard label="Ingest terakhir" value={formatDateTime(stats?.lastIngest)} tone="amber" />
      </div>

      {stats && stats.byType.length > 0 && (
        <div className="knowledge-typestats">
          {stats.byType.map((t) => (
            <span key={t.docType ?? "lainnya"} className="knowledge-typestat">
              <Badge tone="blue">{t.docType ? (docTypeLabel[t.docType] ?? t.docType) : "lainnya"}</Badge>
              {t.documents} dok · {t.chunks} chunk
            </span>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <Input
          aria-label="Cari isi chunk"
          placeholder="Cari isi chunk..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="filter-bar__search"
        />
        <Select
          aria-label="Filter jenis"
          value={docType}
          onChange={(e) => {
            setDocType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua jenis</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {docTypeLabel[t]}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        empty="Belum ada chunk terindeks"
      />
      <Pagination meta={data?.meta} onPage={setPage} />
    </>
  );
}

function IngestTab() {
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const { data: status } = useQuery({
    queryKey: qk.knowledge.ingest,
    queryFn: knowledgeApi.ingestStatus,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });

  const ingestMut = useMutation({
    mutationFn: () => knowledgeApi.ingest({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.knowledge.ingest }),
    onError: (e) => setError(errorMessage(e)),
  });

  useEffect(() => {
    if (status?.status === "done") {
      qc.invalidateQueries({ queryKey: qk.knowledge.stats });
      qc.invalidateQueries({ queryKey: ["knowledge", "chunks"] });
      qc.invalidateQueries({ queryKey: ["knowledge", "documents"] });
    }
  }, [status?.status, qc]);

  const results = status?.results ?? [];

  return (
    <>
      <div className="knowledge-ingest-bar">
        <Button
          onClick={() => {
            setError("");
            ingestMut.mutate();
          }}
          loading={ingestMut.isPending || status?.status === "running"}
        >
          <ArrowsClockwise size={16} /> Re-ingest Semua Dokumen
        </Button>
        <span className="knowledge-ingest-status">
          Status:{" "}
          <Badge tone={statusTone[status?.status ?? "idle"]}>{status?.status ?? "idle"}</Badge>
          {status?.startedAt && <span className="knowledge-ingest-time">Mulai {formatDateTime(status.startedAt)}</span>}
          {status?.finishedAt && (
            <span className="knowledge-ingest-time">Selesai {formatDateTime(status.finishedAt)}</span>
          )}
        </span>
      </div>

      <ErrorText>{error || (status?.status === "error" ? status.error : "")}</ErrorText>

      <p className="knowledge-ingest-hint">
        Re-ingest membaca dokumen aktif, memotong &amp; meng-embed ulang yang berubah (content hash),
        lalu memperbarui index RAG yang dipakai asisten di Telegram.
      </p>

      {results.length > 0 && (
        <ul className="knowledge-ingest-results">
          {results.map((r) => (
            <li key={r.documentId}>
              <span className="mono-xs">{r.source}</span>{" "}
              {r.skipped ? <Badge tone="slate">dilewati</Badge> : <Badge tone="green">{r.chunks} chunk</Badge>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
