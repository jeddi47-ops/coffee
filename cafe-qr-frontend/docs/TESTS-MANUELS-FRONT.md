# Tests manuels : frontend, lot 1 (zone client et désabonnement)

Données : seed du backend (cafés A et B). Lancer le backend en local, puis `npm run dev`.

1. `/m/0000…` (jeton inconnu) affiche « Ce QR code n'est plus valide », jamais un écran blanc.
2. `/m/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001` affiche le menu, le logo ou les initiales, « Table 1 ».
3. Espresso (indisponible) : « Indisponible », pas de bouton Ajouter ; un produit en promo affiche son `promo_label`.
4. Ajouter 2 espressos, commander : la réponse affiche « Commande n° X envoyée ». Le total du suivi égale `total_cents` du serveur.
5. Onglet réseau : le corps de `create-order` ne contient aucun prix.
6. Ajouter 21 fois le même produit : bloqué à 20. Passer le total à 50 : bouton désactivé et message affiché.
7. Après commande : bouton « Annuler » visible tant que la commande est `pending`, puis disparaît après acceptation côté personnel.
8. Cliquer « Appeler un serveur » deux fois : pas d'erreur, le bouton devient « Un serveur arrive ».
9. Après le 429 du délai de répit : bouton « Patientez N s » jusqu'à la fin du décompte.
10. Masquer l'onglet : aucune requête pendant l'absence (onglet réseau), reprise au retour.
11. `/desabonnement?statut=ok&cafe=Caf%C3%A9%20A` affiche « Vous ne recevrez plus les nouveautés de Café A. ».
12. `/desabonnement?statut=invalide` affiche « Lien invalide ». Aucun appel réseau sur cette page.
