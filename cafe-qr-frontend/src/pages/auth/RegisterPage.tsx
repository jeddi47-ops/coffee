import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { AuthLayout } from "../auth/AuthLayout";

export default function RegisterPage() {
  const [cafe, setCafe] = useState("");
  const [owner, setOwner] = useState("");
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { data, error } = await supabase.functions.invoke("register-cafe", {
        body: { cafe_name: cafe, owner_name: owner, email, access_key: key },
      });
      if (error || !data?.success) throw new Error(data?.message ?? "Inscription impossible. Vérifiez la clé et réessayez.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally { setBusy(false); }
  }

  return <AuthLayout title="Créer un espace café" subtitle="Une clé d’accès valide est nécessaire pour activer votre espace.">
    {done ? <div role="status" className="space-y-3">
      <p>Le café est créé. Consultez votre email pour définir le mot de passe et vous connecter.</p>
      <Link className="underline" to="/login">Aller à la connexion</Link>
    </div> : <form onSubmit={submit} className="space-y-4">
      <Field label="Nom du café" htmlFor="cafe"><Input id="cafe" required maxLength={120} value={cafe} onChange={e => setCafe(e.target.value)} /></Field>
      <Field label="Nom du responsable" htmlFor="owner"><Input id="owner" required maxLength={80} value={owner} onChange={e => setOwner(e.target.value)} /></Field>
      <Field label="Email" htmlFor="email"><Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label="Clé d’accès" htmlFor="key"><Input id="key" required autoCapitalize="characters" value={key} onChange={e => setKey(e.target.value)} /></Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Création…" : "Créer mon espace"}</Button>
      <p className="text-center text-sm">Déjà inscrit ? <Link className="underline" to="/login">Se connecter</Link></p>
    </form>}
  </AuthLayout>;
}
