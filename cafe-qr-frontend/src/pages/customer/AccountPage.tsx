// /compte : espace client (cafés suivis, emails, déconnexion, suppression du compte).
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { publicAssetUrl, SITE_URL } from "../../lib/env";
import { customerRpc } from "../../lib/api";
import { ApiError, errorMessage, fromPostgrest } from "../../lib/errors";
import { homeFor, useAuthStore } from "../../stores/authStore";
import { useAuthReady } from "../../components/RequireAuth";
import { FullPageLoader, ListSkeleton } from "../../components/Skeletons";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Card } from "../../components/ui/card";
import { initials } from "../../components/CafeHeader";
import { fr } from "../../i18n/fr";
import type { FollowedCafe } from "../../types/api";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await supabase.auth
      .signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${SITE_URL}/auth/callback` } })
      .catch(() => undefined);
    setBusy(false);
    setSent(true); // même message que le compte existe ou non
  };
  return (
    <Card>
      <h2 className="text-lg font-semibold">{fr.account.signInTitle}</h2>
      <p className="mt-1 text-sm text-muted">{fr.account.signInText}</p>
      {sent ? (
        <p role="status" className="mt-4 text-sm">{fr.account.linkSent}</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Field label={fr.follow.email} htmlFor="account-email">
            <Input id="account-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || !email}>{fr.account.signInSubmit}</Button>
        </form>
      )}
    </Card>
  );
}

export default function AccountPage() {
  const ready = useAuthReady();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const [cafes, setCafes] = useState<FollowedCafe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1>(0);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCafes(await customerRpc.myFollowedCafes());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (profile?.kind === "customer") void load();
  }, [profile, load]);

  if (!ready || (session && !profile)) return <FullPageLoader />;
  // Un compte employé qui ouvre /compte est redirigé vers son espace.
  if (profile?.kind === "staff") return <Navigate to={homeFor(profile.staff.role)} replace />;

  const toggle = async (cafe: FollowedCafe, on: boolean) => {
    if (!session) return;
    const { error: updError } = await supabase
      .from("cafe_followers")
      .update(on ? { notifications_opt_in: true, unsubscribed_at: null } : { notifications_opt_in: false })
      .eq("customer_id", session.user.id)
      .eq("cafe_id", cafe.cafe_id);
    if (updError) setError(errorMessage(fromPostgrest(updError)));
    await load();
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await customerRpc.deleteMyAccount();
      await signOut(null);
      setDeleted(true);
    } catch (e) {
      setError(e instanceof ApiError && e.code === "staff_account" ? fr.errors.codes.staff_account : errorMessage(e));
    } finally {
      setBusy(false);
      setDeleteStep(0);
    }
  };

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{fr.account.title}</h1>

      {deleted && <p role="status" className="rounded-card bg-surface-2 p-4">{fr.account.deleted}</p>}

      {!deleted && (!session || profile?.kind !== "customer") && <SignInForm />}

      {!deleted && session && profile?.kind === "customer" && (
        <>
          <Card>
            <h2 className="text-lg font-semibold">{fr.account.followed}</h2>
            {error && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p>}
            {!cafes ? (
              <div className="mt-4"><ListSkeleton rows={2} /></div>
            ) : cafes.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{fr.account.none}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {cafes.map((c) => {
                  const logo = publicAssetUrl(c.logo_path);
                  const on = c.notifications_opt_in && !c.unsubscribed_at;
                  return (
                    <li key={c.cafe_id} className="flex items-center gap-3 py-3">
                      {logo ? (
                        <img src={logo} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">{initials(c.name)}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <Switch checked={on} onChange={(v) => void toggle(c, v)} label={c.name} description={fr.account.receiveEmails} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Button variant="secondary" className="w-full" onClick={() => void signOut(null)}>{fr.account.logout}</Button>

          <Card>
            <h2 className="text-lg font-semibold">{fr.account.deleteTitle}</h2>
            <p className="mt-1 text-sm text-muted">{fr.account.deleteText}</p>
            {deleteStep === 0 ? (
              <Button variant="secondary" className="mt-4 w-full" onClick={() => setDeleteStep(1)}>{fr.account.deleteStep1}</Button>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="danger" onClick={deleteAccount} disabled={busy}>{fr.account.deleteStep2}</Button>
                <Button variant="secondary" onClick={() => setDeleteStep(0)} disabled={busy}>{fr.common.cancel}</Button>
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
