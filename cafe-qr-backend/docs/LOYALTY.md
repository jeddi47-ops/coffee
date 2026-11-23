# Fidélité

La migration `20261123104604_loyalty_program.sql` ajoute uniquement les tables et fonctions de fidélité. Aucun programme n'est activé par défaut. Le patron active et configure son programme dans `/admin/fidelite`.

- Compte client gratuit : QR personnel dans `/compte`, première carte créée au premier scan.
- Personnel connecté : onglet Fidélité dans `/staff`, accès caméra requis (HTTPS). Le scan ajoute immédiatement un tampon. Le café provient du compte du personnel, jamais du QR.
- Le délai est propre au couple client/café, 60 minutes par défaut (1 minute à 7 jours).
- Corrections réservées au patron, avec motif obligatoire. Elles ne représentent pas une visite et ne réinitialisent pas le délai.
- Une récompense retire exactement le seuil actuel, en conservant le surplus. Changer le seuil applique le nouveau seuil aux cartes existantes ; aucun tampon acquis n'est supprimé.
- Le journal conserve les scans, corrections et récompenses ; l'interface affiche les 50 dernières opérations de chaque carte.
- Rappel après 14 jours par défaut, réglable de 1 à 365 jours. Seuls les clients auxquels il manque 1 ou 2 tampons sont concernés. Une nouvelle visite réussie réarme le rappel.

## Mise en service

1. Appliquer la migration sur l'environnement choisi, puis déployer `loyalty-reminders` et le frontend ensemble.
2. Configurer `VITE_VAPID_PUBLIC_KEY` pour le frontend et `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` pour la fonction, en réutilisant les clés push existantes.
3. Appliquer la migration `20261123104858_loyalty_reminder_auth.sql` : elle génère le secret dans Vault et configure la vérification réservée au service serveur. L’URL Vault doit correspondre au projet déployé.
4. Activer les extensions `pg_cron` et `pg_net`, puis exécuter le script `scripts/schedule-loyalty.sql`. Il appelle la fonction chaque jour à 12h UTC. Le secret n'est pas écrit dans le dépôt ni dans la commande Cron.
5. Le client active explicitement les rappels dans son compte. Sur iPhone, installer l'application sur l'écran d'accueil si nécessaire. Il peut retirer l'abonnement de cet appareil depuis le même écran.

Le traitement réserve au plus 100 cartes par passage. Pour une audience plus grande, augmenter la fréquence du Cron. Un rappel est marqué avant l'envoi pour éviter un doublon après une interruption ; une panne après réservation peut donc empêcher ce rappel. Aucune relance automatique de ce même rappel n'est effectuée. Les clés VAPID sont vérifiées avant la réservation.

## Vérifications

`npm run build` dans le frontend vérifie TypeScript et produit le build. Les règles de la migration peuvent être vérifiées en PostgreSQL avec le script `scripts/test-loyalty.mjs` (PGlite, dépendance de développement). Ce test utilise des comptes fictifs ; il ne contacte jamais Supabase.

Les tests caméra sur appareils et la livraison réelle de push restent à effectuer sur un environnement HTTPS avec les secrets configurés.
