import { useSearchParams } from "react-router-dom";
import { fr } from "../i18n/fr";

// Page publique : aucun appel d'API. Le backend a déjà traité le désabonnement
// et redirige ici avec ?statut=ok&cafe=<nom> ou ?statut=invalide.
export function DesabonnementPage() {
  const [params] = useSearchParams();
  const ok = params.get("statut") === "ok";
  const cafe = params.get("cafe") ?? "";

  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-semibold">
        {ok ? fr.unsubscribe.okTitle : fr.unsubscribe.invalidTitle}
      </h1>
      <p className="mt-2 text-muted">
        {ok ? fr.unsubscribe.okText(cafe) : fr.unsubscribe.invalidText}
      </p>
    </main>
  );
}
