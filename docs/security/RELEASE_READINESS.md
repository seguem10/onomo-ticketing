# État avant publication — 14 octobre 2026

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
