# Vérification navigateur — 11 octobre 2026

Application : https://onomo-ticketing.vercel.app/

Session administrateur existante, ticket de test TK-B96C7ED3. Aucun nouveau message envoyé, aucune modification de ticket ou de droits. Le brouillon d’aperçu a été vidé après le test.

## Vérifié en production

- Dernière version chargée après actualisation.
- Profil compact et menu profil / paramètres / déconnexion visibles sur ordinateur.
- Onglets Détails et Conversation utilisables, choix d’onglet conservé lors de la réouverture du ticket.
- Informations et participants affichés en panneau latéral sur ordinateur.
- Liste de candidats participants visible ; aucune invitation exécutée.
- Filtre En attente IT : un résultat correspondant au compteur.
- Filtre En attente demandeur : zéro résultat et état vide approprié.
- Aperçu : gras, liste numérotée et lien HTTPS rendus sans envoi.
- Responsive : largeur ordinateur 1440 px et mobile 390 px. À 390 px, largeur document = largeur viewport, aucun débordement horizontal global. Vue mobile conserve l’éditeur et les informations sous la conversation.
- Taille temporaire du navigateur restaurée après le test.

## Limites et suites

- Une seule session disponible : accusés de lecture croisés, isolation entre hôtels et compteurs entre deux comptes non validés de bout en bout.
- Ajout/retrait participant, signature persistante et téléversement non exécutés pendant cette vérification.
- Photos de profil réelles non implémentées : avatar avec initiales.
- Avertissement console : Realtime indisponible, interrogation périodique de secours active. Les mises à jour ne sont donc pas garanties instantanées dans cette session.
- Le responsive navigateur ne remplace pas le test d’une PWA installée sur téléphone.
