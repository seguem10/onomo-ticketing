# Surface API

Inventaire local : admin-create-user, admin-reset-user-password, complete-first-login, admin-mfa-policy, admin-import-it-roster, admin-email-self-test, ticket-notification-delivery, access-request-email, sla-escalation-email, ai-ticket-analysis, ai-it-assistant.
Les handlers de provisioning/reset/MFA examinent getUser et les permissions. MFA reset exige AAL2 du token authentifié, identité confirmée, motif et autre administrateur ; le contrôle de révocation instantanée de sessions est à tester.
Email self-test limite l’adresse à celle de l’utilisateur confirmé et utilise une réservation SQL atomique 60 s ; le fournisseur email reste non validé (HTTP 400 lors du test précédent). Demandes d’accès désactivées dans UI, code/API conservés.
Analyse ticket : permission ticket:create et JSON uniquement, mais parse avant limites des champs, absence de limite de corps/rate limiter constatée dans ce handler. Timeout et consommation fournisseur à contrôler.

CORS origin preview regex trop large à revoir ; CORS n’est pas une autorisation. Tests non authentifié/non autorisé/autorisé, payload excessif, rejouage et mass assignment : NOT TESTED sur environnement distant. Secrets uniquement référencés par nom, valeurs non lues.
