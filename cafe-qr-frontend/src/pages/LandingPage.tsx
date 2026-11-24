import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Bell, Gift, Utensils } from "lucide-react";

const features = [
  { title: "Le menu à table", icon: Utensils, text: "Vos clients scannent le QR de leur table, consultent la carte et passent commande depuis leur téléphone." },
  { title: "Le service en salle", icon: Bell, text: "Commandes et appels arrivent sur l’écran du serveur avec le numéro de table et le temps d’attente." },
  { title: "La prochaine visite", icon: Gift, text: "Le serveur scanne le QR personnel du client. Un tampon s’ajoute à sa carte, selon la règle de votre café." },
];
const cta = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#26201a] px-5 py-3 font-semibold text-white focus-visible:outline-offset-4";
export default function LandingPage() {
  const [step, setStep] = useState(0);
  const [count, setCount] = useState(1);
  const steps = ["À table", "En salle", "Fidélité"];
  return <main className="min-h-screen bg-[#faf6ed] text-[#282118]">
    <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-[#d5cbb9] px-5 py-4">
      <span className="flex items-center gap-2 font-serif text-2xl font-bold"><img src="/icons/cafe-qr-logo.png" alt="Café QR" width="64" height="64" className="rounded-lg" /></span>
      <nav className="flex items-center gap-5 font-semibold"><a className="hidden sm:block" href="#tarifs">Tarifs</a><Link to="/login">Se connecter ↗</Link></nav>
    </header>
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-10 md:grid-cols-2 md:py-20">
      <div><h1 className="font-serif text-5xl font-bold leading-none tracking-tight md:text-7xl">De la première commande au prochain café.</h1>
        <p className="my-6 max-w-md text-lg leading-relaxed">Une carte à scanner, des commandes qui arrivent en salle et une bonne raison pour vos habitués de revenir.</p>
        <div className="flex flex-wrap items-center gap-5"><Link className={cta} to="/inscription">Créer mon établissement <ArrowUpRight size={18}/></Link><a href="#demo" className="font-semibold underline underline-offset-4">Essayer la démo</a></div></div>
      <figure><img src="/terrasse-cafe.jpg" alt="Un espresso et le menu sur téléphone à côté du QR de la table 04" className="aspect-[5/4] w-full rounded-t-[4rem] object-cover md:aspect-square"/><figcaption className="mt-2 text-right font-serif italic">En terrasse, table 04.</figcaption></figure>
    </section>
    <section className="bg-[#203c30] text-[#fff8e8]"><div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 md:grid-cols-3">{features.map(({title,icon:Icon,text})=><article key={title}><Icon className="mb-3 text-[#edd098]"/><h2 className="font-serif text-2xl">{title}</h2><p className="mt-2 max-w-sm leading-relaxed">{text}</p></article>)}</div></section>
    <section id="demo" className="mx-auto grid max-w-5xl items-center gap-7 px-5 py-14 md:grid-cols-2"><div><h2 className="font-serif text-4xl">Essayez côté table.</h2><p className="mt-3">Simulez une commande et suivez son arrivée en salle.</p></div>
      <div className="rounded-2xl border border-[#d5cbb9] bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-[#79582d]">Démo · Table 04 · {steps[step]}</p>
      <div aria-live="polite" className="my-5"><h3 className="font-serif text-3xl">{["Un espresso ?", "Commande à préparer", "Un tampon de plus"][step]}</h3>
      {step===0 ? <label className="mt-4 flex items-center justify-between">Quantité<select className="rounded border p-2" value={count} onChange={e=>setCount(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label> : <p className="mt-3">{step===1 ? count+" × Espresso · Table 04" : "Après le scan du serveur, la carte client passe à 6 / 10 tampons."}</p>}</div>
      <button className={cta+" w-full"} onClick={()=>{setStep((step+1)%3);if(step===2)setCount(1)}}>{["Envoyer la commande démo","Simuler le scan fidélité","Recommencer"][step]}</button></div>
    </section>
    <section id="tarifs" className="mx-auto max-w-5xl border-t border-[#d5cbb9] px-5 py-12"><h2 className="font-serif text-4xl">Choisissez votre durée.</h2><p className="my-4">Une clé à usage unique active l’accès de votre établissement.</p><div className="grid gap-4 sm:grid-cols-2">{[["Mensuel","10","mois"],["Annuel","110","an"]].map(([title,price,unit])=><div key={unit} className="rounded-xl border border-[#cfc2ae] p-6"><span className="flex items-center gap-2 font-semibold"><Check size={16}/>{title}</span><p className="mt-3"><strong className="font-serif text-4xl">{price} $US</strong> / {unit}</p></div>)}</div><Link className="mt-6 inline-block font-semibold underline underline-offset-4" to="/inscription">J’ai déjà une clé →</Link></section>
    <footer className="bg-[#26201a] px-5 py-7 text-center font-serif text-xl text-[#fff8e8]">Café QR</footer>
  </main>;
}
