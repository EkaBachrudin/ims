import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/api/endpoints";
import { qk } from "@/hooks/queryKeys";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Badge, PageHeader } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/types";
import "./AuditLogsPage.css";

const actionTone: Record<string, "green" | "blue" | "red" | "yellow" | "slate"> = {
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  VOID: "yellow",
  LOGIN: "slate",
};

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  const filters = { page, limit: 20, entity: entity || undefined, action: action || undefined };
  const { data, isLoading } = useQuery({ queryKey: qk.auditLogs.list(filters), queryFn: () => auditApi.list(filters) });

  const columns: Column<AuditLog>[] = [
    { key: "time", header: "Waktu", render: (r) => formatDateTime(r.createdAt) },
    { key: "actor", header: "Pelaku", render: (r) => r.actor?.name ?? "sistem" },
    {
      key: "action",
      header: "Aksi",
      render: (r) => <Badge tone={actionTone[r.action] ?? "slate"}>{r.action}</Badge>,
    },
    { key: "entity", header: "Entitas", render: (r) => r.entity },
    {
      key: "entityId",
      header: "ID",
      render: (r) => <span className="mono-xs">{r.entityId?.slice(0, 8) ?? "-"}</span>,
    },
    { key: "ip", header: "IP", render: (r) => r.ipAddress ?? "-" },
    {
      key: "after",
      header: "Detail",
      render: (r) => (
        <details className="audit-page__details">
          <summary className="audit-page__summary">lihat</summary>
          <pre className="audit-page__pre">
            {JSON.stringify(r.after ?? r.before ?? {}, null, 1)}
          </pre>
        </details>
      ),
    },
  ];

  return (
    <div className="audit-page">
      <PageHeader title="Audit Log" description="Jejak perubahan data penting" />

      <div className="filter-bar">
        <Input
          aria-label="Filter entitas"
          placeholder="Filter entitas (mis. Product)"
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
          className="audit-page__filter-entity"
        />
        <Combobox
          className="audit-page__filter-action"
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          placeholder="Semua aksi"
          options={[
            { value: "CREATE", label: "CREATE" },
            { value: "UPDATE", label: "UPDATE" },
            { value: "DELETE", label: "DELETE" },
            { value: "VOID", label: "VOID" },
            { value: "LOGIN", label: "LOGIN" },
          ]}
        />
      </div>

      <DataTable columns={columns} rows={data?.data ?? []} loading={isLoading} rowKey={(r) => r.id} />
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}
