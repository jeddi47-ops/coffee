import { BellRing, Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { fr } from "../../i18n/fr";
import "./waiter-call.css";

type Phase = "ready" | "sending" | "waiting" | "handled";

const copy: Record<Phase, [string, string]> = {
  ready: ["Besoin d’un serveur ?", "Prévenez l’équipe de votre table en un geste."],
  sending: ["Envoi de l’appel…", "Nous transmettons votre demande à l’équipe."],
  waiting: ["Appel envoyé", "L’équipe a reçu votre demande. Vous pouvez retourner au menu."],
  handled: ["Demande prise en charge", "L’équipe a traité l’appel de votre table."],
};

function ServiceScene({ phase }: { phase: Phase }) {
  return (
    <div className="service-scene" data-phase={phase} aria-hidden="true">
      <div className="service-halo" />
      <div className="service-counter" />
      <div className="service-bell">
        <div className="service-foot" />
        <div className="service-dome"><i className="service-plunger" /></div>
        <i className="service-echo left" /><i className="service-echo right" />
      </div>
      <div className="service-portrait">
        <svg viewBox="0 0 120 140" fill="none" stroke="#f0d599" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <g className="service-attendant">
            <path d="M69 61v10l9 6M51 61v10l-9 6" />
            <path d="M46 39q0-20 15-20t15 19l-2 13q-2 12-13 14-12-1-15-15z" fill="#674b36" />
            <path d="M46 40q-6-24 13-25 20-2 19 19-12-1-17-8-5 10-15 14z" fill="#342b26"/>
            <path d="M32 125l3-36q1-9 15-14l11 12 11-12q15 4 17 18l2 32" fill="#e4d7b7"/>
            <path d="M49 77l12 23 12-23 7 5-4 43H44l-4-43z" fill="#242321"/>
            <path d="M54 80l7 3 6-3v8l-6-3-7 3z" fill="#bd9452" strokeWidth="1"/>
            <path d="M40 94l-7 16-14-7-5 6 19 13q5 2 8-4l6-13" fill="#ded1af"/>
            <path d="M6 101h27M10 97q2-10 10-10t10 10M20 87v-2" />
          </g>
        </svg>
      </div>
      {phase === "handled" && <span className="service-seal"><Check size={20} strokeWidth={3} /></span>}
    </div>
  );
}

export function CallWaiterView({ tableLabel, busy, waiting, handled, cooldown, onCall }: {
  tableLabel: string;
  busy: boolean;
  waiting: boolean;
  handled: boolean;
  cooldown: number;
  onCall: () => void;
}) {
  let phase: Phase = "ready";
  if (busy) phase = "sending";
  else if (waiting) phase = "waiting";
  else if (handled) phase = "handled";
  const [title, description] = copy[phase];
  return (
    <section aria-labelledby="service-title" className="mx-auto w-full max-w-md px-5 pb-8" style={{ paddingTop: "calc(80px + env(safe-area-inset-top, 0px))" }}>
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-lg">
        <ServiceScene phase={phase} />
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-muted">{tableLabel}</p>
          <div role="status" aria-atomic="true">
            <h1 id="service-title" className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
          </div>
          {(phase === "ready" || phase === "handled") && <Button className="mt-6 w-full" disabled={cooldown > 0} onClick={onCall}>
            <BellRing size={18} aria-hidden="true" />
            {cooldown > 0 ? fr.table.callCooldown(cooldown) : fr.table.callAction}
          </Button>}
        </div>
      </div>
    </section>
  );
}
