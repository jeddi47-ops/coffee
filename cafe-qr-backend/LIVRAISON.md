# Livraison : backend Supabase Café QR (V1)

## Fichiers livrés

| Chemin | Routes / fonctions définies |
|---|---|
| `supabase/config.toml` | `verify_jwt` : false pour get-menu, get-table-state, create-order, cancel-order, call-waiter, unsubscribe ; true pour create-staff, send-announcement |
| `supabase/migrations/0001_schema.sql` | 6 enums, 13 tables, index obligatoires, `generate_qr_token()`, `set_updated_at()`, triggers `on_auth_user_created` (`handle_new_auth_user`) et `on_auth_user_email_changed` |
| `supabase/migrations/0002_rls.sql` | `current_staff_cafe_id()`, `current_staff_role()`, `is_cafe_active()`, privilèges, RLS + policies sur les 13 tables, garde-fou « aucune table sans policy » |
| `supabase/migrations/0003_functions.sql` | RPC personnel : `staff_update_order_status`, `staff_handle_waiter_call`, `staff_close_session`, `staff_set_product_availability`, `staff_regenerate_table_token`, `owner_set_staff_active`, `staff_list_orders`, `staff_list_followers`, `session_total_cents` · RPC clients : `follow_cafe`, `my_followed_cafes`, `delete_my_account` · Internes (service_role) : `create_order_tx`, `check_rate_limit`, `get_menu_tx`, `get_table_state_tx`, `cancel_order_tx`, `call_waiter_tx`, `begin_announcement_send`, `announcement_recipients`, `finish_announcement_send`, `unsubscribe_follower` · utilitaires `api_error`, `assert_staff` · révocations/grants · job pg_cron |
| `supabase/migrations/0004_realtime_storage.sql` | Publication `supabase_realtime` (orders, waiter_calls, table_sessions, products), bucket `cafe-assets`, 4 policies Storage |
| `supabase/seed.sql` | Cafés A et B : patron, serveur, 5 tables, 3 catégories, 10 produits (1 indisponible, 1 en promo), 1 annonce brouillon ; 3 clients (dont 1 désabonné) |
| `supabase/functions/_shared/cors.ts` | CORS limité à `ALLOWED_ORIGINS` |
| `supabase/functions/_shared/supabase.ts` | client service_role, `requireStaff()`, URLs publiques Storage |
| `supabase/functions/_shared/validate.ts` | zod, lecture de corps bornée, jeton de table, signature/vérification HMAC du désabonnement |
| `supabase/functions/_shared/errors.ts` | format `{ error: { code, message } }`, mapping `PTxxx` → HTTP, enveloppe `handle()` |
| `supabase/functions/_shared/ratelimit.ts` | limitation par IP (hachée) et par utilisateur via `check_rate_limit` |
| `supabase/functions/get-menu/index.ts` | `GET get-menu` → `get_menu_tx` |
| `supabase/functions/get-table-state/index.ts` | `GET get-table-state` → `get_table_state_tx` |
| `supabase/functions/create-order/index.ts` | `POST create-order` → `create_order_tx` |
| `supabase/functions/cancel-order/index.ts` | `POST cancel-order` → `cancel_order_tx` |
| `supabase/functions/call-waiter/index.ts` | `POST call-waiter` → `call_waiter_tx` |
| `supabase/functions/unsubscribe/index.ts` | `GET` (vérification) / `POST` (désabonnement) unsubscribe → `unsubscribe_follower` |
| `supabase/functions/create-staff/index.ts` | `POST create-staff` → `auth.admin.inviteUserByEmail` + insert `staff_members` |
| `supabase/functions/send-announcement/index.ts` | `POST send-announcement` → `begin_announcement_send`, `announcement_recipients`, API batch Resend, `finish_announcement_send` |
| `scripts/create-cafe.mjs` | création café + invitation patron + N tables + catégories (`--name --slug --owner-email --tables`) |
| `scripts/generate-qr.mjs` | un SVG par table → `${SITE_URL}/m/${qr_token}`, libellé sous le QR |
| `docs/API.md` | référence de chaque Edge Function et RPC |
| `docs/ASSUMPTIONS.md` | 47 hypothèses |
| `docs/TESTS-MANUELS.md` | une commande curl/SQL par critère 1 à 15 |
| `.env.example` | variables sans valeurs |
| `README.md` | installation et déploiement |
| `package.json`, `.gitignore` | ajouts : dépendances des scripts, exclusion `.env` et `qr/` |

## Hypothèses principales
Voir `docs/ASSUMPTIONS.md`. Les plus structurantes : FK composites par café, lecture publique du menu
réservée au rôle `anon`, café inactif = plus aucun accès, 50 articles = somme des quantités, produit
indisponible = 409, colonne `sending_started_at` ajoutée, dossier Storage `announcements/` ajouté.

## Ce qui n'a pas pu être fait / vérifié
- **Pas d'exécution réelle** : l'environnement de génération n'avait ni Postgres ni Supabase CLI.
  Le TypeScript et les scripts Node ont passé un contrôle de syntaxe, mais migrations et fonctions doivent
  être validées avec `supabase db reset` puis `docs/TESTS-MANUELS.md`.
- Envoi Resend non testé en conditions réelles (prévu : `EMAIL_DRY_RUN=true` pour les tests).
- Envois d'annonces volumineux : pas de file d'attente en V1 (limite de durée des Edge Functions).
- Page frontend `/desabonnement` non livrée (backend uniquement) : elle est requise pour le lien de désabonnement.
- Lien de désabonnement : les endpoints répondent en JSON, plus aucune page HTML servie par Supabase.
- Question produit ouverte : fermeture automatique des sessions de table (voir ASSUMPTIONS, « Sessions partagées »).

## Ordre de déploiement
1. `supabase link --project-ref <ref>`
2. (option) activer `pg_cron`
3. `supabase db push`
4. `supabase secrets set RESEND_API_KEY=… MAIL_FROM=… SITE_URL=… ALLOWED_ORIGINS=… UNSUBSCRIBE_SECRET=…`
5. `supabase functions deploy` des 8 fonctions
6. Réglages Auth (Site URL, redirections, SMTP Resend, lien magique)
7. `node --env-file=.env scripts/create-cafe.mjs …` puis `scripts/generate-qr.mjs`
