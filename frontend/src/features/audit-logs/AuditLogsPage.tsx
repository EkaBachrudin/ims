import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/api/endpoints";
import { qk } from "@/hooks/queryKeys";
import { Input, Select } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/Table";
import { Badge, PageHeader } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/types";

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
      render: (r) => <span className="font-mono text-xs">{r.entityId?.slice(0, 8) ?? "-"}</span>,
    },
    { key: "ip", header: "IP", render: (r) => r.ipAddress ?? "-" },
    {
      key: "after",
      header: "Detail",
      render: (r) => (
        <details className="max-w-xs">
          <summary className="cursor-pointer text-xs text-accent">lihat</summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted p-2 font-mono text-[10px] leading-tight">
            {JSON.stringify(r.after ?? r.before ?? {}, null, 1)}
          </pre>
        </details>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit Log" description="Jejak perubahan data penting" />

      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          aria-label="Filter entitas"
          placeholder="Filter entitas (mis. Product)"
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
          className="max-w-[220px]"
        />
        <Select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        >
          <option value="">Semua aksi</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="VOID">VOID</option>
          <option value="LOGIN">LOGIN</option>
        </Select>
      </div>

      <DataTable columns={columns} rows={data?.data ?? []} loading={isLoading} rowKey={(r) => r.id} />
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}
