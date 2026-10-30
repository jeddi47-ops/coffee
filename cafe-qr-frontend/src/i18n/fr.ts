// Tous les textes de l'interface. Un seul fichier pour pouvoir traduire plus tard.
export const fr = {
  common: {
    retry: "Réessayer",
    loading: "Chargement…",
    close: "Fermer",
  },
  menu: {
    unavailable: "Indisponible",
    add: "Ajouter",
    offer: "Offre du moment",
    empty: "Le menu n'est pas encore disponible.",
    tableLabel: (label: string) => `Table ${label}`,
    cartButton: (count: number) => `Mon panier (${count})`,
    refreshed: "Menu mis à jour",
  },
  cart: {
    title: "Mon panier",
    empty: "Votre panier est vide.",
    subtotal: "Sous-total indicatif",
    quantityLabel: "Quantité",
    lineNote: "Note pour ce plat",
    orderNote: "Note pour la commande",
    submit: "Commander",
    submitting: "Envoi en cours…",
    success: (n: number) => `Commande n° ${n} envoyée, en attente de validation par le personnel.`,
    limit50: "Maximum 50 articles par commande.",
    suspended: "Les commandes sont momentanément suspendues. Appelez un serveur.",
    remove: "Retirer",
  },
  table: {
    title: "Ma table",
    none: "Aucune commande en cours",
    total: "Total de la table",
    cancel: "Annuler",
    cancelUnavailable: "Annulation impossible depuis cet appareil.",
    callWaiter: "Appeler un serveur",
    waiterComing: "Un serveur arrive",
    disabledCall: "Appel serveur indisponible",
    status: {
      pending: "En attente de validation",
      accepted: "Acceptée",
      preparing: "En préparation",
      served: "Servie",
      cancelled: "Annulée",
    } as Record<string, string>,
  },
  notFound: {
    title: "Page introuvable",
    text: "Cette page n'existe pas.",
  },
  unsubscribe: {
    okTitle: "Vous êtes désabonné(e)",
    okText: (cafe: string) =>
      cafe
        ? `Vous ne recevrez plus les nouveautés de ${cafe}.`
        : "Vous ne recevrez plus les nouveautés de ce café.",
    invalidTitle: "Lien invalide",
    invalidText: "Ce lien de désabonnement est invalide ou a expiré.",
  },
};
