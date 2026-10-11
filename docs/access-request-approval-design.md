# Demandes d'accès — circuit confirmé

État : spécification préparée, fonctionnalité non déployée.

## Décision utilisateur

Pour OPERA et Microsoft 365, trois validations sont obligatoires :

1. IT Hôtel OU IT Régional couvrant l'hôtel ;
2. DG : Directeur de l'hôtel ;
3. RH Régional couvrant l'hôtel.

Les validations sont séquentielles. Un refus termine la demande ; une nouvelle
soumission distincte est nécessaire. Les décisions précédentes ne sont jamais
réutilisées pour cette nouvelle demande.

L'accord d'un des deux IT satisfait uniquement la validation IT.
Un administrateur n'approuve pas automatiquement à la place de RH ou DG.
Le demandeur ne peut jamais valider sa propre demande.

## Sécurité et intégration requises

- Distinguer les demandes d'accès des tickets incidents existants.
- Calculer les autorisations et l'état final exclusivement sur le serveur.
- Enregistrer les décisions dans un historique append-only, horodaté serveur.
- Lier chaque décision à la demande, au groupe de validation et à auth.uid().
- Verrouiller la demande pendant une décision pour éviter les doubles accords concurrents.
- Une approbation IT ne crée aucun accès automatiquement dans OPERA ou Microsoft 365.
- Ne permettre l'exécution IT qu'après les trois accords requis.
- Ne jamais stocker de mot de passe dans une demande ou une notification.
- Restreindre lecture et approbation aux acteurs autorisés pour cette demande.
- Empêcher la modification des détails après une première décision ; une demande modifiée doit être soumise à nouveau.
- Conserver l'authentification MFA, les restrictions hôtel et la confidentialité des notes internes.
- Tester refus hors périmètre, auto-approbation, concurrence et accès direct API.

## Comptes et périmètres confirmés

- L'administrateur crée lui-même de nouveaux comptes dans la plateforme.
- Directeur Hôtel : un hôtel explicitement assigné.
- RH Régional : plusieurs hôtels explicitement sélectionnés.
- Aucun rôle d'approbation n'est attribué automatiquement aux comptes actuels.

## État de réalisation

- Formulaire de création des nouveaux rôles : déployé.
- Règles de transition : module préparé et testé, non connecté à la production.
- Tables, contrôles RLS et API de décision : migration appliquée ; vérification
  des accès anonymes, de l'absence de session et des écritures directes effectuée.
- Interface demandes : formulaire OPERA/Microsoft 365, liste paginée,
  détails, justification obligatoire et historique ajoutés. Avertissement de
  vérification en cours conservé jusqu'aux tests réels.
- Test complet SQL : non exécuté, car le contrôle de sécurité a refusé une
  attribution temporaire de rôles à un compte réel en production, même sous
  rollback. Préférer des comptes de test dédiés autorisés ou un environnement
  isolé. Le chemin positif et la concurrence restent à vérifier réellement.
- Alertes persistantes : déclencheur serveur par étape, boîte de réception
  propre au compte et pop-ups (vérification toutes les 30 secondes lorsque la
  page est visible). Notification navigateur seulement si déjà autorisée ;
  ce mécanisme n'est pas un push hors ligne.
- Fonction EmailJS `access-request-email` : déployée. Journal privé des
  tentatives, réservation atomique serveur, revérification du rôle/périmètre
  et limitation globale du débit. Une tentative incertaine n'est pas relancée
  automatiquement. Le navigateur déclenche l'envoi après persistance ; ce
  n'est pas encore un worker durable avec reprise si le navigateur ferme.
- Configuration : le secret `ACCESS_REQUEST_EMAILJS_TEMPLATE_ID` est absent
  du projet lors de la vérification ; l'envoi reste désactivé sans lui.
- Tests réels multi-comptes et réception des mails : reportés par l'utilisateur.

Aucune attribution de privilèges ni modification de tickets n'a été effectuée pour cette spécification.
