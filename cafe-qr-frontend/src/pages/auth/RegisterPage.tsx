import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { ArrowRight, Coffee, KeyRound, MailCheck } from "lucide-react";

export default function RegisterPage() {
  const [cafe, setCafe] = useState("");
  const [owner, setOwner] = useState("");
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activation, setActivation] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activation) { setActivation(true); return; }
    if (busy) return;
    setBusy(true); setError("");
    try {
      const code = key.replace(/[\s\u200b\ufeff]/gu, "").replace(/[‐‑‒–—−]/gu, "-").toUpperCase();
      if (!/^CAFE-[MA](?:-[0-9A-F]{8}){4}$/.test(code)) {
        throw new Error("Copiez la clé complète, du préfixe CAFE- jusqu’au dernier caractère.");
      }
      const { data, error } = await supabase.functions.invoke("register-cafe", {
        body: { cafe_name: cafe, owner_name: owner, email, access_key: code },
      });
      if (error || !data?.success) {
        const response = error?.context;
        if (response instanceof Response) {
          if (response.status === 429) throw new Error("Trop de tentatives. Patientez une heure avant de réessayer.");
          const body = await response.json().catch(() => null);
          if (typeof body?.error?.message === "string") throw new Error(body.error.message);
        }
        throw new Error("L’inscription a échoué. Vérifiez votre connexion et réessayez.");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally { setBusy(false); }
  }

  const title = done ? "Vérifiez votre boîte mail" : activation ? "Activez votre café" : "Créons votre espace café";
  const inputStyle = "rounded-xl border-stone-300 bg-white px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";

  return (
    <main className="min-h-screen bg-[#faf8f3] text-[#232920]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold"><Coffee aria-hidden="true" /> Café QR</Link>
        <Link to="/login" className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold">Se connecter</Link>
      </header>
      <div className="mx-auto grid max-w-6xl overflow-hidden px-5 pb-10 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-10 lg:pt-6">
        <aside className="relative hidden min-h-[34rem] overflow-hidden rounded-[2rem] bg-[#19392c] lg:block">
          <img src="/espresso-marbre.jpg" alt="Une tasse en porcelaine sur un comptoir en marbre vert" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-8 pb-9 pt-28 text-white">
            <p className="max-w-xs font-serif text-5xl leading-tight">À chaque table, son menu.</p>
          </div>
        </aside>
        <section className="my-auto w-full max-w-xl justify-self-center rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm sm:p-9">
          {done ? <MailCheck className="mb-5 h-10 w-10 text-emerald-800" /> : (
            <div className="mb-7">
              <p className="text-sm font-semibold text-emerald-800">Étape {activation ? "2 sur 2 · Activation" : "1 sur 2 · Établissement"}</p>
              <div aria-hidden="true" className="mt-3 flex gap-2"><span className="h-1 flex-1 rounded-full bg-emerald-800" /><span className={`h-1 flex-1 rounded-full ${activation ? "bg-emerald-800" : "bg-stone-200"}`} /></div>
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {done ? <div role="status" className="mt-5 space-y-5">
            <p>Votre espace est créé. Ouvrez le message envoyé à <strong className="break-all">{email}</strong> pour définir votre mot de passe.</p>
            <Link to="/login" className="inline-block font-semibold underline">Aller à la connexion</Link>
          </div> : <form onSubmit={submit} className="mt-6 space-y-5">
            {activation ? <>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f3f5ee] p-4">
                <div className="min-w-0"><p className="break-words font-bold">{cafe}</p><p className="break-all text-sm text-stone-600">{email}</p></div>
                <button type="button" disabled={busy} className="text-sm font-semibold underline" onClick={() => {setActivation(false); setError("");}}>Modifier</button>
              </div>
              <Field label="Clé d’accès" htmlFor="key"><Input autoFocus id="key" className={inputStyle+" font-mono"} required placeholder="CAFE-…" autoCapitalize="characters" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} /></Field>
              <p className="flex gap-2 text-sm text-stone-600"><KeyRound size={18} className="shrink-0" />Collez la clé reçue par email après votre achat.</p>
            </> : <>
              <Field label="Nom du café" htmlFor="cafe"><Input id="cafe" className={inputStyle} autoComplete="organization" required maxLength={120} value={cafe} onChange={e => setCafe(e.target.value)} /></Field>
              <Field label="Nom du responsable" htmlFor="owner"><Input id="owner" className={inputStyle} autoComplete="name" required maxLength={80} value={owner} onChange={e => setOwner(e.target.value)} /></Field>
              <Field label="Adresse email" htmlFor="email"><Input id="email" className={inputStyle} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
            </>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <Button type="submit" size="lg" className="w-full gap-2 rounded-xl bg-[#19392c] text-white" disabled={busy}>{busy ? "Création en cours…" : activation ? "Activer mon espace" : "Continuer"}<ArrowRight size={18}/></Button>
          </form>}
        </section>
      </div>
    </main>
  );
}
