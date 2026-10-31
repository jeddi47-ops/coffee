// /desabonnement : page publique sans appel d'API. Le backend a déjà traité le désabonnement
// et redirige ici (303) avec ?statut=ok&cafe=<nom> ou ?statut=invalide.
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, LinkIcon } from "lucide-react";
import { fr } from "../i18n/fr";

export default function DesabonnementPage() {
  const [params] = useSearchParams();
  const ok = params.get("statut") === "ok";
  const cafe = (params.get("cafe") ?? "").slice(0, 120);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center p-6 text-center">
      {ok ? <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" /> : <LinkIcon className="h-12 w-12 text-muted" aria-hidden="true" />}
      <h1 className="mt-4 text-xl font-semibold">{ok ? fr.unsubscribe.okTitle : fr.unsubscribe.invalidTitle}</h1>
      <p className="mt-2 text-muted">{ok ? fr.unsubscribe.okText(cafe) : fr.unsubscribe.invalidText}</p>
    </main>
  );
}
