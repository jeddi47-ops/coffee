# Hypothèses prises (Café QR V1)

Règle appliquée : en cas d'ambiguïté, l'option la plus sûre a été choisie.

## Modèle de données
1. **Clés étrangères composites** `(xxx_id, cafe_id)` entre tables d'un même café : une commande ne peut
   physiquement pas pointer vers une table, une session ou une catégorie d'un autre café.
2. **Un seul owner par café** (index unique partiel).
3. Pas de suppression en cascade de l'historique : une table, une session ou une catégorie qui a des
   lignes liées ne peut pas être supprimée (la désactiver / la vider). Supprimer un café (admin) supprime tout.
4. `order_items.product_id` passe à `null` si le produit est supprimé ; les snapshots conservent nom et prix.
5. `rate_limit_hits` : id `bigint identity` (pas d'uuid, table à fort débit) et pas de `cafe_id`.
6. Colonne ajoutée `announcements.sending_started_at` pour le quota 24 h et l'anti double envoi.
7. Chemins d'images contrôlés en base : `logo_path` commence par `{cafe_id}/logo/`, `image_path` par `{cafe_id}/`.
8. `customers.email` est resynchronisé si l'email Auth change.

## Sécurité / accès
9. **Café inactif** : le personnel perd tout accès (lecture comprise) et les routes publiques renvoient 403.
10. **Lecture publique du menu réservée au rôle `anon`** : un employé connecté du café A ne lit pas le menu
    du café B via l'API REST (critère 1 au sens strict). Le menu public passe de toute façon par `get-menu`.
11. **Défense en profondeur** : en plus de la RLS, les privilèges de table sont retirés puis ré-accordés
    colonne par colonne (ex. `qr_token`, `is_active` du café, `status` d'une annonce ne sont jamais modifiables
    par un client).
12. `rate_limit_hits` n'a aucun droit pour anon/authenticated ; une policy **restrictive « tout refuser »**
    est créée pour respecter « aucune table sans policy ». La migration 0002 échoue si une table de `public`
    n'a pas la RLS ou n'a aucune policy.
13. Les métadonnées d'inscription sont contrôlées par le client : `signup_type = 'staff'` ne donne aucun droit,
    les lignes `staff_members` ne sont créées que par `create-staff` ou le script admin.
14. Une adresse email = un seul type de compte en V1 : `create-staff` renvoie 409 si l'email existe déjà
    (y compris un compte client). `delete_my_account` refuse les comptes employés.
15. Une requête navigateur dont l'`Origin` n'est pas dans `ALLOWED_ORIGINS` est refusée (403), pas seulement
    privée d'en-têtes CORS. Les appels sans `Origin` (curl, serveur) sont acceptés.
16. Les IP sont **hachées** (SHA-256 tronqué) avant stockage dans `rate_limit_hits`. IP lue dans
    `cf-connecting-ip`, puis `x-real-ip`, puis le premier élément de `x-forwarded-for`.
17. Codes HTTP ajoutés à la liste du cahier des charges : 401 (JWT), 405 (méthode), 413 (corps trop gros).

## Commandes
18. « 50 articles par commande » = **somme des quantités** ≤ 50 (donc aussi ≤ 50 lignes).
19. Un produit d'une **catégorie masquée** n'apparaît pas au menu et ne peut pas être commandé (404).
20. Produit inconnu / d'un autre café : 404 `product_not_found`. Produit indisponible : 409 `product_unavailable`.
    `product_id` mal formé : 400.
21. Un jeton de table **mal formé** est traité comme inconnu : 404.
22. Champs inconnus dans `create-order` (ex. `price_cents`) **ignorés silencieusement** (supprimés par la
    validation), conformément à « les prix envoyés par le client sont ignorés ».
23. `options` : stockées telles quelles, **sans impact sur le prix** en V1 (liste de 20 éléments max :
    chaînes ≤ 100 caractères ou objets plats).
24. La limite par table (`order_rate_limit` / 10 min) compte **toutes** les commandes, annulées comprises.
25. Les validations de la commande sont faites avant l'ouverture de session (même transaction : aucun effet
    de bord en cas d'erreur).
26. `cancel-order` refuse aussi (409) une commande appartenant à une session fermée ou périmée : un client
    arrivant plus tard à la même table ne peut pas annuler la commande du précédent.
27. `cancelled_by` vaut `customer` ou l'uuid (texte) de l'employé.

## Sessions et appels serveur
28. Session périmée : fermée paresseusement à la commande suivante (`closed_by = null`), ignorée par
    `get-table-state` et `call-waiter`.
29. `staff_close_session` traite aussi les appels serveur encore ouverts de la table.
30. `staff_handle_waiter_call` et `staff_close_session` sont idempotents (déjà traité/fermé : renvoyé tel quel).
31. `owner_set_staff_active` : l'owner ne peut ni se désactiver ni se réactiver lui-même (409) ; il peut
    réactiver un employé.

## Limites de débit (par IP sauf mention)
32. `get-menu` 60/min (cahier des charges) ; `create-order` 10/min (cahier des charges) ;
    `get-table-state` 30/min par (IP, table) + 600/min par IP (polling, wifi partagé du café) ;
    `cancel-order` 20/min ; `call-waiter` 10/min ; `unsubscribe` 20/min ;
    `create-staff` 20/min + 20/h par owner ; `send-announcement` 10/min + 5/min par employé.
    ⚠ Tous les clients d'un café partagent souvent la même IP publique : surveiller les 429 en production.
33. `check_rate_limit` n'enregistre que les hits **autorisés** (table bornée à `p_max` lignes par clé et par
    fenêtre). Le `retry_after_seconds` renvoyé pour la limite IP est la durée de la fenêtre (borne haute).

