# Sauvegarde manuelle — vérification du 15 octobre 2026

Deux exports PostgreSQL custom chiffrés AES-256-GCM conservés hors dépôt Git. Clés enveloppées par Windows DPAPI CurrentUser, pas de mot de passe DB enregistré. TLS verify-full avec certificat public officiel Supabase. Aucun contenu de données ni secret publié.

Dernière archive : empreinte SHA-256 conforme, déchiffrement GCM authentifié, inventaire pg_restore lisible (1 094 entrées).

Restauration transactionnelle PASS dans un nouveau conteneur PostgreSQL Supabase 17.6 sans réseau ni ports exposés, données sur tmpfs. Opérateur intégré supabase_admin ; pg_cron/pg_stat_statements/pg_net préchargés, exécution cron désactivée. Propriétaires et ACL de l'archive restaurés. Trois rôles absents créés sans LOGIN ni mot de passe ; 22 appartenances exportées avec options ADMIN/INHERIT/SET présentes et vérifiées. Les appartenances supplémentaires et attributs des rôles préexistants de l'image ne sont pas démontrés identiques au cloud. Conteneur jetable supprimé à la fin, copie tmpfs écartée.

## Copie portable et complément Storage — 16 octobre 2026

Copie chiffrée hors machine sur le disque externe choisi par l'utilisateur. Clé de récupération enveloppée par scrypt et AES-256-GCM avec une phrase saisie localement, sans publication ni stockage de cette phrase. Empreinte de la copie DB et déchiffrement authentifié vérifiés. Le format portable ne dépend pas de DPAPI ; récupération sur un second ordinateur non testée.

Complément Storage séparé chiffré : 3 objets, 368 579 octets. Relecture du fichier chiffré depuis le disque externe, authentification GCM et empreintes de chaque objet vérifiées. Les copies téléchargées non chiffrées restent dans Téléchargements ; aucune suppression effectuée. Aucun objet cloud modifié. Le manifeste DB initial ne décrit pas ce complément ; son rapport storage-verification.json est distinct.

## Limites encore ouvertes

- Réimport des objets Storage dans un service isolé non testé ; vérification cryptographique du complément seulement.
- Instantanés DB et Storage collectés séparément : cohérence atomique non garantie.
- Récupération indépendante avec saisie de la phrase sur un second ordinateur non testée.
- Pas de reprise complète Auth/Edge Functions/configuration dashboard ni des clés racines de chiffrement/Vault.
- Restauration SQL réussie, mais comparaison exhaustive des lignes, privilèges effectifs, RLS et fonctionnement applicatif après reprise non effectuée.
- Inventaires des rôles collectés séparément de l'instantané DB ; cohérence atomique globale non garantie.
- Aucun RPO/RTO ou mécanisme de sauvegarde récurrent validé.

Ce contrôle ne suffit pas à déclarer la reprise complète du système ni à lever tous les prérequis de publication. Production inchangée.
