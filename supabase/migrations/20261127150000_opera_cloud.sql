-- The hotels use Opera Cloud (Oracle, in the web browser), not the former
-- OPERA PMS. Names, knowledge base articles, maintenance plans and access
-- requests follow.

-- Access requests: the system is now "Opera Cloud".
alter table public.access_requests drop constraint if exists access_requests_system_name_check;
update public.access_requests set system_name = 'Opera Cloud' where system_name = 'OPERA';
alter table public.access_requests add constraint access_requests_system_name_check
  check (system_name in ('Opera Cloud', 'Microsoft 365'));

-- Knowledge base category.
update public.kb_articles set category = 'Opera Cloud' where category = 'OPERA PMS';

-- Opera articles, rewritten for Opera Cloud (web browser, hosted by Oracle).
update public.kb_articles k
set title = v.title, title_en = v.title_en, body = v.body, body_en = v.body_en, updated_at = now()
from (values
  ('Opera : impossible de se connecter',
   'Opera Cloud : impossible de se connecter', 'Opera Cloud: cannot sign in',
   E'1. Opera Cloud s''ouvre dans le navigateur (Chrome ou Edge) : vérifiez d''abord qu''Internet fonctionne en ouvrant un autre site.\n2. Utilisez le lien Opera Cloud enregistré dans vos favoris, pas un lien reçu par e-mail.\n3. Vérifiez la touche Verr. Maj et la langue du clavier.\n4. Essayez dans une fenêtre de navigation privée : si cela marche, videz le cache du navigateur.\n5. Si le message parle de compte verrouillé, expiré ou de mot de passe à changer, créez un ticket (catégorie Accès) : seul l''administrateur Opera Cloud peut le débloquer.\nNe partagez jamais votre identifiant Opera Cloud avec un collègue.',
   E'1. Opera Cloud opens in the browser (Chrome or Edge): first check that the Internet works by opening another website.\n2. Use the Opera Cloud link saved in your favourites, not a link received by e-mail.\n3. Check Caps Lock and the keyboard language.\n4. Try in a private browsing window: if it works, clear the browser cache.\n5. If the message mentions a locked or expired account, or a password to change, create a ticket (Access category): only the Opera Cloud administrator can unlock it.\nNever share your Opera Cloud login with a colleague.'),
  ('Opera est lent ou figé',
   'Opera Cloud est lent ou figé', 'Opera Cloud is slow or frozen',
   E'1. Attendez une minute : une recherche ou un rapport lourd peut prendre du temps.\n2. Vérifiez si vos collègues ont le même problème : si oui, ne relancez rien et créez un ticket Urgent (Internet de l''hôtel ou service Oracle).\n3. Si vous êtes seul touché, fermez les onglets inutiles et actualisez la page Opera Cloud (F5) après avoir enregistré.\n4. Toujours lent : videz le cache du navigateur, ou fermez complètement le navigateur et rouvrez Opera Cloud.\nN''actualisez jamais la page pendant un encaissement ou un check-out.',
   E'1. Wait one minute: a heavy search or report can take time.\n2. Check whether colleagues have the same problem: if so, do not restart anything and create an Urgent ticket (hotel Internet or Oracle service).\n3. If only you are affected, close unused tabs and refresh the Opera Cloud page (F5) after saving.\n4. Still slow: clear the browser cache, or fully close the browser and open Opera Cloud again.\nNever refresh the page during a payment or a check-out.'),
  ('Opera : la clôture de nuit (Night Audit) est bloquée',
   'Opera Cloud : la clôture de fin de journée (End of Day / Night Audit) est bloquée', 'Opera Cloud: the End of Day (Night Audit) is stuck',
   E'1. Ne relancez pas la clôture et ne fermez pas l''onglet Opera Cloud qui la fait tourner.\n2. Notez l''étape affichée et le message d''erreur exact, avec l''heure.\n3. Vérifiez que les arrivées et départs du jour sont traités et qu''aucune note client n''est ouverte, si la procédure de l''hôtel le demande.\n4. Créez un ticket Urgent (catégorie IT / Réseau) : seul l''administrateur Opera Cloud ou le support Oracle reprend une clôture interrompue.',
   E'1. Do not restart the End of Day and do not close the Opera Cloud tab running it.\n2. Write down the step shown and the exact error message, with the time.\n3. Check that today''s arrivals and departures are processed and that no guest folio is open, if the hotel''s procedure requires it.\n4. Create an Urgent ticket (IT / Network category): only the Opera Cloud administrator or Oracle support resumes an interrupted End of Day.'),
  ('Opera : la carte de chambre ne s''encode pas depuis Opera',
   'Opera Cloud : la carte de chambre ne s''encode pas', 'Opera Cloud: the key card does not encode',
   E'1. Vérifiez que la carte est bien posée sur l''encodeur et que l''encodeur est allumé et branché.\n2. Vérifiez que vous êtes sur le poste de réception habituel : l''encodeur est lié à ce poste dans Opera Cloud.\n3. Réessayez une fois depuis la réservation dans Opera Cloud.\n4. Si cela ne marche toujours pas, encodez la carte directement sur le logiciel des serrures (procédure de secours de la réception).\n5. Créez un ticket : l''interface entre Opera Cloud et les serrures est peut-être arrêtée. Indiquez le numéro de chambre et l''heure.',
   E'1. Check that the card sits on the encoder and that the encoder is on and plugged in.\n2. Check that you are on the usual front desk computer: the encoder is linked to that workstation in Opera Cloud.\n3. Try once more from the reservation in Opera Cloud.\n4. If it still fails, encode the card directly in the lock software (reception fallback procedure).\n5. Create a ticket: the interface between Opera Cloud and the locks may be down. Give the room number and the time.'),
  ('Opera : envoyer une facture par e-mail au client',
   'Opera Cloud : envoyer une facture par e-mail au client', 'Opera Cloud: e-mail an invoice to the guest',
   E'1. Vérifiez l''adresse e-mail du client dans son profil.\n2. Depuis la facturation (Billing) ou l''historique des notes (Folio History), choisissez l''envoi par e-mail ; sinon, ouvrez la facture en PDF, enregistrez-la et envoyez-la depuis la boîte e-mail de la réception.\n3. Le client ne la reçoit pas : demandez-lui de regarder ses courriers indésirables.\n4. Si l''envoi échoue avec un message d''erreur, créez un ticket avec le message exact.',
   E'1. Check the guest''s e-mail address in the profile.\n2. From Billing or Folio History, choose e-mail sending; otherwise open the invoice as PDF, save it and send it from the reception mailbox.\n3. The guest does not receive it: ask them to check their junk mail.\n4. If sending fails with an error message, create a ticket with the exact message.'),
  ('Opera : une facture ou un rapport ne s''imprime pas',
   'Opera Cloud : une facture ou un rapport ne s''imprime pas', 'Opera Cloud: an invoice or report does not print',
   E'1. Opera Cloud ouvre les documents en PDF dans le navigateur : autorisez les fenêtres pop-up pour le site Opera Cloud si rien ne s''ouvre.\n2. Dans l''aperçu PDF, vérifiez l''imprimante choisie avant d''imprimer.\n3. Imprimez une page test depuis Windows pour savoir si le problème vient de l''imprimante.\n4. Toujours bloqué : enregistrez le PDF et créez un ticket avec le nom du rapport, l''imprimante et l''heure.',
   E'1. Opera Cloud opens documents as PDF in the browser: allow pop-up windows for the Opera Cloud site if nothing opens.\n2. In the PDF preview, check the selected printer before printing.\n3. Print a Windows test page to find out whether the printer is the problem.\n4. Still stuck: save the PDF and create a ticket with the report name, the printer and the time.'),
  ('Opera : demander un accès ou un nouveau rôle',
   'Opera Cloud : demander un accès ou un nouveau rôle', 'Opera Cloud: request access or a new role',
   E'1. Faites une demande d''accès (système Opera Cloud) ou créez un ticket (catégorie Accès) en indiquant : nom, hôtel, service, rôle demandé (réception, réservations, comptabilité…) et date de début.\n2. Ajoutez l''accord de votre responsable.\n3. L''administrateur Opera Cloud crée le compte avec le minimum de droits utiles et vous transmet l''accès par un canal sûr.\nNe partagez jamais un compte Opera Cloud entre collègues : chaque action est tracée à votre nom.',
   E'1. Make an access request (Opera Cloud system) or create a ticket (Access category) with: name, hotel, department, requested role (front desk, reservations, accounting…) and start date.\n2. Add your manager''s approval.\n3. The Opera Cloud administrator creates the account with the minimum rights needed and sends the access through a safe channel.\nNever share an Opera Cloud account between colleagues: every action is logged in your name.')
) as v(old_title, title, title_en, body, body_en)
where k.title = v.old_title;