## Annonces et emails
34. Quota « 3 annonces / 24 h » = fenêtre glissante sur `sending_started_at`, statuts `sending` et `sent`.
35. Si un lot Resend échoue, l'annonce passe quand même à `sent` avec le `sent_count` réel (jamais renvoyée :
    pas de doublon). Si la fonction est interrompue (timeout), l'annonce reste `sending` : remise à `draft`
    manuelle par l'admin si besoin.
36. Volume : l'envoi se fait dans la requête (lots de 100 + pause 600 ms). Au-delà de quelques milliers
    d'abonnés, prévoir une file d'attente (V2) à cause de la durée max d'une Edge Function.
37. `EMAIL_DRY_RUN=true` (optionnel) : n'appelle pas Resend, compte les emails comme envoyés (tests).
38. L'expéditeur affiché est le nom du café, avec l'adresse de `MAIL_FROM`.
39. **Désabonnement** : `GET` désabonne directement (conforme au cahier des charges). Risque connu : certains
    antivirus de messagerie ouvrent les liens et peuvent désabonner sans action de l'utilisateur. `POST`
    one-click (RFC 8058) est aussi accepté.
40. À vérifier au déploiement : Supabase peut servir les réponses `text/html` des Edge Functions en
    `text/plain` sur le domaine par défaut `*.supabase.co`. Si c'est le cas, utiliser un domaine personnalisé
    ou faire pointer le lien vers une page du frontend qui appelle `unsubscribe` en POST.

## Storage / Realtime
41. Dossier ajouté `{cafe_id}/announcements/` pour les images d'annonces (le cahier des charges ne prévoyait
    que `products` et `logo`).
42. Pas de policy `SELECT` anon sur `storage.objects` : les fichiers sont lisibles par leur URL publique,
    mais le listing du bucket n'est pas exposé.
43. Realtime : seules `orders`, `waiter_calls`, `table_sessions`, `products` sont publiées ; la migration
    retire les tables sensibles si elles y avaient été ajoutées. `products` étant public, un anonyme pourrait
    techniquement s'abonner à ses changements (données publiques, sans risque).
44. `pg_cron` est activé si possible (nettoyage toutes les 15 min) ; sinon nettoyage opportuniste (≈1 % des
    appels à `check_rate_limit`).

