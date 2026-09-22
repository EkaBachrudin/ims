import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { errorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Input";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl">📦</div>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">WMS + AI Assistant</h1>
          <p className="text-sm text-slate-500">Masuk ke dashboard gudang</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
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
        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: admin@umkm.id / password123
        </p>
      </div>
    </div>
  );
}
