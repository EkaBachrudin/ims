import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { roleLabel } from "@/lib/format";
import type { Role } from "@/types";

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const nav: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/products", label: "Produk" },
  { to: "/categories", label: "Kategori" },
  { to: "/partners", label: "Partner" },
  { to: "/warehouses", label: "Gudang" },
  { to: "/inbound", label: "Barang Masuk" },
  { to: "/outbound", label: "Barang Keluar" },
  { to: "/purchase-orders", label: "Purchase Order" },
  { to: "/delivery-notes", label: "Surat Jalan" },
  { to: "/reports", label: "Laporan" },
  { to: "/users", label: "Pengguna", roles: ["SUPER_ADMIN"] },
  { to: "/audit-logs", label: "Audit Log", roles: ["SUPER_ADMIN"] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visible = nav.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <span className="text-lg">📦</span>
          <span className="font-semibold text-slate-800">WMS + AI</span>
        </div>
        <nav className="space-y-0.5 p-2">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="text-sm font-medium text-slate-500 md:hidden">WMS + AI</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-400">{user ? roleLabel[user.role] : ""}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Keluar
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
