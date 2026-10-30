# Café QR (V1) : référence API

- Edge Functions : `https://<projet>.supabase.co/functions/v1/<nom>`
- RPC SQL : `POST https://<projet>.supabase.co/rest/v1/rpc/<fonction>` avec les en-têtes
  `apikey: <anon key>`, `Authorization: Bearer <JWT utilisateur>`, `Content-Type: application/json`.
- Toutes les réponses sont en JSON (sauf la page HTML de `unsubscribe`).
- Montants : **centimes entiers** (`*_cents`). Devise : code ISO du café (`currency`).

## Format d'erreur

```json
{ "error": { "code": "table_not_found", "message": "QR code inconnu ou désactivé." } }
```

| HTTP | Sens |
|---|---|
| 400 | Validation (corps, paramètres, transition de statut invalide). Peut contenir `issues: [{ path, message }]` |
| 401 | JWT absent ou invalide (fonctions personnel / RPC) |
| 403 | Café inactif, fonctionnalité désactivée, rôle insuffisant, origine non autorisée |
| 404 | Jeton de table ou ressource inconnu(e) |
| 405 | Méthode HTTP non autorisée |
| 409 | Conflit (commande plus annulable, annonce déjà envoyée, produit indisponible, email déjà utilisé) |
| 413 | Corps de requête trop volumineux |
| 429 | Limite atteinte : `retry_after_seconds` dans l'erreur + en-tête `Retry-After` |
| 500 | Erreur interne |

Les fonctions SQL lèvent `SQLSTATE PT<code HTTP>` : appelées en RPC via PostgREST, elles renvoient
directement ce code HTTP avec `{ code: "PT404", message: "<code machine>", details: "<message>", hint: "<retry>" }`.

---

## Edge Functions publiques (client en salle, `verify_jwt = false`)

### `GET get-menu?token=<qr_token>`
Menu de la table. `Cache-Control: public, max-age=30`. Limite : 60 req/min/IP.

Réponse 200 :
```json
{
  "cafe": { "name": "Café A", "slug": "cafe-a", "logo_path": null, "logo_url": null, "currency": "EUR",
            "ordering_enabled": true, "call_waiter_enabled": true },
  "table": { "label": "1" },
  "categories": [
    { "id": "uuid", "name": "Boissons chaudes", "position": 1,
      "products": [
        { "id": "uuid", "name": "Cappuccino", "description": "…", "price_cents": 350,
          "image_path": null, "image_url": null, "is_available": true,
          "is_promoted": true, "promo_label": "Offre du moment", "position": 3, "options": [] } ] } ]
}
```
Erreurs : 404 `table_not_found` (jeton inconnu, mal formé ou table inactive), 403 `cafe_inactive`, 429.

### `GET get-table-state?token=<qr_token>`
État de la table (polling 5 à 10 s). Limites : 30 req/min par (IP, table) et 600 req/min/IP.

Réponse 200 :
```json
{
  "table": { "label": "1" },
  "session": { "id": "uuid", "opened_at": "…" },
  "orders": [ { "id": "uuid", "order_number": 12, "status": "pending", "order_type": "dine_in",
                "note": null, "total_cents": 360, "created_at": "…",
                "items": [ { "name": "Espresso", "unit_price_cents": 180, "quantity": 2, "note": null, "options": [] } ] } ],
  "total_cents": 360,
  "currency": "EUR",
  "waiter_call": { "id": "uuid", "status": "open", "created_at": "…" },
  "disclaimer": "Montant indicatif, pas un ticket de caisse"
}
```
`session` vaut `null` (et `orders: []`, `total_cents: 0`) si aucune session ouverte non périmée.
`total_cents` = somme des commandes **non annulées** de la session. Erreurs : 404, 403, 429.

### `POST create-order`
Corps (32 Ko max) :
```json
{ "token": "<qr_token>",
  "items": [ { "product_id": "uuid", "quantity": 2, "note": "sans sucre", "options": [] } ],
  "note": "On est en terrasse",
  "order_type": "dine_in" }
```
- `quantity` : entier 1 à 20 ; 50 articles max au total (somme des quantités).
- `note` ligne tronquée à 150 caractères, `note` commande à 300.
- Tout champ de prix envoyé est **ignoré** : prix et total viennent de la base.
- Limites : 10 req/min/IP + `order_rate_limit` commandes par table et par 10 min (défaut 5).

