# Supabase : constat en lecture seule

14/10/2026 : 26 tables publiques, toutes avec RLS. 4 buckets privés : images assistant (5 Mo), photos profils (1 Mo), pièces jointes et fichiers messages (10 Mo). Aucun fichier réel lu.
Tickets : INSERT permission ticket:create + created_by=auth.uid + hotel scope ; SELECT admin ou read-all avec scope ou propriétaire/assigné ; UPDATE admin/support avec scope ou propriétaire/assigné. Trigger protège créateur/affectation/statut/priorité/hôtel et champs sensibles du profil.
Fichiers : SELECT Storage via ticket/commentaire soumis à RLS ; URL signées cliente 60 s. Journaux audit_logs et activity_log : SELECT administrateur. activité cliente INSERT acteur propre, mais nom/action/détails restent non fiables.

Attention : branches propriétaire/assigné à tester après retrait de scope ; update column-level pour demandeur à tester ; helpers SECURITY DEFINER à inventorier intégralement et tester avec rôles fictifs ; tables exposées/vues/grants/Realtimes non intégralement validés. RLS activé ne signifie pas RLS correcte.
Fonctions privées MFA et scopes examinées ; aucun bypass ajouté. Toutes modifications SQL reportées après fixture et migrations inverses. Aucun changement SQL effectué dans cette tranche.

## Contrôles supplémentaires du 14/10/2026

Requêtes de catalogue exécutées : aucune fonction SECURITY DEFINER du schéma public n'est exécutable par anon ; aucune politique public destinée à anon/PUBLIC ; seule vue public accessible aux rôles anon/authenticated identifiée : ticket_message_counts, avec security_invoker=true. Ces constats portent sur la configuration et ne sont pas des tentatives d'exploitation.
Docker CLI disponible (29.8.2). La disponibilité du moteur, la reproductibilité du schéma local et les fixtures ne sont pas encore vérifiées ; aucune stack locale démarrée.
