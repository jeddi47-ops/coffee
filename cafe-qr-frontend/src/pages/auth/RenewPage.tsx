import { useState, type FormEvent } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuthReady } from "../../components/RequireAuth";
import { FullPageLoader } from "../../components/Skeletons";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/authStore";

export default function RenewPage() {
  const ready = useAuthReady();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);
  const refreshCafe = useAuthStore(s => s.refreshCafe);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!ready) return <FullPageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || profile.kind === "none") return <FullPageLoader />;
  if (profile.kind !== "staff" || profile.staff.role !== "owner") {
    return <main className="mx-auto max-w-lg p-6"><h1 className="text-2xl font-bold">Renouvellement</h1><p className="mt-3">Demandez au responsable du café de saisir une clé de renouvellement.</p><Link className="mt-4 inline-block underline" to="/login">Retour à la connexion</Link></main>;
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const code = key.replace(/[\s\u200b\ufeff]/gu, "").replace(/[‐‑‒–—−]/gu, "-").toUpperCase();
      if (!/^CAFE-[MA](?:-[0-9A-F]{8}){4}$/.test(code)) {
        throw new Error("Copiez la clé complète, du préfixe CAFE- jusqu’au dernier caractère.");
      }
      const { data, error } = await supabase.functions.invoke("renew-access-key", { body: { access_key: code } });
      if (error || !data?.success) {
        const response = error?.context;
        if (response instanceof Response) {
          if (response.status === 429) throw new Error("Trop de tentatives. Patientez une heure avant de réessayer.");
          const body = await response.json().catch(() => null);
          if (typeof body?.error?.message === "string") throw new Error(body.error.message);
        }
        throw new Error("Le renouvellement a échoué. Vérifiez votre connexion et réessayez.");
      }
      await refreshCafe();
      setKey("");
      setSuccess(`Accès renouvelé jusqu’au ${new Date(data.access_until).toLocaleDateString("fr-FR")}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le renouvellement a échoué.");
    } finally { setBusy(false); }
  }

  const until = profile.cafe.access_until ? new Date(profile.cafe.access_until).toLocaleDateString("fr-FR") : "non défini";
  return <main className="mx-auto max-w-lg space-y-6 p-6">
    <header><p className="text-sm text-muted">Café QR</p><h1 className="text-2xl font-bold">Renouveler l’accès</h1><p className="mt-2">{profile.cafe.name} · accès jusqu’au {until}</p></header>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Clé d’accès" htmlFor="renew-key"><Input id="renew-key" required value={key} onChange={e => setKey(e.target.value)} /></Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {success && <p role="status" className="text-sm">{success}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Renouvellement…" : "Activer la clé"}</Button>
    </form>
    <Link className="underline" to="/login">Retour à la connexion</Link>
  </main>;
}
