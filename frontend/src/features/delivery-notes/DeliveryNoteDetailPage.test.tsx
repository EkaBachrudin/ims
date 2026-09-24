import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/endpoints", () => ({
  dnApi: { get: vi.fn(), updateStatus: vi.fn(), update: vi.fn() },
  transactionApi: { list: vi.fn() },
  partnerApi: { list: vi.fn() },
  productApi: { list: vi.fn() },
  warehouseApi: { list: vi.fn() },
}));
vi.mock("@/lib/roles", () => ({ useCanManage: vi.fn(() => true) }));

import { dnApi, transactionApi } from "@/api/endpoints";
import { useCanManage } from "@/lib/roles";
import { DeliveryNoteDetailPage } from "./DeliveryNoteDetailPage";

const mockedGet = vi.mocked(dnApi.get);
const mockedTxn = vi.mocked(transactionApi.list);

const dn = {
  id: "dn-1",
  dnNumber: "DN-202609-001",
  status: "DRAFT",
  shipDate: "2026-09-25T00:00:00.000Z",
  notes: "catatan uji",
  po: null,
  partner: { id: "p1", name: "Agen Bahari", type: "CUSTOMER" },
  warehouse: { id: "w1", code: "GDG", name: "Gudang Utama" },
  createdBy: { id: "u1", name: "Admin" },
  items: [
    { id: "i1", quantity: 10, product: { id: "pr1", sku: "DMS-01", name: "Dimsum", unit: "pack" } },
  ],
  createdAt: "2026-09-23T00:00:00.000Z",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/delivery-notes/dn-1"]}>
        <Routes>
          <Route path="/delivery-notes/:id" element={<DeliveryNoteDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGet.mockResolvedValue(dn as never);
  mockedTxn.mockResolvedValue({ data: [] } as never);
  vi.mocked(useCanManage).mockReturnValue(true);
});

describe("DeliveryNoteDetailPage", () => {
  it("menampilkan detail DN beserta item", async () => {
    renderPage();
    expect((await screen.findAllByText("DN-202609-001")).length).toBeGreaterThan(0);
    expect(screen.getByText("Agen Bahari")).toBeInTheDocument();
    expect(screen.getAllByText("Dimsum").length).toBeGreaterThan(0);
    expect(screen.getByText("catatan uji")).toBeInTheDocument();
  });

  it("menampilkan tombol Edit untuk DRAFT saat boleh kelola", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("menonaktifkan aksi Edit saat tidak boleh kelola", async () => {
    vi.mocked(useCanManage).mockReturnValue(false);
    renderPage();
    await screen.findAllByText("DN-202609-001");
    expect(screen.getByRole("button", { name: /edit/i })).toBeDisabled();
  });
});
