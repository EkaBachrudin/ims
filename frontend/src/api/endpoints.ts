import { api } from "./client";
import type {
  ApiEnvelope,
  AuditLog,
  AuthUser,
  Category,
  DashboardSummary,
  DeliveryNote,
  DnStatus,
  Meta,
  Partner,
  Product,
  PurchaseOrder,
  StockReportRow,
  StockTransaction,
  User,
  Warehouse,
} from "@/types";

type ListResult<T> = { data: T[]; meta?: Meta };

async function unwrap<T>(p: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

async function unwrapList<T>(p: Promise<{ data: ApiEnvelope<T[]> }>): Promise<ListResult<T>> {
  const res = await p;
  return { data: res.data.data, meta: res.data.meta };
}

export const authApi = {
  login: (email: string, password: string) =>
    unwrap<{ user: AuthUser; accessToken: string; refreshToken: string }>(
      api.post("/auth/login", { email, password }),
    ),
  me: () => unwrap<AuthUser>(api.get("/auth/me")),
  logout: (refresh: string) => api.post("/auth/logout", { refresh }),
};

export const productApi = {
  list: (params?: Record<string, unknown>) => unwrapList<Product>(api.get("/products", { params })),
  get: (id: string) => unwrap<Product>(api.get(`/products/${id}`)),
  create: (body: unknown) => unwrap<Product>(api.post("/products", body)),
  update: (id: string, body: unknown) => unwrap<Product>(api.patch(`/products/${id}`, body)),
  remove: (id: string) => api.delete(`/products/${id}`),
};

export const categoryApi = {
  list: (params?: Record<string, unknown>) =>
    unwrap<Category[]>(api.get("/categories", { params })),
  create: (body: { name: string }) => unwrap<Category>(api.post("/categories", body)),
  update: (id: number, body: { name: string }) =>
    unwrap<Category>(api.patch(`/categories/${id}`, body)),
  remove: (id: number) => api.delete(`/categories/${id}`),
};

export const partnerApi = {
  list: (params?: Record<string, unknown>) => unwrapList<Partner>(api.get("/partners", { params })),
  create: (body: unknown) => unwrap<Partner>(api.post("/partners", body)),
  update: (id: string, body: unknown) => unwrap<Partner>(api.patch(`/partners/${id}`, body)),
  remove: (id: string) => api.delete(`/partners/${id}`),
};

export const warehouseApi = {
  list: (params?: Record<string, unknown>) =>
    unwrap<Warehouse[]>(api.get("/warehouses", { params })),
  create: (body: unknown) => unwrap<Warehouse>(api.post("/warehouses", body)),
  update: (id: string, body: unknown) => unwrap<Warehouse>(api.patch(`/warehouses/${id}`, body)),
  remove: (id: string) => api.delete(`/warehouses/${id}`),
};

export const transactionApi = {
  list: (params?: Record<string, unknown>) =>
    unwrapList<StockTransaction>(api.get("/transactions", { params })),
  inbound: (body: unknown) => unwrap<StockTransaction>(api.post("/transactions/inbound", body)),
  outbound: (body: unknown) => unwrap<StockTransaction>(api.post("/transactions/outbound", body)),
  void: (id: string, reason: string) =>
    unwrap<StockTransaction>(api.post(`/transactions/${id}/void`, { reason })),
};

export const poApi = {
  list: (params?: Record<string, unknown>) => unwrapList<PurchaseOrder>(api.get("/po", { params })),
  get: (id: string) => unwrap<PurchaseOrder>(api.get(`/po/${id}`)),
  create: (body: unknown) => unwrap<PurchaseOrder>(api.post("/po", body)),
  update: (id: string, body: unknown) => unwrap<PurchaseOrder>(api.patch(`/po/${id}`, body)),
  confirm: (id: string) => unwrap<PurchaseOrder>(api.post(`/po/${id}/confirm`)),
  cancel: (id: string) => unwrap<PurchaseOrder>(api.post(`/po/${id}/cancel`)),
  remove: (id: string) => api.delete(`/po/${id}`),
};

export const dnApi = {
  list: (params?: Record<string, unknown>) =>
    unwrapList<DeliveryNote>(api.get("/delivery-notes", { params })),
  get: (id: string) => unwrap<DeliveryNote>(api.get(`/delivery-notes/${id}`)),
  create: (body: unknown) => unwrap<DeliveryNote>(api.post("/delivery-notes", body)),
  update: (id: string, body: unknown) =>
    unwrap<DeliveryNote>(api.put(`/delivery-notes/${id}`, body)),
  updateStatus: (id: string, status: DnStatus, notes?: string) =>
    unwrap<DeliveryNote>(api.patch(`/delivery-notes/${id}`, { status, notes })),
};

export const reportApi = {
  dashboard: () => unwrap<DashboardSummary>(api.get("/reports/dashboard")),
  stock: (params?: Record<string, unknown>) =>
    unwrap<StockReportRow[]>(api.get("/reports/stock", { params })),
  lowStock: () => unwrap<StockReportRow[]>(api.get("/reports/low-stock")),
  shipments: (date: string) =>
    unwrap<{
      date: string;
      shipments: {
        partner: string;
        product: string;
        qty: number;
        unit: string;
        warehouse: string;
      }[];
    }>(api.get("/reports/shipments", { params: { date } })),
};

export const userApi = {
  list: (params?: Record<string, unknown>) => unwrapList<User>(api.get("/users", { params })),
  create: (body: unknown) => unwrap<User>(api.post("/users", body)),
  update: (id: string, body: unknown) => unwrap<User>(api.patch(`/users/${id}`, body)),
  remove: (id: string) => api.delete(`/users/${id}`),
};

export const auditApi = {
  list: (params?: Record<string, unknown>) =>
    unwrapList<AuditLog>(api.get("/audit-logs", { params })),
};
