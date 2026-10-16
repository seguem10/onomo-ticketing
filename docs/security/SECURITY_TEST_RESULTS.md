# Preuves exécutées

Date : 14/10/2026. Commande locale : node --test tests/*.test.cjs. Résultat : 41 PASS, 0 FAIL.
Deux nouveaux tests : cache métier non persistant quand Supabase configuré/démo conservée ; export par hôtel sans interpolation executable du nom.
Tests existants : logique rôles, conversations/XSS, fichiers images, MFA assurance/audit, suivi tickets, push. Certains sont des tests de source ou mocks : ils ne prouvent pas les autorisations serveur.
Lectures SQL réelles : 26/26 RLS, 4/4 buckets privés, politiques et triggers examinés. PASS pour ces assertions de configuration uniquement.

NOT TESTED : scénarios multi-hôtels avec identifiants fictifs dans recette, appels API actifs, RLS INSERT/UPDATE/DELETE sous autres rôles, Realtime, MFA bout-en-bout, uploads malveillants, restauration, mobile/PWA et FR/EN/AR navigateurs, CI exécutée par GitHub, CodeQL, dépendances CVE, secret scanning complet, WAF, branches protégées.
MAIL : test précédent échoué chez fournisseur, non relancé.
Aucun test actif offensif exécuté en production. Aucun PASS global ASVS déclaré.

Contrôles de catalogue supplémentaires PASS : zéro SECURITY DEFINER public exécutable par anon ; zéro politique public pour anon/PUBLIC ; vue exposée identifiée configurée security_invoker=true. Les fonctions privées, grants de schémas et RPC authentifiés restent à auditer exhaustivement.

## PostgreSQL isolé — exécution réelle

Conteneur `onomo-security-20261014`, PostgreSQL 17.6 Alpine, réseau `none`, aucun port publié. Image digest sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94.
Commande : tests/isolated-rls.sql via docker exec/psql, ON_ERROR_STOP=1. Aucun accès production. Helpers Auth simulés : ce n’est pas un test JWT/Supabase complet.

- PASS : IT local lit hôtel A.
- PASS : IT local ne lit pas ticket non assigné B.
- PASS : INSERT hors hôtel B refusé par RLS.
- PASS : régional lit les hôtels assignés A/B.
- PASS : admin lit les trois tickets fictifs.
- FAIL : un ticket B encore assigné à l’IT reste lisible quand le scope de l’IT est limité à A. Reproduction de la branche assigned_to de la politique inspectée.

Le script retourne aussi les FAIL sous forme de lignes ; le code de sortie psql=0 n’est pas un succès global. Correction de politique NON APPLIQUÉE. Les tests UPDATE/Storage/Realtime/Auth et les helpers réels restent NOT TESTED.

### Correction SEC-06 en recette seulement

Migration proposée 20261014101827 exige le scope hôtel sur les branches assigned_to de SELECT et UPDATE, avec USING et WITH CHECK. Politique propriétaire demandeur inchangée.
Après application locale : 8 assertions PASS (lecture A ; absence B y compris ancien assigné ; UPDATE B=0 ; UPDATE A=1 ; INSERT B refusé ; régional A/B ; admin global ; propriétaire demandeur inchangé). Les assertions SQL lèvent une exception en cas d’échec, ON_ERROR_STOP=1.
Rollback exécuté : comportement original reproduit, puis correctif réappliqué et 8 assertions PASS à nouveau. Aucun changement production. Storage/Realtime/Auth serveur et handlers complets toujours NOT TESTED.

## Auth réel local via Compose

DB/Auth/REST démarrés avec ports 127.0.0.1 uniquement, santé Auth/REST HTTP 200. Commande `node scripts/test-local-auth.cjs` exécutée : six assertions PASS (inscription fictive auto-confirmée localement ; mauvais mot de passe refusé ; login réussi ; identité authentifiée ; véritable enrollment/challenge/verify TOTP et token AAL2 ; refresh après logout global refusé). Aucun email réel ni secret imprimé.
Ce test valide Auth local, pas la fonction métier admin-reset-MFA, la configuration cloud, le schéma métier, Storage ou Realtime. Ces scénarios restent NOT TESTED.

## REST avec sessions Auth réelles locales

`node scripts/test-local-rest.cjs` exécuté sur Auth :65433 et REST :65434, avec fixtures uniquement : huit assertions PASS. IT A ne lit que A ; UUID B ne retourne aucune ligne ; PATCH B ne modifie rien ; PATCH A réussit ; INSERT B et falsification created_by refusés 403 ; IT B ne lit que B ; anonyme refusé.
Les helpers de permissions sont simplifiés dans tests/local-rest-fixture.sql et les politiques reproduisent le modèle corrigé. Les JWT sont réellement émis et vérifiés par Auth/PostgREST. Ne pas extrapoler ce résultat aux fonctions/trigger/scopes complets de production. Stockage, Realtime, interface mobile et récupération MFA restent NOT TESTED.

## Storage réel local

Service storage-api v1.72.1 sur 127.0.0.1:65435, secrets locaux en environnement, aucun provider S3/externe. Bucket recipe-private et fichier texte fictif, politiques reliées à la fixture tickets.
`node scripts/test-local-storage.cjs` : sept assertions PASS (upload autorisé ; lecture privée autorisée ; lecture autre hôtel refusée ; lecture anonyme refusée ; création URL signée hors périmètre refusée ; URL autorisée utilisable ; expiration après délai). URL/token/secret non imprimés.
Ces tests valident le service et le modèle minimal de scope avec Auth réel local ; ils ne valident pas les politiques complètes de production, malware, path traversal, quota, notes internes, suppression ni téléchargement après retrait de droits durant la durée de validité d’un lien déjà signé. Realtime toujours NOT TESTED.

## Realtime réel local

Realtime v2.130.0 démarré sur 127.0.0.1:65436, tenant local realtime-dev, clés locales non imprimées. `node scripts/test-local-realtime.cjs` : quatre contrôles PASS (deux subscriptions Auth prêtes ; A reçoit UPDATE A ; B reçoit UPDATE B ; aucun événement croisé A/B avec contrôles positifs). Publication limitée à recipe_tickets.
Le client WS utilise le module existant du conteneur Storage et des tokens fictifs sur stdin. Le test utilise le service réel mais les helpers et tables sont ceux de la fixture minimale. Sessions expirées/révocation en cours d’abonnement, changements de droits en direct, messages internes, INSERT/DELETE, broadcast/presence privés et limites de charge restent NOT TESTED. Aucun test Realtime production.
