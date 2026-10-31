// /auth/callback : retour des liens magiques (client), d'invitation et de réinitialisation (personnel).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initialAuthError, initialAuthType, supabase } from "../../lib/supabase";
import { customerRpc } from "../../lib/api";
import { homeFor, useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/button";
import { fr } from "../../i18n/fr";
import { AuthLayout } from "./AuthLayout";

export const PENDING_FOLLOW_KEY = "cafeqr-pending-follow";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const init = useAuthStore((s) => s.init);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialAuthError) {
        setFailed(true);
        return;
      }
      await init();
      // detectSessionInUrl ouvre la session à partir du lien ; on attend qu'elle soit disponible.
      let session = (await supabase.auth.getSession()).data.session;
      for (let i = 0; !session && i < 10; i++) {
        await new Promise((r) => setTimeout(r, 300));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (cancelled) return;
      if (!session) {
        setFailed(true);
        return;
      }
      if (initialAuthType === "invite" || initialAuthType === "recovery") {
        navigate("/auth/mot-de-passe", { replace: true });
        return;
      }
      const profile = await loadProfile().catch(() => null);
      if (cancelled) return;
      if (profile?.kind === "staff") {
        navigate(homeFor(profile.staff.role), { replace: true });
        return;
      }
      // Client déjà inscrit : les métadonnées d'inscription sont ignorées, on suit le café ici.
      const pendingSlug = localStorage.getItem(PENDING_FOLLOW_KEY);
      if (profile?.kind === "customer" && pendingSlug) {
        await customerRpc.followCafe(pendingSlug).catch(() => undefined);
      }
      localStorage.removeItem(PENDING_FOLLOW_KEY);
      navigate("/compte", { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [init, loadProfile, navigate]);

  return (
    <AuthLayout title={failed ? fr.auth.callbackError : fr.auth.callbackLoading}>
      {failed ? (
        <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>{fr.auth.backToLogin}</Button>
      ) : (
        <div className="flex justify-center" aria-busy="true">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
        </div>
      )}
    </AuthLayout>
  );
}
