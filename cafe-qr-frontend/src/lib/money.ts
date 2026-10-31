// Montants en centimes entiers. Seul point d'affichage monétaire de l'application.
const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency: string): string {
  const safe = Number.isInteger(cents) ? cents : Math.round(cents);
  let f = formatters.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat("fr-FR", { style: "currency", currency });
    } catch {
      f = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
    }
    formatters.set(currency, f);
  }
  return f.format(safe / 100);
}

/** "3,50" ou "3.5" -> 350. Renvoie null si invalide ou négatif. */
export function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 100_000_00 ? cents : null;
}

/** 350 -> "3,50" pour un champ de saisie. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
