# Qualification initiale CodeQL — 14 octobre 2026

Mise à jour après scan du commit 862b4a3 : workflow terminé success, vue branche inspectée : 10 Open / 6 Closed (16 identifiants cumulés, une alerte stockage recréée). Restent #1, #2, #3, #4, #9, #10, #11, #12, #13, #16. Pas de dismissal manuel.

Chemin #9 vérifié dans Show paths : prénom du formulaire utilisateur -> DEMO_USERS -> agentNames -> options des filtres avancés -> innerHTML. Échappement des attributs value et libellés hôtel/priorité/catégorie/agent ajouté, sélection conservée et testée avec quotes et fragment img malveillant. Nouveau scan requis avant de déclarer #4/#9 résolues.

Vue GitHub inspectée avec filtre `is:open branch:security/onomo-audit-20261014` : 15 alertes ouvertes, 12 High et 3 Medium. `main` n'a pas encore été analysée ; son compteur vide ne constitue pas un résultat sans alertes.

| Alertes | Signal | Qualification initiale / suite |
| --- | --- | --- |
| 1, 12, 13, 14 | Stockage sensible navigateur | À approfondir : dh_users persiste une liste complète ; runtime-sync distingue mode connecté et démonstration, et utilise un marqueur de session minimal en mode connecté. Vérifier les flux et supprimer les champs secrets des caches sans casser le mode démo. |
| 4–9 | Texte DOM réinterprété comme HTML | À approfondir : sites de rendu innerHTML, tracer chaque source et l'échappement. Ne pas remplacer globalement innerHTML par textContent, ce qui casserait l'interface. Aucune exploitation production tentée. |
| 10, 11 | Regexp HTML dans tests | Code de test : assertions d'absence de `<script>`, non filtre de sécurité de l'application. Faux positif probable après inspection ; conserver les tests. Aucune alerte masquée automatiquement. |
| 2, 3 | Données fichier envoyées sur réseau | Script de recette locale : reçoit deux tokens fictifs sur stdin puis utilise les services fixes realtime:4000/rest:3000 dans Docker. Comportement de test intentionnel, pas preuve d'exfiltration production. Ne jamais lui fournir de credentials production. |
| 15 | Origine postMessage non vérifiée | Handler SKIP_WAITING du service worker : examiner les contraintes de Client/source/origin et tester les mises à jour PWA avant ajout du contrôle. |

La réussite du workflow signifie que le scan et l'upload fonctionnent ; elle ne signifie pas zéro vulnérabilité. Les classifications initiales ne sont pas des dismissals GitHub. Les 15 alertes restent ouvertes jusqu'à correction vérifiée ou qualification documentée complète.

Correctifs partiels préparés : rôle inconnu échappé dans comptes/profil, initiales échappées dans comptes/profil ; identifiants de tickets déplacés vers des attributs data échappés dans tableau et Kanban au lieu d'interpolation dans JavaScript. Test Kanban avec identifiant contenant quotes et fragments HTML malveillants. Ne pas considérer les six alertes DOM résolues avant nouvelle analyse des chemins complets.

Handler de mise à jour PWA : vérification exacte event.origin === self.location.origin avant SKIP_WAITING. Test des origines absentes, null, tierces, suffixes trompeurs et du chemin positif même origine. Référence : https://developer.mozilla.org/en-US/docs/Web/API/ExtendableMessageEvent/origin . Test navigateur de mise à jour PWA encore NON TESTÉ ; aucun déploiement production.
