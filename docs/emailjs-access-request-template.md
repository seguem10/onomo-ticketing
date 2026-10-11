# Modèle EmailJS — demandes d’accès

État : modèle et contrat préparés. Aucun envoi automatique branché ; aucune
garantie de livraison avant test réel. Ne pas remplacer le modèle des tickets.

1. Dans EmailJS → Email Templates, créer un nouveau modèle nommé
   « ONOMO — Demande d’accès ».
2. To Email : `{{to_email}}`.
3. Subject : `{{subject}}`.
4. From Name : `ONOMO Desk`. Conserver l’adresse d’expédition par défaut du
   service Outlook connecté ; ne pas mettre une adresse utilisateur en From.
5. Utiliser le corps de message ci-dessous, avec les variables standards
   double accolades (pas de contenu HTML libre).
6. Enregistrer et copier uniquement le Template ID.
7. Supabase → Edge Functions → Secrets : ajouter
   `ACCESS_REQUEST_EMAILJS_TEMPLATE_ID` avec cet identifiant. Ne pas remplacer
   `EMAILJS_TEMPLATE_ID`, qui sert aux tickets.

```text
Bonjour {{to_name}},

Une demande d’accès a évolué sur ONOMO Desk.

Référence : {{request_number}}
Système : {{request_system}}
Hôtel : {{request_hotel}}
État : {{request_status}}

Connectez-vous pour consulter la demande et les actions autorisées :
{{app_url}}

Les accords ne créent aucun compte automatiquement.
Ne communiquez jamais de mot de passe ou de code MFA par email.

Cordialement,
ONOMO Desk
```

La future fonction d’envoi utilisera le service EmailJS déjà configuré, les
destinataires des alertes persistées et une protection serveur contre les
doublons. Elle doit recontrôler leur rôle/périmètre avant envoi. Ce contrat de
modèle n’est pas une autorisation d’envoyer à un destinataire arbitraire.
