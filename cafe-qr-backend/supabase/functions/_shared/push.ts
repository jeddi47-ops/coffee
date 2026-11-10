// Alertes push (Web Push + VAPID) envoyées à tous les téléphones du personnel d'un café.
// Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. mailto:vous@exemple.fr).
// Si l'un d'eux manque, l'envoi est ignoré : les commandes et les appels continuent de fonctionner.
import webpush from "npm:web-push@3.6.7";
import { adminClient } from "./supabase.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushMessage {
  kind: "order" | "call";
  title: string;
  body: string;
  tag: string;
}

/** Envoie le message à tous les téléphones abonnés d'employés actifs du café. */
export async function sendPushToCafe(cafeId: string, message: PushMessage): Promise<void> {
  if (!ensureConfigured()) {
    console.warn("Push ignoré : secrets VAPID_* manquants.");
    return;
  }

  const db = adminClient();
  const { data, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key, staff_members!inner(is_active)")
    .eq("cafe_id", cafeId)
    .eq("staff_members.is_active", true);
  if (error) {
    console.error("Push : lecture des abonnements impossible", error);
    return;
  }

  const payload = JSON.stringify({ ...message, url: "/staff" });
  const dead: string[] = [];

  await Promise.allSettled(
    (data ?? []).map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
          payload,
          { TTL: 300, urgency: "high" },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404 / 410 : le téléphone n'est plus abonné, on le retire.
        if (status === 404 || status === 410) dead.push(row.id);
        else console.error("Push : échec d'envoi", status ?? err);
      }
    }),
  );

  if (dead.length > 0) {
    await db.from("push_subscriptions").delete().in("id", dead);
  }
}

/** Alerte pour une table identifiée par son jeton de QR (nouvelle commande ou appel serveur). */
export async function notifyTableEvent(
  tableToken: string,
  kind: "order" | "call",
  orderNumber?: number,
): Promise<void> {
  const { data: table, error } = await adminClient()
    .from("cafe_tables")
    .select("cafe_id, label")
    .eq("qr_token", tableToken)
    .maybeSingle();
  if (error || !table) return;

  if (kind === "call") {
    await sendPushToCafe(table.cafe_id, {
      kind,
      title: `Appel : table ${table.label}`,
      body: "Un client demande un serveur.",
      tag: `call-${table.label}`,
    });
    return;
  }

  await sendPushToCafe(table.cafe_id, {
    kind,
    title: orderNumber ? `Nouvelle commande n° ${orderNumber}` : "Nouvelle commande",
    body: `Table ${table.label}`,
    tag: `order-${orderNumber ?? Date.now()}`,
  });
}

/** Lance l'envoi sans retarder la réponse au client ; une erreur d'envoi n'échoue jamais la requête. */
export function runInBackground(task: Promise<unknown>): void {
  const safe = task.catch((err) => console.error("Push : tâche d'arrière-plan échouée", err));
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(safe);
}
