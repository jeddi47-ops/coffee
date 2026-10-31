const hm = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dmy = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso: string): string => hm.format(new Date(iso));
export const formatDateTime = (iso: string): string => dmy.format(new Date(iso));

/** Minutes écoulées depuis iso (entier, ≥ 0). */
export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}
