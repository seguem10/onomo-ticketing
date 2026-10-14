# Modèle de menaces

Actifs : tickets, messages publics/internes, pièces jointes, comptes/permissions, secrets serveur, tokens, journaux.
Frontières : navigateur non fiable → Supabase Auth/REST/RLS ; navigateur → fonctions serveur ; Storage → URL signées ; fonctions → services email/IA ; GitHub → Vercel.

Scénarios prioritaires : accès inter-hôtels par UUID ; changement des champs role/hotel/MFA ; ancien token après retrait de permissions ; consultation note interne par demandeur ; vol token via XSS ; fichier falsifié ; génération abusive emails/IA ; journaux falsifiés ; dépendance compromise.
Administrateur compromis et technicien malveillant restent dans le modèle. Les permissions du client ne constituent jamais une autorité.

Vérifié : RLS activé, buckets privés, getUser côté fonctions sensibles, trigger de garde des profils. Hypothèses non démontrées : protection de main, WAF, backups, état des secrets/rotations, isolation d’un environnement de recette. Aucun environnement de test distant autorisé identifié.
