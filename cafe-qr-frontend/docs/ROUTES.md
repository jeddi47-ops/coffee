# Routes Café QR

## Pages du frontend (SPA, `vercel.json` réécrit tout vers `index.html`)
| Route | Accès | Rôle | Fichier |
|---|---|---|---|
| `/m/:token` | public | Menu, recherche, À la une, panier, commande, Ma table, appel serveur, annulation, « Recevoir les nouveautés » | `src/pages/customer/MenuPage.tsx` |
| `/desabonnement?statut=ok&cafe=<nom>` / `?statut=invalide` | public | Page statique après le lien de désabonnement (aucun appel d'API) | `src/pages/DesabonnementPage.tsx` |
| `/compte` | client connecté (lien magique) | Cafés suivis, emails oui/non, déconnexion, suppression du compte | `src/pages/customer/AccountPage.tsx` |
| `/login` | public | Connexion du personnel, mot de passe oublié | `src/pages/auth/LoginPage.tsx` |
| `/auth/callback` | public | Retour des liens magiques, d'invitation et de réinitialisation | `src/pages/auth/AuthCallbackPage.tsx` |
| `/auth/mot-de-passe` | session issue d'un lien | Définir / réinitialiser le mot de passe | `src/pages/auth/SetPasswordPage.tsx` |
| `/staff` | owner, manager, waiter | Écran de service temps réel (commandes, appels, tables, ruptures) | `src/pages/staff/StaffPage.tsx` |
| `/admin` | owner, manager | Menu : catégories, produits, photos, promotions, aperçu client | `src/pages/admin/MenuAdminPage.tsx` |
| `/admin/tables` | owner, manager | Tables, QR SVG, plaquettes A4, régénération | `src/pages/admin/TablesAdminPage.tsx` |
| `/admin/equipe` | **owner** | Employés, invitations, activation | `src/pages/admin/StaffAdminPage.tsx` |
| `/admin/nouveautes` | owner, manager | Annonces, envoi par email | `src/pages/admin/AnnouncementsPage.tsx` |
| `/admin/reglages` | **owner** | Pause commandes, appel serveur, nom, logo, devise, avancés, Apparence | `src/pages/admin/SettingsPage.tsx` |
| `/` | | Redirige vers `/login` | |
| `*` | | Page introuvable | `src/pages/NotFoundPage.tsx` |

Redirections : waiter → `/staff` ; manager/owner → `/admin`. Un waiter qui ouvre `/admin` est renvoyé vers `/staff`,
un manager qui ouvre `/admin/equipe` ou `/admin/reglages` est renvoyé vers `/admin`. Employé désactivé ou compte sans
ligne `staff_members` : déconnexion avec message. Un employé qui ouvre `/compte` est renvoyé vers son espace.
Un lien d'authentification arrivant sur n'importe quelle page est redirigé vers `/auth/callback` (fragment conservé).

## Edge Functions (`<SUPABASE_URL>/functions/v1/…`)
| Fonction | Méthode | Accès | Appelée par |
|---|---|---|---|
| `get-menu?token=` | GET | public | MenuPage |
| `get-table-state?token=` | GET | public | MenuPage (polling 8 s si commande en attente, sinon 15 s, pause onglet caché) |
| `create-order` | POST | public | CartDrawer (renvoie `cancel_key`, jamais de prix envoyé) |
| `cancel-order` | POST | public | TableStatePanel (`token`, `order_id`, `cancel_key`) |
| `call-waiter` | POST | public | MenuPage / BottomNav |
| `unsubscribe?t=` | GET | public (lien signé) | Lien des emails → 303 vers `/desabonnement` |
| `unsubscribe?t=` | POST | public (lien signé) | Messagerie (one-click), 204 |
| `create-staff` | POST | JWT owner | StaffAdminPage |
| `send-announcement` | POST | JWT owner/manager | AnnouncementsPage |

## RPC (`supabase.rpc(...)`, utilisateur connecté)
| RPC | Appelée par |
|---|---|
| `staff_list_orders` (curseur) | StaffPage (chargement initial et resynchronisation) |
| `staff_update_order_status` | OrderCard |
| `staff_handle_waiter_call` | CallsPanel |
| `staff_close_session` | TablesView (« Table réglée ») |
| `session_total_cents` | TablesView |
| `staff_set_product_availability` | AvailabilityList |
| `staff_regenerate_table_token` | TablesAdminPage |
| `owner_set_staff_active` | StaffAdminPage |
| `staff_list_followers` (`active_subscribers`) | AnnouncementsPage |
| `follow_cafe`, `my_followed_cafes`, `delete_my_account` | FollowDialog, AuthCallbackPage, AccountPage |

## Tables PostgREST (RLS)
`cafes` (lecture, réglages owner, thème), `staff_members` (lecture), `cafe_tables`, `categories`, `products`
(CRUD owner/manager), `orders` + `order_items` (lecture d'une commande sur événement temps réel), `waiter_calls`,
`table_sessions` (lecture), `announcements` (brouillons), `customers` (lecture de soi), `cafe_followers`
(interrupteur emails). Storage : bucket `cafe-assets` (`{cafe_id}/products|logo|announcements/<uuid>.webp`).

## Realtime
Canal `staff-<cafe_id>` : `orders`, `waiter_calls`, `table_sessions`, `products`, filtre `cafe_id=eq.<café>`.

## Variables d'environnement
- Frontend : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé anon uniquement), `VITE_SITE_URL`.
- Edge Functions (secrets Supabase) : `SITE_URL` (= `VITE_SITE_URL`), `ALLOWED_ORIGINS` (doit contenir l'URL du
  frontend), `UNSUBSCRIBE_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `EMAIL_DRY_RUN`.
