# Plan de remédiation

1. Branche actuelle : cache local métier et interpolation handlers, tests locaux, CI de régression, PR sans fusion.
2. Recette isolée : fixtures hôtels A/B, demandeur/IT/admin, matrice autorisations et RLS/Storage/Realtime ; ne pas utiliser production pour reproductions offensives.
3. P0 si confirmé : corriger accès inter-hôtels et élévation par migration minimale réversible ; revue indépendante avant production.
4. Auth : live-session checks, révocation/rôle changé, récupération MFA et tests navigateurs ; ne pas retirer AAL2.
5. Uploads : inspection du contenu côté serveur/quarantaine et analyse malware ; conserver documents existants sans les supprimer.
6. API : validation taille avant parsing, idempotence durable événement et quota fournisseur ; pas de changement métier sans validation.
7. Supply chain : versions exactes + Deno locks après compatibilité, CodeQL/secret scanning/Dependabot, protection main et gate déploiement.
8. Backups : établir RPO/RTO et test de restauration isolée ; politique de conservation et réponse incidents.

Besoin restant : URL/projet de recette explicitement autorisé ou environnement local reproductible, accès settings GitHub/Vercel, propriétaire sauvegardes. Ne jamais fournir de secret dans le chat.
