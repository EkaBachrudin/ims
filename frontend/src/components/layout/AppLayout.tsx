import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ChartBar,
  ClipboardText,
  Cube,
  List,
  Monitor,
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
import "./AppLayout.css";

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
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <Cube size={size * 0.6} weight="duotone" />
    </span>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label =
    theme === "light" ? "Tema terang" : theme === "dark" ? "Tema gelap" : "Tema sistem";
  return (
    <button
      onClick={toggle}
      className="theme-toggle"
      aria-label={`Ganti tema — saat ini ${label}`}
      title={label}
    >
      {theme === "light" ? <Sun size={17} /> : theme === "dark" ? <Moon size={17} /> : <Monitor size={17} />}
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
    ["nav-link", isActive && "is-active"].filter(Boolean).join(" ");

  const navList = (
    <nav className="nav">
      {visible.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass}>
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  const sidebarFooter = (
    <div className="sidebar__footer">
      <div className="user-chip">
        <span className="user-chip__avatar">{initials(user?.name)}</span>
        <div className="user-chip__text">
          <p className="user-chip__name">{user?.name}</p>
          <p className="user-chip__role">{user ? roleLabel[user.role] : ""}</p>
        </div>
      </div>
      <div className="sidebar__actions">
        <ThemeToggle />
        <button onClick={handleLogout} className="logout-btn">
          <SignOut size={16} />
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <BrandMark />
          <div className="brand">
            <p className="brand__name">WMS</p>
            <p className="brand__sub">AI Assistant</p>
          </div>
        </div>
        <div className="sidebar__nav">{navList}</div>
        {sidebarFooter}
      </aside>

      {drawerOpen && (
        <div className="drawer">
          <div className="drawer__overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="drawer__panel">
            <div className="drawer__header">
              <div className="drawer__brand">
                <BrandMark />
                <p className="brand__name">WMS</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="drawer__close" aria-label="Tutup menu">
                <X size={18} />
              </button>
            </div>
            <div className="drawer__nav">{navList}</div>
            {sidebarFooter}
          </div>
        </div>
      )}

      <div className="app-content">
        <header className="app-header">
          <button onClick={() => setDrawerOpen(true)} className="app-header__menu" aria-label="Buka menu">
            <List size={18} />
          </button>
          <div className="app-header__brand">
            <BrandMark size={28} />
            <span className="app-header__name">WMS</span>
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
