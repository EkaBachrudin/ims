export const qk = {
  dashboard: ["dashboard"] as const,
  products: {
    all: ["products"] as const,
    list: (filters: unknown) => ["products", "list", filters] as const,
    detail: (id: string) => ["products", "detail", id] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: (filters?: unknown) => ["categories", "list", filters ?? {}] as const,
  },
  partners: {
    all: ["partners"] as const,
    list: (filters: unknown) => ["partners", "list", filters] as const,
  },
  warehouses: {
    all: ["warehouses"] as const,
    list: (filters?: unknown) => ["warehouses", "list", filters ?? {}] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    list: (filters: unknown) => ["transactions", "list", filters] as const,
  },
  purchaseOrders: {
    all: ["purchase-orders"] as const,
    list: (filters: unknown) => ["purchase-orders", "list", filters] as const,
    detail: (id: string) => ["purchase-orders", "detail", id] as const,
  },
  deliveryNotes: {
    all: ["delivery-notes"] as const,
    list: (filters: unknown) => ["delivery-notes", "list", filters] as const,
    detail: (id: string) => ["delivery-notes", "detail", id] as const,
  },
  reports: {
    stock: (filters: unknown) => ["reports", "stock", filters] as const,
    products: (filters: unknown) => ["reports", "products", filters] as const,
    lowStock: ["reports", "low-stock"] as const,
    shipments: (date: string) => ["reports", "shipments", date] as const,
    periodSummary: (filters: unknown) => ["reports", "period-summary", filters] as const,
    stockTrend: (filters: unknown) => ["reports", "stock-trend", filters] as const,
    stockSummary: ["reports", "stock-summary"] as const,
    poSummary: (filters: unknown) => ["reports", "po-summary", filters] as const,
    dnSummary: (filters: unknown) => ["reports", "dn-summary", filters] as const,
    purchaseOrders: (filters: unknown) => ["reports", "purchase-orders", filters] as const,
    deliveryNotes: (filters: unknown) => ["reports", "delivery-notes", filters] as const,
    transactions: (filters: unknown) => ["reports", "transactions", filters] as const,
    stockCard: (filters: unknown) => ["reports", "stock-card", filters] as const,
    movementAnalysis: (filters: unknown) => ["reports", "movement-analysis", filters] as const,
    userActivity: (filters: unknown) => ["reports", "user-activity", filters] as const,
  },
  users: {
    all: ["users"] as const,
    list: (filters: unknown) => ["users", "list", filters] as const,
  },
  auditLogs: {
    all: ["audit-logs"] as const,
    list: (filters: unknown) => ["audit-logs", "list", filters] as const,
  },
  knowledge: {
    all: ["knowledge"] as const,
    documents: (filters: unknown) => ["knowledge", "documents", filters] as const,
    detail: (id: string) => ["knowledge", "detail", id] as const,
    stats: ["knowledge", "stats"] as const,
    chunks: (filters: unknown) => ["knowledge", "chunks", filters] as const,
    ingest: ["knowledge", "ingest"] as const,
  },
};
