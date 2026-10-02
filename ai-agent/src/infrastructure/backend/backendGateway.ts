import axios from "axios";
import { env } from "../../config/env";
import type {
  AiLogInput,
  BackendGateway,
  CategoryRow,
  ChatUser,
  Dashboard,
  DnListFilter,
  DnRow,
  InventoryFilter,
  InventoryRow,
  ListResult,
  LowStockRow,
  PartnerListFilter,
  PartnerRow,
  PoDetail,
  PoListFilter,
  PoListRow,
  ProductListFilter,
  ProductRow,
  ShipmentRecap,
  StockLookup,
  TransactionFilter,
  TransactionRow,
  WarehouseRow,
} from "../../application/ports/backendGateway";

/** HTTP client ke Backend API (satu-satunya jalur data bisnis). */
export const backend = axios.create({
  baseURL: env.BACKEND_API_URL,
  timeout: 15_000,
  headers: { "x-internal-key": env.INTERNAL_API_KEY },
});

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

async function fetchList<T>(
  path: string,
  params: Record<string, unknown>,
): Promise<ListResult<T>> {
  const { data } = await backend.get(path, { params: cleanParams(params) });
  return {
    data: (data.data ?? []) as T[],
    meta: data.meta,
    unmatched: data.unmatched,
    matched: data.matched,
  };
}

/** Validasi chatId terdaftar sebagai user aktif. */
export async function resolveChatUser(chatId: string): Promise<ChatUser | null> {
  try {
    const { data } = await backend.get(`/internal/chat-user/${encodeURIComponent(chatId)}`);
    return data.data as ChatUser;
  } catch {
    return null;
  }
}

export async function logConversation(input: AiLogInput): Promise<void> {
  try {
    await backend.post("/internal/ai-log", input);
  } catch {
    // logging tidak boleh menggagalkan balasan ke user
  }
}

export const backendGateway: BackendGateway = {
  resolveChatUser,
  logConversation,

  async getStockByProductName(productName) {
    const { data } = await backend.get(`/reports/stock/${encodeURIComponent(productName)}`);
    return (data.data ?? null) as StockLookup | null;
  },

  async getShipmentRecap(date) {
    const { data } = await backend.get("/reports/shipments", { params: { date } });
    return data.data as ShipmentRecap;
  },

  listProducts(filter: ProductListFilter) {
    return fetchList<ProductRow>("/reports/products", { q: filter.q });
  },

  async listCategories() {
    const { data } = await backend.get("/reports/categories");
    return (data.data ?? []) as CategoryRow[];
  },

  listPartners(filter: PartnerListFilter) {
    return fetchList<PartnerRow>("/reports/partners", { q: filter.q, type: filter.type });
  },

  async listWarehouses() {
    const { data } = await backend.get("/reports/warehouses");
    return (data.data ?? []) as WarehouseRow[];
  },

  listInventory(filter: InventoryFilter) {
    return fetchList<InventoryRow>("/reports/inventory", {
      productName: filter.productName,
      warehouseCode: filter.warehouseCode,
    });
  },

  listTransactions(filter: TransactionFilter) {
    return fetchList<TransactionRow>("/reports/transactions", {
      type: filter.type,
      from: filter.from,
      to: filter.to,
      productName: filter.productName,
      warehouseCode: filter.warehouseCode,
      partnerName: filter.partnerName,
    });
  },

  listPurchaseOrders(filter: PoListFilter) {
    return fetchList<PoListRow>("/reports/purchase-orders", {
      statuses: filter.statuses,
      partnerName: filter.partnerName,
      from: filter.from,
      to: filter.to,
    });
  },

  async getPurchaseOrder(poNumber) {
    const { data } = await backend.get(
      `/reports/purchase-orders/${encodeURIComponent(poNumber)}`,
    );
    return (data.data ?? null) as PoDetail | null;
  },

  listDeliveryNotes(filter: DnListFilter) {
    return fetchList<DnRow>("/reports/delivery-notes", {
      status: filter.status,
      partnerName: filter.partnerName,
      from: filter.from,
      to: filter.to,
    });
  },

  async getLowStock() {
    const { data } = await backend.get("/reports/low-stock");
    return (data.data ?? []) as LowStockRow[];
  },

  async getDashboard() {
    const { data } = await backend.get("/reports/dashboard");
    return data.data as Dashboard;
  },

  async createPoDraft(input) {
    const { data } = await backend.post("/po/draft", {
      partnerName: input.partnerName,
      items: input.items,
      targetDate: input.targetDate ?? undefined,
      source: input.source,
      chatId: input.chatId,
    });
    return data.data;
  },

  async createDnDraft(input) {
    const { data } = await backend.post("/delivery-notes/draft", {
      partnerName: input.partnerName,
      items: input.items,
      shipDate: input.shipDate ?? undefined,
      warehouseCode: input.warehouseCode ?? undefined,
      chatId: input.chatId,
    });
    return data.data;
  },
};
