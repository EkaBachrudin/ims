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
    lowStock: ["reports", "low-stock"] as const,
    shipments: (date: string) => ["reports", "shipments", date] as const,
  },
  users: {
    all: ["users"] as const,
    list: (filters: unknown) => ["users", "list", filters] as const,
  },
  auditLogs: {
    all: ["audit-logs"] as const,
    list: (filters: unknown) => ["audit-logs", "list", filters] as const,
  },
};
