// POST /functions/v1/send-announcement   (personnel, verify_jwt = true)
// owner et manager. Corps : { announcement_id }
// draft -> sending (atomique) -> envoi Resend par lots -> sent.
// Si aucun email n'est transmis : retour en draft (quota libéré) et erreur 502 / 409.
import { fromDbError, handle, HttpError, json, requireMethod } from "../_shared/errors.ts";
import { adminClient, publicAssetUrl, requireStaff, supabaseUrl } from "../_shared/supabase.ts";
import { enforceIpLimit, enforceRateLimit } from "../_shared/ratelimit.ts";
import { parseWith, readJsonBody, signUnsubscribeToken, z } from "../_shared/validate.ts";

const schema = z.object({ announcement_id: z.string().uuid() });

const BATCH_SIZE = 100; // maximum de l'API batch Resend
const RESEND_URL = "https://api.resend.com/emails/batch";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function fromAddress(cafeName: string): string {
  const mailFrom = Deno.env.get("MAIL_FROM") ?? "";
  const match = /<([^>]+)>/.exec(mailFrom);
  const address = (match ? match[1] : mailFrom).trim();
  if (!address) throw new Error("MAIL_FROM manquant");
  const name = cafeName.replace(/["<>\r\n\\]/g, "").slice(0, 60);
  return `"${name}" <${address}>`;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  cafe_name: string;
  cafe_slug: string;
  sending_started_at: string;
}

async function buildEmail(
  ann: Announcement,
  cafeId: string,
  recipient: { customer_id: string; email: string },
) {
  const token = await signUnsubscribeToken(recipient.customer_id, cafeId);
  // Lien visible : GET sur la fonction, qui désabonne puis redirige vers ${siteUrl}/desabonnement.
  const unsubscribeUrl = `${supabaseUrl()}/functions/v1/unsubscribe?t=${encodeURIComponent(token)}`;
  const imageUrl = publicAssetUrl(ann.image_path);
  const subject = `${ann.cafe_name} : ${ann.title}`.replace(/[\r\n]+/g, " ").slice(0, 200);

  const html = `<!doctype html><html lang="fr"><body style="font-family:system-ui,sans-serif;color:#222;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px">${escapeHtml(ann.title)}</h1>
${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" style="max-width:100%;border-radius:8px">` : ""}
<p style="line-height:1.6;white-space:pre-line">${escapeHtml(ann.body)}</p>
<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px">
<p style="font-size:12px;color:#888">Vous recevez cet email car vous suivez ${escapeHtml(ann.cafe_name)}.
<a href="${escapeHtml(unsubscribeUrl)}" style="color:#888">Se désabonner</a></p>
</body></html>`;

  const text = `${ann.title}\n\n${ann.body}\n\n--\nVous recevez cet email car vous suivez ${ann.cafe_name}.\nSe désabonner : ${unsubscribeUrl}\n`;

  return {
    from: fromAddress(ann.cafe_name),
    to: [recipient.email],
    subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

async function sendBatch(emails: unknown[], idempotencyKey: string): Promise<boolean> {
  if (Deno.env.get("EMAIL_DRY_RUN") === "true") {
    console.log(`[EMAIL_DRY_RUN] lot ${idempotencyKey} : ${emails.length} email(s) non envoyé(s)`);
    return true;
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY manquant");

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(emails),
    });
    if (res.ok) return true;
    const detail = await res.text().catch(() => "");
    console.error(`Resend lot ${idempotencyKey} tentative ${attempt} : HTTP ${res.status} ${detail.slice(0, 300)}`);
    if (res.status < 500 && res.status !== 429) return false;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  await enforceIpLimit(req, "send-announcement", 10, 60);

  const caller = await requireStaff(req, ["owner", "manager"]);
  await enforceRateLimit(`user:send-announcement:${caller.userId}`, 5, 60);

  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
  if (!siteUrl) throw new HttpError(500, "config_missing", "SITE_URL n'est pas configuré.");

  const body = parseWith(schema, await readJsonBody(req, 1024));
  const admin = adminClient();

  // draft -> sending, atomique, quota 3 / 24 h (409 si déjà envoyée).
  const { data: started, error: startError } = await admin.rpc("begin_announcement_send", {
    p_announcement_id: body.announcement_id,
    p_cafe_id: caller.cafeId,
  });
  if (startError) throw fromDbError(startError);
  const ann = started as Announcement;

  let sent = 0;
  let failed = 0;
  let batchIndex = 0;
  let cursor: string | null = null;
  let fatal = false;

  try {
    while (true) {
      const { data: rows, error } = await admin.rpc("announcement_recipients", {
        p_cafe_id: caller.cafeId,
        p_after: cursor,
        p_limit: BATCH_SIZE,
      });
      if (error) throw fromDbError(error);
      const recipients = (rows ?? []) as { customer_id: string; email: string }[];
      if (recipients.length === 0) break;

      const emails = await Promise.all(recipients.map((r) => buildEmail(ann, caller.cafeId, r)));
      // La clé inclut sending_started_at : un nouvel essai après retour en draft n'est pas
      // confondu avec un envoi précédent côté Resend.
      const ok = await sendBatch(emails, `announcement:${ann.id}:${ann.sending_started_at}:batch:${batchIndex}`);
      if (ok) sent += recipients.length;
      else failed += recipients.length;

      cursor = recipients[recipients.length - 1].customer_id;
      batchIndex++;
      if (recipients.length < BATCH_SIZE) break;
      await new Promise((r) => setTimeout(r, 600)); // limite de débit Resend
    }
  } catch (err) {
    fatal = true;
    console.error("Envoi d'annonce interrompu", err);
  }

  if (sent === 0) {
    const { error: revertError } = await admin.rpc("revert_announcement_send", { p_announcement_id: ann.id });
    if (revertError) console.error("revert_announcement_send", revertError);
    if (fatal || failed > 0) {
      throw new HttpError(502, "send_failed",
        "Aucun email n'a pu être transmis. L'annonce repasse en brouillon : vous pouvez réessayer.");
    }
    throw new HttpError(409, "no_recipients",
      "Aucun abonné ne peut recevoir cette annonce. Elle reste en brouillon.");
  }

  // Au moins un email transmis : on enregistre le nombre réel (pas de renvoi automatique,
  // pour éviter les doublons). Les échecs partiels remontent en "partial" et failed_count.
  const { error: finishError } = await admin.rpc("finish_announcement_send", {
    p_announcement_id: ann.id,
    p_sent_count: sent,
  });
  if (finishError) throw fromDbError(finishError);

  const status = fatal || failed > 0 ? "partial" : "sent";
  return json(req, { announcement_id: ann.id, status, sent_count: sent, failed_count: failed }, 200);
}));
