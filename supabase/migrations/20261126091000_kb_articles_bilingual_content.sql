-- Knowledge base content in French and English: English versions of the five
-- starter articles, and twenty new articles on the problems hotel staff meet
-- most often. New articles are saved as drafts, like the starter ones, so
-- the IT team reviews them before requesters see them.
begin;

update public.kb_articles set
  title_en = 'Wi-Fi does not work on my computer',
  body_en = E'1. Check that the computer''s Wi-Fi is on (icon at the bottom right).\n2. Forget the network, then connect again with the right password.\n3. Restart the computer.\n4. If several colleagues are affected, create a High priority ticket and say which area of the hotel.'
where title = 'Le Wi-Fi ne fonctionne pas sur mon poste' and title_en is null;
update public.kb_articles set
  title_en = 'The printer no longer prints',
  body_en = E'1. Check that the printer is on, shows no error, and has paper and toner.\n2. Switch it off for 30 seconds, then on again.\n3. On the computer, open the print queue and delete stuck documents.\n4. Still stuck: create a ticket with the printer name and the message shown.'
where title = 'L''imprimante n''imprime plus' and title_en is null;
update public.kb_articles set
  title_en = 'I forgot my password',
  body_en = E'For security reasons, only the IT team can reset a password.\nCreate a ticket (Access category) stating the application concerned. Never send your password by e-mail or over the phone.'
where title = 'J''ai oublié mon mot de passe' and title_en is null;
update public.kb_articles set
  title_en = 'My computer is very slow',
  body_en = E'1. Save your work and restart the computer (a full restart, not sleep).\n2. Close unused tabs and applications.\n3. Let Windows updates finish.\n4. If it is still slow, create a ticket saying since when and in which application.'
where title = 'Mon ordinateur est très lent' and title_en is null;
update public.kb_articles set
  title_en = 'I no longer receive my e-mails',
  body_en = E'1. Check your Internet connection by opening a website.\n2. Look in the Junk Email folder.\n3. Close and reopen Outlook, or try https://outlook.office.com.\n4. If the problem continues, create a ticket with the sender''s address and the time it was sent.'
where title = 'Je ne reçois plus mes e-mails' and title_en is null;

