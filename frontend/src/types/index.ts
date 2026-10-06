export type Role = "SUPER_ADMIN" | "ADMIN" | "OWNER";

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Meta;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  telegramId: string | null;
  whatsappNumber?: string | null;
}

export interface User extends AuthUser {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  _count?: { products: number };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  stock: number;
  minStock: number;
  categoryId: number;
  category: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export type PartnerType = "SUPPLIER" | "CUSTOMER";

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

export type TransactionType = "IN" | "OUT" | "ADJUSTMENT";

export interface StockTransaction {
  id: string;
  type: TransactionType;
  quantity: number;
  referenceNo: string | null;
  notes: string | null;
  productId: string;
  warehouseId: string;
  partnerId: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string; unit: string };
  warehouse: { id: string; code: string; name: string };
  partner: { id: string; name: string } | null;
  purchaseOrder?: { id: string; poNumber: string } | null;
  deliveryNote?: { id: string; dnNumber: string } | null;
  createdBy: { id: string; name: string };
}

export type PoStatus = "DRAFT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
export type PoSource = "WEB" | "AI_CHAT";

export interface PurchaseOrderItem {
  id: string;
  quantity: number;
  unitPrice: string | number | null;
  productId: string;
  product: { id: string; sku: string; name: string; unit: string };
  receivedQuantity?: number;
  remainingQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: PoStatus;
  source: PoSource;
  targetDate: string | null;
  notes: string | null;
  partner: { id: string; name: string; type: PartnerType };
  warehouse: { id: string; code: string; name: string } | null;
  createdBy: { id: string; name: string; role: Role };
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type DnStatus = "DRAFT" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export interface DeliveryNote {
  id: string;
  dnNumber: string;
  status: DnStatus;
  shipDate: string;
  notes: string | null;
  po: { id: string; poNumber: string; status: PoStatus } | null;
  partner: { id: string; name: string; type: PartnerType };
  warehouse: { id: string; code: string; name: string };
  createdBy: { id: string; name: string };
  items: { id: string; quantity: number; product: { id: string; sku: string; name: string; unit: string } }[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actor: { id: string; name: string } | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalProducts: number;
  activePOs: number;
  todayInbound: number;
  todayOutbound: number;
  lowStockCount: number;
  recentTransactions: StockTransaction[];
}

export interface StockReportRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  category: { id: number; name: string };
  lowStock: boolean;
  inventories: {
    id: string;
    quantity: number;
    warehouse: { id: string; code: string; name: string };
  }[];
}

export const DOC_TYPES = [
  "sop",
  "faq",
  "kebijakan",
  "runbook",
  "panduan-produk",
  "onboarding",
  "catatan-partner",
  "kontrak",
] as const;

export type DocType = (typeof DOC_TYPES)[number];

export interface KnowledgeDocument {
  id: string;
  filename: string;
  title: string;
  docType: DocType;
  version: number;
  isActive: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  uploadedBy: { id: string; name: string } | null;
  _count?: { chunks: number };
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  content: string;
}

export interface KnowledgeStats {
  totalChunks: number;
  totalDocuments: number;
  lastIngest: string | null;
  byType: { docType: string | null; documents: number; chunks: number }[];
}

export interface KnowledgeChunkRow {
  id: string;
  source: string;
  title: string | null;
  docType: string | null;
  documentId: string | null;
  content: string;
  createdAt: string;
}

export interface IngestJobState {
  status: "idle" | "running" | "done" | "error";
  startedAt: string | null;
  finishedAt: string | null;
  results: { documentId: string; source: string; chunks: number; skipped: boolean }[];
  error: string | null;
}
