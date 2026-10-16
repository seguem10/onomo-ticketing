# Recette interface sans accès production

Lancer depuis le dépôt : `node scripts/local-ui-recipe.cjs`, ouvrir http://127.0.0.1:8127 . Serveur limité à loopback ; uniquement GET/HEAD et assets explicites. Aucune clé de production, proxy ni fichier env servi. Sources du dépôt non modifiées : les réponses remplacent les URL Supabase et clés publishable par des valeurs locales inertes.

CSP connect-src 'none' bloque les API et WebSockets, worker-src 'none' empêche l'enregistrement du service worker de production. Images externes et soumission formulaires bloquées. Bibliothèques et polices publiques CDN autorisées pour rendu ; pas d'API métier externe. Les politiques Vercel ne sont pas reproduites par ce serveur.

Portée : smoke test de la page initiale et états d'erreur. Ce mode ne valide PAS connexion, MFA, tickets persistés, PWA, Realtime ou parcours métier complets. Ne pas saisir de données ou identifiants réels. La recette complète nécessite schéma métier local, routage des services et fixtures d'autorisation.

Contrôles automatiques : neutralisation des références, présence CSP, refus Git/env/config et méthodes mutantes. Test navigateur pas encore exécuté. Arrêter le processus serveur après usage.

Test navigateur exécuté le 14 octobre 2026 : page login locale chargée, changement FR -> EN -> arabe -> FR confirmé dans l'arbre d'accessibilité, sans saisie d'identifiants. Premier lancement sandbox inaccessible, relancement autorisé hors sandbox toujours sur 127.0.0.1 réussi. Serveur arrêté après test. Ceci confirme chargement et traductions de la page initiale seulement ; pas les workflows authentifiés, responsive/mobile ni PWA.

Complément mobile : viewport 390x844, page login FR visible et formulaire lisible. Mesure document clientWidth=390 / scrollWidth=390 en FR puis arabe : pas de débordement horizontal observé. Arabe lang=ar / dir=rtl confirmé. Aucun identifiant saisi, aucune installation PWA tentée. Viewport réinitialisé et serveur arrêté. Autres tailles, clavier virtuel et pages authentifiées NON TESTÉS.
