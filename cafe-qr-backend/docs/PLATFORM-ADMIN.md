# Administration de la plateforme et clés d'accès

Cette première livraison ajoute le tableau de bord /platform-admin, la génération de lots de clés et les statistiques calculées à partir des activations. Les widgets Chariow ne sont pas encore intégrés : leurs codes produits seront ajoutés lorsqu'ils seront fournis.

## Sécurité et initialisation

L'administration plateforme est séparée des rôles owner, manager et waiter des cafés. Les tables platform_admins et access_keys n'autorisent aucune lecture/écriture directe depuis le navigateur. Les deux Edge Functions revérifient le JWT et l'appartenance à platform_admins.

Après avoir créé le compte Supabase Auth destiné à l'administration :

1. Appliquer les migrations avec supabase db push.
2. Dans Supabase SQL Editor, ajouter l'ID Auth du compte comme administrateur :

```sql
insert into public.platform_admins (user_id)
select id from auth.users where lower(email) = lower('admin@example.com')
on conflict (user_id) do nothing;
```

3. Déployer platform-dashboard et create-access-keys.
4. Se connecter dans l'application avec ce compte et ouvrir /platform-admin.

Ne jamais ajouter une clé service_role au frontend. La table platform_admins est administrée depuis Supabase SQL Editor.

## Clés générées

Le lot contient des clés aléatoires séparées par forfait : CAFE-M-… pour le mensuel et CAFE-A-… pour l'annuel. La base conserve seulement leur empreinte SHA-256 et les 8 derniers caractères. Le code complet est renvoyé une seule fois à l'écran et dans le CSV ; conserver ce fichier pour l'import dans Chariow.

Les clés ne périment pas dans l'inventaire. Une clé activée devra ensuite être marquée comme consommée par le parcours d'inscription/renouvellement (à livrer dans l'étape suivante).

## Statistiques

Le filtre mensuel porte sur activated_at. Le revenu affiché est calculé à partir des forfaits activés : 10 USD par clé mensuelle, 110 USD par clé annuelle. Il s'agit du revenu du modèle Café QR compté à l'activation, sans dépendance aux données de vente Chariow.

Tant que le parcours d'activation n'est pas livré, les compteurs d'activations et de revenu restent à zéro.
