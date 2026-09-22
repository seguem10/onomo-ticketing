# Mise en production Supabase — Onomo Support IT

L’application historique utilisait une table `utilisateurs` avec des mots de passe gérés côté navigateur. Ce mode ne convient pas à une production multi-utilisateur.

1. Dans Supabase, activez **Auth → Email / Password** et créez les comptes réels.
2. Exécutez [secure_roles_migration.sql](supabase/secure_roles_migration.sql), puis [ticketing_production_migration.sql](supabase/ticketing_production_migration.sql) dans l’éditeur SQL.
3. Associez chaque compte à son profil `utilisateurs` en renseignant `auth_user_id` avec l’UUID de `auth.users`.
4. Associez les comptes aux rôles via `app_user_roles`.
5. Vérifiez que les anciennes policies `allow_all` ne sont plus présentes pour les tables protégées.
6. Hébergez l’application en HTTPS. Les services workers, le cache PWA et les sessions Auth ne sont pas fiables sous `file://`.

## Durcissement P0 des accès

Après les migrations précédentes, exécutez aussi `supabase/p0_rls_hardening.sql`, puis `supabase/p3_settings_security_reconciliation.sql` et `supabase/p4_profile_privilege_guard.sql`, dans le SQL Editor Supabase.

Cette migration crée la table de périmètres hôtel manquante, rétablit la compatibilité
avec les rôles historiques utilisant la permission `*`, protège le journal des tickets
avec les mêmes règles RLS que les tickets et empêche un demandeur de modifier
l'assignation, le statut, la priorité, l'hôtel ou le créateur d'un ticket.

Avant de l'exécuter en production, exportez une sauvegarde et lancez ensuite
`supabase/tests/ticketing_security.test.sql` dans un environnement de test avec les
UUID de comptes de test à jour.

La clé publishable Supabase peut être fournie au navigateur. Ne placez jamais une clé `service_role` dans ce fichier HTML, dans JavaScript ou dans le navigateur.

La réconciliation P3 réserve strictement `app_settings` au rôle Administrateur,
accorde à ce rôle les droits SQL nécessaires pour enregistrer les paramètres et
journalise chaque modification dans `audit_logs` sans recopier de valeur sensible.

La migration P4 bloque l’auto‑élévation de privilèges dans un profil : un
utilisateur ne peut jamais s’attribuer un rôle, un hôtel, une permission, un MFA
ou un mot de passe local. Les mots de passe restent exclusivement gérés par
Supabase Auth.
