# Livraison : frontend Café QR (V1 complète, lots 1 à 4)

## Fichiers livrés
| Chemin de destination | Rôle | Routes d'API / de l'application |
|---|---|---|
| `package.json` | Dépendances et scripts (dev, build, check:secrets) | — |
| `vite.config.ts` | Vite, découpage supabase/qrcode | — |
| `tsconfig.json` | TypeScript strict | — |
| `tailwind.config.ts` | Couleurs = variables CSS uniquement | — |
| `postcss.config.js` | Tailwind + autoprefixer | — |
| `index.html` | Page HTML, manifest, icônes | — |
| `vercel.json` | Réécriture SPA + en-têtes de sécurité | toutes les routes |
| `public/_redirects` | Réécriture SPA Netlify | toutes les routes |
| `.env.example` | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL | — |
| `.gitignore` | Exclut .env*, node_modules, dist | — |
| `public/manifest.webmanifest` | PWA de l'écran de service | /staff |
| `public/sw.js` | Service worker minimal, sans cache | /staff |
| `public/icons/icon-192.png` | Icône PWA | /staff |
| `public/icons/icon-512.png` | Icône PWA | /staff |
| `public/icons/icon-maskable-512.png` | Icône PWA masquable | /staff |
| `scripts/check-repo.mjs` | Contrôle critère 20 + couleurs en dur | — |
| `src/main.tsx` | Entrée ; redirige les liens d'auth vers /auth/callback | toutes |
| `src/App.tsx` | ErrorBoundary + Suspense + routes | toutes |
| `src/routes.tsx` | Carte des routes, gardes de rôle, chargement à la demande | toutes |
| `src/index.css` | Jetons de design neutres, mode nuit, impression A4 | toutes |
| `src/vite-env.d.ts` | Types des variables VITE_* | — |
| `src/lib/env.ts` | Config publique, URL Storage, URL de QR | — |
| `src/lib/supabase.ts` | Client anon, type de lien d'auth | Auth, Realtime, Storage, PostgREST |
| `src/lib/api.ts` | Fonctions typées | get-menu, get-table-state, create-order, cancel-order, call-waiter, create-staff, send-announcement ; RPC staff_list_orders, staff_update_order_status, staff_handle_waiter_call, staff_close_session, staff_set_product_availability, staff_regenerate_table_token, owner_set_staff_active, staff_list_followers, session_total_cents, follow_cafe, my_followed_cafes, delete_my_account |
| `src/lib/errors.ts` | Codes d'erreur → messages français | — |
| `src/lib/money.ts` | formatMoney, saisie euros → centimes | — |
| `src/lib/theme.ts` | buildTheme : variables CSS + contraste 4,5:1 | /m/:token, aperçu admin |
| `src/lib/qr.ts` | QR SVG + libellé, téléchargement | /admin/tables |
| `src/lib/image.ts` | Redimensionnement WebP 1200 px < 2 Mo | /admin, /admin/nouveautes, /admin/reglages |
| `src/lib/sound.ts` | Sons Web Audio (commande, appel) | /staff |
| `src/lib/wakelock.ts` | Écran allumé (Wake Lock) | /staff |
| `src/lib/time.ts` | Heures et durées | — |
| `src/lib/utils.ts` | cn() | — |
| `src/stores/cartStore.ts` | Panier, note, cancel_key (sessionStorage) | /m/:token |
| `src/stores/authStore.ts` | Session, profil staff/client, rôle | auth ; tables staff_members, cafes, customers |
| `src/stores/staffStore.ts` | État de l'écran de service | /staff |
| `src/types/api.ts` | Types des réponses et des lignes | — |
| `src/i18n/fr.ts` | Tous les textes | toutes |
| `src/components/MenuView.tsx` | Menu (recherche, pastilles, À la une, sections) | /m/:token, aperçu admin |
| `src/components/CafeHeader.tsx` | Logo/initiales, nom, phrase d'accroche, table | /m/:token |
| `src/components/ProductCard.tsx` | Cartes produit (4:3 ou compacte sans photo) | /m/:token |
| `src/components/ThemeScope.tsx` | Applique le thème d'un café | /m/:token, aperçu admin |
| `src/components/RequireAuth.tsx` | Gardes de rôle | /staff, /admin/* |
| `src/components/ErrorBoundary.tsx` | Écran d'erreur neutre | toutes |
| `src/components/ErrorView.tsx` | QR non valide, café indisponible, réseau | /m/:token |
| `src/components/Skeletons.tsx` | Squelettes neutres | toutes |
| `src/components/ConnectionBanner.tsx` | « Connexion perdue » | /staff |
| `src/components/ConfirmDialog.tsx` | Confirmation | /staff, /admin/* |
| `src/components/ui/button.tsx` | Bouton (variantes) | — |
| `src/components/ui/input.tsx` | Input, Textarea, Select | — |
| `src/components/ui/label.tsx` | Label, Field (aide, erreur, compteur) | — |
| `src/components/ui/switch.tsx` | Interrupteur accessible | — |
| `src/components/ui/card.tsx` | Card, Badge | — |
| `src/components/ui/dialog.tsx` | Fenêtre modale / tiroir | — |
| `src/pages/customer/MenuPage.tsx` | Page du QR | /m/:token ; get-menu, call-waiter |
| `src/pages/customer/CartDrawer.tsx` | Panier et commande | create-order |
| `src/pages/customer/TableStatePanel.tsx` | Ma table, annulation | get-table-state, cancel-order |
| `src/pages/customer/BottomNav.tsx` | Barre du bas 4 entrées | /m/:token |
| `src/pages/customer/useTableState.ts` | Polling 8 s / 15 s, pause onglet caché | get-table-state |
| `src/pages/customer/useCountdown.ts` | Décompte des 429 | — |
| `src/pages/customer/FollowDialog.tsx` | Recevoir les nouveautés (lien magique) | Auth signInWithOtp ; RPC follow_cafe ; table customers |
| `src/pages/customer/AccountPage.tsx` | Espace client | /compte ; RPC my_followed_cafes, delete_my_account ; table cafe_followers |
| `src/pages/auth/AuthLayout.tsx` | Mise en page des écrans d'auth | — |
| `src/pages/auth/LoginPage.tsx` | Connexion, mot de passe oublié | /login ; signInWithPassword, resetPasswordForEmail |
| `src/pages/auth/AuthCallbackPage.tsx` | Retour des liens | /auth/callback ; RPC follow_cafe |
| `src/pages/auth/SetPasswordPage.tsx` | Définir le mot de passe | /auth/mot-de-passe ; updateUser |
| `src/pages/staff/StaffPage.tsx` | Écran de service | /staff |
| `src/pages/staff/useStaffData.ts` | Chargement, Realtime, polling de secours | RPC staff_list_orders, session_total_cents ; tables orders, order_items, waiter_calls, table_sessions, cafe_tables, categories, products ; Realtime |
| `src/pages/staff/OrderCard.tsx` | Carte commande, étape suivante seule | RPC staff_update_order_status |
| `src/pages/staff/CallsPanel.tsx` | Appels serveur | RPC staff_handle_waiter_call |
| `src/pages/staff/TablesView.tsx` | État des tables, Table réglée | RPC staff_close_session, session_total_cents |
| `src/pages/staff/AvailabilityList.tsx` | Ruptures | RPC staff_set_product_availability |
| `src/pages/admin/AdminLayout.tsx` | Barre latérale / burger | /admin/* |
| `src/pages/admin/adminData.ts` | Upload Storage, catalogue, aperçu, ordre | Storage cafe-assets ; tables categories, products |
| `src/pages/admin/MenuAdminPage.tsx` | Catégories, produits, aperçu client | /admin ; tables categories, products |
| `src/pages/admin/ProductForm.tsx` | Formulaire produit + photo WebP | /admin ; table products, Storage |
| `src/pages/admin/TablesAdminPage.tsx` | Tables, QR, plaquettes A4 | /admin/tables ; table cafe_tables ; RPC staff_regenerate_table_token |
| `src/pages/admin/StaffAdminPage.tsx` | Équipe (owner) | /admin/equipe ; create-staff ; RPC owner_set_staff_active ; table staff_members |
| `src/pages/admin/AnnouncementsPage.tsx` | Nouveautés | /admin/nouveautes ; send-announcement ; RPC staff_list_followers ; table announcements, Storage |
| `src/pages/admin/SettingsPage.tsx` | Réglages (owner) | /admin/reglages ; table cafes, Storage |
| `src/pages/admin/AppearanceSettings.tsx` | Bloc Apparence (owner), aperçu en direct | /admin/reglages ; table cafes (theme_accent, theme_mode, tagline) |
| `src/pages/DesabonnementPage.tsx` | Page statique de désabonnement | /desabonnement |
| `src/pages/NotFoundPage.tsx` | Page introuvable | * |
| `README.md` | Installation, variables, déploiement | — |
| `docs/ROUTES.md` | Routes, fonctions, RPC, tables | — |
| `docs/FRONTEND.md` | Carte des pages et des appels | — |
| `docs/ASSUMPTIONS-FRONT.md` | Hypothèses | — |
| `docs/TESTS-MANUELS-FRONT.md` | Procédure par critère (20 + 6) | — |
| `LIVRAISON-FRONT.md` | Ce fichier | — |

## Hypothèses
Voir `docs/ASSUMPTIONS-FRONT.md` (32 points). Principales : design inspiré de la maquette (section 13) sans ses
éléments hors périmètre ; ajustement de l'accent s'il est invisible sur le fond ; polling 8 s si commande en attente
(15 s sinon) ; composants façon shadcn sans Radix ; client déjà inscrit suivi via `follow_cafe` après connexion.

## Ce qui n'a pas pu être fait ou vérifié
- `npm install` / `npm run build` non exécutés (pas d'accès npm). TypeScript strict vérifié à 0 erreur avec des
  définitions minimales des paquets : un écart avec les vrais types reste possible.
- Zone client rendue dans Chromium avec les données du seed (aucune erreur console) ; `/staff` et `/admin` vérifiés
  par compilation uniquement, pas rendus visuellement ni testés contre un vrai Supabase.
- Lighthouse et 4G simulée non mesurés.
- Le thème dépend de la migration backend `0005_cafe_theme.sql` (fournie dans le backend v1.4).

## Ordre des commandes
Local : `npm install` → `cp .env.example .env` (remplir) → backend `supabase start` + `supabase db reset` +
`supabase functions serve --env-file supabase/functions/.env` → `npm run dev` → `npm run check:secrets` → `npm run build`.
Production : backend `supabase db push` (0005 incluse) → `supabase functions deploy create-staff` (redirection
d'invitation) → `supabase secrets set SITE_URL=… ALLOWED_ORIGINS=…` → Vercel/Netlify avec les 3 variables `VITE_*`
→ Supabase Auth : Site URL et Redirect URLs.