-- Other articles that name Opera.
update public.kb_articles
set body = replace(body, '(Sage, Opera…)', '(Sage 1000…)'),
    body_en = replace(body_en, '(Sage, Opera…)', '(Sage 1000…)'), updated_at = now()
where title = 'Citrix ne s''ouvre pas ou l''application n''apparaît pas';
update public.kb_articles
set body = replace(body, 'si Opera, les caisses', 'si Opera Cloud, les caisses'),
    body_en = replace(body_en, 'whether Opera, tills', 'whether Opera Cloud, tills'), updated_at = now()
where title = 'Internet est lent ou coupé dans tout l''hôtel';
update public.kb_articles
set body = replace(body, 'une session Opera ouverte', 'une session Opera Cloud ouverte'),
    body_en = replace(body_en, 'an Opera session open', 'an Opera Cloud session open'), updated_at = now()
where title = 'Verrouiller son poste en quittant le bureau';

-- Maintenance plans created from the templates.
update public.maintenance_plans
set description = replace(description, '(Opera, Micros/Simphony, partages de fichiers).', '(Micros/Simphony, partages de fichiers ; Opera Cloud est hébergé et sauvegardé par Oracle).')
where description like '%(Opera, Micros/Simphony, partages de fichiers).%';
update public.maintenance_plans
set description = replace(description, '(Windows, Opera, Micros, messagerie)', '(Windows, Opera Cloud, Micros, messagerie)')
where description like '%(Windows, Opera, Micros, messagerie)%';
