# ONOMO Support IT — Contexte projet

## Projet
- Nom : ONOMO Support IT
- Type : PWA de ticketing / Service Desk IT
- Repository : seguem10/onomo-ticketing
- Branche principale : main
- Déploiement : Vercel
- URL : https://onomo-ticketing.vercel.app/

## Stack
- HTML / CSS / JavaScript vanilla
- Supabase Auth
- Supabase PostgreSQL
- Supabase Edge Functions
- Supabase Realtime
- EmailJS
- PWA / Service Worker
- Vercel

## Structure importante
- index.html : application principale et logique historique
- assets/js/i18n.js : charge plusieurs modules complémentaires
- assets/js/runtime-sync.js : synchronisation Supabase / session
- assets/js/modern-features.js : fonctionnalités utilisateurs
- assets/js/user-ticket-fix.js : logique ticket / profil
- assets/js/user-save-fix.js : sauvegarde utilisateurs
- assets/js/requester-it-list-fix.js : liste des IT pour Demandeur
- assets/js/profile-navigation-fix.js : navigation Mon profil
- assets/js/password-change-fix.js : changement de mot de passe
- assets/js/admin-activity.js : audit et branding
- assets/js/ticket-voice-notifications.js : voix et notifications
- assets/pwa/onomo-logo.svg : logo

## Rôles
- admin / Administrateur
- it_regional / IT Régional
- it_hotel / IT Hôtel
- demandeur / Demandeur

Toujours normaliser les rôles avant comparaison.

## Hôtels
- Airport
- CASA CITY CENTER
- Sidi Maarouf

Règles :
- IT Hôtel : un hôtel principal
- IT Régional : plusieurs hôtels possibles
- Demandeur : un hôtel principal
- Admin : pas de restriction hôtel

Pour un Demandeur, conserver hotels comme tableau JSONB, par exemple ["Airport"].

## Supabase
Project ref : aljnwqrjplqvehctsdqj

Table utilisateurs :
- id
- email
- pwd
- prenom
- nom
- role
- hotel
- hotels jsonb
- must_change_password
- mfa_enabled
- mfa_secret
- last_login
- created_at
- language
- roles jsonb
- auth_user_id

Table tickets :
- id
- numero
- titre
- description
- hotel
- categorie
- priorite
- statut
- role_source
- assigne_a
- created_at
- escalated
- escalatedAt
- created_by_id
- created_by_email
- created_by_name
- created_by
- assigned_to
- updated_by

Table activity_log :
- id
- actor_id
- actor_name
- actor_email
- action
- entity_type
- entity_id
- details
- created_at

## Authentification
Supabase Auth est la source principale de la session.

Relation attendue :
utilisateurs.auth_user_id = auth.users.id

currentUser est une variable interne du script principal. Elle n'est pas forcément disponible comme window.currentUser.

Les événements INITIAL_SESSION et SIGNED_IN peuvent initialiser/restaurer le profil.

Éviter de relancer initSession() sur USER_UPDATED ou TOKEN_REFRESHED car cela peut reconstruire l'application et renvoyer l'utilisateur au Dashboard.

## Problème important : changement de mot de passe
Le changement de mot de passe a provoqué un retour vers l'accueil / Dashboard pour tous les rôles, y compris Admin.

Des corrections ont déjà été tentées dans :
- assets/js/password-change-fix.js
- assets/js/runtime-sync.js

Le problème doit être traité comme un problème de navigation/session, pas simplement comme un problème de délai de rafraîchissement.

Avant toute nouvelle modification :
1. identifier le handler qui provoque switchView('dashboard'), initSession(), location.reload() ou une réinitialisation
2. vérifier les listeners onAuthStateChange
3. vérifier les wrappers de switchView
4. vérifier les wrappers de submitUser
5. vérifier le Service Worker et le cache PWA
6. vérifier que le nouveau JS est réellement chargé avec son cache-buster

Ne pas multiplier les wrappers sans vérifier la chaîne d'appel.

## Comportement attendu du changement de mot de passe
1. vérifier l'ancien mot de passe
2. modifier Supabase Auth
3. synchroniser éventuellement utilisateurs.pwd
4. rester sur Mon profil
5. afficher un succès
6. ne pas déconnecter
7. ne pas revenir au Dashboard
8. ne pas recharger toute la PWA

