import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Cube, ShieldCheck, Sparkle, Warehouse } from "@phosphor-icons/react";
import { useAuth } from "@/app/AuthContext";
import { errorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";

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
    <div className="flex min-h-[100dvh] bg-background">
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Cube size={20} weight="duotone" />
          </span>
          <span className="text-sm font-semibold tracking-tight">WMS + AI Assistant</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Manajemen gudang yang rapi, tanpa kerja dua kali.
          </h1>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm opacity-90">
                <Icon size={20} weight="duotone" className="mt-0.5 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs opacity-60">Dibuat untuk UMKM yang ingin tumbuh tertib.</p>
      </aside>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Cube size={20} weight="duotone" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              WMS + AI Assistant
            </span>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-foreground">Masuk ke dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gunakan akun gudang Anda untuk melanjutkan.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
            <Button type="submit" loading={loading} className="w-full">
              Masuk
            </Button>
          </form>

          <p className="mt-6 rounded-lg border border-border bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            Demo: admin@umkm.id / password123
          </p>
        </div>
      </div>
    </div>
  );
}
