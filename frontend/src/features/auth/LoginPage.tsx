import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Cube, ShieldCheck, Sparkle, Warehouse } from "@phosphor-icons/react";
import { useAuth } from "@/app/AuthContext";
import { errorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";
import "./LoginPage.css";

const highlights = [
  { icon: Warehouse, text: "Kelola stok, gudang, dan transaksi dalam satu tempat" },
  { icon: Sparkle, text: "Asisten AI untuk mempercepat input dan pencarian data" },
  { icon: ShieldCheck, text: "Peran akses dan jejak audit untuk tiap perubahan" },
];

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@umkm.id");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <aside className="login-page__aside">
        <div className="login-page__brand">
          <span className="login-page__brand-mark">
            <Cube size={20} weight="duotone" />
          </span>
          <span className="login-page__brand-name">WMS + AI Assistant</span>
        </div>

        <div className="login-page__intro">
          <h1 className="login-page__headline">
            Manajemen gudang yang rapi, tanpa kerja dua kali.
          </h1>
          <ul className="login-page__highlights">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="login-page__highlight">
                <Icon size={20} weight="duotone" className="login-page__highlight-icon" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="login-page__footnote">Dibuat untuk UMKM yang ingin tumbuh tertib.</p>
      </aside>

      <div className="login-page__main">
        <div className="login-page__form-panel">
          <div className="login-page__mobile-brand">
            <span className="login-page__brand-mark">
              <Cube size={20} weight="duotone" />
            </span>
            <span className="login-page__mobile-brand-name">WMS + AI Assistant</span>
          </div>

          <h2 className="login-page__title">Masuk ke dashboard</h2>
          <p className="login-page__subtitle">Gunakan akun gudang Anda untuk melanjutkan.</p>

          <form className="login-page__form" onSubmit={onSubmit}>
            <ErrorText>{error}</ErrorText>
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@umkm.id"
                required
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>
            <Button type="submit" loading={loading} className="login-page__submit">
              Masuk
            </Button>
          </form>

          <p className="login-page__demo">
            Demo: admin@umkm.id / password123
          </p>
        </div>
      </div>
    </div>
  );
}
