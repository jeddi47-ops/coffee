// Gardes de routes : personnel (par rôle) et client connecté.
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { homeFor, useAuthStore } from "../stores/authStore";
import type { StaffRole } from "../types/api";
import { FullPageLoader } from "./Skeletons";
import { fr } from "../i18n/fr";

export function useAuthReady(): boolean {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    init().catch(() => setFailed(true));
  }, [init]);
  return status === "ready" || failed;
}

export function RequireStaff({ roles, children }: { roles: StaffRole[]; children: ReactNode }) {
  const ready = useAuthReady();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const location = useLocation();

  const noAccess = ready && session && profile?.kind === "none";
  useEffect(() => {
    // Employé désactivé ou compte sans ligne staff_members : déconnexion avec message clair.
    if (noAccess) void signOut(fr.auth.deactivated);
  }, [noAccess, signOut]);

  if (!ready || (session && !profile)) return <FullPageLoader />;
  if (!session || noAccess) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profile?.kind === "customer") return <Navigate to="/compte" replace />;
  if (profile?.kind === "staff" && !roles.includes(profile.staff.role)) {
    return <Navigate to={homeFor(profile.staff.role)} replace />;
  }
  return <>{children}</>;
}
