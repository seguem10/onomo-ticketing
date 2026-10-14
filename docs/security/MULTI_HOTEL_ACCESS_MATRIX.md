# Matrice d’accès attendue

| Rôle | Tickets | Messages/fichiers | Annuaire | Administration |
| --- | --- | --- | --- | --- |
| Demandeur | Création hôtel autorisé, lecture de ses tickets | Publics de ses tickets ; aucun interne | Support autorisé de son hôtel | Non |
| IT Hôtel | Son hôtel selon permissions | Tickets autorisés ; internes selon droits | Support autorisé | Non |
| IT Régional | Liste explicite d’hôtels assignés | Même périmètre | Support autorisé | Non |
| Administrateur | Ressources autorisées globales | Global selon droits | Global | MFA et audit pour actions sensibles |
| Directeur / RH | Rôles existants préservés | À valider sans étendre leurs droits | Selon permissions | Aucun droit ajouté |

Menus de rapports IT masqués par travaux précédents ; ce n’est pas une sécurité serveur. Tests d’isolation par UUID, filtre, export, URL signée, abonnement Realtime et retrait d’hôtel : NOT TESTED en environnement isolé. Ne pas exécuter avec les données réelles de production.
