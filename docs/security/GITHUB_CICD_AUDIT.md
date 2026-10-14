# GitHub / CI — 14 octobre 2026

Contrôles réellement exécutés : repository metadata via connecteur, CI runs du commit 9496f28, GET public /branches/main.
CI Security checks : run 38554785665 completed/success. Ceci concerne cette version, pas les futurs commits. Dépôt public, default branch main. Branch endpoint protected=false. Rulesets détaillés et accès/bypass administrateurs pas vérifiés ; aucune règle de protection modifiée.

Risque SEC-07 (haut) : absence de protection main signalée, pouvant permettre publication sans revue ou contrôles obligatoires. Faire valider une règle exigeant PR, revue indépendante et CI Security checks/regression, blocage force-push/suppression, restrictions bypass et gate production. Vérifier possibilité de revue avec le nombre réel de mainteneurs pour éviter un blocage opérationnel.

Proposé en PR : Actions contents:read, checkout SHA épinglé, persist-credentials=false, timeout, tests/syntaxe et scan supplémentaire de secrets des fichiers courants sans imprimer les valeurs. Dependabot couvre Actions seulement (pas les imports npm Deno).
Secret scanning natif GitHub est disponible automatiquement pour repos publics selon documentation ; état des alertes/push protection et historique complet NON VÉRIFIÉS. Le scanner local ne remplace pas GitHub/Gitleaks ni une rotation des secrets compromis.
CodeQL, CVE des imports serveur, Vercel protections/WAF, gates déploiement et backups restent à vérifier. Aucun secret CI ajouté, aucune action tierce non épinglée introduite et aucune fusion/déploiement.

## Mise à jour — protection activée avec autorisation

Le 14 octobre 2026, règle classique créée pour `main` via les paramètres GitHub. Confirmation UI : « Branch protection rule created », application à une branche.

- Pull Request obligatoire ; approbations indépendantes non obligatoires en l'absence de second mainteneur identifié.
- Check `regression` obligatoire, source GitHub Actions, branche à jour avant fusion.
- Application aux administrateurs, sans bypass des protections.
- Force push et suppression non autorisés.

Dernier contrôle CI vérifié : commit `12fe61a470b796d162aca641efada6713cade0be`, run `38556956550`, Security checks, completed/success. Ce résultat ne valide pas des commits ultérieurs ni la conformité ASVS complète.

SEC-07 est partiellement remédié : protection main activée ; revue indépendante et gate de production restent à organiser. La PR #46 demeure non fusionnée ; aucun déploiement production réalisé.

## CodeQL préparé

Workflow avancé pour JavaScript/TypeScript et GitHub Actions, suite security-extended, actions épinglées par SHA officiel, checkout sans credentials persistants. Permission security-events:write limitée au job d'analyse pour publier les résultats ; aucun secret métier, déploiement, calendrier récurrent ni modification des SDK serveur.

SHA CodeQL v4 vérifié via git ls-remote du dépôt officiel : f3c49fd1ef3281abc41069b3dd22807a60c963f6. Référence : https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options

Résultats CodeQL : NON TESTÉS tant que les jobs ne sont pas terminés. Ce scan ne valide pas RLS, MFA ou autorisations métier à l'exécution. Aucun check CodeQL rendu obligatoire avant validation de son fonctionnement.

Inventaire initial : 7 fonctions importent supabase-js avec @2 flottant, 4 avec @2.49.8 ; aucun lockfile trouvé. Audit CVE et verrouillage compatibles restent à effectuer, sans upgrade arbitraire du système.
