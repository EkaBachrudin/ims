import { useAuth } from "@/app/AuthContext";

export function useCanManage(): boolean {
  const { user } = useAuth();
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
}

export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === "SUPER_ADMIN";
}
