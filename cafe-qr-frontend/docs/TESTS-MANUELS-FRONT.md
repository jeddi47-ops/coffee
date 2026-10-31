# Tests manuels frontend (critères section 12 + thème section 14)

## Préparation
1. Backend local : `supabase start`, `supabase db reset` (applique 0001→0005, `seed.sql` puis `seed-theme.sql`),
   `supabase functions serve --env-file supabase/functions/.env` avec `ALLOWED_ORIGINS=http://localhost:5173`,
   `SITE_URL=http://localhost:5173`, `EMAIL_DRY_RUN=true`.
2. Frontend : `.env` avec `VITE_SUPABASE_URL=http://127.0.0.1:54321`, la clé anon de `supabase status`,
   `VITE_SITE_URL=http://localhost:5173`, puis `npm run dev`.
3. Jetons : `TA1…TA5 = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa000N`, `TB1 = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0001`.
   Comptes : `owner-a@cafe-a.test`, `waiter-a@cafe-a.test`, `owner-b@cafe-b.test` (mot de passe `Password123!`).
   Les emails locaux (invitations, liens) arrivent dans la boîte mail de la stack locale (`supabase status`).

## Critères section 12
| # | Procédure | Attendu |
|---|---|---|
| 1 | Ouvrir `/m/ffffffffffffffffffffffffffffffffffff` puis `/m/abc` | Page « QR code non valide », jamais d'écran blanc ni de texte technique |
| 2 | Ouvrir `/m/TA1` | Menu en 3 catégories, Cappuccino dans « À la une » avec « Offre du moment », Thé glacé grisé « Indisponible » sans bouton « + » |
| 3 | Ajouter 2 Espresso, ouvrir Panier, Commander | « Commande n° X envoyée… », panier vidé ; Ma table : total = `total_cents` de la réponse `get-table-state` (onglet réseau) |
| 4 | Onglet réseau, requête `create-order` | Corps : `token`, `items[{product_id, quantity, note?}]`, `note?`, `order_type` ; **aucun prix** |
| 5 | Admin owner A : Réglages → « Mettre les commandes en pause » ; recharger `/m/TA1` | Bouton Panier et « + » absents, bandeau « Les commandes sont momentanément suspendues… » ; bouton Serveur actif |
| 6 | Sur `/m/TA3`, passer 6 commandes de suite | 6e : message « Beaucoup de commandes… », bouton « Patientez N s » désactivé jusqu'à 0, aucune requête automatique (onglet réseau) |
| 7 | `/m/TA4` : appuyer 2 fois sur Serveur | « Un serveur arrive », pas d'erreur. `/staff` (waiter A) : « Pris en charge ». Sous 15 s le bouton redevient « Serveur ». Nouvel appui immédiat : décompte du délai de répit |
| 8 | Commander sur `/m/TA2`, ouvrir Ma table | « Annuler » visible. Accepter dans `/staff` : « Annuler » disparaît en moins de 10 s (polling 8 s en attente) |
| 9 | Annuler une commande pending | Commande barrée, « Exclue du total », total réduit d'autant |
| 10 | Onglet réseau ouvert, changer d'onglet 30 s puis revenir | Aucune requête `get-table-state` pendant l'absence ; une requête immédiate au retour |
| 11 | `/staff` (waiter A), « Démarrer le service » ; commander depuis `/m/TA1` sur un autre appareil | Carte en < 2 s + son (2 notes) ; appel serveur : son différent (3 bips) + compteur sur l'onglet Appels |
| 12 | Sur `/staff`, DevTools → Network → Offline 30 s, puis Online | Bandeau « Connexion perdue, mise à jour toutes les 15 s », puis disparition et resynchronisation complète |
| 13 | Carte pending : seul « Accepter » (+ Refuser) ; accepted : « En préparation » ; preparing : « Servie ». Ouvrir `/staff` sur 2 écrans, accepter sur l'un puis cliquer « Accepter » sur l'autre avant mise à jour | Message « Ce changement de statut n'est plus possible… », état rechargé |
| 14 | `/staff` → Tables → « Table réglée » sur la table 1, confirmer ; ouvrir `/m/TA1` → Ma table | « Aucune commande en cours », total 0,00 € |
| 15 | Connecté waiter A, ouvrir `/admin` ; connecté manager, ouvrir `/admin/equipe` et `/admin/reglages` | Waiter → `/staff` ; manager → `/admin`, liens Équipe et Réglages absents du menu |
| 16 | Admin → Menu → Nouveau produit avec une photo JPEG de 6 Mo ; ouvrir `/m/TA1` dans les 30 s | Photo visible (4:3) ; dans Storage : `{cafe_id}/products/<uuid>.webp`, < 2 Mo, ≤ 1200 px |
| 17 | Admin → Tables : scanner le QR de la table 5 | Ouvre `${VITE_SITE_URL}/m/<qr_token>`. « Régénérer le QR » + confirmer : l'ancienne URL affiche « QR code non valide » |
| 18 | Admin → Nouveautés : créer, Envoyer | Confirmation « Envoyer… à 1 abonné actif » ; résultat « Envoyée à 1 abonné » ; l'annonce s'ouvre en lecture seule ; aucun email affiché nulle part |
| 19 | S'abonner depuis `/m/TA1` (« Recevoir les nouveautés »), suivre le lien, `/compte` → Supprimer (2 étapes) | Compte supprimé. Avec un compte employé, `/compte` redirige vers son espace (pas de suppression possible) |
| 20 | `npm run check:secrets` | « Dépôt propre » : ni clé de service, ni clé, ni `console.log`, ni `dangerouslySetInnerHTML` |

## Critères complémentaires (thème, section 14)
| # | Procédure | Attendu |
|---|---|---|
| T1 | Ouvrir `/m/TA1` puis `/m/TB1` | A : fond sombre, accent rouge #C0392B, phrase d'accroche ; B : fond clair, accent vert #2F6B4F, pas de phrase |
| T2 | Admin owner → Réglages → Apparence : saisir #FFE066 puis #111111 (mode sombre) | Aperçu : texte des boutons lisible (sombre sur jaune 11,9:1 ; blanc sur gris 7,5:1), mention « Couleur ajustée » pour #111111 |
| T3 | DevTools → Overrides : réponse `get-menu` sans `theme` ni `tagline` | Aucune erreur, thème par défaut (#8B5E3C, clair) |
| T4 | Seed sans image ; puis une photo très sombre et une très claire | Cartes propres sans photo (initiale) ; photos recadrées 4:3, aucun texte posé dessus |
| T5 | Owner : enregistrer un thème ; client sous 30 s. Saisir `#12345` | Thème visible côté client ; hexadécimal refusé (« Format attendu… »). Manager : `/admin/reglages` inaccessible, donc pas de bloc Apparence |
| T6 | `npm run check:secrets` (règle « couleur en dur ») | Aucune couleur `#…`, `rgb(`, ni classe de couleur fixe dans `src/pages/customer` et `src/components` |

## Tests supplémentaires
- `/desabonnement?statut=ok&cafe=Caf%C3%A9%20A` → « Vous ne recevrez plus les nouveautés de Café A. » ; `?statut=invalide` → « Lien invalide » ; aucun appel réseau.
- Invitation d'un employé (Équipe) : le lien reçu mène à `/auth/mot-de-passe`, puis à `/staff` ou `/admin` selon le rôle.
- « Mot de passe oublié » sur `/login` : même message que le compte existe ou non.
- Impression : Tables → « Imprimer les plaquettes » → aperçu A4, 6 plaquettes par page, rien d'autre de la page.
