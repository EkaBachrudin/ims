import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ChartBar,
  ClipboardText,
  Cube,
  List,
  Moon,
  Package,
  Scroll,
  SignOut,
  SquaresFour,
  Sun,
  Tag,
  TrayArrowDown,
  TrayArrowUp,
  Truck,
  UserGear,
  UsersThree,
  Warehouse,
  X,
} from "@phosphor-icons/react";
import { useAuth } from "@/app/AuthContext";
import { useTheme } from "@/app/ThemeContext";
import { roleLabel } from "@/lib/format";
import type { Role } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
}

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <SquaresFour size={18} weight="duotone" /> },
  { to: "/products", label: "Produk", icon: <Package size={18} weight="duotone" /> },
  { to: "/categories", label: "Kategori", icon: <Tag size={18} weight="duotone" /> },
  { to: "/partners", label: "Partner", icon: <UsersThree size={18} weight="duotone" /> },
  { to: "/warehouses", label: "Gudang", icon: <Warehouse size={18} weight="duotone" /> },
  { to: "/inbound", label: "Barang Masuk", icon: <TrayArrowDown size={18} weight="duotone" /> },
  { to: "/outbound", label: "Barang Keluar", icon: <TrayArrowUp size={18} weight="duotone" /> },
  {
    to: "/purchase-orders",
    label: "Purchase Order",
    icon: <ClipboardText size={18} weight="duotone" />,
  },
  { to: "/delivery-notes", label: "Surat Jalan", icon: <Truck size={18} weight="duotone" /> },
  { to: "/reports", label: "Laporan", icon: <ChartBar size={18} weight="duotone" /> },
  {
    to: "/users",
    label: "Pengguna",
    icon: <UserGear size={18} weight="duotone" />,
    roles: ["SUPER_ADMIN"],
  },
  {
    to: "/audit-logs",
    label: "Audit Log",
    icon: <Scroll size={18} weight="duotone" />,
    roles: ["SUPER_ADMIN"],
  },
];

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-lg bg-accent text-accent-foreground"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Cube size={size * 0.6} weight="duotone" />
    </span>
  );
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={resolved === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      title="Ganti tema"
    >
      {resolved === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visible = nav.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-accent-subtle font-medium text-accent-subtle-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  const navList = (
    <nav className="space-y-0.5 p-2">
      {visible.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass}>
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-border p-2">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-xs font-semibold text-accent-subtle-foreground">
          {initials(user?.name)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user ? roleLabel[user.role] : ""}</p>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SignOut size={16} />
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-foreground">WMS</p>
            <p className="text-xs text-muted-foreground">AI Assistant</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{navList}</div>
        {sidebarFooter}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface shadow-pop">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2.5">
                <BrandMark />
                <p className="text-sm font-semibold tracking-tight text-foreground">WMS</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Tutup menu"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navList}</div>
            {sidebarFooter}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-4 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Buka menu"
          >
            <List size={18} />
          </button>
          <div className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="text-sm font-semibold tracking-tight text-foreground">WMS</span>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
