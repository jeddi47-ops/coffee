// GET  /functions/v1/unsubscribe?t=<jeton>  -> désabonne, puis redirige (303) vers la page frontend :
//      ${SITE_URL}/desabonnement?statut=ok&cafe=<nom>   ou   ?statut=invalide
//      (lien présent dans les emails : la page frontend n'appelle aucune API).
// POST /functions/v1/unsubscribe?t=<jeton>  -> désabonne, réponse 204. Utilisé par la messagerie
//      (one-click RFC 8058, en-tête List-Unsubscribe).
// verify_jwt = false. Jeton = HMAC-SHA256("customer_id:cafe_id", UNSUBSCRIBE_SECRET).
import { fromDbError, handle, HttpError, requireMethod } from "../_shared/errors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { enforceIpLimit } from "../_shared/ratelimit.ts";
import { verifyUnsubscribeToken } from "../_shared/validate.ts";

function pageRedirect(siteUrl: string, statut: "ok" | "invalide", cafeName?: string | null): Response {
  const location = statut === "ok"
    ? `${siteUrl}/desabonnement?statut=ok&cafe=${encodeURIComponent(cafeName ?? "")}`
    : `${siteUrl}/desabonnement?statut=invalide`;
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

Deno.serve(handle(async (req) => {
  requireMethod(req, ["GET", "POST"]);
  await enforceIpLimit(req, "unsubscribe", 20, 60);

  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
  if (!siteUrl) throw new HttpError(500, "config_missing", "SITE_URL n'est pas configuré.");

  const isGet = req.method === "GET";
  const parsed = await verifyUnsubscribeToken(new URL(req.url).searchParams.get("t"));
  if (!parsed) {
    if (isGet) return pageRedirect(siteUrl, "invalide");
    throw new HttpError(400, "invalid_token", "Lien de désabonnement invalide ou incomplet.");
  }

  const { data, error } = await adminClient().rpc("unsubscribe_follower", {
    p_customer_id: parsed.customerId,
    p_cafe_id: parsed.cafeId,
    p_commit: true,
  });
  if (error) throw fromDbError(error);

  if (!data?.found) {
    if (isGet) return pageRedirect(siteUrl, "invalide");
    throw new HttpError(404, "subscription_not_found", "Abonnement introuvable.");
  }

  if (isGet) return pageRedirect(siteUrl, "ok", data.cafe_name ?? null);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}));
