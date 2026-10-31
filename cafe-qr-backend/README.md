# Café QR : backend Supabase (V1 cafés)

Backend multi-tenant pour cafés : menu par QR code, commande depuis la table, appel serveur,
écran du personnel en temps réel, comptes clients et envoi de nouveautés par email (Resend).
Backend uniquement (SQL, Edge Functions TypeScript/Deno, scripts Node). Aucun frontend.

```
supabase/
  config.toml  000                   verify_jwt par fonction
  migrations/0001_schema.sql      enums, tables, index, triggers
  migrations/0002_rls.sql         fonctions d'aide, privilèges, RLS, policies
  migrations/0003_functions.sql   RPC personnel/clients, fonctions internes, droits
  migrations/0004_realtime_storage.sql
  seed.sql                        données de test (local uniquement)
  functions/_shared/              cors, supabase, validate, errors, ratelimit
  functions/<8 fonctions>/index.ts
scripts/create-cafe.mjs, scripts/generate-qr.mjs
docs/API.md, docs/ASSUMPTIONS.md, docs/TESTS-MANUELS.md
```
xc
## Prérequis
- Supabase CLI récent (`supabase --version`), Docker pour la stack locale
- Node.js ≥ 20.6 (scripts), `jq` et `psql` pour les tests manuels
- Un compte Resend avec un domaine d'envoi vérifié

## A. Développement local

```bash
npm install
supabase start                      # démarre Postgres, Auth, Realtime, Storage, Edge Runtime
supabase db reset                   # applique 0001 → 0004 puis seed.sql
cp .env.example supabase/functions/.env   # renseigner ALLOWED_ORIGINS, UNSUBSCRIBE_SECRET, EMAIL_DRY_RUN=true…
supabase functions serve --env-file supabase/functions/.env
```
Puis dérouler `docs/TESTS-MANUELS.md`. Les emails d'invitation locaux arrivent dans l'interface mail de
la stack locale (voir `supabase status`).

## B. Déploiement en production (ordre exact)

```bash
# 1. Lier le projet
supabase login
supabase link --project-ref <PROJECT_REF>

# 2. (Recommandé) activer pg_cron : Dashboard → Database → Extensions → pg_cron
#    (sinon la migration 0003 tente de l'activer, ou se rabat sur le nettoyage opportuniste)

# 3. Migrations (le seed n'est PAS appliqué en production)
supabase db push

# 4. Secrets des Edge Functions (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement)
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  MAIL_FROM="Café QR <nouveautes@votre-domaine.fr>" \
  SITE_URL=https://menu.votre-domaine.fr \
  ALLOWED_ORIGINS=https://menu.votre-domaine.fr \
  UNSUBSCRIBE_SECRET=$(openssl rand -hex 32)

# 5. Déployer les fonctions (verify_jwt lu dans supabase/config.toml)
supabase functions deploy get-menu
supabase functions deploy get-table-state
supabase functions deploy create-order
supabase functions deploy cancel-order
supabase functions deploy call-waiter
supabase functions deploy unsubscribe
supabase functions deploy create-staff
supabase functions deploy send-announcement
```

### 6. Réglages Auth (Dashboard → Authentication)
- **URL Configuration** : Site URL = `SITE_URL`, Redirect URLs = `SITE_URL/**`.
- **Providers → Email** : activé (lien magique) ; désactiver les connexions anonymes.
- **SMTP** : configurer le SMTP Resend (`smtp.resend.com`), sinon les invitations du personnel et liens
  magiques sont fortement limités par le service email intégré.

### 7. Créer le premier café et ses QR codes

```bash
cp .env.example .env    # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL (jamais versionné)
npm install
node --env-file=.env scripts/create-cafe.mjs --name "Le Petit Café" --slug le-petit-cafe \
     --owner-email patron@example.com --owner-name "Marie" --tables 12
node --env-file=.env scripts/generate-qr.mjs --slug le-petit-cafe      # → qr/le-petit-cafe/*.svg
```
Le patron reçoit une invitation par email. Les SVG pointent vers `${SITE_URL}/m/<qr_token>`.
⚠ Le dossier `qr/` contient les jetons secrets : ne pas le versionner (déjà dans `.gitignore`).

## Frontend requis (hors de ce lot)
- Page `/desabonnement` (publique, sans appel d'API) : lit `?statut=ok&cafe=<nom>` ou `?statut=invalide`.
  Le lien des emails passe par la fonction `unsubscribe`, qui désabonne puis redirige vers cette page.
- Case « Recevoir les nouveautés » **non pré-cochée** à l'inscription client (`newsletter_opt_in`).
- Stocker la `cancel_key` renvoyée par `create-order` (localStorage) pour permettre l'annulation.

## Règles de sécurité appliquées
- RLS sur **toutes** les tables de `public` (la migration 0002 échoue sinon) + privilèges colonne par colonne.
- Isolation par `cafe_id` via `current_staff_cafe_id()` et clés étrangères composites.
- `service_role` uniquement dans les Edge Functions et les scripts d'admin.
- Aucune écriture anonyme directe : commandes, appels et sessions passent par les Edge Functions.
- Prix et totaux recalculés en base, montants en centimes entiers.
- Fonctions `SECURITY DEFINER` avec `set search_path = ''` et objets qualifiés par leur schéma.

## Opérations admin utiles (SQL, service_role)
```sql
-- Désactiver un café
update public.cafes set is_active = false where slug = 'le-petit-cafe';
-- Débloquer une annonce restée en "sending" après une interruption
update public.announcements set status = 'draft', sending_started_at = null where id = '<uuid>' and status = 'sending';
```
