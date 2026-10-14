# Réponse aux incidents — procédure proposée

Confirmer le signal, horodater UTC et Casablanca, désigner responsable incident. Préserver les logs sans secrets et limiter les accès. Ne pas supprimer tickets, pièces jointes ou preuves.
Contenir : désactiver accès compromis via mécanisme approuvé, révoquer sessions, rotation des secrets avec propriétaire et approbation ; vérifier que les access tokens résiduels ne passent plus les guards. Ne jamais retirer RLS/MFA.
Analyser périmètre hôtel/utilisateurs/service et période ; séparer faits/hypothèses. Évaluer obligations de notification avec responsables compétents.
Restaurer dans environnement isolé avant toute remise en service ; vérifier isolation, MFA et workflows ; documenter décision, validation, rollback, communication et suivi.
RPO/RTO, fréquence sauvegardes, chiffrement, conservation et contacts d’astreinte : NON DÉFINIS/À VALIDER. Aucune restauration testée et aucune surveillance récurrente activée par cette PR.
