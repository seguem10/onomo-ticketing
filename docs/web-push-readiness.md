# Push application fermée — état de préparation

Réception service worker : handlers préparés et tests unitaires ajoutés.
Non actif tant que l'inscription et l'envoi serveur ne sont pas implémentés.

Garanties de cette partie :
- Le message affiché est générique, sans texte de ticket, données RH, identité
  ou mot de passe ; tout détail reste derrière la connexion et le MFA.
- Le clic ne suit aucune URL reçue dans le payload.
- Un onglet existant est simplement focalisé ; sa page n'est pas remplacée.

À réaliser avant activation :
1. Clés VAPID : générées et enregistrées dans Supabase sous
   `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` et
   `WEB_PUSH_VAPID_SUBJECT`. Présence des noms vérifiée ; aucune valeur privée
   affichée ou conservée dans le dépôt. La clé publique reste à exposer au
   mécanisme d'abonnement. Ne jamais réutiliser une clé Auth Supabase.
2. Abonnement explicite de chaque appareil, après action de l'utilisateur et
   son accord à la demande de permission du navigateur.
3. Stockage sécurisé lié à l'utilisateur authentifié, révocation lors d'un
   changement de compte sur l'appareil et limitation du nombre d'appareils.
4. Envoi serveur avec revalidation rôle/hôtel, gestion des abonnements expirés,
   dédoublonnage et journal des tentatives.
5. Test réel appareil fermé et test d'un appareil partagé. Ne pas présenter
   ce mécanisme comme actif sur la base des seuls tests unitaires du worker.

Les mails et pop-ups existants restent des mécanismes distincts. Aucun
abonnement, aucune permission navigateur ni envoi push n'a été créé par ce
travail préparatoire.
