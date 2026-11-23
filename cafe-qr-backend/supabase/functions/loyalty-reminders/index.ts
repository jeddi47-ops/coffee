import webpush from "npm:web-push@3.6.7";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const secret = req.headers.get("x-loyalty-secret");
  if (!secret || secret.length > 128) return new Response("Unauthorized", {status:401});
  const db=adminClient();
  const auth=await db.rpc("loyalty_cron_authorized",{p_secret:secret});
  if(auth.error || auth.data !== true) return new Response("Unauthorized", {status:401});
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY"), privateKey = Deno.env.get("VAPID_PRIVATE_KEY"), subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return new Response("Push not configured", { status: 503 });
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const body=await req.json().catch(()=>({}));
  if(body.check_only === true) return Response.json({ready:true});
  const { data, error } = await db.rpc("loyalty_claim_reminders");
  if (error) return new Response("Unable to claim reminders", { status: 500 });
  let sent = 0, failed = 0;
  for (const card of data ?? []) {
    for (const sub of card.subscriptions ?? []) {
      try {
        // Browser endpoints are restricted to known push services to avoid arbitrary server requests.
        const host = new URL(sub.endpoint).hostname;
        if (!(host === "fcm.googleapis.com" || host.endsWith(".push.services.mozilla.com") || host === "updates.push.services.mozilla.com" || host === "web.push.apple.com" || host.endsWith(".notify.windows.com"))) { failed++; continue; }
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, JSON.stringify({
          kind: "loyalty", title: card.name, body: `Plus que ${card.remaining} tampon${card.remaining > 1 ? "s" : ""} pour ${card.reward}.`,
          tag: `loyalty-${card.id}`, url: "/compte",
        }), { TTL: 3600, urgency: "normal", timeout: 5000 });
        sent++;
      } catch (e) {
        failed++;
        if ([404, 410].includes((e as { statusCode?: number }).statusCode ?? 0)) await db.from("loyalty_push").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
  return Response.json({ sent, failed });
});
