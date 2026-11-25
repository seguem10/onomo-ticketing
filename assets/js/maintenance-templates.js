/* Ready-made maintenance plans, based on the equipment of the hotels'
   inventory workbook (NAS Synology, WatchGuard, Peplink, Eaton UPS, Ruckus
   Wi-Fi, Hikvision NVR, VingCard, Micros, OmniPCX, VRV, fire system,
   elevators, cold rooms…). A technician picks the ones that apply to a hotel
   in the "Maintenance planifiée" page; each becomes an ordinary, editable
   plan. Titles and descriptions become the tickets' title and text. */
(function(root){
 'use strict';
 const T=(group,key,title,frequency,priority,category,description)=>({group,key,title,frequency,priority,category,description});
 const TEMPLATES=[
  // Informatique
  T('it','backup-check','Vérifier les sauvegardes (NAS)','monthly','Haute','IT / Réseau','Contrôler que les sauvegardes sont réussies (Opera, Micros/Simphony, partages de fichiers). Vérifier l’espace libre et l’état des disques du NAS Synology (SMART, alertes).'),
  T('it','backup-restore','Test de restauration d’une sauvegarde','quarterly','Haute','IT / Réseau','Restaurer un fichier ou une base de test depuis la sauvegarde et vérifier qu’il est exploitable. Noter la durée de restauration.'),
  T('it','os-updates','Mises à jour des postes et serveurs','monthly','Normale','IT / Réseau','Windows Update et antivirus à jour sur les postes et serveurs (Interface, CAPS, Pointage, VingCard). Redémarrer les serveurs en heure creuse et vérifier les services après redémarrage.'),
  T('it','firewall','Pare-feu et routeur : mises à jour et accès','quarterly','Normale','IT / Réseau','WatchGuard Firebox et Peplink : mise à jour du firmware, validité des licences, revue des comptes et accès VPN, sauvegarde de la configuration.'),
  T('it','ups-test','Onduleurs : test d’autonomie','semiannual','Haute','IT / Réseau','Onduleur Eaton (TGBT / salle informatique) : test batterie, voyants, charge supportée, date de remplacement des batteries.'),
  T('it','wifi','Wi-Fi : contrôleur et bornes','monthly','Normale','IT / Réseau','Contrôleur Ruckus : bornes hors ligne, firmware, clients connectés, plaintes clients sur le Wi-Fi. Vérifier les switchs PoE des bornes.'),
  T('it','cctv','Vidéosurveillance : caméras et enregistrements','monthly','Normale','IT / Réseau','NVR Hikvision : toutes les caméras en ligne, enregistrement actif, durée de conservation respectée, date et heure correctes.'),
  T('it','vingcard','Encodeurs de clés et serrures (VingCard)','monthly','Normale','IT / Réseau','Encodeurs RFID de la réception, serveur VingCard, liste des serrures à pile faible. Remplacer les piles signalées.'),
  T('it','pos','Caisses et imprimantes Micros','monthly','Normale','IT / Réseau','Caisses Micros, imprimantes tickets et imprimantes IP cuisine/bar : impression, rouleaux, nettoyage des têtes, synchronisation des menus.'),
  T('it','pabx','Téléphonie : sauvegarde de la configuration PABX','semiannual','Basse','IT / Réseau','OmniPCX : sauvegarde de la configuration, test des postes réception et chambres, numéros d’urgence.'),
  T('it','server-room','Salle informatique : propreté, température, câblage','quarterly','Normale','IT / Réseau','Température et climatisation de la salle informatique, poussière, rangement du câblage, étiquetage des baies et des switchs.'),
  T('it','accounts','Revue des comptes utilisateurs et des accès','quarterly','Normale','IT / Réseau','Désactiver les comptes des départs (Windows, Opera, Micros, messagerie), vérifier les comptes partagés et les droits administrateur.'),
  T('it','licenses','Licences et garanties à renouveler','yearly','Normale','IT / Réseau','Antivirus, Microsoft 365, WatchGuard, contrats de support, garanties matériel (voir l’Inventaire) : dates d’échéance et renouvellements à prévoir.'),
  T('it','inventory','Mise à jour annuelle de l’inventaire IT','yearly','Basse','IT / Réseau','Mettre à jour l’Inventaire : nouveaux équipements, numéros de série, emplacements, matériel retiré.'),
  // Technique
  T('technical','hvac-filters','Climatisation VRV : nettoyage des filtres','quarterly','Normale','Maintenance','Ventilo-convecteurs des chambres, restaurants, salles de banquet et bureaux : nettoyage des filtres, écoulement des condensats.'),
  T('technical','hot-water','Eau chaude sanitaire : températures (légionelle)','monthly','Haute','Maintenance','Relever la température des ballons et des points de puisage éloignés, purger les points peu utilisés, consigner les relevés.'),
  T('technical','softener','Adoucisseur : niveau de sel et réglages','monthly','Basse','Maintenance','Contrôler le niveau de sel, la dureté de l’eau en sortie et le cycle de régénération.'),
  T('technical','electrical','Tableaux électriques : contrôle et serrage','yearly','Normale','Maintenance','Contrôle visuel et thermographique des tableaux, serrage des connexions, test des différentiels.'),
  T('technical','elevator','Ascenseurs : visite d’entretien','monthly','Normale','Maintenance','Visite du prestataire (contrat d’entretien) : signer le carnet, noter les anomalies, tester l’alarme de cabine.'),
  // Sécurité
  T('safety','fire-system','Système incendie : test de la centrale et des détecteurs','semiannual','Haute','Sécurité','Test de la centrale incendie, d’un échantillon de détecteurs, des déclencheurs manuels et des sirènes. Consigner dans le registre de sécurité.'),
  T('safety','extinguishers','Extincteurs : vérification annuelle','yearly','Haute','Sécurité','Vérification par l’organisme agréé, présence et accessibilité de chaque extincteur, dates de contrôle à jour.'),
  T('safety','emergency-lights','Éclairage de sécurité : test des blocs','quarterly','Normale','Sécurité','Tester les blocs autonomes d’éclairage de sécurité (couloirs, escaliers, issues) et remplacer ceux qui ne s’allument pas.'),
  // Cuisine
  T('kitchen','cold-rooms','Chambres froides : relevé des températures','weekly','Haute','Restauration','Relever les températures des chambres froides et armoires positives/négatives, vérifier les joints de portes et l’alarme de température.'),
  T('kitchen','hood','Hotte et extraction cuisine : nettoyage','semiannual','Normale','Restauration','Nettoyage des filtres et du conduit d’extraction par le prestataire, contrôle du ventilateur.')
 ];
 const GROUPS={it:'Informatique',technical:'Technique',safety:'Sécurité',kitchen:'Cuisine'};
 const addDays=(iso,days)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 // Plans to create for a hotel: the chosen templates not already in place
 // (same title), with first due dates spread one day apart so a hotel does
 // not receive every ticket on the same morning (weekly tasks start at once).
 function build(keys,hotel,start,existing){
  const taken=new Set((existing||[]).filter(p=>p.hotel===hotel).map(p=>String(p.title).trim().toLowerCase()));
  let offset=0;
  return TEMPLATES.filter(t=>keys.includes(t.key)&&!taken.has(t.title.toLowerCase())).map(t=>({
   hotel,title:t.title,description:t.description,category:t.category,priority:t.priority,frequency:t.frequency,
   next_due:t.frequency==='weekly'?start:addDays(start,offset++),active:true
  }));
 }
 root.MaintenanceTemplates={TEMPLATES,GROUPS,build};
})(typeof window!=='undefined'?window:globalThis);
