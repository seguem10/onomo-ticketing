# SLA — e-mails d'escalade automatiques

La migration `20261008161246_sla_escalation_email_delivery.sql` crée une file
d'attente privée. La fonction `sla-escalation-email` la lit avec la clé de
service Supabase et utilise les secrets EmailJS ou Resend déjà présents.

Avant d'activer le job planifié, configurez le même secret aléatoire aux deux
emplacements suivants, sans le placer dans le code, Git ou le navigateur :

1. **Supabase → Edge Functions → Secrets** :
   `SLA_ESCALATION_CRON_SECRET`.
2. **Supabase → SQL Editor**, dans Vault :
   `select vault.create_secret('VALEUR_IDENTIQUE', 'onomo_sla_cron_secret');`

Ensuite, planifiez un appel toutes les cinq minutes avec les valeurs stockées
dans Vault. Le script exact est fourni pendant le déploiement afin de ne jamais
commiter l'URL de projet ou le secret.

Le job ne doit jamais utiliser une clé EmailJS, Resend, service_role ou un mot
de passe dans son code SQL.
