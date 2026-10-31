# Frontend Café QR : carte des pages et des appels

## Architecture
- `src/main.tsx` : point d'entrée, redirige les liens d'authentification vers `/auth/callback`.
- `src/App.tsx` : `ErrorBoundary` + `Suspense` + `useRoutes(routes)`.
- `src/routes.tsx` : carte des routes. `/m/:token` est chargé directement ; tout le reste est chargé à la demande
  (`React.lazy`), donc `/staff`, `/admin`, l'auth et supabase-js ne pèsent pas sur la page du QR.
- `src/lib/env.ts` : configuration publique (sans supabase-js). `src/lib/supabase.ts` : client anon, chargé à la demande.
- `src/lib/api.ts` : une fonction typée par Edge Function et par RPC. `src/lib/errors.ts` : codes → messages français.
- `src/i18n/fr.ts` : tous les textes.

## Zone client (`/m/:token`)
`MenuPage` charge `get-menu`, calcule le thème (`buildTheme`) **avant** le premier affichage, puis rend dans
`ThemeScope` : `MenuView` (partagé avec l'aperçu admin) = `CafeHeader` (logo/initiales, nom, phrase d'accroche,
table) → recherche locale → pastilles collantes (la pastille active suit le défilement) → « À la une » (produits
`is_promoted`) → sections par catégorie (`ProductRow`). Barre du bas (`BottomNav`) : Menu, Panier central avec
quantité, Ma table (pastille si commande en cours), Serveur (« Arrive » si appel ouvert, décompte si 429).
`CartDrawer` (create-order), `TableStatePanel` (get-table-state, cancel-order), `FollowDialog` (lien magique, chargé à la demande).

Sans photo : carte compacte avec l'initiale, aucune image cassée (`onError` → initiale). Avec photo : ratio 4:3,
`object-cover`, chargement différé. Aucun texte posé sur une photo (le badge a son propre fond).

## Thème par café (`src/lib/theme.ts`)
`buildTheme(accent, mode)` → variables `--accent`, `--accent-foreground`, `--accent-soft`, `--bg`, `--surface`,
`--surface-2`, `--ink`, `--muted`, `--line`, `--overlay` + `data-theme`. Le texte sur l'accent (blanc ou quasi noir)
atteint toujours 4,5:1 ; sinon l'accent est assombri/éclairci. Un accent invisible sur le fond (presque noir en mode
sombre, presque blanc en mode clair) est ajusté. Valeur absente ou invalide : thème par défaut (#8B5E3C, clair).
`/staff`, `/admin`, `/compte` gardent le thème neutre (`src/index.css`). Mesures : #FFE066 → texte sombre 11,9:1 ;
#111111 sombre → #555555 + texte blanc 7,5:1 ; #C0392B → 5,4:1 ; #2F6B4F → 6,3:1.

## Personnel (`/staff`)
`useStaffData` : chargement complet (`staff_list_orders` par statut avec curseur, appels ouverts, tables + sessions
+ `session_total_cents`, catalogue), canal Realtime filtré par café ; chaque événement recharge la ligne concernée.
Canal tombé ou navigateur hors ligne : bandeau « Connexion perdue » + rechargement complet toutes les 15 s ;
resynchronisation complète au retour. « Démarrer le service » déverrouille l'audio (Web Audio, 2 sons distincts)
et active le Wake Lock. Aucune mise à jour optimiste : après chaque action, la ligne est relue sur le serveur.

## Admin (`/admin/*`)
`AdminLayout` (barre latérale / burger), `MenuAdminPage` + `ProductForm` (photos via `src/lib/image.ts` : WebP,
1200 px max, < 2 Mo), `TablesAdminPage` (`src/lib/qr.ts`, plaquettes A4 via `window.print()`), `StaffAdminPage`,
`AnnouncementsPage`, `SettingsPage` + `AppearanceSettings` (owner, aperçu en direct avec `MenuView`).
