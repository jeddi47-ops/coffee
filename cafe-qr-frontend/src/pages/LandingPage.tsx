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
  const [purchase, setPurchase] = useState<Plan | null>(null);
  const [tool, setTool] = useState(0);
  const [paused, setPaused] = useState(false);
  const selected = operations[tool];
  return <main className="min-h-screen bg-[#faf6ed] text-[#282118]">
    <header className="border-b border-[#d5cbb9] bg-[#fffdf8]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 px-5 py-3 md:flex-nowrap md:px-10">
        <a href="#accueil" aria-label="Café QR, accueil"><img src="/icons/cafe-qr-logo.png" alt="Café QR" width="62" height="62" /></a>
        <nav aria-label="Navigation principale" className="order-3 flex w-full flex-wrap justify-between gap-x-3 border-t border-[#ded8ca] pt-1 text-sm font-semibold md:order-none md:w-auto md:gap-8 md:border-0">
          <a className="py-3 hover:underline" href="#accueil">Accueil</a>
          <a className="py-3 hover:underline" href="#fonctionnalites">Fonctionnalités</a>
          <a className="py-3 hover:underline" href="#fidelite">Fidélité</a>
          <a className="py-3 hover:underline" href="#tarifs">Tarifs</a>
        </nav>
        <Link className="inline-flex items-center gap-2 rounded-full border border-[#cac4b8] px-5 py-2.5 text-sm font-semibold" to="/login">Se connecter <ArrowUpRight size={16}/></Link>
      </div>
    </header>
    <section id="accueil" aria-labelledby="accueil-titre" className="relative isolate mx-auto grid min-h-[min(78svh,800px)] place-items-center overflow-hidden bg-stone-900 px-5 py-20 text-center text-white">
      <img src="/accueil-service.jpg" alt="" fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/55" />
      <div className="mx-auto max-w-4xl">
        <h1 id="accueil-titre" className="text-balance font-serif text-[clamp(2.6rem,5.6vw,5.4rem)] leading-[1.02] tracking-tight">Vos clients commandent. Votre équipe sait quelle table servir.</h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed md:text-xl">Une carte à scanner, des commandes qui arrivent en salle et une bonne raison pour vos habitués de revenir.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="inline-flex items-center gap-2 rounded-full bg-[#fffaf0] px-6 py-3 font-semibold text-[#19372c]" to="/inscription">Créer mon établissement <ArrowUpRight size={18}/></Link>
          <a className="rounded-full border border-white/70 bg-black/30 px-6 py-3 font-semibold text-white" href="#tarifs">Voir les tarifs</a>
        </div>
      </div>
    </section>
    <section id="fonctionnalites" className="bg-[#203c30] text-[#fff8e8]"><div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 md:grid-cols-3">{features.map(({title,icon:Icon,text})=><article key={title}><Icon className="mb-3 text-[#edd098]"/><h2 className="font-serif text-2xl">{title}</h2><p className="mt-2 max-w-sm leading-relaxed">{text}</p></article>)}</div></section>
    <section className="mx-auto max-w-6xl px-5 pt-16"><h2 className="font-serif text-4xl">Dans les coulisses de votre établissement.</h2>
      <div className="mt-7 grid overflow-hidden rounded-2xl border border-[#d5cbb9] md:grid-cols-2">
        <div className="p-5 sm:p-8"><div className="flex flex-wrap gap-2">{operations.map(({name,Icon},i)=><button key={name} aria-pressed={tool===i} onClick={()=>setTool(i)} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${tool===i?"bg-[#203c30] text-white":"bg-white"}`}><Icon size={16}/>{name}</button>)}</div>
        <div aria-live="polite" className="mt-8"><h3 className="font-serif text-3xl">{selected.name}</h3><p className="mt-3 max-w-md">{selected.detail}</p></div></div>
        <div className="flex items-end p-5 sm:p-8" style={{backgroundImage:"url(/services.jpg)",backgroundSize:"300% auto",backgroundPosition:["left center","center center","center center","right center"][tool]}}>
          <div key={tool} className="w-full rounded-xl bg-white p-4 shadow-xl motion-safe:animate-[appear_.35s_ease-out]"><selected.Icon className="mb-2 text-[#986629]"/>{selected.rows.map(row=><p className="border-t py-2 font-medium" key={row}>{row}</p>)}</div></div>
      </div></section>
    <section id="fidelite" className="mt-16 overflow-hidden bg-[#eadfcb] py-8"><div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-4 px-5"><h2 className="font-serif text-3xl">Une fidélité à vos couleurs.</h2><button aria-pressed={paused} onClick={()=>setPaused(!paused)} className="text-sm underline">{paused?"Reprendre":"Pause"}</button></div>
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
