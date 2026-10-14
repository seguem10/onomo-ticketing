# Recette interface sans accès production

Lancer depuis le dépôt : `node scripts/local-ui-recipe.cjs`, ouvrir http://127.0.0.1:8127 . Serveur limité à loopback ; uniquement GET/HEAD et assets explicites. Aucune clé de production, proxy ni fichier env servi. Sources du dépôt non modifiées : les réponses remplacent les URL Supabase et clés publishable par des valeurs locales inertes.

CSP connect-src 'none' bloque les API et WebSockets, worker-src 'none' empêche l'enregistrement du service worker de production. Images externes et soumission formulaires bloquées. Bibliothèques et polices publiques CDN autorisées pour rendu ; pas d'API métier externe. Les politiques Vercel ne sont pas reproduites par ce serveur.

Portée : smoke test de la page initiale et états d'erreur. Ce mode ne valide PAS connexion, MFA, tickets persistés, PWA, Realtime ou parcours métier complets. Ne pas saisir de données ou identifiants réels. La recette complète nécessite schéma métier local, routage des services et fixtures d'autorisation.

Contrôles automatiques : neutralisation des références, présence CSP, refus Git/env/config et méthodes mutantes. Test navigateur pas encore exécuté. Arrêter le processus serveur après usage.
