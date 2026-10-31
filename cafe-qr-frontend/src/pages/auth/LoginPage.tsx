// /login : connexion du personnel (email + mot de passe), mot de passe oublié.
import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { SITE_URL } from "../../lib/env";
import { homeFor, useAuthStore } from "../../stores/authStore";
import { useAuthReady } from "../../components/RequireAuth";
import { FullPageLoader } from "../../components/Skeletons";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { fr } from "../../i18n/fr";
import { AuthLayout } from "./AuthLayout";

export default function LoginPage() {
  const ready = useAuthReady();
  const profile = useAuthStore((s) => s.profile);
  const notice = useAuthStore((s) => s.notice);
  const setNotice = useAuthStore((s) => s.setNotice);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const signOut = useAuthStore((s) => s.signOut);

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (notice) {
      setError(notice);
      setNotice(null);
    }
  }, [notice, setNotice]);

  if (!ready) return <FullPageLoader />;
  if (profile?.kind === "staff") return <Navigate to={homeFor(profile.staff.role)} replace />;

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError(authError.status === 400 ? fr.auth.badCredentials : fr.errors.generic);
        return;
      }
      const p = await loadProfile();
      if (p?.kind !== "staff") {
        await signOut(null);
        setError(p?.kind === "customer" ? fr.auth.notStaff : fr.auth.deactivated);
      }
    } catch {
      setError(fr.errors.network);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    await supabase.auth
      .resetPasswordForEmail(email.trim(), { redirectTo: `${SITE_URL}/auth/callback` })
      .catch(() => undefined);
    setBusy(false);
    setInfo(fr.auth.forgotSent); // même message que le compte existe ou non
  };

  return (
    <AuthLayout title={mode === "login" ? fr.auth.loginTitle : fr.auth.forgotTitle} subtitle={mode === "login" ? fr.auth.loginSubtitle : undefined}>
      <form onSubmit={mode === "login" ? login : forgot} className="space-y-4" noValidate>
        <Field label={fr.auth.email} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mode === "login" && (
          <Field label={fr.auth.password} htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        {info && <p role="status" className="text-sm text-ink">{info}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy || !email}>
          {mode === "login" ? (busy ? fr.auth.submitting : fr.auth.submit) : fr.auth.forgotSubmit}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Button variant="link" onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setError(null); setInfo(null); }}>
          {mode === "login" ? fr.auth.forgot : fr.auth.backToLogin}
        </Button>
      </div>
    </AuthLayout>
  );
}
