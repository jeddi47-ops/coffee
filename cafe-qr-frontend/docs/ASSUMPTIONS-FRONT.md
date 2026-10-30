# Hypothèses frontend (lot 1)

1. **Design** : l'image de référence fournie par Marie est une idée, non une spec. On suit le cahier :
   style sobre, couleurs via variables CSS (`--accent`, `--surface`, `--ink`, `--muted`, `--radius`),
   thème par défaut clair. Pas de nom de café en dur, pas d'onglet Réservations, pas de notes/avis (hors périmètre).
2. **Appels API** : `fetch` direct vers les Edge Functions avec la clé anon en en-tête `apikey`. supabase-js
   est utilisé pour le client, Auth et Realtime dans les lots suivants.
3. **Clés d'annulation** : stockées dans `sessionStorage` (par commande), pas en `localStorage` : elles disparaissent
   avec l'onglet. Conséquence : un client qui ferme l'onglet ne peut plus annuler sa commande (message
   « Annulation impossible depuis cet appareil », affiché sous les commandes en attente qui n'ont pas de clé sur cet appareil).
4. **Panier** : `sessionStorage`, indexé par jeton de table (le jeton y figure donc comme clé d'objet, il disparaît avec l'onglet).
5. **Sous-total** : calculé localement, indicatif. Le total affiché après commande vient de `session_total_cents`
   et de `get-table-state`.
6. **Polling** : `get-table-state` toutes les 15 s, pause quand l'onglet est caché (Page Visibility). Le backend limite à 30 requêtes/min par IP et par table : 15 s laisse de la marge pour plusieurs téléphones sur le même wifi.
7. **Rechargement du menu** : au retour sur l'onglet après plus de 2 minutes.
8. **Appel serveur** : après un 429 `waiter_call_cooldown`, le bouton affiche le décompte `retry_after_seconds`.
9. **Limites** : 20 par ligne, 50 au total, notes tronquées (150 / 300) dès l'interface.
10. **Textes** : tout en français dans `src/i18n/fr.ts`. Les messages d'erreur viennent de `src/lib/errors.ts`.
11. **Non livré dans ce lot** : espace personnel, admin, auth, compte client, PWA, génération de QR, sons, Wake Lock.
12. **Build** : `npm run build` (tsc strict + vite) vérifié, sans erreur.
