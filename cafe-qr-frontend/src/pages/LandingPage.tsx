import { useEffect, useRef, useState } from "react";
import { CardFace, cardDesigns } from "../components/LoyaltyCardFace";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, X, ChevronDown } from "lucide-react";

const featureGroups = [
  {
    title: "À table",
    photo: "photo-1517248135467-4c7edcad34c4",
    alt: "Tables dressées dans une salle de restaurant",
    items: [
      ["Menu et disponibilités", "Organisez vos plats par catégorie. Quand un produit est épuisé, signalez-le sur la carte que vos clients consultent depuis leur téléphone."],
      ["QR par table", "Chaque table a son propre QR. Le client le scanne pour ouvrir votre menu et sa commande est associée à la bonne table."],
    ],
  },
  {
    title: "Pendant le service",
    photo: "photo-1556911220-bff31c812dba",
    alt: "Préparation d’un plat en cuisine",
    items: [
      ["Commandes et appels", "L’équipe retrouve les commandes sur son écran de service. Un client a besoin de quelqu’un ? Son appel indique à quelle table se rendre."],
      ["Accès de l’équipe", "Créez un accès pour chaque serveur. Chacun se connecte à son espace pour suivre les demandes en salle."],
    ],
  },
  {
    title: "Après la visite",
    photo: "photo-1541167760496-1628856ab772",
    alt: "Café servi avec un motif de mousse de lait",
    items: [
      ["Carte de fidélité", "Choisissez un modèle de carte, votre règle et la récompense. Le serveur scanne le QR personnel du client pour ajouter un tampon sur la carte de votre établissement."],
      ["Nouveautés et rappels", "Partagez vos nouveautés avec les clients qui vous suivent. Un client proche de sa récompense peut recevoir un rappel après une période d’absence s’il a accepté les notifications."],
    ],
  },
];
const plans = [
  { id: "monthly", label: "Mensuel", price: 10, unit: "mois", duration: "1 mois" },
  { id: "annual", label: "Annuel", price: 110, unit: "an", duration: "12 mois" },
] as const;
type Plan = typeof plans[number];
const included = ["Menu numérique et QR par table", "Commandes et appels serveur", "Gestion de l’équipe et des ruptures", "Nouveautés et cartes de fidélité"];
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
  const [paused, setPaused] = useState(false);
  return <main className="min-h-screen bg-[#faf6ed] text-[#282118]">
    <header className="border-b border-[#d5cbb9] bg-[#fffdf8]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 px-5 py-3 md:flex-nowrap md:px-10">
        <a href="#accueil" aria-label="Café QR, accueil"><img src="/icons/cafe-qr-logo.png" alt="Café QR" width="62" height="62" /></a>
        <nav aria-label="Navigation principale" className="order-3 flex w-full flex-wrap justify-between gap-x-3 border-t border-[#ded8ca] pt-1 text-sm font-semibold md:order-none md:w-auto md:gap-8 md:border-0">
          <a className="py-3 hover:underline" href="#accueil">Accueil</a>
          <a className="py-3 hover:underline" href="#fonctionnalites">Fonctionnalités</a>
          <a className="py-3 hover:underline" href="#fidelite">Fidélité</a>
          <a className="py-3 hover:underline" href="#tarifs">Tarifs</a>
          <a className="py-3 hover:underline" href="#demarrer">Démarrer</a>
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
    <section id="fonctionnalites" aria-labelledby="titre-fonctionnalites" className="mx-auto max-w-7xl px-5 pt-14 md:px-10 md:pt-20">
      <h2 id="titre-fonctionnalites" className="max-w-3xl text-balance font-serif text-4xl leading-tight tracking-tight text-[#19372c] md:text-6xl">
        Les fonctionnalités pour votre établissement
      </h2>
      <div className="mt-8 grid gap-x-7 gap-y-12 md:mt-12 md:grid-cols-3">
        {featureGroups.map(group => (
          <article key={group.title} className="min-w-0">
            <img
              src={`https://images.unsplash.com/${group.photo}?auto=format&fit=crop&w=850&q=80`}
              alt={group.alt}
              width={850}
              height={638}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-xl bg-stone-200 object-cover"
              onError={event => {
                const image = event.currentTarget;
                if (image.getAttribute("src") !== "/accueil-service.jpg") {
                  image.src = "/accueil-service.jpg";
                  image.alt = "Scènes de restauration, de la table au comptoir";
                }
              }}
            />
            <h3 className="mb-3 mt-6 font-serif text-3xl tracking-tight">{group.title}</h3>
            {group.items.map(([label, description], index) => (
              <details key={label} open={index === 0} className="group border-t border-[#cfc7b8]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold text-[#203c30] [&::-webkit-details-marker]:hidden">
                  {label}
                  <ChevronDown aria-hidden="true" size={18} className="shrink-0 group-open:rotate-180 motion-safe:transition-transform" />
                </summary>
                <p className="pb-5 pr-3 text-base leading-relaxed text-[#534f46]">{description}</p>
              </details>
            ))}
          </article>
        ))}
      </div>
    </section>
    <section id="fidelite" className="mt-16 overflow-hidden bg-[#eadfcb] py-8"><div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-4 px-5"><h2 className="font-serif text-3xl">Une fidélité à vos couleurs.</h2><button aria-pressed={paused} onClick={()=>setPaused(!paused)} className="text-sm underline">{paused?"Reprendre":"Pause"}</button></div>
      <style>{`@keyframes loyalty-roll{to{transform:translateX(-50%)}}`}</style>
      <div className="overflow-x-auto">
        <div className="flex w-max motion-safe:animate-[loyalty-roll_95s_linear_infinite]" style={{ animationPlayState: paused ? "paused" : "running" }}>
          {[0, 1].map(copy => (
            <div key={copy} aria-hidden={copy === 1} className={`flex gap-5 py-3 pr-5 ${copy === 1 ? "motion-reduce:hidden" : ""}`}>
              {cardDesigns.map(design => (
                <div key={design.color} className="w-[min(80vw,19rem)] shrink-0">
                  <CardFace color={design.color} name={design.name} stamps={3} target={5}
                    reward="Une spécialité offerte" rule="Un passage = un tampon" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-5 max-w-5xl px-5">Choisissez le modèle, la règle et la récompense. Les clients qui acceptent les notifications peuvent recevoir un rappel à l’approche de leur récompense.</p></section>
    <section id="tarifs" className="mx-auto max-w-5xl px-5 py-16"><h2 className="font-serif text-4xl">Toutes les fonctionnalités. À vous de choisir la durée.</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">{plans.map(plan=><article key={plan.id} className="flex flex-col rounded-2xl border border-[#cfc2ae] bg-white p-6"><h3 className="text-xl font-semibold">{plan.label}</h3><p className="my-3"><strong className="font-serif text-5xl">{plan.price} $US</strong> / {plan.unit}</p><p>{plan.duration} d’accès{plan.id==="annual"?" · 10 $US d’économie sur 12 mois":""}</p>
        <ul className="my-6 space-y-3">{included.map(label=><li key={label} className="flex items-center gap-2"><Check size={16}/>{label}</li>)}</ul>
        <button onClick={()=>setPurchase(plan)} className={cta+" mt-auto w-full"}>Acheter · {plan.price} $US</button></article>)}</div>
      <p className="mt-5">Après l’achat, votre clé s’affiche dans Chariow et vous est envoyée par email.</p><Link className="mt-3 inline-block font-semibold underline" to="/inscription">J’ai déjà une clé →</Link></section>
    {purchase && <Checkout plan={purchase} close={()=>setPurchase(null)}/>}
    <div className="bg-[#291d16] text-[#fff8ef]" style={{backgroundImage: "radial-gradient(ellipse at 90% 18%, #543122 0, transparent 60%), radial-gradient(ellipse at 0% 100%, #42291e 0, transparent 55%)"}}>
      <section id="demarrer" aria-labelledby="demarrer-titre" className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
        <h2 id="demarrer-titre" className="font-serif text-[clamp(2.8rem,5.5vw,5.5rem)] font-semibold leading-none tracking-tight">
          Prêt à digitaliser <em className="block text-[#e8b77e]">votre salle ?</em>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-pretty leading-relaxed text-[#ead9cb] md:text-lg">
          Choisissez votre formule, activez votre clé et mettez votre menu entre les mains de vos clients.
        </p>
        <a href="#tarifs" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#b34524] px-7 py-4 font-semibold text-white hover:bg-[#9f391c] focus-visible:outline-white">
          Choisir ma formule <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </section>
      <footer className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid items-start gap-8 border-t border-white/20 pt-9 md:grid-cols-[1.2fr_1fr_auto]">
          <a href="#accueil" className="flex w-fit items-center gap-3 font-serif text-2xl focus-visible:outline-white">
            <img src="/icons/cafe-qr-logo.png" alt="" width="48" height="48" className="rounded-lg" /> Café QR
          </a>
          <nav aria-label="Liens de pied de page" className="flex flex-col items-start gap-3 text-sm text-[#f1dfcf]">
            <Link to="/inscription" className="underline-offset-4 hover:underline focus-visible:outline-white">Activer ma clé d’accès</Link>
            <Link to="/login" className="underline-offset-4 hover:underline focus-visible:outline-white">Se connecter</Link>
          </nav>
          <small className="text-[#d7bda9]">© {new Date().getFullYear()} Café QR. Tous droits réservés.</small>
        </div>
      </footer>
    </div>
  </main>;
}