## Ajouts au périmètre (utilitaires nécessaires)
45. RPC ajoutées : `follow_cafe`, `my_followed_cafes` (les clients n'ont pas accès à `cafes`),
    `staff_list_orders`, `staff_list_followers` (pagination par curseur demandée), `session_total_cents`.
    Fonctions internes : `get_menu_tx`, `get_table_state_tx`, `cancel_order_tx`, `call_waiter_tx`,
    `begin_announcement_send`, `announcement_recipients`, `finish_announcement_send`, `unsubscribe_follower`
    (service_role uniquement), pour garder chaque route en une seule requête/transaction.
46. Le personnel ne voit jamais les emails des abonnés.
47. `package.json` et `.gitignore` ajoutés (dépendances des scripts, exclusion de `.env` et des QR générés).


---

## Corrections après relecture (remplacent les hypothèses citées)

**Remplace 35 (échec d'envoi).** Si aucun email n'est transmis, l'annonce repasse en `draft`, le quota est libéré,
et l'API renvoie 502 `send_failed` (ou 409 `no_recipients` si aucun abonné éligible). Si au moins un email est
transmis, l'annonce passe à `sent` avec le nombre réel, la réponse indique `status: "partial"` et `failed_count`.
Pas de renvoi automatique des lots en échec (évite les doublons). La clé d'idempotence Resend inclut
`sending_started_at`, donc un nouvel essai après retour en draft n'est pas confondu avec le précédent.

**Remplace 39 et 40 (désabonnement).** La fonction `unsubscribe` ne sert plus de page HTML. GET vérifie le lien
en lecture seule (JSON), POST désabonne (JSON). Le lien visible dans l'email pointe vers une **page du frontend**
`${SITE_URL}/desabonnement?t=…` qui appelle ces endpoints. L'en-tête `List-Unsubscribe` pointe vers
l'endpoint POST (one-click). Les scanners de liens de messagerie ne désabonnent donc plus personne.
**Frontend requis** : cette page n'existe pas encore dans ce lot (backend uniquement).

**Remplace 26 (annulation).** Chaque commande reçoit une `cancel_key` aléatoire renvoyée une seule fois par
`create-order`, dont seule l'empreinte SHA-256 est stockée (`orders.cancel_key_hash`). `cancel-order` exige cette clé.
Un autre client arrivant à la table ne peut donc annuler aucune commande qu'il n'a pas passée, même en `pending`.

**Sessions partagées (limite assumée).** La session est volontairement partagée entre les clients d'une même
table (une table = une addition). Un client suivant voit donc les articles et le total de la session en cours
tant que le personnel ne l'a pas fermée ou qu'elle n'est pas périmée (3 h). Ce n'est pas corrigé en V1 : le levier
est la clôture par le personnel. Question ouverte pour le produit : faut-il une fermeture automatique (ex. toutes
commandes servies depuis X min) ou un bouton « j'ai payé » côté client ?

**Consentement (remplace le défaut implicite).** Le trigger d'inscription crée l'abonnement avec
`notifications_opt_in = false` sauf si `newsletter_opt_in = true` est fourni explicitement. Le défaut de la colonne
(`true`) ne s'applique qu'à l'action explicite « suivre » (`follow_cafe`). Le frontend doit proposer une case
à cocher non pré-cochée. Point juridique à faire valider (hors périmètre technique).

**Confirmation d'email (correction 1 de l'audit).** `apply_customer_signup` crée la ligne `cafe_followers` seulement
si `email_confirmed_at` est non null (à l'insertion si déjà confirmé, sinon via le trigger
`on_auth_user_confirmed`). `announcement_recipients` exige en plus `auth.users.email_confirmed_at is not null`
et `auth.users.email = customers.email`.

**Annonce sans destinataire.** Si aucun abonné éligible : retour en draft, 409 `no_recipients`, quota non consommé.

**Hypothèse 14 (create-staff sur email déjà client).** Inchangée : 409 si l'email existe déjà.