Réponse 201 :
```json
{ "order_id": "uuid", "order_number": 13, "status": "pending", "order_total_cents": 360,
  "session_id": "uuid", "session_total_cents": 720, "currency": "EUR",
  "cancel_key": "3f9a…36 caractères hex" }
```
**`cancel_key` n'est renvoyée qu'une fois.** Le client la garde (localStorage) pour annuler sa commande.
Elle n'est jamais renvoyée par `get-table-state` ni stockée en clair.
```
Erreurs : 400 (`validation_error`, `invalid_quantity`, `too_many_items`, `invalid_order_type`…),
403 (`cafe_inactive`, `ordering_disabled`), 404 (`table_not_found`, `product_not_found` : inconnu,
d'un autre café ou catégorie masquée), 409 `product_unavailable`, 429 (`rate_limited`, `table_rate_limited`).

### `POST cancel-order`
Corps : `{ "token": "<qr_token>", "order_id": "uuid", "cancel_key": "<cancel_key de create-order>" }`. Limite : 20 req/min/IP.
Autorisé seulement si la commande appartient à la table du jeton, a été passée avec cette `cancel_key`,
est dans la session en cours, et est `pending`. Clé absente ou fausse : 404 `order_not_found` (rien n'est révélé).

Réponse 200 : `{ "order_id", "order_number", "status": "cancelled", "session_total_cents", "currency" }`
Erreurs : 404 (`table_not_found`, `order_not_found`), 409 (`order_not_pending`, `order_not_cancellable`), 403, 429.

### `POST call-waiter`
Corps : `{ "token": "<qr_token>" }`. Limite : 10 req/min/IP.
- Appel déjà ouvert pour la table : renvoie le même appel (200, `created: false`).
- Sinon crée l'appel (201, `created: true`).

Réponse : `{ "created": true, "call": { "id": "uuid", "status": "open", "created_at": "…" } }`
Erreurs : 403 (`cafe_inactive`, `call_waiter_disabled`), 404, 429 `waiter_call_cooldown`
(délai `waiter_call_cooldown_seconds` après le dernier appel traité).

### `GET unsubscribe?t=<jeton>` : vérification (lecture seule)
Ne modifie rien. Réponse 200 : `{ "cafe_name": "Café A", "unsubscribed": false }`. Erreurs : 400 `invalid_token`, 404 `subscription_not_found`.

### `POST unsubscribe?t=<jeton>` : désabonnement
Passe `notifications_opt_in = false` et renseigne `unsubscribed_at` (idempotent).
Réponse 200 : `{ "cafe_name": "Café A", "unsubscribed": true }`. Même erreurs que GET.
Appelé par la page frontend `/desabonnement?t=…` (lien dans les emails) et par la messagerie
(one-click RFC 8058, en-tête `List-Unsubscribe`). Jeton : `<customer_id>.<cafe_id>.<base64url(HMAC-SHA256("customer_id:cafe_id", UNSUBSCRIBE_SECRET))>`.
Limite : 20 req/min/IP. Réponses en JSON uniquement (aucune page HTML servie par la fonction).

---

## Edge Functions personnel (`verify_jwt = true`, en-tête `Authorization: Bearer <JWT>`)

Le rôle, l'activation de l'employé et l'activation du café sont revérifiés dans le code.

### `POST create-staff` (owner)
Corps : `{ "email": "serveur@example.com", "display_name": "Léa", "role": "waiter" }`
(`role` ∈ `manager` | `waiter`, jamais `owner`). Le café est toujours celui de l'appelant ;
tout `cafe_id` envoyé est ignoré. Envoie une invitation (`auth.admin.inviteUserByEmail`).
Limites : 20 req/min/IP et 20/heure par owner.

Réponse 201 : `{ "staff_member": { "id", "cafe_id", "role", "display_name", "is_active", "created_at", "email" } }`
Erreurs : 400 (rôle `owner` ou invalide), 401, 403 (`forbidden`, `forbidden_role`), 409 `email_already_registered`, 429, 500 `invite_failed`.

### `POST send-announcement` (owner, manager)
Corps : `{ "announcement_id": "uuid" }`. Passe l'annonce `draft → sending` de façon atomique,
envoie via Resend (lots de 100, `Idempotency-Key` par lot) aux abonnés `notifications_opt_in = true`
et `unsubscribed_at is null`, avec lien de désabonnement + `List-Unsubscribe` / `List-Unsubscribe-Post`,
puis `sent` avec `sent_count`. Quota : 3 annonces par café et par 24 h.

Réponse 200 : `{ "announcement_id", "status": "sent" | "partial", "sent_count": 1, "failed_count": 0 }`.
`partial` = au moins un email transmis mais des lots ont échoué (pas de renvoi automatique).
Si **aucun** email n'est transmis, l'annonce repasse en `draft` (quota libéré) et on renvoie :
502 `send_failed` (échec d'envoi) ou 409 `no_recipients` (aucun abonné éligible).
Erreurs : 401, 403, 404 `announcement_not_found`, 409 (`announcement_already_sent`, `no_recipients`), 429, 500 `config_missing`, 502 `send_failed`.
Seuls les abonnés dont l'email est **confirmé** et dont le compte correspond à l'email de la ligne `customers` sont ciblés.

---

## RPC SQL : personnel (rôle `authenticated`, employé actif d'un café actif)

| Fonction | Paramètres | Rôles | Réponse | Erreurs |
|---|---|---|---|---|
| `staff_update_order_status` | `p_order_id uuid, p_new_status order_status` | tous | ligne `orders` | 400 `invalid_transition`, 403, 404 |
| `staff_handle_waiter_call` | `p_call_id uuid` | tous | ligne `waiter_calls` (idempotent) | 403, 404 |
| `staff_close_session` | `p_session_id uuid` | tous | ligne `table_sessions` ; traite aussi les appels ouverts de la table | 403, 404 |
| `staff_set_product_availability` | `p_product_id uuid, p_available boolean` | tous | ligne `products` | 400, 403, 404 |
| `staff_regenerate_table_token` | `p_table_id uuid` | owner, manager | ligne `cafe_tables` (nouveau `qr_token`) | 403, 404 |
| `owner_set_staff_active` | `p_staff_id uuid, p_active boolean` | owner | ligne `staff_members` | 400, 403, 404, 409 `cannot_deactivate_self` |
| `staff_list_orders` | `p_status?, p_cursor_created_at?, p_cursor_id?, p_limit? (≤100)` | tous | `{ items: [...avec lignes], next_cursor }` | 403 |
| `staff_list_followers` | `p_cursor_created_at?, p_cursor_customer_id?, p_limit? (≤100)` | owner, manager | `{ items, active_subscribers, next_cursor }` (sans emails) | 403 |
| `session_total_cents` | `p_session_id uuid` | tous (RLS) | addition indicative (bigint) | |

Transitions : `pending → accepted → preparing → served`, et `pending | accepted | preparing → cancelled`.
`accepted_at/by`, `served_at`, `cancelled_at/by` sont renseignés automatiquement.

Pagination : passer `next_cursor.created_at` / `next_cursor.id` (ou `customer_id`) de la page précédente.

## RPC SQL : clients connectés

| Fonction | Paramètres | Réponse | Erreurs |
|---|---|---|---|
| `follow_cafe` | `p_slug text` | ligne `cafe_followers` (réabonne si besoin ; l'action explicite du client vaut consentement) | 403 `not_a_customer`, 404 `cafe_not_found` |
| `my_followed_cafes` | aucun | `[{ cafe_id, name, slug, logo_path, notifications_opt_in, unsubscribed_at, followed_at }]` | |
| `delete_my_account` | aucun | `null` ; supprime compte + abonnements | 401, 403 `staff_account` |

Inscription client : `supabase.auth.signInWithOtp({ email, options: { data: { signup_type: 'customer', cafe_slug: 'cafe-a', display_name: '…', newsletter_opt_in: true|false } } })`.
- L'abonnement au café n'est créé **qu'à la confirmation de l'email** (jamais pour un email non confirmé).
- `newsletter_opt_in` vaut `true` **seulement** si la case est cochée explicitement (sinon `false`).

## Accès directs aux tables (PostgREST, RLS)

| Table | Lecture | Écriture |
|---|---|---|
| `cafes` | employés du café | owner : réglages (`name, logo_path, currency, ordering_enabled, call_waiter_enabled, order_rate_limit, waiter_call_cooldown_seconds, session_stale_hours`) |
| `staff_members` | employés du café | aucune (create-staff, `owner_set_staff_active`) |
| `cafe_tables` | employés du café | owner, manager : `label`, `is_active` (jeton jamais choisi par le client) |
| `categories`, `products` | employés du café ; `anon` : visibles des cafés actifs | owner, manager |
| `table_sessions`, `orders`, `order_items`, `waiter_calls` | employés du café | aucune (fonctions) |
| `customers` | soi-même | soi-même : `display_name` |
| `cafe_followers` | soi-même ; owner/manager : abonnés du café | soi-même : insert, `notifications_opt_in`, `unsubscribed_at`, delete |
| `announcements` | owner, manager | owner, manager : `title, body, image_path` tant que `draft` |
| `rate_limit_hits` | aucune | aucune |

## Realtime

Tables publiées : `orders`, `waiter_calls`, `table_sessions`, `products`. Exemple écran personnel :
```js
supabase.channel('staff').on('postgres_changes',
  { event: '*', schema: 'public', table: 'orders', filter: `cafe_id=eq.${cafeId}` },
  (p) => reloadOrder(p.new.id)).subscribe()
```

## Storage

Bucket public `cafe-assets` (jpeg/png/webp, 2 Mo). Chemins : `{cafe_id}/products/…`, `{cafe_id}/logo/…`,
`{cafe_id}/announcements/…`. Écriture/suppression : owner et manager du café du 1er segment.
URL publique : `${SUPABASE_URL}/storage/v1/object/public/cafe-assets/<chemin>`.
