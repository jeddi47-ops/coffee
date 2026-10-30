# Routes Café QR

## Pages du frontend (SPA, `vercel.json` réécrit tout vers `index.html`)
| Route | Rôle | Statut |
|---|---|---|
| `/m/:token` | Menu, panier, commande, suivi de table, appel serveur, annulation (client, sans compte) | livré (lot 1) |
| `/desabonnement?statut=ok&cafe=<nom>` ou `?statut=invalide` | Page statique affichée après le lien de désabonnement des emails | livré (lot 1) |
| `/login`, `/auth/*`, `/compte`, `/staff`, `/admin/*` | Connexion, compte client, espace personnel, administration | à venir |

## Edge Functions (`<SUPABASE_URL>/functions/v1/…`)
| Fonction | Méthode | Accès | Rôle |
|---|---|---|---|
| `get-menu?token=` | GET | public | Menu du café pour la table |
| `get-table-state?token=` | GET | public | Commandes et total de la table, appel serveur en cours (30 req/min par IP et table) |
| `create-order` | POST | public | Passe une commande ; renvoie `cancel_key` (une seule fois) |
| `cancel-order` | POST | public | Annule une commande encore `pending` (`token`, `order_id`, `cancel_key`) |
| `call-waiter` | POST | public | Appelle un serveur (délai de répit, 429 `waiter_call_cooldown`) |
| `unsubscribe?t=` | GET | public (lien signé) | Désabonne puis redirige (303) vers `/desabonnement?statut=…` |
| `unsubscribe?t=` | POST | public (lien signé) | Désabonnement one-click de la messagerie, répond 204 |
| `create-staff` | POST | JWT, rôle `owner` | Invite un employé par email |
| `send-announcement` | POST | JWT, rôle `owner` ou `manager` | Envoie une annonce aux abonnés |

## Fonctions SQL appelées avec `supabase.rpc(...)` (utilisateur connecté)
`staff_list_orders`, `staff_update_order_status`, `staff_handle_waiter_call`, `staff_close_session`,
`staff_set_product_availability`, `staff_regenerate_table_token`, `staff_list_followers` (owner/manager),
`owner_set_staff_active` (owner), `follow_cafe`, `my_followed_cafes`, `delete_my_account`.

## Variables d'environnement
- Frontend : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé anon uniquement), `VITE_SITE_URL`.
- Edge Functions (secrets Supabase) : `SITE_URL`, `ALLOWED_ORIGINS` (doit contenir l'URL du frontend),
  `UNSUBSCRIBE_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `EMAIL_DRY_RUN`.
