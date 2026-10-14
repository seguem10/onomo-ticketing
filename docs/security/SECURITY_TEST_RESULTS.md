# Preuves exécutées

Date : 14/10/2026. Commande locale : node --test tests/*.test.cjs. Résultat : 41 PASS, 0 FAIL.
Deux nouveaux tests : cache métier non persistant quand Supabase configuré/démo conservée ; export par hôtel sans interpolation executable du nom.
Tests existants : logique rôles, conversations/XSS, fichiers images, MFA assurance/audit, suivi tickets, push. Certains sont des tests de source ou mocks : ils ne prouvent pas les autorisations serveur.
Lectures SQL réelles : 26/26 RLS, 4/4 buckets privés, politiques et triggers examinés. PASS pour ces assertions de configuration uniquement.

NOT TESTED : scénarios multi-hôtels avec identifiants fictifs dans recette, appels API actifs, RLS INSERT/UPDATE/DELETE sous autres rôles, Realtime, MFA bout-en-bout, uploads malveillants, restauration, mobile/PWA et FR/EN/AR navigateurs, CI exécutée par GitHub, CodeQL, dépendances CVE, secret scanning complet, WAF, branches protégées.
MAIL : test précédent échoué chez fournisseur, non relancé.
Aucun test actif offensif exécuté en production. Aucun PASS global ASVS déclaré.

Contrôles de catalogue supplémentaires PASS : zéro SECURITY DEFINER public exécutable par anon ; zéro politique public pour anon/PUBLIC ; vue exposée identifiée configurée security_invoker=true. Les fonctions privées, grants de schémas et RPC authentifiés restent à auditer exhaustivement.