Ce comportement doit être identique pour tous les rôles.

## Profil
Mon profil doit fonctionner pour :
- Administrateur
- IT Régional
- IT Hôtel
- Demandeur

Il doit afficher les informations du compte et permettre le changement de mot de passe.

Le code historique renderMyProfile() existe dans index.html. Si cette fonction provoque une erreur, diagnostiquer l'erreur réelle avant d'ajouter un autre wrapper.

## Utilisateurs
La gestion des utilisateurs est intégrée à l'option Utilisateurs.

- Demandeur : hôtel obligatoire
- IT Hôtel : hôtel obligatoire
- IT Régional : plusieurs hôtels possibles
- Admin : pas de restriction hôtel

Pour les modifications, préférer une sauvegarde directe vers public.utilisateurs via window.sbFetch() si les anciens wrappers posent problème.

Toujours envoyer roles: [role] et hotels comme tableau JSONB.

## Tickets
Pour un Demandeur :
- hôtel = hôtel du Demandeur
- IT Hôtel correspondant à l'hôtel si disponible
- sinon IT Régional couvrant l'hôtel

Le fallback d'assignation côté base existe et renseigne assigned_to et assigne_a.

## Voice ticket
Les Demandeurs peuvent créer un ticket par voix.

Langues :
- Français
- Anglais
- Darija marocaine
- Darija arabe ou alphabet latin

Edge Function : ai-ticket-analysis

Fonction :
1. transcription
2. analyse IA
3. titre
4. description
5. catégorie
6. priorité
7. hôtel
8. résumé
9. remplissage du formulaire
10. création du ticket

Catégories :
- IT / Réseau
- Chambres
- Restauration
- Guest relations
- Sécurité
- Autre

Priorités :
- Haute
- Normale
- Basse
- Urgente
- Critique

## EmailJS
Service : service_n993o6q
Template : template_soeedb

Création ticket :
- notifier l'IT assigné

Changement de statut ou assignation :
- notifier le Demandeur
- notifier les Administrateurs
- notifier les IT Régionaux

Le template doit utiliser {{to_email}} si ce paramètre est prévu.

## Audit
activity_log doit couvrir les actions importantes :
- création/modification/suppression utilisateur
- changement rôle/hôtel
- création ticket
- modification ticket
- assignation
- changement statut
- changement mot de passe si pertinent

Accès au journal : Administrateurs uniquement.

## RLS
Une ancienne erreur venait de utilisateurs.hotels enregistré comme string JSON au lieu d'un tableau JSONB.

Correct :
["Airport","CASA CITY CENTER"]

Incorrect :
"[\"Airport\",\"CASA CITY CENTER\"]"

Toujours vérifier le type JSONB avant de modifier la logique RLS.

## Edge Functions connues
- admin-create-user
- ai-ticket-analysis

Il n'existe pas actuellement de fonction Edge dédiée pour récupérer la liste des IT pour les Demandeurs.

## Branding
Nom : ONOMO Support IT
Titre : ONOMO Support IT — Service Desk
Logo : assets/pwa/onomo-logo.svg

## Règles de développement
Avant de modifier :
1. lire le code existant
2. identifier la vraie fonction responsable
3. éviter les wrappers multiples
4. préférer une correction ciblée
5. utiliser un cache-buster pour les nouveaux JS
6. vérifier que le fichier est chargé
7. vérifier le Service Worker
8. vérifier Supabase Auth et RLS après une modification utilisateur

Ne pas supposer qu'un commit signifie que le navigateur utilise déjà le nouveau code.

Après une correction :
- vérifier le commit
- vérifier le fichier sur main
- vérifier le chargement du script
- vérifier les anciens scripts encore chargés
- vérifier le comportement après cache PWA

## État actuel
Le principal problème connu est le changement de mot de passe.

Symptôme :
l'utilisateur clique sur changer le mot de passe puis la page se rafraîchit ou revient rapidement vers l'accueil / Dashboard.

Le problème touche tous les rôles, y compris Admin.

Conclusion de diagnostic à privilégier :
ne pas augmenter simplement un délai. Identifier le mécanisme exact qui force la navigation ou réinitialise l'application après la mise à jour Auth.

Ce document est le contexte de référence pour continuer le développement et le dépannage du projet ONOMO Support IT.