insert into public.kb_articles (title, title_en, category, published, created_by, updated_by, body, body_en)
select v.title, v.title_en, v.category, false, null, null, v.body, v.body_en
from (values
  ('Opera : impossible de se connecter', 'Opera: cannot sign in', 'Logiciels',
   E'1. Vérifiez que vous êtes connecté au réseau de l''hôtel (et au VPN si vous êtes à distance).\n2. Vérifiez la touche Verr. Maj et la langue du clavier.\n3. Fermez complètement Opera puis rouvrez-le.\n4. Si le message parle de compte verrouillé ou expiré, créez un ticket (catégorie Accès) : seul l''administrateur Opera peut le débloquer.\nNe partagez jamais votre identifiant Opera avec un collègue.',
   E'1. Check that you are connected to the hotel network (and to the VPN when working remotely).\n2. Check Caps Lock and the keyboard language.\n3. Close Opera completely, then open it again.\n4. If the message mentions a locked or expired account, create a ticket (Access category): only the Opera administrator can unlock it.\nNever share your Opera login with a colleague.'),
  ('Opera : une facture ou un rapport ne s''imprime pas', 'Opera: an invoice or report does not print', 'Logiciels',
   E'1. Vérifiez l''imprimante choisie dans la fenêtre d''impression d''Opera.\n2. Imprimez une page test depuis Windows pour savoir si le problème vient de l''imprimante.\n3. Essayez d''enregistrer le document en PDF puis de l''imprimer.\n4. Toujours bloqué : créez un ticket avec le nom du rapport, l''imprimante et l''heure.',
   E'1. Check the printer selected in Opera''s print window.\n2. Print a Windows test page to find out whether the printer is the problem.\n3. Try saving the document as a PDF, then print it.\n4. Still stuck: create a ticket with the report name, the printer and the time.'),
  ('Caisse Micros figée ou très lente', 'Micros POS frozen or very slow', 'Caisse',
   E'1. Ne retirez pas le câble d''alimentation pendant une transaction.\n2. Terminez ou annulez la commande en cours si l''écran répond encore.\n3. Vérifiez le câble réseau de la caisse (voyant allumé).\n4. Si une seule caisse est touchée, redémarrez-la par le menu (ou en maintenant le bouton marche 10 secondes en dernier recours).\n5. Si plusieurs caisses sont touchées, créez un ticket Urgent : le serveur Micros/Simphony est peut-être en cause.',
   E'1. Do not pull the power cable during a transaction.\n2. Finish or void the current order if the screen still responds.\n3. Check the till''s network cable (light on).\n4. If only one till is affected, restart it from the menu (or hold the power button for 10 seconds as a last resort).\n5. If several tills are affected, create an Urgent ticket: the Micros/Simphony server may be at fault.'),
  ('Imprimante de tickets (bar, cuisine) n''imprime pas', 'Receipt or kitchen printer does not print', 'Caisse',
   E'1. Vérifiez le rouleau de papier (sens d''insertion, face thermique vers la tête).\n2. Vérifiez que le capot est bien fermé et qu''aucun voyant rouge ne clignote.\n3. Éteignez l''imprimante 10 secondes puis rallumez-la.\n4. Pour une imprimante réseau (cuisine), vérifiez que le câble réseau est branché.\n5. Ne relancez pas une commande deux fois : prévenez d''abord le responsable de salle.',
   E'1. Check the paper roll (direction, thermal side facing the head).\n2. Check the cover is closed and no red light is blinking.\n3. Switch the printer off for 10 seconds, then on again.\n4. For a network printer (kitchen), check the network cable is plugged in.\n5. Do not send an order twice: tell the floor manager first.'),
  ('La carte de chambre d''un client ne fonctionne pas', 'A guest''s key card does not work', 'Serrures',
   E'1. Réencodez la carte sur l''encodeur de la réception (vérifiez le numéro de chambre et les dates).\n2. Tenez la carte loin des téléphones et des aimants.\n3. Si la nouvelle carte ne fonctionne pas non plus, la pile de la serrure est peut-être faible : prévenez la technique.\n4. Si l''encodeur ne répond pas, créez un ticket Urgent (catégorie IT / Réseau).',
   E'1. Re-encode the card on the reception encoder (check the room number and dates).\n2. Keep the card away from phones and magnets.\n3. If the new card does not work either, the lock battery may be low: tell the maintenance team.\n4. If the encoder does not respond, create an Urgent ticket (IT / Network category).'),
  ('Un client n''arrive pas à se connecter au Wi-Fi', 'A guest cannot connect to the Wi-Fi', 'Réseau',
   E'1. Vérifiez le nom du réseau clients et le code ou la page de connexion du jour.\n2. Demandez au client d''oublier le réseau puis de se reconnecter.\n3. Si la page de connexion ne s''affiche pas, ouvrir un site en http (ex. http://neverssl.com) la fait apparaître.\n4. Si plusieurs clients du même étage sont touchés, créez un ticket avec l''étage et l''heure.',
   E'1. Check the guest network name and today''s code or login page.\n2. Ask the guest to forget the network and connect again.\n3. If the login page does not appear, opening an http site (e.g. http://neverssl.com) brings it up.\n4. If several guests on the same floor are affected, create a ticket with the floor and the time.'),
  ('Outlook ne s''ouvre pas ou reste bloqué', 'Outlook does not open or hangs', 'Messagerie',
   E'1. Fermez Outlook, attendez 30 secondes puis rouvrez-le.\n2. Redémarrez l''ordinateur.\n3. Vérifiez que vos e-mails sont accessibles sur https://outlook.office.com.\n4. Si le web fonctionne mais pas l''application, créez un ticket : l''IT réparera le profil Outlook.\nNe supprimez aucun fichier Outlook vous-même.',
   E'1. Close Outlook, wait 30 seconds, then open it again.\n2. Restart the computer.\n3. Check that your e-mail works on https://outlook.office.com.\n4. If the web works but not the app, create a ticket: IT will repair the Outlook profile.\nDo not delete any Outlook file yourself.'),
  ('Ma boîte e-mail est pleine', 'My mailbox is full', 'Messagerie',
   E'1. Videz le dossier Éléments supprimés et le dossier Courrier indésirable.\n2. Supprimez ou archivez les e-mails anciens avec de grosses pièces jointes (triez par taille).\n3. Enregistrez les pièces jointes importantes dans OneDrive avant de supprimer l''e-mail.\n4. Si la boîte reste pleine, créez un ticket pour demander l''archivage.',
   E'1. Empty the Deleted Items and Junk Email folders.\n2. Delete or archive old e-mails with large attachments (sort by size).\n3. Save important attachments to OneDrive before deleting the e-mail.\n4. If the mailbox stays full, create a ticket to request archiving.'),
  ('Teams : pas de son, de micro ou de caméra', 'Teams: no sound, microphone or camera', 'Messagerie',
   E'1. Dans Teams, ouvrez Paramètres > Périphériques et choisissez le bon casque, micro et caméra.\n2. Vérifiez que le micro n''est pas coupé (bouton du casque ou de l''ordinateur).\n3. Débranchez et rebranchez le casque ou la webcam, puis relancez Teams.\n4. Testez avec « Passer un appel test » dans les paramètres.\n5. Toujours rien : créez un ticket avec le modèle du casque.',
   E'1. In Teams, open Settings > Devices and choose the right headset, microphone and camera.\n2. Check the microphone is not muted (headset or computer button).\n3. Unplug and plug in the headset or webcam again, then restart Teams.\n4. Use "Make a test call" in the settings.\n5. Still nothing: create a ticket with the headset model.'),
  ('Nouveau téléphone : réinstaller la double authentification (MFA)', 'New phone: set up two-step verification (MFA) again', 'Accès',
   E'1. Gardez l''ancien téléphone si possible : il sert à valider le changement.\n2. Installez Microsoft Authenticator sur le nouveau téléphone.\n3. Si vous n''avez plus l''ancien téléphone, créez un ticket (catégorie Accès) : l''IT réinitialisera votre MFA après vérification de votre identité.\nNe donnez jamais un code de validation reçu à quelqu''un qui vous appelle.',
   E'1. Keep the old phone if possible: it is used to approve the change.\n2. Install Microsoft Authenticator on the new phone.\n3. If you no longer have the old phone, create a ticket (Access category): IT will reset your MFA after checking your identity.\nNever give a verification code to someone who calls you.'),
  ('E-mail suspect ou tentative d''hameçonnage', 'Suspicious e-mail or phishing attempt', 'Sécurité',
   E'Signes d''alerte : expéditeur inconnu ou adresse bizarre, urgence, demande de mot de passe, de paiement ou de changement de RIB, lien ou pièce jointe inattendus.\n1. Ne cliquez sur aucun lien et n''ouvrez pas la pièce jointe.\n2. Ne répondez pas.\n3. Signalez l''e-mail avec le bouton « Signaler » d''Outlook, ou transférez-le à l''IT.\n4. Si vous avez cliqué ou saisi un mot de passe, créez immédiatement un ticket Urgent.',
   E'Warning signs: unknown sender or odd address, urgency, a request for a password, a payment or new bank details, an unexpected link or attachment.\n1. Do not click any link or open the attachment.\n2. Do not reply.\n3. Report the e-mail with Outlook''s "Report" button, or forward it to IT.\n4. If you clicked or typed a password, create an Urgent ticket immediately.'),
  ('Verrouiller son poste en quittant le bureau', 'Lock your computer when you leave your desk', 'Sécurité',
   E'Appuyez sur Windows + L chaque fois que vous quittez votre poste, même quelques minutes.\nÀ la réception, ne laissez jamais une session Opera ouverte sans surveillance : les données des clients sont confidentielles.',
   E'Press Windows + L every time you leave your desk, even for a few minutes.\nAt reception, never leave an Opera session open and unattended: guest data is confidential.'),
  ('OneDrive ne synchronise plus mes fichiers', 'OneDrive no longer syncs my files', 'Logiciels',
   E'1. Cliquez sur l''icône du nuage OneDrive en bas à droite et lisez le message.\n2. Vérifiez votre connexion Internet.\n3. Mettez la synchronisation en pause puis reprenez-la.\n4. Vérifiez que le nom du fichier ne contient pas de caractères interdits (" * : < > ? / \\ |).\n5. Toujours bloqué : créez un ticket avec une capture du message.',
   E'1. Click the OneDrive cloud icon at the bottom right and read the message.\n2. Check your Internet connection.\n3. Pause syncing, then resume it.\n4. Check that the file name has no forbidden characters (" * : < > ? / \\ |).\n5. Still stuck: create a ticket with a screenshot of the message.'),
  ('Scanner un document vers mon e-mail', 'Scan a document to my e-mail', 'Matériel',
   E'1. Posez le document sur la vitre ou dans le chargeur du copieur.\n2. Choisissez « Numériser » puis « E-mail » et sélectionnez votre adresse dans le carnet.\n3. Lancez la numérisation et vérifiez votre boîte de réception (et le dossier Courrier indésirable).\n4. Si votre adresse n''est pas dans le carnet, créez un ticket pour la faire ajouter.',
   E'1. Place the document on the glass or in the copier''s feeder.\n2. Choose "Scan" then "E-mail" and pick your address in the address book.\n3. Start scanning and check your inbox (and the Junk Email folder).\n4. If your address is not in the address book, create a ticket to have it added.'),
  ('L''écran reste noir', 'The screen stays black', 'Matériel',
   E'1. Vérifiez que l''écran est allumé (voyant) et que les câbles d''alimentation et vidéo sont bien branchés des deux côtés.\n2. Bougez la souris ou appuyez sur une touche : l''ordinateur est peut-être en veille.\n3. Éteignez l''écran 10 secondes puis rallumez-le.\n4. Si l''ordinateur ne démarre pas du tout, créez un ticket avec le nom du poste.',
   E'1. Check the screen is on (light) and that the power and video cables are firmly plugged in at both ends.\n2. Move the mouse or press a key: the computer may be asleep.\n3. Switch the screen off for 10 seconds, then on again.\n4. If the computer does not start at all, create a ticket with the computer name.'),
  ('Téléphone fixe sans tonalité', 'Desk phone with no dial tone', 'Téléphonie',
   E'1. Vérifiez que le combiné est bien raccroché puis décroché, et que le cordon est branché.\n2. Vérifiez le câble réseau ou téléphonique à l''arrière du poste.\n3. Débranchez l''alimentation (ou le câble réseau pour un poste IP) 10 secondes puis rebranchez.\n4. Si toute la réception ou un étage est touché, créez un ticket Urgent.',
   E'1. Check the handset is properly hung up then lifted, and that the cord is plugged in.\n2. Check the network or phone cable at the back of the phone.\n3. Unplug the power (or the network cable for an IP phone) for 10 seconds, then plug it back in.\n4. If the whole reception or a floor is affected, create an Urgent ticket.'),
  ('La TV d''une chambre n''a plus de chaînes', 'A room TV has no channels', 'Matériel',
   E'1. Vérifiez que la TV est sur la bonne source (TV / HDMI) avec la télécommande.\n2. Éteignez la TV à l''interrupteur ou débranchez-la 30 secondes.\n3. Vérifiez le câble antenne ou réseau derrière la TV.\n4. Si plusieurs chambres sont touchées, créez un ticket avec les numéros de chambre.',
   E'1. Check the TV is on the right source (TV / HDMI) with the remote.\n2. Switch the TV off at the switch or unplug it for 30 seconds.\n3. Check the aerial or network cable behind the TV.\n4. If several rooms are affected, create a ticket with the room numbers.'),
  ('Clé USB trouvée ou inconnue', 'Found or unknown USB stick', 'Sécurité',
   E'Ne branchez jamais une clé USB trouvée ou d''origine inconnue sur un ordinateur de l''hôtel : elle peut contenir un virus.\nRemettez-la à l''IT. Pour échanger des fichiers, utilisez OneDrive ou l''e-mail.',
   E'Never plug a found or unknown USB stick into a hotel computer: it may carry a virus.\nHand it to IT. To share files, use OneDrive or e-mail.'),
  ('Windows redémarre pour des mises à jour', 'Windows restarts for updates', 'Logiciels',
   E'Les mises à jour protègent l''ordinateur : ne les annulez pas.\n1. Enregistrez votre travail dès qu''un redémarrage est demandé.\n2. Laissez l''ordinateur allumé et branché pendant l''installation, même si elle semble longue.\n3. Si l''ordinateur reste bloqué plus d''une heure sur le même pourcentage, créez un ticket.',
   E'Updates protect the computer: do not cancel them.\n1. Save your work as soon as a restart is requested.\n2. Leave the computer on and plugged in during the installation, even if it seems long.\n3. If the computer stays stuck on the same percentage for over an hour, create a ticket.'),
  ('Accès à distance : le VPN ne se connecte pas', 'Remote access: the VPN does not connect', 'Réseau',
   E'1. Vérifiez d''abord que votre connexion Internet fonctionne sans VPN.\n2. Fermez le client VPN puis relancez la connexion.\n3. Validez la demande de double authentification sur votre téléphone si elle apparaît.\n4. Si le message persiste, créez un ticket avec une capture du message et l''heure.\nNe modifiez pas vous-même les paramètres du VPN.',
   E'1. First check that your Internet connection works without the VPN.\n2. Close the VPN client, then connect again.\n3. Approve the two-step verification request on your phone if it appears.\n4. If the message persists, create a ticket with a screenshot of the message and the time.\nDo not change the VPN settings yourself.')
) as v(title, title_en, category, body, body_en)
where not exists (select 1 from public.kb_articles k where k.title = v.title);

commit;
