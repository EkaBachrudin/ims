/** DTO & port gateway ke Backend API (satu-satunya jalur data bisnis). */

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MatchedNames {
  products?: string[];
  warehouses?: string[];
  partners?: string[];
}

export interface ListResult<T> {
  data: T[];
  meta?: Meta;
  unmatched?: string[];
  matched?: MatchedNames;
}

export interface StockRow {
  name: string;
  sku: string;
  stock: number;
  unit: string;
}

export interface StockLookup {
  status: "ok" | "ambiguous" | "none";
  product: StockRow | null;
  candidates: StockRow[];
  suggestions: { name: string; sku: string }[];
}

export interface ShipmentRecap {
  date: string;
  shipments: {
    partner: string;
    product: string;
    sku: string;
    qty: number;
    unit: string;
    warehouse: string;
    notes: string | null;
  }[];
}

export interface ProductRow {
  sku: string;
  name: string;
  unit: string;
  stock: number;
  category: string | null;
  lowStock: boolean;
}

export interface CategoryRow {
  name: string;
  productCount: number;
}

export interface PartnerRow {
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
}

export interface WarehouseRow {
  code: string;
  name: string;
  isActive: boolean;
}

export interface InventoryRow {
  product: string;
  sku: string;
  unit: string;
  warehouse: string;
  warehouseCode: string;
  quantity: number;
}

export interface TransactionRow {
  date: string;
  type: string;
  product: string;
  sku: string;
  quantity: number;
  unit: string;
  warehouse: string;
  partner: string | null;
  poNumber: string | null;
}

export interface PoListRow {
  poNumber: string;
  status: string;
  partner: string;
  targetDate: string | null;
  createdAt: string;
  items: { product: string; quantity: number; unit: string }[];
}

export interface PoDetail {
  poNumber: string;
  status: string;
  partner: string;
  warehouse: string | null;
  targetDate: string | null;
  items: { product: string; ordered: number; received: number; remaining: number; unit: string }[];
}

export interface DnRow {
  dnNumber: string;
  status: string;
  shipDate: string;
  poNumber: string | null;
  partner: string;
  warehouse: string;
  items: { product: string; quantity: number; unit: string }[];
}

export interface LowStockRow {
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  unit: string;
}

export interface Dashboard {
  totalProducts: number;
  activePOs: number;
  todayInbound: number;
  todayOutbound: number;
  lowStockCount: number;
  recentTransactions: {
    type: string;
    quantity: number;
    createdAt: string;
    product: { name: string; unit: string };
    warehouse: { name: string };
  }[];
}

export interface DraftItem {
  quantity: number;
  product: { name: string; unit: string };
}

export interface PoDraftInput {
  partnerName: string;
  items: { productName: string; qty: number }[];
  targetDate?: string | null;
}

export interface PoDraftResult {
  poNumber: string;
  partner: { name: string };
  targetDate?: string | null;
  webUrl?: string;
  items?: DraftItem[];
}

export interface DnDraftInput {
  partnerName: string;
  items: { productName: string; qty: number }[];
  shipDate?: string | null;
  warehouseCode?: string | null;
}

export interface DnDraftResult {
  dnNumber: string;
  partner: { name: string };
  shipDate?: string | null;
  items?: DraftItem[];
}

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface AiLogInput {
  platform: "TELEGRAM" | "WHATSAPP";
  chatId: string;
  messageIn: string;
  messageOut?: string | null;
  intent?: string | null;
  toolName?: string | null;
  toolPayload?: unknown;
  toolResult?: unknown;
  latencyMs?: number;
}

export interface ProductListFilter {
  q?: string | null;
  page?: number;
  limit?: number;
}

export interface PartnerListFilter {
  q?: string | null;
  type?: string | null;
}

export interface InventoryFilter {
  productName?: string | null;
  warehouseCode?: string | null;
}

export interface TransactionFilter {
  type?: string | null;
  from?: string | null;
  to?: string | null;
  productName?: string | null;
  warehouseCode?: string | null;
  partnerName?: string | null;
  limit?: number;
}

export interface PoListFilter {
  statuses?: string | null;
  partnerName?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface DnListFilter {
  status?: string | null;
  partnerName?: string | null;
  from?: string | null;
  to?: string | null;
}

/** Kontrak data bisnis ke Backend API. */
export interface BackendGateway {
  resolveChatUser(chatId: string): Promise<ChatUser | null>;
  logConversation(input: AiLogInput): Promise<void>;

  getStockByProductName(productName: string): Promise<StockLookup | null>;
  getShipmentRecap(date: string): Promise<ShipmentRecap>;
  listProducts(filter: ProductListFilter): Promise<ListResult<ProductRow>>;
  listCategories(): Promise<CategoryRow[]>;
  listPartners(filter: PartnerListFilter): Promise<ListResult<PartnerRow>>;
  listWarehouses(): Promise<WarehouseRow[]>;
  listInventory(filter: InventoryFilter): Promise<ListResult<InventoryRow>>;
  listTransactions(filter: TransactionFilter): Promise<ListResult<TransactionRow>>;
  listPurchaseOrders(filter: PoListFilter): Promise<ListResult<PoListRow>>;
  getPurchaseOrder(poNumber: string): Promise<PoDetail | null>;
  listDeliveryNotes(filter: DnListFilter): Promise<ListResult<DnRow>>;
  getLowStock(): Promise<LowStockRow[]>;
  getDashboard(): Promise<Dashboard>;

  createPoDraft(input: PoDraftInput & { chatId: string; source: "AI_CHAT" }): Promise<PoDraftResult>;
  createDnDraft(input: DnDraftInput & { chatId: string }): Promise<DnDraftResult>;
}
