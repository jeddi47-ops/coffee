// Traduction des codes d'erreur de l'API en messages français. Jamais de message brut.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: number,
  ) {
    super(code);
  }
}

const MESSAGES: Record<string, string> = {
  table_not_found: "Ce QR code n'est plus valide. Demandez de l'aide au personnel.",
  cafe_inactive: "Ce café n'est pas disponible pour le moment.",
  ordering_disabled: "Les commandes sont momentanément suspendues. Appelez un serveur.",
  product_unavailable: "Un produit de votre panier vient de devenir indisponible.",
  product_not_found: "Un produit de votre panier n'existe plus.",
  table_rate_limited: "Trop de commandes pour cette table. Réessayez dans quelques minutes.",
  rate_limited: "Trop de requêtes. Réessayez dans un instant.",
  order_not_pending: "La commande est déjà prise en charge, elle ne peut plus être annulée.",
  order_not_cancellable: "Cette commande ne peut plus être annulée.",
  order_not_found: "Commande introuvable.",
  waiter_call_cooldown: "Un serveur vient de passer. Merci de patienter.",
  call_waiter_disabled: "L'appel serveur est désactivé dans ce café.",
  invalid_quantity: "La quantité doit être comprise entre 1 et 20.",
  too_many_items: "Maximum 50 articles par commande.",
  validation_error: "Votre demande n'a pas pu être validée.",
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0 || err.status >= 500) {
      return "Un problème est survenu. Vérifiez votre connexion et réessayez.";
    }
    return MESSAGES[err.code] ?? "Une erreur est survenue. Réessayez.";
  }
  return "Une erreur est survenue. Réessayez.";
}
