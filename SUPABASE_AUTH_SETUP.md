# Supabase Auth — Onomo Support IT

Cette version utilise Supabase Auth pour les connexions et la création des utilisateurs.

## 1. Exécuter les migrations

Dans Supabase → SQL Editor, exécuter dans cet ordre :

1. `supabase/secure_roles_migration.sql`
2. `supabase/ticketing_production_migration.sql`

La table `utilisateurs` doit contenir `auth_user_id`.

## 2. Créer le premier administrateur

Pour le premier compte, créer manuellement un utilisateur dans :

Supabase → Authentication → Users → Add user.

Activer la confirmation email si vous voulez permettre la connexion immédiatement.

Copier ensuite l'UUID de l'utilisateur Auth.

Dans SQL Editor, remplacer les valeurs ci-dessous :

```sql
insert into public.utilisateurs (
  id, auth_user_id, email, pwd, prenom, nom, role, hotel,
  hotels, must_change_password, mfa_enabled
) values (
  'UUID_AUTH',
  'UUID_AUTH',
  'admin@votre-domaine.com',
  '',
  'Admin',
  'Système',
  'admin',
  null,
  '[]'::jsonb,
  false,
  false
)
on conflict (auth_user_id) do update set
  email=excluded.email,
  role=excluded.role;
```

Puis associer le rôle Administrateur :

```sql
insert into public.app_user_roles (user_id, role_id)
select 'UUID_AUTH', id
from public.app_roles
where name='Administrateur'
on conflict do nothing;
```

Après cette étape, la connexion de l'administrateur se fait avec Supabase Auth.

## 3. Déployer la fonction de création des utilisateurs

Le fichier est :

`supabase/functions/admin-create-user/index.ts`

Cette fonction crée :

- le compte dans `auth.users`
- le profil dans `public.utilisateurs`
- le lien dans `public.app_user_roles`

La clé service role n'est jamais envoyée au navigateur.

### Avec Supabase CLI

Depuis le dossier du projet :

```bash
supabase functions deploy admin-create-user
```

La fonction utilise automatiquement les variables Supabase disponibles dans l'environnement hébergé.

Si votre projet utilise encore la variable historique `SUPABASE_SERVICE_ROLE_KEY`, elle est également acceptée par le code.

## 4. Création depuis l'application

Une fois la fonction déployée :

1. Se connecter avec le compte Administrateur.
2. Ouvrir Administration → Utilisateurs.
3. Cliquer sur Ajouter un compte.
4. Remplir prénom, nom, email, mot de passe et rôle.
5. Cliquer sur Créer le compte.

Le compte est alors créé directement dans Supabase Auth.

Il est aussi créé automatiquement dans `utilisateurs` et dans `app_user_roles`.

## 5. Session après actualisation

Le navigateur utilise maintenant une session Supabase persistante avec :

- `persistSession: true`
- `autoRefreshToken: true`
- stockage local dédié `onomo-supabase-auth`
- restauration via `auth_user_id`
- écoute des événements `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED` et `USER_UPDATED`

Une actualisation de la page ne doit donc plus déconnecter l'utilisateur tant que sa session Supabase est valide.

## 6. Vérification

Après déploiement Vercel :

1. Se connecter.
2. Actualiser la page avec F5.
3. Vérifier que l'application reste ouverte.
4. Fermer complètement le navigateur.
5. Rouvrir l'application.
6. Vérifier que la session est toujours restaurée.
7. Créer un nouvel utilisateur depuis Administration → Utilisateurs.
8. Vérifier dans Supabase → Authentication → Users que le compte existe.
9. Vérifier dans `utilisateurs` que `auth_user_id` correspond au même UUID.
10. Vérifier dans `app_user_roles` que le rôle est présent.

## Sécurité

Ne jamais mettre `service_role` ou une clé secrète Supabase dans `index.html`, `runtime-sync.js` ou un autre fichier JavaScript exécuté dans le navigateur.

Supabase recommande de garder `service_role` côté serveur. La fonction Edge est utilisée précisément pour cette opération privilégiée.
