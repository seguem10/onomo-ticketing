# Checklist avant validation

- [x] Branche dédiée ; main non modifiée ; aucun déploiement production.
- [x] Inspection code, RLS/buckets en lecture seule ; données métier intactes.
- [x] Correctifs minimaux et 46 tests locaux PASS au commit 862b4a3.
- [x] Journaux de test sans mots de passe ni tokens.
- [x] PR brouillon #46 créée ; CI Security checks PASS au commit 862b4a3 (run 38599339428).
- [ ] Revue indépendante avant mise en production.
- [x] Recette locale isolée avec utilisateurs/hôtels fictifs : Auth, REST, Storage, Realtime et modèle RLS minimal testés.
- [ ] Recette complète du schéma, helpers et fonctions métier réellement déployés.
- [ ] Tests cookies pertinents/auth bearer, révocation/MFA/role-changes/API/Realtime.
- [ ] Validation serveur fichiers et malware/quarantaine.
- [ ] FR/EN/AR, design, mobile/PWA et workflows vérifiés après modifications.
- [x] Main protégée : PR et regression obligatoires, sans bypass admin/force-push/suppression.
- [x] CodeQL configuré ; première analyse JavaScript/TypeScript et Actions publiée, 15 alertes initiales qualifiées partiellement.
- [ ] Résultats CodeQL après tous les correctifs confirmés ; alertes restantes entièrement qualifiées.
- [ ] Secret scanning historique, CVE/dépendances verrouillées et production gate validés.
- [ ] WAF/rate limits Auth et API vérifiés.
- [ ] Backups, restauration isolée, RPO/RTO et conservation validés.
- [ ] ASVS L2 checklist complète versionnée et preuves par exigence.
- [ ] Autorisation explicite avant merge, migration ou production.

Dernier point CI : CodeQL run 38599339409 encore in_progress lors du contrôle. Aucun résultat final supposé. La réussite de regression ne signifie ni zéro alerte CodeQL ni conformité ASVS L2.
