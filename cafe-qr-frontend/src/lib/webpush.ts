// Alertes push du personnel (Web Push). L'abonnement du téléphone est enregistré côté serveur
// par la fonction SQL staff_register_push. Clé publique VAPID uniquement dans le frontend.
import { supabase } from "./supabase";
import { fromPostgrest } from "./errors";

const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

export type PushState = "not-configured" | "unsupported" | "needs-install" | "default" | "granted" | "denied";

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function keyToBytes(base64Url: string) {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** État actuel des alertes sur ce téléphone. */
export function getPushState(): PushState {
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // iPhone : les alertes n'existent que si l'app est ajoutée à l'écran d'accueil (iOS 16.4 ou plus).
  if (!supported) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

async function serviceWorkerReady(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

function sameKey(sub: PushSubscription): boolean {
  const current = sub.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = keyToBytes(VAPID_PUBLIC_KEY);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function subscribeAndRegister(): Promise<void> {
  const reg = await serviceWorkerReady();
  let sub = await reg.pushManager.getSubscription();
  // Clé VAPID changée : l'ancien abonnement ne marcherait plus.
  if (sub && !sameKey(sub)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error("Abonnement push incomplet");

  const { error } = await supabase.rpc("staff_register_push", {
    p_endpoint: json.endpoint,
    p_p256dh: p256dh,
    p_auth_key: auth,
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw fromPostgrest(error);
}

/** À appeler depuis un toucher de l'utilisateur (obligatoire pour demander l'autorisation). */
export async function enablePush(): Promise<PushState> {
  const state = getPushState();
  if (state !== "default" && state !== "granted") return state;
  if (state === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "denied" : "default";
  }
  await subscribeAndRegister();
  return "granted";
}

/** Au chargement de l'écran de service : remet l'abonnement à jour si l'autorisation est déjà donnée. */
export async function ensurePushRegistered(): Promise<void> {
  if (getPushState() !== "granted") return;
  try {
    await subscribeAndRegister();
  } catch {
    // Le service reste utilisable sans alertes en arrière-plan.
  }
}
