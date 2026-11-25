import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, X, QrCode, Users, Megaphone, Bell, Gift, Utensils } from "lucide-react";

const features = [
  { title: "Le menu à table", icon: Utensils, text: "Vos clients scannent le QR de leur table, consultent la carte et passent commande depuis leur téléphone." },
  { title: "Le service en salle", icon: Bell, text: "Commandes et appels arrivent sur l’écran du serveur avec le numéro de table et le temps d’attente." },
  { title: "La prochaine visite", icon: Gift, text: "Le serveur scanne le QR personnel du client. Un tampon s’ajoute à sa carte, selon la règle de votre café." },
];
const plans = [
  { id: "monthly", label: "Mensuel", price: 10, unit: "mois", duration: "1 mois" },
  { id: "annual", label: "Annuel", price: 110, unit: "an", duration: "12 mois" },
] as const;
type Plan = typeof plans[number];
const included = ["Menu numérique et QR par table", "Commandes et appels serveur", "Gestion de l’équipe et des ruptures", "Nouveautés et cartes de fidélité"];
const operations = [
  { Icon: Utensils, name: "Menu et ruptures", detail: "Modifiez les plats et indiquez les produits épuisés.", rows: ["Assiette de saison · Disponible", "Tarte du jour · Épuisée"] },
  { Icon: QrCode, name: "Tables et QR", detail: "Associez chaque table à son QR pour retrouver l’origine d’une commande.", rows: ["Table 04 · Terrasse", "Table 08 · Salle"] },
  { Icon: Users, name: "Équipe", detail: "Donnez à chaque membre de votre équipe son accès au service.", rows: ["Responsable", "Serveur"] },
  { Icon: Megaphone, name: "Nouveautés", detail: "Annoncez votre prochain brunch ou un nouveau plat aux clients qui suivent votre établissement.", rows: ["Le brunch du dimanche", "Nouvelle carte de saison"] },
];
function Checkout({plan, close}: {plan: Plan; close: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return <dialog ref={dialog} onCancel={close} aria-labelledby="purchase-title" className="m-auto w-[94vw] max-w-2xl overflow-hidden rounded-2xl border bg-white p-0 backdrop:bg-black/60">
    <header className="flex items-center justify-between border-b p-4"><h2 id="purchase-title" className="font-bold">{plan.label} · {plan.price} $US</h2><button aria-label="Fermer" onClick={close} className="p-2"><X/></button></header>
    <iframe title={`Acheter la clé — ${plan.label}`} src={`/acheter-cle.html?offre=${plan.id}`} allow="payment" className="block h-[70dvh] w-full border-0"/>
  </dialog>;
}
const cta = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#26201a] px-5 py-3 font-semibold text-white focus-visible:outline-offset-4";
export default function LandingPage() {
  const [step, setStep] = useState(0);
  const [count, setCount] = useState(1);
  const [purchase, setPurchase] = useState<Plan | null>(null);
  const [tool, setTool] = useState(0);
  const [paused, setPaused] = useState(false);
  const selected = operations[tool];
  const steps = ["À table", "En salle", "Fidélité"];
  return <main className="min-h-screen bg-[#faf6ed] text-[#282118]">
    <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-[#d5cbb9] px-5 py-4">
      <span className="flex items-center gap-2 font-serif text-2xl font-bold"><img src="/icons/cafe-qr-logo.png" alt="Café QR" width="64" height="64" className="rounded-lg" /></span>
      <nav className="flex items-center gap-5 font-semibold"><a className="hidden sm:block" href="#tarifs">Tarifs</a><Link to="/login">Se connecter ↗</Link></nav>
    </header>
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-10 md:grid-cols-2 md:py-20">
      <div><h1 className="font-serif text-5xl font-bold leading-none tracking-tight md:text-6xl">Vos clients commandent. Votre équipe sait quelle table servir.</h1>
        <p className="my-6 max-w-md text-lg leading-relaxed">Une carte à scanner, des commandes qui arrivent en salle et une bonne raison pour vos habitués de revenir.</p>
        <div className="flex flex-wrap items-center gap-5"><Link className={cta} to="/inscription">Créer mon établissement <ArrowUpRight size={18}/></Link><a href="#demo" className="font-semibold underline underline-offset-4">Essayer la démo</a></div></div>
      <figure><img src="/services.jpg" alt="En salle, au passe et en boulangerie pendant le service" className="aspect-[5/4] w-full rounded-t-[4rem] object-cover md:aspect-square"/><figcaption className="mt-2 text-right font-serif italic">À table, au passe, au comptoir.</figcaption></figure>
    </section>
    <section className="bg-[#203c30] text-[#fff8e8]"><div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 md:grid-cols-3">{features.map(({title,icon:Icon,text})=><article key={title}><Icon className="mb-3 text-[#edd098]"/><h2 className="font-serif text-2xl">{title}</h2><p className="mt-2 max-w-sm leading-relaxed">{text}</p></article>)}</div></section>
    <section className="mx-auto max-w-6xl px-5 pt-16"><h2 className="font-serif text-4xl">Dans les coulisses de votre établissement.</h2>
      <div className="mt-7 grid overflow-hidden rounded-2xl border border-[#d5cbb9] md:grid-cols-2">
        <div className="p-5 sm:p-8"><div className="flex flex-wrap gap-2">{operations.map(({name,Icon},i)=><button key={name} aria-pressed={tool===i} onClick={()=>setTool(i)} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${tool===i?"bg-[#203c30] text-white":"bg-white"}`}><Icon size={16}/>{name}</button>)}</div>
        <div aria-live="polite" className="mt-8"><h3 className="font-serif text-3xl">{selected.name}</h3><p className="mt-3 max-w-md">{selected.detail}</p></div></div>
        <div className="flex items-end p-5 sm:p-8" style={{backgroundImage:"url(/services.jpg)",backgroundSize:"300% auto",backgroundPosition:["left center","center center","center center","right center"][tool]}}>
          <div key={tool} className="w-full rounded-xl bg-white p-4 shadow-xl motion-safe:animate-[appear_.35s_ease-out]"><selected.Icon className="mb-2 text-[#986629]"/>{selected.rows.map(row=><p className="border-t py-2 font-medium" key={row}>{row}</p>)}</div></div>
      </div></section>
    <section id="demo" className="mx-auto grid max-w-5xl items-center gap-7 px-5 py-14 md:grid-cols-2"><div><h2 className="font-serif text-4xl">Essayez côté table.</h2><p className="mt-3">Simulez une commande et suivez son arrivée en salle.</p></div>
      <div className="rounded-2xl border border-[#d5cbb9] bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-[#79582d]">Démo · Table 04 · {steps[step]}</p>
      <div aria-live="polite" className="my-5"><h3 className="font-serif text-3xl">{["Un espresso ?", "Commande à préparer", "Un tampon de plus"][step]}</h3>
      {step===0 ? <label className="mt-4 flex items-center justify-between">Quantité<select className="rounded border p-2" value={count} onChange={e=>setCount(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label> : <p className="mt-3">{step===1 ? count+" × Espresso · Table 04" : "Après le scan du serveur, la carte client passe à 6 / 10 tampons."}</p>}</div>
      <button className={cta+" w-full"} onClick={()=>{setStep((step+1)%3);if(step===2)setCount(1)}}>{["Envoyer la commande démo","Simuler le scan fidélité","Recommencer"][step]}</button></div>
    </section>
    <section className="overflow-hidden bg-[#eadfcb] py-8"><div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-4 px-5"><h2 className="font-serif text-3xl">Une fidélité à vos couleurs.</h2><button aria-pressed={paused} onClick={()=>setPaused(!paused)} className="text-sm underline">{paused?"Reprendre":"Pause"}</button></div>
      <style>{`@keyframes loyalty-roll{to{transform:translateX(-50%)}}@keyframes appear{from{opacity:.4;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div className="flex w-max motion-safe:animate-[loyalty-roll_28s_linear_infinite]" style={{animationPlayState:paused?"paused":"running"}}>{[0,1].map(copy=><div aria-hidden={copy===1} key={copy} className="flex gap-4 pr-4">{["Bistro","Bar à jus","Boulangerie","Grillades"].map((label,n)=><div key={label} style={{background:["#65243c","#1a654d","#85532a","#343333"][n]}} className="w-52 rounded-2xl p-4 text-white"><Gift size={19}/><p className="my-2 font-serif text-2xl">{label}</p><span aria-label="3 tampons sur 5">● ● ● ○ ○</span></div>)}</div>)}</div>
      <p className="mx-auto mt-5 max-w-5xl px-5">Choisissez le modèle, la règle et la récompense. Les clients qui acceptent les notifications peuvent recevoir un rappel à l’approche de leur récompense.</p></section>
    <section id="tarifs" className="mx-auto max-w-5xl px-5 py-16"><h2 className="font-serif text-4xl">Toutes les fonctionnalités. À vous de choisir la durée.</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">{plans.map(plan=><article key={plan.id} className="flex flex-col rounded-2xl border border-[#cfc2ae] bg-white p-6"><h3 className="text-xl font-semibold">{plan.label}</h3><p className="my-3"><strong className="font-serif text-5xl">{plan.price} $US</strong> / {plan.unit}</p><p>{plan.duration} d’accès{plan.id==="annual"?" · 10 $US d’économie sur 12 mois":""}</p>
        <ul className="my-6 space-y-3">{included.map(label=><li key={label} className="flex items-center gap-2"><Check size={16}/>{label}</li>)}</ul>
        <button onClick={()=>setPurchase(plan)} className={cta+" mt-auto w-full"}>Acheter · {plan.price} $US</button></article>)}</div>
      <p className="mt-5">Après l’achat, votre clé s’affiche dans Chariow et vous est envoyée par email.</p><Link className="mt-3 inline-block font-semibold underline" to="/inscription">J’ai déjà une clé →</Link></section>
    {purchase && <Checkout plan={purchase} close={()=>setPurchase(null)}/>}
    <footer className="bg-[#26201a] px-5 py-7 text-center font-serif text-xl text-[#fff8e8]">Café QR</footer>
  </main>;
}
