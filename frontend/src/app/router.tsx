import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ProductsPage } from "@/features/products/ProductsPage";
import { CategoriesPage } from "@/features/categories/CategoriesPage";
import { PartnersPage } from "@/features/partners/PartnersPage";
import { WarehousesPage } from "@/features/warehouses/WarehousesPage";
import { InboundPage, OutboundPage } from "@/features/transactions/pages";
import { PurchaseOrdersPage } from "@/features/purchase-orders/PurchaseOrdersPage";
import { PurchaseOrderDetailPage } from "@/features/purchase-orders/PurchaseOrderDetailPage";
import { DeliveryNotesPage } from "@/features/delivery-notes/DeliveryNotesPage";
import { DeliveryNoteDetailPage } from "@/features/delivery-notes/DeliveryNoteDetailPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { UsersPage } from "@/features/users/UsersPage";
import { AuditLogsPage } from "@/features/audit-logs/AuditLogsPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/partners" element={<PartnersPage />} />
        <Route path="/warehouses" element={<WarehousesPage />} />
        <Route path="/inbound" element={<InboundPage />} />
        <Route path="/outbound" element={<OutboundPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
        <Route path="/delivery-notes" element={<DeliveryNotesPage />} />
        <Route path="/delivery-notes/:id" element={<DeliveryNoteDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/users"
          element={
            <RequireAuth roles={["SUPER_ADMIN"]}>
              <UsersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <RequireAuth roles={["SUPER_ADMIN"]}>
              <AuditLogsPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
