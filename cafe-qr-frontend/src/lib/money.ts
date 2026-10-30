// Montants en centimes entiers. Seul point d'affichage monétaire.
export function formatMoney(cents: number, currency: string): string {
  if (!Number.isInteger(cents)) throw new Error("Montant non entier");
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}
