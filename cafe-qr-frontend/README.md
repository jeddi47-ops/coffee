# Café QR : frontend (lot 1 : zone client et désabonnement)

React 18 + Vite + TypeScript, Tailwind, Zustand, React Router, supabase-js.
Consomme les Edge Functions décrites dans `docs/API.md` du backend.

## Installation
```bash
npm install
cp .env.example .env       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (clé anon uniquement), VITE_SITE_URL
npm run dev
```

## Routes livrées dans ce lot
- `/m/:token` : menu, panier, commande, suivi de table, appel serveur, annulation.
- `/desabonnement?statut=ok&cafe=<nom>` ou `?statut=invalide` : page statique, sans API.

Pas encore livré : `/login`, `/auth/*`, `/staff`, `/admin/*`, `/compte`.

## Déploiement
Vercel ou Netlify (SPA). `vercel.json` réécrit toutes les routes vers `index.html`.
Penser à définir les trois variables `VITE_*` dans le projet d'hébergement.

## Règle d'or
Seule la clé anon existe ici. Vérifier avant livraison qu'aucune clé de service n'est présente dans le dépôt.
