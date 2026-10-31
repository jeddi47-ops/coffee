// /auth/mot-de-passe : définir (invitation) ou réinitialiser le mot de passe.
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { homeFor, useAuthStore } from "../../stores/authStore";
import { useAuthReady } from "../../components/RequireAuth";
import { FullPageLoader } from "../../components/Skeletons";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { fr } from "../../i18n/fr";
import { AuthLayout } from "./AuthLayout";

export default function SetPasswordPage() {
  const ready = useAuthReady();
  const session = useAuthStore((s) => s.session);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <FullPageLoader />;
  if (!session) {
    return (
      <AuthLayout title={fr.auth.setPasswordTitle}>
        <p className="text-sm text-ink">{fr.auth.setPasswordNoSession}</p>
        <Button className="mt-4 w-full" onClick={() => navigate("/login")}>{fr.auth.backToLogin}</Button>
      </AuthLayout>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError(fr.auth.tooShort);
    if (password !== confirm) return setError(fr.auth.mismatch);
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(fr.errors.generic);
      return;
    }
    const profile = await loadProfile().catch(() => null);
    setBusy(false);
    navigate(profile?.kind === "staff" ? homeFor(profile.staff.role) : "/login", { replace: true });
  };

  return (
    <AuthLayout title={fr.auth.setPasswordTitle} subtitle={fr.auth.setPasswordIntro}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={fr.auth.newPassword} htmlFor="new-password" hint={fr.auth.passwordHint}>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={fr.auth.confirmPassword} htmlFor="confirm-password">
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? fr.common.saving : fr.auth.setPasswordSubmit}
        </Button>
      </form>
    </AuthLayout>
  );
}
