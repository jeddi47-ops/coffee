# Café QR : frontend (V1 complète)

React 18 + Vite + TypeScript, Tailwind CSS, composants façon shadcn/ui, Zustand, React Router, supabase-js v2.
Consomme le backend Supabase Café QR (voir `docs/API.md` du backend). Carte des pages : `docs/ROUTES.md`
et `docs/FRONTEND.md`.

## Prérequis
- Node.js ≥ 20, npm
- Backend Café QR **v1.4** (migrations 0001 → 0005, dont `0005_cafe_theme.sql` pour le thème par café)

## Installation et lancement local
```bash
npm install
cp .env.example .env
# .env : VITE_SUPABASE_URL=http://127.0.0.1:54321
#        VITE_SUPABASE_ANON_KEY=<anon key de `supabase status`>   (clé anon uniquement)
#        VITE_SITE_URL=http://localhost:5173
npm run dev                 # http://localhost:5173
npm run check:secrets       # contrôle : aucune clé, aucun console.log, aucune couleur en dur côté client
npm run build               # tsc strict + vite build -> dist/
```
Backend local : `supabase start`, `supabase db reset`, `supabase functions serve --env-file supabase/functions/.env`
avec `ALLOWED_ORIGINS=http://localhost:5173` et `SITE_URL=http://localhost:5173`.

## Déploiement (Vercel ou Netlify)
1. Variables du projet : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` (URL publique, sans `/` final).
2. Vercel : `vercel.json` (réécriture SPA + en-têtes de sécurité) est pris en compte. Netlify : ajouter un fichier
   `public/_redirects` contenant `/* /index.html 200`.
3. Backend : `supabase secrets set SITE_URL=<VITE_SITE_URL> ALLOWED_ORIGINS=<VITE_SITE_URL>`, puis redéployer les
   fonctions (`supabase functions deploy create-staff`, etc.).
4. Supabase → Authentication → URL Configuration : Site URL = `VITE_SITE_URL`, Redirect URLs = `VITE_SITE_URL/**`.
5. Vérifier : `/m/<jeton>` s'affiche, `/login` connecte un employé, l'écran `/staff` s'installe (PWA).

## Structure
```
src/main.tsx, App.tsx, routes.tsx       noyau (routes chargées à la demande sauf /m/:token)
src/lib/                                env, supabase (anon), api, errors, money, theme, qr, image, sound, wakelock, time, utils
src/stores/                             cartStore, authStore, staffStore
src/types/api.ts                        contrats Edge Functions + lignes des tables
src/i18n/fr.ts                          tous les textes
src/components/                         MenuView, CafeHeader, ProductCard, ThemeScope, RequireAuth, ErrorBoundary,
                                        Skeletons, ConnectionBanner, ConfirmDialog, ErrorView, ui/ (button, input, label, switch, card, dialog)
src/pages/customer/                     MenuPage, CartDrawer, TableStatePanel, BottomNav, FollowDialog, AccountPage, hooks
src/pages/auth/                         LoginPage, AuthCallbackPage, SetPasswordPage
src/pages/staff/                        StaffPage, OrderCard, CallsPanel, TablesView, AvailabilityList, useStaffData
src/pages/admin/                        AdminLayout, MenuAdminPage, ProductForm, TablesAdminPage, StaffAdminPage,
                                        AnnouncementsPage, SettingsPage, AppearanceSettings, adminData
```

## Règles d'or
Seule la clé anon existe ici. Aucun prix envoyé au serveur, total toujours lu sur le serveur. Montants en centimes
(`formatMoney`). Texte utilisateur jamais injecté en HTML. Jeton de table jamais journalisé. Textes dans `src/i18n/fr.ts`.
