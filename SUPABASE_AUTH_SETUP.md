# Supabase Auth — Onomo Support IT

Cette version utilise Supabase Auth pour les connexions et la création des utilisateurs.

## 1. Exécuter les migrations

Dans Supabase → SQL Editor, exécuter dans cet ordre :

1. `supabase/secure_roles_migration.sql`
2. `supabase/ticketing_production_migration.sql`
3. `supabase/p0_rls_hardening.sql`
4. `supabase/p3_settings_security_reconciliation.sql`
5. `supabase/p4_profile_privilege_guard.sql`
6. `supabase/p5_notification_trigger_reconciliation.sql`
7. `supabase/p6_ticket_creation_history_fix.sql`
8. `supabase/p7_requester_it_scope.sql`
9. `supabase/p8_canonical_ticket_numbers.sql`
10. `supabase/p9_my_permissions_rpc.sql`
11. `supabase/p10_profile_rls_reconciliation.sql`
12. `supabase/p11_ticket_rls_reconciliation.sql`
13. `supabase/p12_ticket_related_rls_reconciliation.sql`
14. `supabase/p13_rbac_reconciliation.sql`
15. `supabase/p14_audit_and_settings_rls_reconciliation.sql`

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

La fonction nécessite le secret serveur `SUPABASE_SERVICE_ROLE_KEY`. Il ne doit
jamais être ajouté aux variables Vercel ni au code navigateur :

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role
supabase functions deploy admin-create-user
```

## 4. Déployer l'analyse IA (optionnelle)

L'analyse des tickets et la création d'utilisateurs sont deux fonctions Edge
distinctes. Déployez la première uniquement si vous activez l'option IA :

```bash
supabase secrets set ANTHROPIC_API_KEY=votre_cle_anthropic
supabase functions deploy ai-ticket-analysis
```

L'analyse attend actuellement du JSON (titre et description). La dictée vocale
requiert en plus un fournisseur de transcription dédié : l'application affiche
une erreur explicite tant que celui-ci n'est pas configuré, au lieu de simuler
une transcription ou d'envoyer l'audio à Anthropic.

## 5. Création depuis l'application

Une fois la fonction déployée :

1. Se connecter avec le compte Administrateur.
2. Ouvrir Administration → Utilisateurs.
3. Cliquer sur Ajouter un compte.
4. Remplir prénom, nom, email, mot de passe et rôle.
5. Cliquer sur Créer le compte.

Le compte est alors créé directement dans Supabase Auth.

Il est aussi créé automatiquement dans `utilisateurs` et dans `app_user_roles`.

## 6. Session après actualisation

Le navigateur utilise maintenant une session Supabase persistante avec :

- `persistSession: true`
- `autoRefreshToken: true`
- stockage local dédié `onomo-supabase-auth`
- restauration via `auth_user_id`
- écoute des événements `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED` et `USER_UPDATED`

Une actualisation de la page ne doit donc plus déconnecter l'utilisateur tant que sa session Supabase est valide.

## 7. Vérification

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

## 8. Réinitialisation de mot de passe

Dans **Authentication → URL Configuration**, ajoutez l'URL de redirection :

```text
https://onomo-ticketing.vercel.app/#reset-password
```

Ajoutez aussi l'URL équivalente de préproduction si elle est utilisée. Le lien
« Mot de passe oublié ? » envoie ensuite un email Supabase standard ; la page
ne révèle jamais si l'adresse demandée correspond à un compte existant.
