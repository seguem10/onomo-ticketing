# Recette Supabase locale — préparation

## Compose fonctionnel (remplace le lancement CLI ci-dessous)

La CLI publiait explicitement sur 0.0.0.0 : son démarrage a été arrêté et sa base stoppée. `scripts/start-local-auth-recipe.cjs` crée un fichier Compose local hors dépôt, réutilise uniquement le volume local, et démarre DB/Auth/REST sur 127.0.0.1:65432/65433/65434. Aucune clé de production et aucun compte réel. Secrets de recette en mémoire/environnement Docker, jamais imprimés ou commités. Compte fictif auto-confirmé pour ce test local uniquement.
Ports inspectés : tous trois sur 127.0.0.1 ; DB/Auth healthy ; Auth et REST health HTTP 200. `scripts/test-local-auth.cjs` : six assertions réelles PASS, dont MFA TOTP AAL2 et refresh refusé après logout. Storage/Realtime/Edge/UI et schéma métier complet restent NON PRÊTS/NON TESTÉS. Le réseau Compose autorise l’egress ; les scripts de test ciblent exclusivement localhost. Aucun fournisseur tiers configuré.

Les paragraphes suivants décrivent la tentative CLI initiale, non opérationnelle.

Répertoire distinct : `../onomo-security-local`, project_id `onomo-security-local`. Aucun `supabase link` et aucun secret de production.
Réseau Docker dédié `onomo-security-local-net`, interne et host_binding_ipv4=127.0.0.1. Le conteneur PostgreSQL synthétique précédent reste distinct et sans port.

Commande de démarrage : `supabase start --workdir ../onomo-security-local --network-id onomo-security-local-net --exclude studio,imgproxy,logflare,vector,supavisor,edge-runtime`.
Seuls DB/Auth/REST/Storage/Realtime et courrier local sont destinés aux premiers tests. Edge Functions et UI navigateur ne sont pas encore testés.

État : initialisation CLI réalisée, téléchargement/démarrage en cours ; ne pas déclarer les services PASS avant health check et inspection des ports. Ne pas imprimer les clés produites par supabase status/start.

Étapes restantes : reconstruire le schéma métier sans données réelles ; vérifier sa concordance avec les catalogues inspectés ; comptes `*.example.invalid` avec secrets éphémères non journalisés ; hôtels FAKE-A/FAKE-B ; tests accès, Auth MFA, URL signées et Realtime ; tableaux de résultats PASS/FAIL/NOT TESTED.

Ne pas connecter le site production à cette recette. Ne pas copier les utilisateurs/tickets/fichiers de production. Aucune notification réelle. Les ports doivent être inspectés et le lancement arrêté si une écoute hors localhost apparaît.
