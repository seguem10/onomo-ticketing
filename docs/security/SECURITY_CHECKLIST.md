# Checklist avant validation

- [x] Branche dédiée ; main non modifiée ; aucun déploiement production.
- [x] Inspection code, RLS/buckets en lecture seule ; données métier intactes.
- [x] Correctifs minimaux et 41 tests locaux.
- [x] Journaux de test sans mots de passe ni tokens.
- [ ] PR créée et revue indépendante ; CI GitHub PASS.
- [ ] Recette explicitement autorisée ; rôles/hôtels fictifs et isolation testée.
- [ ] Tests cookies pertinents/auth bearer, révocation/MFA/role-changes/API/Realtime.
- [ ] Validation serveur fichiers et malware/quarantaine.
- [ ] FR/EN/AR, design, mobile/PWA et workflows vérifiés après modifications.
- [ ] Secret scanning, CVE, CodeQL, main protégée, production gate.
- [ ] WAF/rate limits Auth et API vérifiés.
- [ ] Backups, restauration isolée, RPO/RTO et conservation validés.
- [ ] ASVS L2 checklist complète versionnée et preuves par exigence.
- [ ] Autorisation explicite avant merge, migration ou production.
