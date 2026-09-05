/* Onomo Support IT - FR / EN / AR UI translation layer */
(function(){
  const fallback=window.OnomoLocaleData||{};
  const langs=['fr','en','ar'];
  const normalize=v=>langs.includes(v)?v:'fr';
  let active=normalize(localStorage.getItem('onomo_language')||((navigator.languages?.[0]||navigator.language||'fr').toLowerCase().split('-')[0]));
  let dictionary={fr:{...(fallback.fr||{})},en:{...(fallback.en||{})},ar:{...(fallback.ar||{})}};
  let translating=false;
  let observerTimer=null;

  /* Phrases used by the current UI but not present in the small base dictionaries. */
  const extra={
    'Support Desk · Hôtellerie':['Support IT','IT Support','دعم تقنية المعلومات'],
    'Support Hôtelier':['Support IT','IT Support','دعم تقنية المعلومات'],
    'Support Desk':['Support IT','IT Support','دعم تقنية المعلومات'],
    'Service Desk':['Service Desk','Service Desk','مكتب الخدمة'],
    'Tableau de bord':['Tableau de bord','Dashboard','لوحة التحكم'],
    'Tickets récents':['Tickets récents','Recent tickets','أحدث التذاكر'],
    'Activité récente':['Activité récente','Recent activity','النشاط الأخير'],
    'Aucune activité':['Aucune activité','No activity','لا يوجد نشاط'],
    'Aucun ticket trouvé':['Aucun ticket trouvé','No ticket found','لم يتم العثور على تذكرة'],
    'Modifiez vos filtres ou créez un nouveau ticket.':['Modifiez vos filtres ou créez un nouveau ticket.','Change your filters or create a new ticket.','عدّل عوامل التصفية أو أنشئ تذكرة جديدة.'],
    'Tickets urgents':['Tickets urgents','Urgent tickets','التذاكر العاجلة'],
    'Mes tickets assignés':['Mes tickets assignés','My assigned tickets','تذاكري المعيّنة'],
    'Détail ticket':['Détail ticket','Ticket details','تفاصيل التذكرة'],
    'Détail du ticket':['Détail du ticket','Ticket details','تفاصيل التذكرة'],
    'Tous les tickets':['Tous les tickets','All tickets','كل التذاكر'],
    'Nouveau ticket':['Nouveau ticket','New ticket','تذكرة جديدة'],
    'Créer le ticket':['Créer le ticket','Create ticket','إنشاء التذكرة'],
    'Ticket créé avec succès':['Ticket créé avec succès','Ticket created successfully','تم إنشاء التذكرة بنجاح'],
    'Ticket mis à jour':['Ticket mis à jour','Ticket updated','تم تحديث التذكرة'],
    'Supabase indisponible — données locales chargées':['Supabase indisponible — données locales chargées','Supabase unavailable — local data loaded','Supabase غير متاح — تم تحميل البيانات المحلية'],
    'Chargement des données…':['Chargement des données…','Loading data…','جارٍ تحميل البيانات…'],
    'Rechercher un ticket…':['Rechercher un ticket…','Search a ticket…','البحث عن تذكرة…'],
    'Notifications':['Notifications','Notifications','الإشعارات'],
    'Tout lire':['Tout lire','Mark all as read','قراءة الكل'],
    'Aucune notification':['Aucune notification','No notifications','لا توجد إشعارات'],
    'Mode sombre':['Mode sombre','Dark mode','الوضع الداكن'],
    'Vue liste':['Vue liste','List view','عرض القائمة'],
    'Vue Kanban':['Vue Kanban','Kanban view','عرض كانبان'],
    'Filtres avancés':['Filtres avancés','Advanced filters','فلاتر متقدمة'],
    'N°':['N°','No.','الرقم'],
    'Numéro':['Numéro','Number','الرقم'],
    'Sujet':['Sujet','Subject','الموضوع'],
    'Hôtel':['Hôtel','Hotel','الفندق'],
    'Hôtel assigné':['Hôtel assigné','Assigned hotel','الفندق المعيّن'],
    'Catégorie':['Catégorie','Category','الفئة'],
    'Priorité':['Priorité','Priority','الأولوية'],
    'Statut':['Statut','Status','الحالة'],
    'SLA':['SLA','SLA','اتفاقية مستوى الخدمة'],
    'Assigné à':['Assigné à','Assigned to','مُعيّن إلى'],
    'Créé':['Créé','Created','تم الإنشاء'],
    'Créé le':['Créé le','Created on','تاريخ الإنشاء'],
    'Description':['Description','Description','الوصف'],
    'Commentaires':['Commentaires','Comments','التعليقات'],
    'Ajouter un commentaire…':['Ajouter un commentaire…','Add a comment…','إضافة تعليق…'],
    'Retour':['Retour','Back','رجوع'],
    'Modifier statut / assignation':['Modifier statut / assignation','Edit status / assignment','تعديل الحالة / التعيين'],
    'Modifier le statut':['Modifier le statut','Edit status','تعديل الحالة'],
    'Nouveau statut':['Nouveau statut','New status','الحالة الجديدة'],
    'Enregistrer':['Enregistrer','Save','حفظ'],
    'Annuler':['Annuler','Cancel','إلغاء'],
    'Fermer':['Fermer','Close','إغلاق'],
    'Rouvrir':['Rouvrir','Reopen','إعادة فتح'],
    'Supprimer':['Supprimer','Delete','حذف'],
    'Modifier':['Modifier','Edit','تعديل'],
    'Créer':['Créer','Create','إنشاء'],
    'Rechercher':['Rechercher','Search','بحث'],
    'Actualiser':['Actualiser','Refresh','تحديث'],
    'Filtrer':['Filtrer','Filter','تصفية'],
    'Réinitialiser':['Réinitialiser','Reset','إعادة تعيين'],
    'Tous':['Tous','All','الكل'],
    'Nouveau':['Nouveau','New','جديد'],
    'En cours':['En cours','In progress','قيد المعالجة'],
    'En attente':['En attente','Pending','قيد الانتظار'],
    'Résolu':['Résolu','Resolved','تم الحل'],
    'Fermé':['Fermé','Closed','مغلق'],
    'Urgents':['Urgents','Urgent','عاجل'],
    'Urgents actifs':['Urgents actifs','Active urgent tickets','تذاكر عاجلة نشطة'],
    'Haute':['Haute','High','عالية'],
    'Normale':['Normale','Normal','عادية'],
    'Basse':['Basse','Low','منخفضة'],
    'Urgente':['Urgente','Urgent','عاجلة'],
    'Critique':['Critique','Critical','حرجة'],
    'Maintenance':['Maintenance','Maintenance','الصيانة'],
    'IT / Réseau':['IT / Network','IT / Network','تقنية المعلومات / الشبكة'],
    'Chambres':['Chambres','Rooms','الغرف'],
    'Restauration':['Restauration','Food & Beverage','المطعم'],
    'Guest relations':['Guest relations','Guest relations','علاقات الضيوف'],
    'Sécurité':['Sécurité','Security','الأمن'],
    'Ménage':['Ménage','Housekeeping','التدبير المنزلي'],
    'Autre':['Autre','Other','أخرى'],
    'Non assigné':['Non assigné','Unassigned','غير معيّن'],
    'Rapports':['Rapports','Reports','التقارير'],
    'Rapport global':['Rapport global','Global report','التقرير العام'],
    'Rapport par hôtel':['Rapport par hôtel','Report by hotel','التقرير حسب الفندق'],
    'Rapport par agent':['Rapport par agent','Report by agent','التقرير حسب الموظف'],
    'Rapport anomalies':['Rapport anomalies','Anomaly report','تقرير الحالات غير العادية'],
    'Mon hôtel':['Mon hôtel','My hotel','فندقي'],
    'Par hôtel':['Par hôtel','By hotel','حسب الفندق'],
    'Par agent':['Par agent','By agent','حسب الموظف'],
    'Par catégorie':['Par catégorie','By category','حسب الفئة'],
    'Par priorité':['Par priorité','By priority','حسب الأولوية'],
    'Par statut':['Par statut','By status','حسب الحالة'],
    'Vue globale':['Vue globale','Global overview','نظرة شاملة'],
    'Anomalies':['Anomalies','Anomalies','الحالات غير العادية'],
    'Administration':['Administration','Administration','الإدارة'],
    'Principal':['Principal','Main','الرئيسية'],
    'Système':['Système','System','النظام'],
    'Paramètres':['Paramètres','Settings','الإعدادات'],
    'Utilisateurs':['Utilisateurs','Users','المستخدمون'],
    'Hôtels':['Hôtels','Hotels','الفنادق'],
    'Mon profil':['Mon profil','My profile','ملفي الشخصي'],
    'Rôles et permissions':['Rôles et permissions','Roles and permissions','الأدوار والصلاحيات'],
    'Gestion des comptes':['Gestion des comptes','Account management','إدارة الحسابات'],
    'Comptes enregistrés':['Comptes enregistrés','Registered accounts','الحسابات المسجلة'],
    'Ajouter un compte':['Ajouter un compte','Add account','إضافة حساب'],
    'Nouvel utilisateur':['Nouvel utilisateur','New user','مستخدم جديد'],
    'Modifier le compte':['Modifier le compte','Edit account','تعديل الحساب'],
    'Prénom':['Prénom','First name','الاسم'],
    'Nom':['Nom','Last name','النسب'],
    'Email':['Email','Email','البريد الإلكتروني'],
    'Adresse email':['Adresse email','Email address','البريد الإلكتروني'],
    'Mot de passe':['Mot de passe','Password','كلمة المرور'],
    'Rôle':['Rôle','Role','الدور'],
    'Rôle :':['Rôle :','Role:','الدور:'],
    'IT Régional':['IT Régional','Regional IT','تقنية المعلومات الإقليمية'],
    'IT Hôtel':['IT Hôtel','Hotel IT','تقنية معلومات الفندق'],
    'Direction':['Direction','Management','الإدارة'],
    'Admin':['Admin','Admin','مسؤول'],
    'Créer le compte':['Créer le compte','Create account','إنشاء الحساب'],
    'Enregistrer les modifications':['Enregistrer les modifications','Save changes','حفظ التغييرات'],
    'Supprimer le compte':['Supprimer le compte','Delete account','حذف الحساب'],
    'Cette action est irréversible.':['Cette action est irréversible.','This action cannot be undone.','هذا الإجراء لا يمكن التراجع عنه.'],
    'Ajouter un hôtel':['Ajouter un hôtel','Add hotel','إضافة فندق'],
    'Modifier l’hôtel':['Modifier l’hôtel','Edit hotel','تعديل الفندق'],
    'Modifier l\'hôtel':['Modifier l\'hôtel','Edit hotel','تعديل الفندق'],
    'Nom de l’hôtel *':['Nom de l’hôtel *','Hotel name *','اسم الفندق *'],
    'Nom de l\'hôtel *':['Nom de l\'hôtel *','Hotel name *','اسم الفندق *'],
    'Ville':['Ville','City','المدينة'],
    'Pays':['Pays','Country','البلد'],
    'Code (3 car.)':['Code (3 car.)','Code (3 chars)','الرمز (3 أحرف)'],
    'Email de contact':['Email de contact','Contact email','البريد الإلكتروني للتواصل'],
    'Personnalisation & Thème':['Personnalisation & Thème','Customization & Theme','التخصيص والمظهر'],
    'Nom de la marque / chaîne hôtelière':['Nom de la marque / chaîne hôtelière','Brand / hotel chain name','اسم العلامة التجارية / سلسلة الفنادق'],
    'Logo (URL ou base64)':['Logo (URL ou base64)','Logo (URL or base64)','الشعار (رابط أو base64)'],
    'Couleur principale':['Couleur principale','Primary color','اللون الرئيسي'],
    'Thème':['Thème','Theme','المظهر'],
    'Clair':['Clair','Light','فاتح'],
    'Sombre':['Sombre','Dark','داكن'],
    'Appliquer les changements':['Appliquer les changements','Apply changes','تطبيق التغييرات'],
    'Typographie & Couleurs avancées':['Typographie & Couleurs avancées','Typography & advanced colors','الخطوط والألوان المتقدمة'],
    'Police d’écriture':['Police d’écriture','Font','الخط'],
    'Police d\'écriture':['Police d\'écriture','Font','الخط'],
    'Taille du texte':['Taille du texte','Text size','حجم النص'],
    'Couleur de la barre latérale':['Couleur de la barre latérale','Sidebar color','لون الشريط الجانبي'],
    'Catégories de tickets':['Catégories de tickets','Ticket categories','فئات التذاكر'],
    'Ajouter une catégorie':['Ajouter une catégorie','Add category','إضافة فئة'],
    'Sauvegarder les catégories':['Sauvegarder les catégories','Save categories','حفظ الفئات'],
    'Réinitialiser':['Réinitialiser','Reset','إعادة تعيين'],
    'Fonctionnalités':['Fonctionnalités','Features','الميزات'],
    'Analyse IA des tickets':['Analyse IA des tickets','AI ticket analysis','تحليل التذاكر بالذكاء الاصطناعي'],
    'Notifications email':['Notifications email','Email notifications','إشعارات البريد الإلكتروني'],
    'Auto-assignation':['Auto-assignation','Auto-assignment','التعيين التلقائي'],
    'Base de données — Supabase':['Base de données — Supabase','Database — Supabase','قاعدة البيانات — Supabase'],
    'Base de données':['Base de données','Database','قاعدة البيانات'],
    'Stockage local (mode NAS)':['Stockage local (mode NAS)','Local storage (NAS mode)','التخزين المحلي (وضع NAS)'],
    'Exporter sauvegarde JSON':['Exporter sauvegarde JSON','Export JSON backup','تصدير نسخة JSON احتياطية'],
    'Importer sauvegarde':['Importer sauvegarde','Import backup','استيراد نسخة احتياطية'],
    'Réinitialiser les tickets':['Réinitialiser les tickets','Reset tickets','إعادة تعيين التذاكر'],
    'Tout effacer':['Tout effacer','Delete everything','حذف كل شيء'],
    'Activer les notifications':['Activer les notifications','Enable notifications','تفعيل الإشعارات'],
    'Changer mon mot de passe':['Changer mon mot de passe','Change my password','تغيير كلمة المرور'],
    'Mot de passe actuel':['Mot de passe actuel','Current password','كلمة المرور الحالية'],
    'Nouveau mot de passe':['Nouveau mot de passe','New password','كلمة المرور الجديدة'],
    'Confirmer le nouveau mot de passe':['Confirmer le nouveau mot de passe','Confirm new password','تأكيد كلمة المرور الجديدة'],
    'Mettre à jour le mot de passe':['Mettre à jour le mot de passe','Update password','تحديث كلمة المرور'],
    'Authentification à deux facteurs (MFA)':['Authentification à deux facteurs (MFA)','Two-factor authentication (MFA)','المصادقة الثنائية (MFA)'],
    'Activer le MFA':['Activer le MFA','Enable MFA','تفعيل المصادقة الثنائية'],
    'Désactiver le MFA':['Désactiver le MFA','Disable MFA','تعطيل المصادقة الثنائية'],
    'Modifier les filtres ou créez un nouveau ticket.':['Modifiez les filtres ou créez un nouveau ticket.','Change your filters or create a new ticket.','عدّل عوامل التصفية أو أنشئ تذكرة جديدة.'],
    'CSV':['CSV','CSV','CSV'],
    'PDF':['PDF','PDF','PDF'],
    'Rapport':['Rapport','Report','تقرير'],
    'Total tickets':['Total tickets','Total tickets','إجمالي التذاكر'],
    'Ouverts':['Ouverts','Open','مفتوحة'],
    'Résolus':['Résolus','Resolved','تم الحل'],
    'Taux résolution':['Taux résolution','Resolution rate','معدل الحل'],
    'Taux résolution :':['Taux résolution :','Resolution rate:','معدل الحل:'],
    'Action requise':['Action requise','Action required','يتطلب إجراء'],
    'aucun actuellement':['aucun actuellement','none currently','لا يوجد حالياً'],
    'Aucun hôtel assigné à votre compte.':['Aucun hôtel assigné à votre compte.','No hotel is assigned to your account.','لا يوجد فندق معيّن لحسابك.'],
    'Connexion':['Connexion','Sign in','تسجيل الدخول'],
    'Déconnexion':['Déconnexion','Sign out','تسجيل الخروج'],
    'Se connecter':['Se connecter','Sign in','تسجيل الدخول'],
    'Identifiants incorrects.':['Identifiants incorrects.','Incorrect credentials.','بيانات الدخول غير صحيحة.'],
    'Email ou mot de passe incorrect.':['Email ou mot de passe incorrect.','Incorrect email or password.','البريد الإلكتروني أو كلمة المرور غير صحيحة.'],
    'Réservé au personnel et aux équipes IT des hôtels':['Réservé au personnel et aux équipes IT des hôtels','For hotel staff and IT teams','مخصص لموظفي الفنادق وفرق تقنية المعلومات'],
    'Hôtel concerné':['Hôtel concerné','Concerned hotel','الفندق المعني'],
    'Sujet *':['Sujet *','Subject *','الموضوع *'],
    'Description':['Description','Description','الوصف'],
    'Contexte, numéro de chambre, gravité observée…':['Contexte, numéro de chambre, gravité observée…','Context, room number, observed severity…','السياق ورقم الغرفة ودرجة الخطورة…'],
    'Analyser avec l’IA':['Analyser avec l’IA','Analyze with AI','تحليل بالذكاء الاصطناعي'],
    'Suggestion IA':['Suggestion IA','AI suggestion','اقتراح الذكاء الاصطناعي'],
    'Champs pré-remplis automatiquement — vous pouvez modifier.':['Champs pré-remplis automatiquement — vous pouvez modifier.','Fields are filled automatically — you can edit them.','تم ملء الحقول تلقائياً ويمكنك تعديلها.'],
    'Assigner à':['Assigner à','Assign to','تعيين إلى'],
    '— Non assigné —':['— Non assigné —','— Unassigned —','— غير معيّن —'],
    'Aucun agent créé':['Aucun agent créé','No agent created','لم يتم إنشاء أي موظف'],
    'Ajouter un commentaire':['Ajouter un commentaire','Add comment','إضافة تعليق'],
    'Envoyer':['Envoyer','Send','إرسال'],
    'Progression':['Progression','Progress','التقدم'],
    'Statut actuel':['Statut actuel','Current status','الحالة الحالية'],
    'Aucune description fournie.':['Aucune description fournie.','No description provided.','لم يتم تقديم وصف.'],
    'Aucun commentaire pour le moment.':['Aucun commentaire pour le moment.','No comments yet.','لا توجد تعليقات حالياً.'],
    'Aucun ticket dans le système — créez des tickets pour voir l’analyse.':['Aucun ticket dans le système — créez des tickets pour voir l’analyse.','No tickets in the system — create tickets to see the analysis.','لا توجد تذاكر في النظام — أنشئ تذاكر لعرض التحليل.'],
    'Analyse des anomalies et tendances':['Analyse des anomalies et tendances','Anomaly and trend analysis','تحليل الحالات غير العادية والاتجاهات'],
    'Anomalies détectées':['Anomalies détectées','Detected anomalies','الحالات غير العادية المكتشفة'],
    'Points d’attention':['Points d’attention','Points of attention','نقاط تحتاج إلى الانتباه'],
    'Points positifs':['Points positifs','Positive points','النقاط الإيجابية'],
    'Aucun dépassement SLA':['Aucun dépassement SLA','No SLA breaches','لا توجد تجاوزات لاتفاقية مستوى الخدمة'],
    'Tous les tickets ouverts sont assignés':['Tous les tickets ouverts sont assignés','All open tickets are assigned','جميع التذاكر المفتوحة معيّنة'],
    'Aucun ticket urgent actif':['Aucun ticket urgent actif','No active urgent tickets','لا توجد تذاكر عاجلة نشطة'],
    'Situation sous contrôle.':['Situation sous contrôle.','Situation under control.','الوضع تحت السيطرة.'],
    'Rapport confidentiel':['Rapport confidentiel','Confidential report','تقرير سري'],
    'Système de ticketing hôtelier':['Système de ticketing hôtelier','Hotel ticketing system','نظام تذاكر الفنادق'],
    'Généré le':['Généré le','Generated on','تم الإنشاء في'],
    'Confidentiel':['Confidentiel','Confidential','سري'],
    'Bienvenue':['Bienvenue','Welcome','مرحباً'],
    'Bienvenue sur votre espace Support IT':['Bienvenue sur votre espace Support IT','Welcome to your IT Support area','مرحباً بكم في مساحة دعم تقنية المعلومات'],
    'Aucune permission':['Aucune permission','No permission','لا توجد صلاحيات'],
    'Accès complet':['Accès complet','Full access','صلاحيات كاملة'],
    'Accès non autorisé.':['Accès non autorisé.','Access denied.','غير مسموح بالوصول.'],
    'Votre session a expiré.':['Votre session a expiré.','Your session has expired.','انتهت صلاحية جلستك.']
  };

  function t(key){return dictionary[active]?.[key]??dictionary.fr?.[key]??key;}
  function entries(){
    const out=[];
    Object.entries(dictionary.fr||{}).forEach(([key,source])=>{if(typeof source==='string'&&source.trim())out.push([source,t(key)]);});
    Object.entries(extra).forEach(([source,v])=>out.push([source,v[['fr','en','ar'].indexOf(active)]||source]));
    const seen=new Set();
    return out.filter(([s])=>{if(seen.has(s))return false;seen.add(s);return true;}).sort((a,b)=>b[0].length-a[0].length);
  }
  function translateValue(value,list){
    if(!value||typeof value!=='string')return value;
    let out=value;
    for(const [source,target] of list){if(source&&target&&source!==target&&out.includes(source))out=out.split(source).join(target);}
    return out;
  }
  function translateTextNodes(root=document.body){
    if(!root||translating)return;
    translating=true;
    try{
      const list=entries();
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(n=>{
        const p=n.parentElement;
        if(!p||['SCRIPT','STYLE'].includes(p.tagName)||p.closest('[data-i18n]'))return;
        if(!n.dataset.onomoSource)n.dataset.onomoSource=n.nodeValue;
        const next=translateValue(n.dataset.onomoSource,list);
        if(n.nodeValue!==next)n.nodeValue=next;
      });
      root.querySelectorAll('input,textarea,button,[title],[aria-label],[placeholder]').forEach(el=>{
        ['placeholder','title','aria-label'].forEach(attr=>{
          if(!el.hasAttribute(attr))return;
          const key='onomo'+attr.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()).replace(/^./,c=>c.toUpperCase());
          if(!el.dataset[key])el.dataset[key]=el.getAttribute(attr);
          const next=translateValue(el.dataset[key],list);
          if(next!==el.getAttribute(attr))el.setAttribute(attr,next);
        });
      });
      root.querySelectorAll('option').forEach(el=>{
        if(!el.dataset.onomoSource)el.dataset.onomoSource=el.textContent;
        el.textContent=translateValue(el.dataset.onomoSource,list);
      });
    }finally{translating=false;}
  }
  function setI18nText(el,value){
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    if(nodes.length)nodes[nodes.length-1].nodeValue=value;else el.textContent=value;
  }
  function updateStatic(){
    document.documentElement.lang=active;
    document.documentElement.dir=active==='ar'?'rtl':'ltr';
    document.body?.setAttribute('dir',active==='ar'?'rtl':'ltr');
    document.title=t('app_name');
    document.querySelectorAll('[data-i18n]').forEach(el=>setI18nText(el,t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));
    document.querySelectorAll('[data-i18n-title]').forEach(el=>el.title=t(el.dataset.i18nTitle));
    document.querySelectorAll('.language-selector').forEach(el=>el.value=active);
    translateTextNodes();
  }
  async function loadLocale(lang){
    try{
      const r=await fetch(`locales/${lang}.json?lang=${lang}&v=5`,{cache:'no-store'});
      if(r.ok){const loaded=await r.json();dictionary[lang]={...(dictionary[lang]||{}),...loaded};}
    }catch(_){}
  }
  function bindSelector(select){
    if(!select||select.dataset.onomoBound==='1')return;
    select.dataset.onomoBound='1';
    select.addEventListener('change',e=>setLanguage(e.target.value,true));
  }
  async function setLanguage(value,persist=true){
    active=normalize(value);
    if(persist)localStorage.setItem('onomo_language',active);
    await loadLocale(active);
    if(window.currentUser){
      currentUser.language=active;
      try{if(window.sbOK?.())window.sbUpdateUser?.(currentUser.id,{language:active});}catch(_){}
    }
    updateStatic();
    enforceSelectors();
    setTimeout(()=>translateTextNodes(),0);
  }
  function makeSelector(id){
    const s=document.createElement('select');
    s.id=id;s.className='language-selector';s.setAttribute('aria-label','Language');
    s.innerHTML='<option value="fr">FR</option><option value="en">EN</option><option value="ar">العربية</option>';
    s.value=active;bindSelector(s);return s;
  }
  function enforceSelectors(){
    const loginScreen=document.getElementById('loginScreen');
    const app=document.getElementById('appScreen');
    const topbar=app?.querySelector('.topbar');
    const search=topbar?.querySelector('.search-box');
    document.querySelectorAll('.language-selector').forEach(el=>{
      if(el.id!=='languageSelector-login'&&el.id!=='languageSelector-app')el.remove();
    });
    if(loginScreen){
      let s=document.getElementById('languageSelector-login');
      if(!s){s=makeSelector('languageSelector-login');loginScreen.appendChild(s);}else bindSelector(s);
      s.value=active;
      Object.assign(s.style,{position:'fixed',top:'18px',right:'18px',left:'auto',bottom:'auto',zIndex:'9999',display:'block',width:'auto',minWidth:'82px'});
    }else document.getElementById('languageSelector-login')?.remove();
    if(topbar&&search){
      let s=document.getElementById('languageSelector-app');
      if(!s){s=makeSelector('languageSelector-app');topbar.insertBefore(s,search);}else bindSelector(s);
      s.value=active;
      Object.assign(s.style,{position:'static',margin:'0 8px',width:'auto',minWidth:'82px',height:'36px',display:'inline-block'});
    }else document.getElementById('languageSelector-app')?.remove();
  }
  window.OnomoI18n={t,setLanguage,get language(){return active},validate(){const keys=Object.keys(dictionary.fr||{});return ['en','ar'].flatMap(l=>keys.filter(k=>!(k in (dictionary[l]||{}))).map(k=>`${l}:${k}`));}};

  document.addEventListener('DOMContentLoaded',async()=>{
    await loadLocale('fr');
    await loadLocale(active);
    enforceSelectors();
    updateStatic();
    const observer=new MutationObserver(()=>{
      clearTimeout(observerTimer);
      observerTimer=setTimeout(()=>{enforceSelectors();translateTextNodes();},120);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  });
})();
