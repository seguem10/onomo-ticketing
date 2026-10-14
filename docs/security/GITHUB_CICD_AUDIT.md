# GitHub / CI — 14 octobre 2026

Contrôles réellement exécutés : repository metadata via connecteur, CI runs du commit 9496f28, GET public /branches/main.
CI Security checks : run 38554785665 completed/success. Ceci concerne cette version, pas les futurs commits. Dépôt public, default branch main. Branch endpoint protected=false. Rulesets détaillés et accès/bypass administrateurs pas vérifiés ; aucune règle de protection modifiée.

Risque SEC-07 (haut) : absence de protection main signalée, pouvant permettre publication sans revue ou contrôles obligatoires. Faire valider une règle exigeant PR, revue indépendante et CI Security checks/regression, blocage force-push/suppression, restrictions bypass et gate production. Vérifier possibilité de revue avec le nombre réel de mainteneurs pour éviter un blocage opérationnel.

Proposé en PR : Actions contents:read, checkout SHA épinglé, persist-credentials=false, timeout, tests/syntaxe et scan supplémentaire de secrets des fichiers courants sans imprimer les valeurs. Dependabot couvre Actions seulement (pas les imports npm Deno).
Secret scanning natif GitHub est disponible automatiquement pour repos publics selon documentation ; état des alertes/push protection et historique complet NON VÉRIFIÉS. Le scanner local ne remplace pas GitHub/Gitleaks ni une rotation des secrets compromis.
CodeQL, CVE des imports serveur, Vercel protections/WAF, gates déploiement et backups restent à vérifier. Aucun secret CI ajouté, aucune action tierce non épinglée introduite et aucune fusion/déploiement.
