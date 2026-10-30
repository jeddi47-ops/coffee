// GET  /functions/v1/unsubscribe?t=<jeton>  -> vérifie le lien (lecture seule), renvoie JSON.
// POST /functions/v1/unsubscribe?t=<jeton>  -> désabonne. Appelé par la page /desabonnement du
//      frontend, et par la messagerie (one-click, RFC 8058) via l'en-tête List-Unsubscribe.
// verify_jwt = false. Jeton = HMAC-SHA256("customer_id:cafe_id", UNSUBSCRIBE_SECRET).
// Aucune page HTML ici : les réponses sont du JSON, donc pas de risque text/plain.
import { fromDbError, handle, HttpError, json, requireMethod } from "../_shared/errors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { enforceIpLimit } from "../_shared/ratelimit.ts";
import { verifyUnsubscribeToken } from "../_shared/validate.ts";

Deno.serve(handle(async (req) => {
  requireMethod(req, ["GET", "POST"]);
  await enforceIpLimit(req, "unsubscribe", 20, 60);

  const parsed = await verifyUnsubscribeToken(new URL(req.url).searchParams.get("t"));
  if (!parsed) {
    throw new HttpError(400, "invalid_token", "Lien de désabonnement invalide ou incomplet.");
  }

  const commit = req.method === "POST";
  const { data, error } = await adminClient().rpc("unsubscribe_follower", {
    p_customer_id: parsed.customerId,
    p_cafe_id: parsed.cafeId,
    p_commit: commit,
  });
  if (error) throw fromDbError(error);
  if (!data?.found) {
    throw new HttpError(404, "subscription_not_found", "Abonnement introuvable.");
  }

  return json(req, {
    cafe_name: data.cafe_name ?? null,
    unsubscribed: Boolean(data.unsubscribed),
  }, 200);
}));
