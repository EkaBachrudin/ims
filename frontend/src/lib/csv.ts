type CsvValue = string | number | null | undefined;

function escapeCell(value: CsvValue): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Unduh data sebagai file CSV di sisi klien. */
export function downloadCsv(filename: string, header: string[], rows: CsvValue[][]): void {
  const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
