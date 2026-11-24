import { Home, CreditCard, UserRound } from "lucide-react";
import { CustomerLoyalty } from "../Loyalty";
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
  const [view, setView] = useState<"Accueil" | "Cartes" | "Compte">("Cartes");
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
    <main className="min-h-screen bg-[#fbf5eb] text-[#261b16]"><header className="bg-[#211815] px-6 py-4 text-2xl font-bold text-white"><div className="mx-auto flex max-w-lg items-center gap-3"><img src="/icons/icon-192.png?v=2" alt="" width="36" height="36" className="rounded-lg" /> Café QR</div></header><div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-5">
      <div className="flex items-center gap-3"><UserRound className="h-12 w-12 rounded-full bg-[#efdfbf] p-3" /><div><h1 className="text-2xl font-bold">{profile?.kind === "customer" ? ["Bonjour", session?.user.user_metadata?.display_name || session?.user.user_metadata?.full_name].filter(Boolean).join(", ") : fr.account.title}</h1><p className="text-sm text-muted">Votre espace client</p></div></div>

      {deleted && <p role="status" className="rounded-card bg-surface-2 p-4">{fr.account.deleted}</p>}

      {!deleted && (!session || profile?.kind !== "customer") && <SignInForm />}

      {!deleted && session && profile?.kind === "customer" && (
        <>
          {view === "Cartes" && <CustomerLoyalty />}
          {view === "Accueil" && (
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
          </Card>)}
          {view === "Compte" && <>
          {error && <p role="alert">{error}</p>}
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
          </Card></>}
          <nav aria-label="Espace client" className="fixed inset-x-0 bottom-0 z-30 flex justify-center border-t bg-[#fffaf2] safe-bottom">{([{ label: "Accueil", Icon: Home }, { label: "Cartes", Icon: CreditCard }, { label: "Compte", Icon: UserRound }] as const).map(({label, Icon}) => <button key={label} aria-current={view === label ? "page" : undefined} className={`flex w-1/3 max-w-40 flex-col items-center gap-1 py-2 text-xs font-semibold ${view === label ? "text-[#986914]" : "text-stone-600"}`} onClick={() => { setView(label); setDeleteStep(0); window.scrollTo(0,0); }}><Icon size={20}/>{label}</button>)}</nav>
        </>
      )}
    </div></main>
  );
}
