# Hypothèses frontend (V1 complète)

## Design
1. **Maquette Sushi Zen (section 13)** : reprise de la structure (logo et nom centrés, recherche, pastilles
   défilables, « À la une », cartes avec badge et bouton « + » rond, barre du bas à 4 entrées avec Panier central),
   sans notes, réservations, filtres avancés, « Voir tout », bandeau à pourcentage ni texte sur photo.
2. Sans photo, la carte de catégorie devient compacte (initiale 48 px) ; la carte « À la une » affiche seulement
   le badge en tête. Vérifié en captures avec le seed (aucune image).
3. Police : pile système (Inter si installée). Aucune police téléchargée, pour la performance.
4. **Contraste au-delà du cahier** : en plus du 4,5:1 texte/accent, l'accent est ajusté s'il est quasi invisible sur
   le fond (écart < 2:1 en sombre, < 1,25:1 en clair). Constaté en capture : #111111 en mode sombre rendait boutons
   et pastilles invisibles. L'admin affiche « Couleur ajustée automatiquement ».
5. Composants `src/components/ui/` écrits à la manière de shadcn/ui (cva + tailwind-merge + clsx), **sans Radix**
   pour limiter les dépendances. Remplaçables par `npx shadcn add …` sans changer les pages.
6. Icônes : `lucide-react` (import par icône, arbre secoué), toujours accompagnées d'un texte ou d'un `aria-label`.

## Client
7. Polling `get-table-state` : **8 s tant qu'une commande est en attente** (critère 8 : « Annuler » disparaît en
   moins de 10 s), 15 s sinon (correctif de Marie : marge sur 30 req/min par IP et par table). Pause onglet caché.
8. `cancel_key` en sessionStorage par commande. Onglet fermé = plus d'annulation possible depuis cet appareil
   (message affiché sous la commande).
9. Panier et note de commande en sessionStorage, indexés par jeton (le jeton figure comme clé, il disparaît avec l'onglet).
10. Ajout au panier : petit message de confirmation (toast) ; limites 20 par ligne et 50 au total bloquées dès l'interface.
11. `FollowDialog` : la case de consentement est obligatoire pour envoyer et n'est jamais pré-cochée ;
    `newsletter_opt_in: true` est transmis dans les métadonnées (requis par le backend v1.1).
12. Client **déjà inscrit** : Supabase ignore les métadonnées d'inscription. Le slug est mémorisé (localStorage) et
    `/auth/callback` appelle `follow_cafe` après connexion. Client déjà connecté : `follow_cafe` directement.
13. `/compte` sans session : formulaire « recevoir un lien de connexion » (`shouldCreateUser: false`).
14. Réactiver les emails dans `/compte` remet aussi `unsubscribed_at` à `null`.

## Auth
15. `flowType: "implicit"` : les liens (invitation, réinitialisation, lien magique) arrivent avec un fragment `#…`.
    Le type de lien est lu **avant** la création du client Supabase (qui nettoie l'URL).
16. Invitation / réinitialisation → `/auth/mot-de-passe` ; lien magique client → `/compte` ; employé → son espace.
17. Le backend envoyait les invitations vers `/staff` : corrigé vers `/auth/callback` (backend v1.4). Par sécurité,
    `main.tsx` redirige tout lien d'authentification vers `/auth/callback`, quelle que soit la page d'arrivée.
18. Expiration de session non rafraîchissable : retour à `/login` avec « Votre session a expiré ».
19. Un employé désactivé en cours de service est déconnecté à la première action refusée (403) ou au rechargement.

## Personnel
20. Écran de service : onglets Commandes (2 colonnes dès la tablette), Appels (compteur), Tables, Ruptures.
21. « Mode nuit » (contraste élevé sur fond noir) mémorisé localement, en plus de l'interrupteur Son.
22. Refuser une commande = transition vers `cancelled`, uniquement sur `pending`, avec confirmation.
23. Une session « ouverte » mais périmée est signalée « Inactive depuis longtemps » ; « Table réglée » reste possible.
24. Service worker minimal (`public/sw.js`) enregistré seulement en production, sans aucun cache.

## Admin
25. Ordre des catégories/produits : boutons Monter/Descendre (positions renumérotées 1..n).
26. Supprimer une catégorie non vide ou une table avec historique est refusé par la base : message dédié.
27. Remplacement d'une photo : l'ancienne est supprimée du Storage (au mieux, sans bloquer).
28. Plaquettes : 6 par page A4 (2 × 3), logo ou initiales, nom du café, QR, « Table X », « Scannez pour voir le menu ».
    Le QR reste noir sur blanc quel que soit le thème (fiabilité du scan).
29. Devise : champ code ISO à 3 lettres validé. Nom, devise et avancés : bouton Enregistrer ; interrupteurs de service : enregistrés immédiatement.
30. Thème : nécessite la migration backend `0005_cafe_theme.sql`. Si elle est absente, l'enregistrement est refusé
    avec un message clair et le menu client garde le thème par défaut.

## Vérifications
31. TypeScript strict vérifié (0 erreur) avec des définitions minimales pour React, React Router, Zustand et
    supabase-js : les vrais paquets n'étaient pas installables hors ligne. `npm run build` reste à lancer.
32. Zone client rendue dans Chromium avec les données du seed (cafés A et B, accents #FFE066 et #111111, sans thème,
    pause commandes, recherche, panier, Ma table) : aucune erreur console. `/staff` et `/admin` non rendus visuellement.
