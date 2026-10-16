# État avant publication — mise à jour 16 octobre 2026

## Publication effective du 16 octobre

PR #46 fusionnée sur main, commit 58709d4a729552ab137e55dbc0eb5913cc0b7bbd, après autorisation de publication malgré les réserves. Source publique du module MFA vérifiée HTTP 200 avec dialogue intégré et sans ancien prompt de reset. Les CI Security checks et CodeQL du head ad40dd471d4d8493d659af6bd23a80d2415d1603 sont success ; 51 tests locaux PASS.

Après un premier essai non exécuté (limite du contrôle d'approbation), bundle production `onomo_sec06_sec08_sec09_release_bundle` appliqué avec succès via apply_migration, dans une transaction avec lock_timeout 5s et statement_timeout 30s. Il regroupe le contenu des trois migrations SEC-06/08/09 déjà suivies dans Git ; ne pas les rejouer individuellement sans réconciliation de l'historique. Relecture du catalogue : tickets_read et tickets_update exigent le périmètre hôtel pour la branche assignation ; tickets_mfa_gate et assistant_images_mfa_gate sont RESTRICTIVE/ALL/authenticated avec USING et WITH CHECK attendus. Aucun contenu métier supprimé.

Ce constat vérifie le déploiement des politiques, pas un nouveau test HTTP authentifié de toutes les branches en production. Le contrôle Advisors sécurité conserve des avertissements à examiner (notamment pg_net public et fonctions SECURITY DEFINER exposées) : pas de déclaration « zéro risque ». Les réserves de reprise applicative complète et revue indépendante restent ouvertes. Les sections suivantes sont historiques et ne décrivent plus l'état de publication courant.

## Contrôle de publication du 15 octobre

Complément du 16 octobre : l'utilisateur confirme sur Chrome la réinitialisation MFA du compte dédié et l'obligation de nouvelle configuration ; preuve déclarative, non observation indépendante du parcours complet. Dans le navigateur intégré, erreur console reproduite `prompt() is not supported` avant l'appel serveur. Correctif local : dialogue HTML intégré. Recette navigateur isolée avec API simulée et connexions réseau bloquées : ouverture, motif trop court après trim refusé, confirmation d'identité obligatoire, annulation sans appel, envoi simulé valide et retour du focus PASS. Pas de réinitialisation réelle pendant cette recette. Ce correctif UI n'est pas publié.

L'utilisateur a donné son accord pour poursuivre après demande d'autorisation de publication. Aucun merge, migration cloud ou déploiement effectué : prérequis opérationnels toujours incomplets. Ne pas confondre autorisation et validation technique.

- Commit exact : c491f16c4494fc42fc1f9d3cc5e441ad2035dd23, branche sécurité poussée, PR #46 brouillon.
- CI confirmée completed/success : Security checks 38760004491 et CodeQL 38760004411. Réussite de l'analyse, pas absence d'alertes.
- 50 tests de régression locaux PASS, syntaxe validée, scan limité 199 fichiers suivis : zéro candidat, sans garantie sur historique/secrets.
- Recette reconstruite Auth/REST/Storage avec vrais JWT : preuves détaillées dans SCHEMA_RECIPE_PREREQUISITES.md. SEC-06/08/09 appliqués seulement localement. Isolement hôtels, assignation résiduelle, notes internes, MFA et liens signés testés dans les limites documentées.
- Retours arrière SQL ciblés fournis ; ils réintroduisent les risques corrigés. Ce ne sont pas des sauvegardes.
- Sauvegarde : export DB chiffré et restauration SQL isolée avec propriétaires/ACL réussis ; copie portable externe et complément Storage (3 objets) vérifiés cryptographiquement. Voir MANUAL_BACKUP_VERIFICATION.md pour les limites, notamment cohérence non atomique et absence de reprise applicative complète.
- BLOQUANT avant publication : parcours navigateur authentifié complet et reset MFA administrateur AAL2 non validés ; revue indépendante non obtenue ; reprise applicative complète non démontrée.
- Réserve : liens déjà signés restent valables jusqu'à expiration ; 60 secondes demandées par UI, plafond serveur non garanti.

Les sections historiques ci-dessous décrivent l'état du 14 octobre et ne remplacent pas cette mise à jour. Aucun contrôle non exécuté n'est promu PASS.

Décision actuelle : NE PAS FUSIONNER / NE PAS DÉPLOYER automatiquement. PR brouillon #46, branche security/onomo-audit-20261014. Une CI verte n'est pas une validation de sécurité complète.

## Preuves confirmées

- Commit 078592fd0990e9e0008c13926d047c84cb5812f4 : regression completed/success (run 38603548638), CodeQL completed/success (run 38603548518). Checkout v6 épinglé et compatible avec ces jobs.
- 48 tests locaux PASS au dernier ajout de tests. Diff/syntaxe contrôlés lors des changements de code.
- Main : PR et regression obligatoires, branche à jour, protection administrateurs, pas de force-push/suppression.
- Correctifs proposés : caches métier en mode connecté, échappement des rendus et filtres, identifiants séparés du code des handlers, origine des messages PWA.
- Dernière vue d'alertes inspectée au commit 6be44b3 : 8 ouvertes / 8 fermées, dont aucune alerte DOM restante dans cette vue. Compteurs du commit 078592f non réinspectés ; aucune extrapolation.
- Auth/REST/Storage/Realtime réels testés localement avec schéma et helpers simplifiés et données fictives uniquement.
- Scan des 190 fichiers texte suivis : zéro candidat selon motifs limités ; pas un audit de tout l'historique.

## Validations restantes prioritaires

1. Recette navigateur du code de la PR : connexion/MFA, navigation stable, tickets, conversation, sélection des filtres, administration, FR/EN/AR et mobile ; mises à jour PWA sur véritable navigateur.
2. Recette schéma métier complet : politiques, triggers, rôles et périmètres réels ; reset MFA administrateur AAL2 et révocation de sessions. Ne jamais retirer AAL2 pour contourner un échec.
3. Migration SEC-06 : revue indépendante, compatibilité des politiques réellement présentes, tests complets puis autorisation explicite distincte pour application production. Rollback restaure un risque connu.
4. Qualifier les alertes stockage/démo et scripts de recette ; conserver la trace sans masquer le risque ni supprimer les fonctionnalités pour réduire un compteur.
5. Dépendances SDK exactes et lockfiles après compatibilité ; historique secrets/alertes ; protections de déploiement Vercel, quotas/rate limits serveur.
6. Sauvegardes : propriétaire, RPO/RTO, restauration isolée mesurée, inventaire Storage et conservation.

## Hors périmètre d'une validation déjà acquise

Antivirus/quarantaine serveur, conformité ASVS L2 complète, charge, délivrabilité mailing et surveillance opérationnelle ne sont pas validés. Les notifications mailing restent reportées par le demandeur.

Toute fusion sur main peut déclencher le déploiement Vercel. Elle nécessite donc l'autorisation explicite de publication, même si aucune commande deploy n'est lancée.
