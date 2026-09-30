// ONOMO Support IT — secure, advisory IT assistant.
// Required secret: OPENAI_API_KEY or ANTHROPIC_API_KEY. SUPABASE_SERVICE_ROLE_KEY
// is provided automatically by Supabase Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2";

const firstProjectKey=(name:string)=>{
  try{
    const values=JSON.parse(Deno.env.get(name)||'{}');
    return Object.values(values).find(value=>typeof value==='string'&&value) as string|undefined;
  }catch(_){return undefined;}
};
const URL=Deno.env.get("SUPABASE_URL")!;
// Supabase now exposes plural JSON key maps to Edge Functions.  Retain the
// legacy names as fallbacks so existing projects continue to work.
const ANON=Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? firstProjectKey("SUPABASE_PUBLISHABLE_KEYS");
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? firstProjectKey("SUPABASE_SECRET_KEYS");
const ANTHROPIC_KEY=Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_KEY=Deno.env.get("OPENAI_API_KEY");
const GEMINI_KEY=Deno.env.get("GEMINI_API_KEY");
// Use the Flash model available on Gemini's free tier by default.  A project
// can still opt into a different enabled model through GEMINI_MODEL.
const GEMINI_MODEL=Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash";
const domains=new Set(['microsoft365','sage1000','citrix','opera','pos','network','maintenance','general']);
const allowedOrigin=(origin:string)=>origin==='https://onomo-ticketing.vercel.app'||/^https:\/\/onomo-ticketing(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
const headers=(req:Request)=>({"Access-Control-Allow-Origin":allowedOrigin(req.headers.get('origin')??'')?req.headers.get('origin')??'':"https://onomo-ticketing.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS",Vary:"Origin","Content-Type":"application/json"});
const send=(req:Request,body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:headers(req)});
// A transient provider outage must not immediately turn a real assistant
// request into the static fallback. Retry only temporary upstream statuses;
// invalid keys and malformed requests still fail immediately.
const requestProvider=async(url:string,init:RequestInit)=>{
  let response:Response|undefined;
  for(let attempt=0;attempt<3;attempt++){
    response=await fetch(url,init);
    if(response.ok||![429,500,502,503,504].includes(response.status)||attempt===2)return response;
    await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }
  throw new Error('AI provider did not return a response');
};
const clean=(value:unknown,max=6000)=>String(value??'').replace(/\b(?:password|mot de passe|token|api[_ -]?key|secret)\s*[:=]\s*\S+/gi,'[REDACTED]').replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,})\b/g,'[REDACTED]').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[REDACTED_EMAIL]').replace(/\b(?:\d[ -]*?){13,19}\b/g,'[REDACTED_PAYMENT]').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const toText=(items:unknown)=>Array.isArray(items)?items.map(item=>clean(item,900)).filter(Boolean).slice(0,8):[];
const priority=(value:unknown)=>{const key=String(value??'').toLowerCase();if(/crit|urgent|p1/.test(key))return 'Urgente';if(/haut|high|p2/.test(key))return 'Haute';if(/bas|low|p4/.test(key))return 'Basse';return 'Normale';};
// First-line, provider-free support.  These are deliberately conservative
// diagnostic templates: they are not vendor-specific runbooks and never carry
// out a change.  They keep the assistant useful when an external model is not
// configured or unavailable, while letting the IT team validate a real local
// procedure later in it_procedures.
const procedureGuide=(domain:string,message:string,language:string)=>{
  const en=language==='en', ar=language==='ar';
  const make=(answer:string,causes:string[],questions:string[],checks:string[],solution:string[],validation:string[],title:string,category='IT / Réseau')=>({
    mode:'procedure',answer,causes,questions,checks,solution,validation,
    assumptions:[ar?'هذا نموذج تشخيص أولي من ONOMO، وليس إجراءً معتمداً خاصاً بالمورد. يجب أن يراجعه مسؤول IT مخوّل قبل أي تغيير.':en?'This is an ONOMO initial diagnostic template, not a vendor-approved procedure. An authorized IT owner must review it before any change.':'Ceci est un modèle initial de diagnostic ONOMO, pas une procédure fournisseur validée. Un responsable IT habilité doit le vérifier avant tout changement.'],
    suggested_ticket:{title,description:`${ar?'الطلب':'Request'}: ${message}\n\n${ar?'التحققات المقترحة':'Suggested checks'}: ${checks.join(' ')}`,category,priority:'Normale'}
  });
  const common=ar?{
    network:'تحقق من اتصال الشبكة والتاريخ والوقت على الجهاز؛ سجّل النتيجة قبل التصعيد.', evidence:'سجّل رسالة الخطأ الدقيقة والوقت واسم الجهاز، من دون كلمة مرور أو بيانات عميل.', safe:'لا تغيّر إعدادات الإنتاج أو الحسابات تلقائياً.'
  }:en?{
    network:'Check network connectivity and the workstation date/time; record the result before escalation.', evidence:'Record the exact error, time, and device name, without passwords or customer data.', safe:'Do not change production settings or accounts automatically.'
  }:{
    network:'Vérifiez la connexion réseau et la date/heure du poste ; consignez le résultat avant escalade.', evidence:'Relevez le message exact, l’heure et le nom du poste, sans mot de passe ni donnée client.', safe:'Ne modifiez pas automatiquement un paramètre de production ou un compte.'
  };
  const requestText=message.toLowerCase();
  const requested=en?`Reported symptom: “${clean(message,260)}”.`:ar?`العَرَض المبلّغ عنه: «${clean(message,260)}».`:`Symptôme signalé : «${clean(message,260)}».`;
  // Deterministic intent routing makes a provider-free guide useful for more
  // than its broad domain. It deliberately routes only to safe checks and
  // never attempts a vendor-specific configuration change.
  if(domain==='microsoft365'&&/(outlook|mail|email|bo[iî]te|messagerie)/i.test(requestText))return make(
    en?`${requested} Outlook / mail diagnostic: determine whether the failure is sending, receiving, opening the mailbox, or searching before any account change.`:ar?`${requested} تشخيص Outlook/البريد: حدّد ما إذا كان العطل في الإرسال أو الاستلام أو فتح الصندوق أو البحث قبل أي تعديل في الحساب.`:`${requested} Diagnostic Outlook / messagerie : déterminez s’il s’agit de l’envoi, de la réception, de l’ouverture de boîte ou de la recherche avant toute modification du compte.`,
    en?['Outlook profile or cached session','Mailbox/service incident','Network or authentication issue']:ar?['ملف Outlook أو جلسة مخزنة','عطل في صندوق البريد أو الخدمة','مشكلة شبكة أو مصادقة']:['Profil Outlook ou session en cache','Incident de boîte aux lettres ou de service','Problème réseau ou d’authentification'],
    en?['Can the user open Outlook on the web?','Is sending, receiving, or both affected?','Do other users in the hotel have the same issue?']:ar?['هل يستطيع المستخدم فتح Outlook على الويب؟','هل يتأثر الإرسال أو الاستلام أو كلاهما؟','هل لدى مستخدمين آخرين في الفندق نفس المشكلة؟']:['L’utilisateur peut-il ouvrir Outlook sur le web ?','L’envoi, la réception ou les deux sont-ils touchés ?','D’autres utilisateurs de l’hôtel rencontrent-ils le même problème ?'],
    [common.network,en?'Check the Microsoft 365 service-health page used by your organization.':ar?'تحقق من صفحة حالة Microsoft 365 المعتمدة لدى المؤسسة.':'Vérifiez la page de santé Microsoft 365 utilisée par votre organisation.',en?'Test Outlook on the web in a private window; record the exact result without deleting local data.':ar?'اختبر Outlook على الويب في نافذة خاصة وسجّل النتيجة بدوّن حذف بيانات محلية.':'Testez Outlook sur le web dans une fenêtre privée et notez le résultat, sans supprimer de données locales.'],
    [common.safe,en?'If web access works but desktop Outlook does not, send the evidence to the Microsoft 365/desktop support owner for an approved profile check.':ar?'إذا نجح الوصول عبر الويب وفشل Outlook المكتبي، أرسل الدلائل إلى مسؤول Microsoft 365/الدعم المكتبي لفحص الملف المعتمد.':'Si le web fonctionne mais pas Outlook sur le poste, transmettez les éléments au responsable Microsoft 365/support poste pour un contrôle de profil approuvé.'],
    [en?'The user can send and receive a test message through the approved channel and the inbox updates normally.':ar?'يمكن للمستخدم إرسال واستقبال رسالة اختبار عبر القناة المعتمدة ويتحدّث صندوق البريد بشكل طبيعي.':'L’utilisateur peut envoyer et recevoir un message de test par le canal approuvé et la boîte se met à jour normalement.'],
    en?'Microsoft 365: Outlook or email issue':'Microsoft 365 : incident Outlook ou messagerie'
  );
  if(domain==='microsoft365'&&/(teams|meeting|réunion|appel|call|visi)/i.test(requestText))return make(
    en?`${requested} Teams diagnostic: isolate whether the failure is sign-in, chat, meeting audio/video, or one specific meeting.`:ar?`${requested} تشخيص Teams: حدّد ما إذا كان العطل في الدخول أو المحادثة أو صوت/فيديو الاجتماع أو اجتماع محدد.`:`${requested} Diagnostic Teams : isolez si l’échec concerne la connexion, le chat, l’audio/vidéo de réunion ou une réunion précise.`,
    en?['Teams service or account session','Device audio/video permission','Network quality or meeting-specific issue']:ar?['خدمة Teams أو جلسة الحساب','صلاحية الصوت/الفيديو للجهاز','جودة الشبكة أو مشكلة اجتماع محدد']:['Service Teams ou session du compte','Autorisation audio/vidéo du poste','Qualité réseau ou incident lié à une réunion'],
    en?['Is chat working while meetings fail?','Is the issue one meeting or every meeting?','What device and error message are involved?']:ar?['هل تعمل المحادثة بينما تفشل الاجتماعات؟','هل المشكلة في اجتماع واحد أم جميع الاجتماعات؟','ما الجهاز ورسالة الخطأ؟']:['Le chat fonctionne-t-il alors que les réunions échouent ?','Le problème concerne-t-il une réunion ou toutes les réunions ?','Quel poste et quel message d’erreur sont concernés ?'],
    [common.network,en?'Check the approved service-health page and test Teams on the web without changing device permissions.':ar?'تحقق من صفحة حالة الخدمة المعتمدة واختبر Teams على الويب دون تغيير أذونات الجهاز.':'Vérifiez la page de santé approuvée et testez Teams sur le web sans modifier les autorisations du poste.',common.evidence],
    [common.safe,en?'Escalate the test results to the Microsoft 365 owner if the failure affects several users or a business-critical meeting.':ar?'صعّد نتائج الاختبار إلى مسؤول Microsoft 365 إذا كان العطل يؤثر على عدة مستخدمين أو اجتماع مهم.':'Escaladez les résultats au responsable Microsoft 365 si l’incident touche plusieurs utilisateurs ou une réunion métier critique.'],
    [en?'The affected user can join a test meeting with the expected chat and media functions.':ar?'يمكن للمستخدم المتأثر الانضمام إلى اجتماع اختبار مع وظائف المحادثة والوسائط المتوقعة.':'L’utilisateur concerné peut rejoindre une réunion de test avec les fonctions de chat et média attendues.'],
    en?'Microsoft 365: Teams meeting issue':'Microsoft 365 : incident réunion Teams'
  );
  if(domain==='microsoft365'&&/(mfa|2fa|auth|connexion|sign.?in|password|mot de passe)/i.test(requestText))return make(
    en?`${requested} Microsoft 365 sign-in diagnostic: confirm the identity flow and impact without resetting credentials in this conversation.`:ar?`${requested} تشخيص تسجيل الدخول Microsoft 365: تحقق من مسار الهوية والأثر دون إعادة تعيين بيانات الاعتماد في هذه المحادثة.`:`${requested} Diagnostic de connexion Microsoft 365 : contrôlez le parcours d’identité et l’impact, sans réinitialiser d’identifiants dans cette conversation.`,
    en?['Expired session or incorrect device time','MFA prompt/device issue','Account, licence, or conditional-access check required']:ar?['جلسة منتهية أو وقت جهاز غير صحيح','مشكلة طلب MFA أو جهاز التحقق','حاجة إلى فحص الحساب أو الترخيص أو الوصول المشروط']:['Session expirée ou heure de poste incorrecte','Incident de demande MFA ou d’appareil de validation','Contrôle de compte, licence ou accès conditionnel requis'],
    en?['What exact error or approval prompt is shown?','Can the user access another Microsoft 365 app?','Was the MFA device recently changed or lost?']:ar?['ما رسالة الخطأ أو طلب الموافقة الظاهر؟','هل يستطيع المستخدم الوصول إلى تطبيق Microsoft 365 آخر؟','هل تم تغيير أو فقد جهاز MFA مؤخراً؟']:['Quel message d’erreur ou quelle demande d’approbation est affiché ?','L’utilisateur accède-t-il à une autre application Microsoft 365 ?','L’appareil MFA a-t-il été changé ou perdu récemment ?'],
    [common.network,en?'Confirm the workstation date/time and ask the user to retry in a private browser window.':ar?'تحقق من تاريخ/وقت محطة العمل واطلب من المستخدم إعادة المحاولة في نافذة خاصة.':'Vérifiez la date/heure du poste puis demandez à l’utilisateur de réessayer dans une fenêtre privée.',en?'Record the error reference and use the organization’s approved identity-support channel; never ask for a code or password.':ar?'سجّل مرجع الخطأ واستعمل قناة دعم الهوية المعتمدة؛ لا تطلب رمزاً أو كلمة مرور.':'Consignez la référence d’erreur et utilisez le circuit support identité approuvé ; ne demandez jamais de code ni de mot de passe.'],
    [common.safe,en?'An authorized identity administrator must perform any MFA reset, licence change, or access-policy review.':ar?'يجب أن يقوم مسؤول هوية مخوّل بأي إعادة تعيين MFA أو تغيير ترخيص أو مراجعة سياسة وصول.':'Un administrateur identité habilité doit effectuer toute réinitialisation MFA, modification de licence ou revue de politique d’accès.'],
    [en?'The user signs in through the approved flow and accesses only the expected applications.':ar?'يتصل المستخدم عبر المسار المعتمد ويصل فقط إلى التطبيقات المتوقعة.':'L’utilisateur se connecte par le parcours approuvé et accède uniquement aux applications attendues.'],
    en?'Microsoft 365: sign-in or MFA issue':'Microsoft 365 : incident de connexion ou MFA'
  );
  const pick=(fr:string,enText:string,arText:string)=>ar?arText:en?enText:fr;
  const quickGuide=(title:string,intro:string,causes:string[],questions:string[],checks:string[],solution:string[],validation:string[],category='IT / Réseau')=>make(`${requested} ${intro}`,causes,questions,checks,solution,validation,title,category);
  if(domain==='microsoft365'&&/(onedrive|sharepoint|fichier|file|sync|synchron)/i.test(requestText))return quickGuide(
    pick('Microsoft 365 : fichiers OneDrive / SharePoint','Microsoft 365: OneDrive / SharePoint files','Microsoft 365: ملفات OneDrive / SharePoint'),pick('Diagnostic des fichiers : vérifiez d’abord si le problème concerne le partage, la synchronisation ou l’accès au site.','File diagnostic: first identify whether sharing, sync, or site access is failing.','تشخيص الملفات: حدّد أولاً ما إذا كان العطل في المشاركة أو المزامنة أو الوصول إلى الموقع.'),
    [pick('Droit de partage ou site','Sharing permission or site','إذن مشاركة أو موقع'),pick('Client de synchronisation','Sync client','عميل المزامنة'),pick('Incident de service','Service incident','عطل خدمة')],
    [pick('Le fichier est-il visible sur le web ?','Is the file visible on the web?','هل يظهر الملف على الويب؟'),pick('Un autre utilisateur autorisé y accède-t-il ?','Can another authorized user access it?','هل يستطيع مستخدم مخوّل آخر الوصول إليه؟')],
    [common.network,pick('Testez l’accès web et notez le message exact, sans déplacer ni écraser de fichier.','Test web access and record the exact message; do not move or overwrite files.','اختبر الوصول عبر الويب وسجّل الرسالة الدقيقة؛ لا تنقل أو تستبدل الملفات.'),common.evidence],
    [common.safe,pick('Transmettez le résultat au propriétaire Microsoft 365 pour vérifier les droits approuvés.','Send findings to the Microsoft 365 owner to verify approved permissions.','أرسل النتائج إلى مسؤول Microsoft 365 للتحقق من الأذونات المعتمدة.')],
    [pick('Le fichier est accessible aux seuls utilisateurs autorisés et la synchronisation est stable.','The file is accessible only to authorized users and sync is stable.','الملف متاح للمستخدمين المصرح لهم فقط والمزامنة مستقرة.')]
  );
  if(domain==='opera'&&/(role|rôle|permission|droit|access|accès|profil)/i.test(requestText))return quickGuide(
    pick('OPERA : accès et rôle','OPERA: access and role','OPERA: الوصول والدور'),pick('Demande d’accès OPERA : qualifiez le périmètre hôtel, le rôle et l’approbation avant toute action.','OPERA access request: qualify property scope, role, and approval before any action.','طلب وصول OPERA: حدّد نطاق المنشأة والدور والموافقة قبل أي إجراء.'),
    [pick('Rôle trop large','Role too broad','دور واسع جداً'),pick('Hôtel non inclus','Property not included','منشأة غير مشمولة'),pick('Compte désactivé','Disabled account','حساب معطّل')],
    [pick('Quel hôtel, département et rôle métier sont demandés ?','Which property, department, and business role are requested?','ما المنشأة والقسم والدور المطلوب؟'),pick('Quelle approbation est disponible ?','Which approval is available?','ما الموافقة المتاحة؟')],
    [common.evidence,pick('Vérifiez le moindre privilège et l’absence de compte dupliqué.','Verify least privilege and that no duplicate account exists.','تحقق من أقل الصلاحيات ومن عدم وجود حساب مكرر.')],
    [common.safe,pick('Seul un administrateur OPERA habilité applique le rôle via le processus local approuvé.','Only an authorized OPERA administrator applies the role through the approved local process.','فقط مسؤول OPERA مخوّل يطبق الدور عبر العملية المحلية المعتمدة.')],
    [pick('L’utilisateur accède uniquement aux fonctions, à l’hôtel et au département demandés.','The user accesses only the requested functions, property, and department.','يصل المستخدم فقط إلى الوظائف والمنشأة والقسم المطلوبين.')]
  );
  if(domain==='citrix'&&/(lent|slow|disconnect|déconnect|freeze|bloqu)/i.test(requestText))return quickGuide(
    pick('Citrix : lenteur ou déconnexion','Citrix: slowness or disconnection','Citrix: بطء أو انقطاع'),pick('Diagnostic Citrix : mesurez l’impact et la stabilité de session sans arrêter de session côté serveur.','Citrix diagnostic: measure impact and session stability without terminating server-side sessions.','تشخيص Citrix: قِس الأثر واستقرار الجلسة دون إنهاء جلسات على الخادم.'),
    [pick('Qualité réseau','Network quality','جودة الشبكة'),pick('Poste ou client Citrix','Workstation or Citrix client','محطة العمل أو عميل Citrix'),pick('Charge applicative','Application load','حمل التطبيق')],
    [pick('Une autre application publiée est-elle lente ?','Is another published application also slow?','هل تطبيق منشور آخر بطيء أيضاً؟'),pick('L’incident touche-t-il d’autres utilisateurs ?','Are other users affected?','هل يتأثر مستخدمون آخرون؟')],
    [common.network,pick('Relevez les heures de déconnexion, l’application et le code éventuel.','Record disconnect times, app name, and any code.','سجّل أوقات الانقطاع واسم التطبيق وأي رمز.'),common.evidence],
    [common.safe,pick('Escaladez avec ces éléments à l’équipe Citrix.','Escalate these findings to the Citrix team.','صعّد هذه النتائج إلى فريق Citrix.')],
    [pick('La session reste stable et l’application répond pour l’utilisateur concerné.','The session remains stable and the application responds for the affected user.','تظل الجلسة مستقرة ويستجيب التطبيق للمستخدم المتأثر.')]
  );
  if(domain==='sage1000'&&/(lent|slow|performance|bloqu|freeze)/i.test(requestText))return quickGuide(
    pick('Sage 1000 : lenteur ou blocage','Sage 1000: slowness or blocking','Sage 1000: بطء أو توقف'),pick('Diagnostic Sage : protégez les traitements financiers en cours avant toute reprise.','Sage diagnostic: protect running finance processes before any retry.','تشخيص Sage: احمِ العمليات المالية الجارية قبل أي إعادة محاولة.'),
    [pick('Traitement financier en cours','Financial process in progress','عملية مالية جارية'),pick('Accès réseau ou session','Network access or session','وصول الشبكة أو الجلسة'),pick('Incident applicatif','Application incident','عطل التطبيق')],
    [pick('Quelle opération métier était en cours ?','Which business operation was running?','ما العملية التجارية التي كانت جارية؟'),pick('Les autres utilisateurs sont-ils touchés ?','Are other users affected?','هل يتأثر مستخدمون آخرون؟')],
    [common.evidence,common.network,pick('Confirmez avec la finance qu’aucune clôture ou export critique n’est en cours.','Confirm with Finance that no close or critical export is running.','أكد مع المالية عدم وجود إغلاق أو تصدير حرج جارٍ.')],
    [common.safe,pick('Escaladez au propriétaire Sage/finance sans supprimer de données ni relancer de traitement.','Escalate to the Sage/Finance owner without deleting data or restarting a process.','صعّد إلى مسؤول Sage/المالية دون حذف بيانات أو إعادة تشغيل عملية.')],
    [pick('Le propriétaire confirme la cohérence et la reprise sans écart comptable.','The owner confirms consistency and resumption with no accounting discrepancy.','يؤكد المسؤول الاتساق والاستئناف دون فرق محاسبي.')]
  );
  if(domain==='sage1000'&&/(clôture|closing|export|import|sauvegarde|backup)/i.test(requestText))return quickGuide(
    pick('Sage 1000 : traitement sensible','Sage 1000: sensitive process','Sage 1000: معالجة حساسة'),pick('Traitement Sage sensible : obtenez la validation finance et vérifiez le statut avant toute action.','Sensitive Sage process: obtain Finance approval and check status before any action.','معالجة Sage حساسة: احصل على موافقة المالية وتحقق من الحالة قبل أي إجراء.'),
    [pick('Traitement déjà lancé','Process already started','تم بدء العملية'),pick('Fenêtre de maintenance','Maintenance window','نافذة صيانة'),pick('Données à valider','Data requiring validation','بيانات تحتاج تحققاً')],
    [pick('Qui est le responsable finance de l’opération ?','Who is the Finance owner of the operation?','من هو مسؤول المالية عن العملية؟'),pick('Quel est le statut et l’heure de la dernière sauvegarde validée ?','What is the status and time of the last validated backup?','ما الحالة ووقت آخر نسخة احتياطية معتمدة؟')],
    [common.evidence,pick('Vérifiez le journal de traitement avec le responsable habilité, sans annuler ni rejouer le lot.','Review the process log with the authorized owner, without cancelling or replaying the batch.','راجع سجل العملية مع المسؤول المخوّل دون إلغاء أو إعادة تشغيل الدفعة.')],
    [common.safe,pick('Utilisez uniquement le plan de reprise documenté par finance et l’éditeur.','Use only the recovery plan documented by Finance and the vendor.','استخدم فقط خطة الاسترداد الموثقة من المالية والمورد.')],
    [pick('La finance valide le résultat, l’intégrité et la traçabilité du traitement.','Finance validates the result, integrity, and traceability of the process.','تؤكد المالية النتيجة والسلامة وقابلية التتبع للعملية.')]
  );
  if(domain==='pos'&&/(print|printer|imprim|ticket|receipt)/i.test(requestText))return quickGuide(
    pick('POS : impression de ticket','POS: receipt printing','POS: طباعة الإيصال'),pick('Diagnostic POS imprimante : isolez le poste, la file et le périphérique sans réimprimer une vente non vérifiée.','POS printer diagnostic: isolate terminal, queue, and peripheral without reprinting an unverified sale.','تشخيص طابعة POS: اعزل المحطة وقائمة الانتظار والجهاز دون إعادة طباعة بيع غير مؤكد.'),
    [pick('Imprimante hors ligne','Printer offline','الطابعة غير متصلة'),pick('File d’impression','Print queue','قائمة انتظار الطباعة'),pick('Connexion locale','Local connection','اتصال محلي')],
    [pick('Le paiement/vente est-il déjà confirmé ?','Is the payment/sale already confirmed?','هل تم تأكيد الدفع/البيع بالفعل؟'),pick('Les autres caisses impriment-elles ?','Do other tills print?','هل تطبع صناديق أخرى؟')],
    [common.evidence,pick('Vérifiez uniquement l’alimentation, le papier, le voyant et le câble visible.','Check only power, paper, indicator, and visible cable.','تحقق فقط من الطاقة والورق والمؤشر والكابل الظاهر.'),common.network],
    [common.safe,pick('Informez le responsable caisse avant toute réimpression ou action sur une vente.','Inform the till manager before any reprint or action on a sale.','أبلغ مسؤول الصندوق قبل أي إعادة طباعة أو إجراء على عملية بيع.')],
    [pick('Le reçu est disponible et la vente n’a été ni dupliquée ni modifiée.','The receipt is available and the sale was neither duplicated nor changed.','الإيصال متاح ولم يتم تكرار البيع أو تغييره.')]
  );
  if(domain==='network'&&/(wifi|wi-fi|wireless|sans fil)/i.test(requestText))return quickGuide(
    pick('Réseau : Wi-Fi indisponible','Network: Wi-Fi unavailable','الشبكة: Wi-Fi غير متاح'),pick('Diagnostic Wi-Fi : qualifiez le lieu et le nombre d’utilisateurs avant toute action sur un point d’accès.','Wi-Fi diagnostic: qualify the location and number of users before any access-point action.','تشخيص Wi-Fi: حدّد الموقع وعدد المستخدمين قبل أي إجراء على نقطة الوصول.'),
    [pick('Couverture locale','Local coverage','تغطية محلية'),pick('Connexion du poste','Device connection','اتصال الجهاز'),pick('Incident d’accès','Access incident','عطل وصول')],
    [pick('Quelle zone/hôtel est touché ?','Which area/property is affected?','أي منطقة/منشأة متأثرة؟'),pick('Un autre réseau ou appareil fonctionne-t-il ?','Does another network or device work?','هل تعمل شبكة أو جهاز آخر؟')],
    [common.network,pick('Testez depuis un second appareil et notez le nom du réseau, le lieu et l’heure.','Test from a second device and record network name, location, and time.','اختبر من جهاز ثانٍ وسجّل اسم الشبكة والموقع والوقت.'),common.evidence],
    [common.safe,pick('Escaladez avec le périmètre ; ne redémarrez aucun équipement réseau sans autorisation.','Escalate with the scope; do not reboot network equipment without authorization.','صعّد مع النطاق؛ لا تعيد تشغيل معدات الشبكة دون إذن.')],
    [pick('Les utilisateurs concernés se connectent au réseau autorisé et accèdent au service attendu.','Affected users connect to the authorized network and reach the expected service.','يتصل المستخدمون المتأثرون بالشبكة المصرح بها ويصلون للخدمة المتوقعة.')]
  );
  if(domain==='network'&&/(vpn|remote|distant|distance)/i.test(requestText))return quickGuide(
    pick('Réseau : accès VPN','Network: VPN access','الشبكة: وصول VPN'),pick('Diagnostic VPN : isolez le poste, le réseau d’origine et le message sans modifier le profil VPN.','VPN diagnostic: isolate device, source network, and error without changing the VPN profile.','تشخيص VPN: اعزل الجهاز وشبكة المصدر والخطأ دون تغيير ملف VPN.'),
    [pick('Connexion Internet locale','Local Internet connection','اتصال إنترنت محلي'),pick('Session ou MFA','Session or MFA','جلسة أو MFA'),pick('Service VPN','VPN service','خدمة VPN')],
    [pick('Internet fonctionne-t-il hors VPN ?','Does Internet work outside VPN?','هل يعمل الإنترنت خارج VPN؟'),pick('Quel message et quelle heure ?','What message and time?','ما الرسالة والوقت؟')],
    [common.network,common.evidence,pick('Testez une reconnexion selon le guide interne sans modifier les paramètres ni importer de profil.','Test reconnecting per the internal guide without changing settings or importing a profile.','اختبر إعادة الاتصال وفق الدليل الداخلي دون تغيير إعدادات أو استيراد ملف.')],
    [common.safe,pick('Transmettez les résultats à l’équipe réseau/identité habilitée.','Send findings to the authorized network/identity team.','أرسل النتائج إلى فريق الشبكة/الهوية المخوّل.')],
    [pick('La connexion VPN autorisée est établie et l’accès prévu fonctionne.','The authorized VPN connection is established and the expected access works.','يتم إنشاء اتصال VPN المصرح به ويعمل الوصول المتوقع.')]
  );
  if(domain==='maintenance'&&/(printer|imprim|scan|scanner)/i.test(requestText))return quickGuide(
    pick('Maintenance : imprimante ou scanner','Maintenance: printer or scanner','الصيانة: طابعة أو ماسح'),pick('Diagnostic matériel : sécurisez l’équipement puis vérifiez les éléments visibles sans démontage.','Hardware diagnostic: make the equipment safe, then check visible items without disassembly.','تشخيص الأجهزة: أمّن الجهاز ثم افحص العناصر الظاهرة دون تفكيك.'),
    [pick('Alimentation ou consommable','Power or consumable','طاقة أو مستهلك'),pick('Connexion visible','Visible connection','اتصال ظاهر'),pick('Incident matériel','Hardware fault','عطل مادي')],
    [pick('Y a-t-il une alerte, un voyant ou un bruit inhabituel ?','Is there an alert, indicator, or unusual noise?','هل توجد رسالة تنبيه أو مؤشر أو صوت غير معتاد؟'),pick('Quel est le numéro d’équipement et son emplacement ?','What are the asset number and location?','ما رقم الجهاز وموقعه؟')],
    [common.evidence,pick('Contrôlez l’alimentation, les consommables et le câble visible ; ne retirez aucun capot.','Check power, consumables, and visible cable; do not remove covers.','تحقق من الطاقة والمستهلكات والكابل الظاهر؛ لا تفتح الأغطية.')],
    [common.safe,pick('Escaladez à la maintenance qualifiée si le défaut persiste ou en cas de risque.','Escalate to qualified maintenance if the fault persists or there is a safety risk.','صعّد إلى الصيانة المؤهلة إذا استمر العطل أو وجدت مخاطر.')],
    [pick('Un technicien qualifié confirme le fonctionnement sûr de l’équipement.','A qualified technician confirms safe equipment operation.','يؤكد فني مؤهل التشغيل الآمن للجهاز.')],
    'Maintenance'
  );
  if(domain==='opera')return make(
    ar?'نموذج طلب OPERA: يتم تنفيذ إنشاء المستخدم أو تعديل صلاحياته حصراً بواسطة مسؤول OPERA مخوّل بعد تحقق الموافقة.':en?'OPERA request template: user creation or permission changes must be performed only by an authorized OPERA administrator after approval is checked.':'Modèle de demande OPERA : la création d’utilisateur ou la modification des droits doit être effectuée uniquement par un administrateur OPERA habilité, après contrôle de l’accord.',
    ar?['طلب وصول جديد','حساب موجود لكنه معطّل','صلاحيات أو منشأة غير مطابقة']:en?['New access request','Existing but disabled account','Incorrect role or property scope']:['Nouvelle demande d’accès','Compte existant mais désactivé','Rôle ou périmètre hôtel incorrect'],
    ar?['ما الفندق والقسم المعنيان ؟','ما الدور المطلوب وأي تاريخ انتهاء ؟','هل توجد موافقة موثقة من المدير أو مالك التطبيق ؟']:en?['Which hotel and department are concerned?','What role and expiry date are required?','Is documented manager or application-owner approval available?']:['Quel hôtel et quel département sont concernés ?','Quel rôle et quelle date de fin sont demandés ?','Une approbation documentée du responsable ou du propriétaire applicatif est-elle disponible ?'],
    [common.evidence,ar?'تحقق من الموافقة ومن أقل صلاحيات لازمة، وتأكد أن الحساب غير موجود أو غير معطّل.':en?'Verify approval and least-privilege role, and confirm the account does not already exist or is disabled.':'Vérifiez l’approbation et le rôle au moindre privilège, puis assurez-vous que le compte n’existe pas déjà ou n’est pas désactivé.',ar?'اطلب من المسؤول المخوّل استخدام واجهة OPERA المعتمدة في الفندق؛ لا تشارك بيانات الدخول.':en?'Ask the authorized administrator to use the property’s approved OPERA interface; never share credentials.':'Demandez à l’administrateur habilité d’utiliser l’interface OPERA approuvée de l’établissement ; ne partagez jamais d’identifiants.'],
    [common.safe,ar?'وثّق الدور والفندق والقسم والموافقة في التذكرة.':en?'Document the role, property, department, and approval in the ticket.':'Consignez le rôle, l’hôtel, le département et l’approbation dans le ticket.'],
    [ar?'L’utilisateur accède uniquement à l’hôtel et aux fonctions autorisés.':en?'The user accesses only the authorized property and functions.':'L’utilisateur accède uniquement à l’hôtel et aux fonctions autorisés.'],
    ar?'OPERA : demande de compte ou droits':'OPERA: access or user request'
  );
  if(domain==='microsoft365')return make(
    ar?'نموذج تشخيص Microsoft 365: ابدأ بعزل ما إذا كانت المشكلة خاصة بمستخدم واحد أو عامة قبل أي تغيير في الحساب.':en?'Microsoft 365 diagnostic template: first isolate whether the issue is limited to one user or is service-wide before changing an account.':'Modèle de diagnostic Microsoft 365 : commencez par isoler si le problème concerne un seul utilisateur ou le service avant toute modification de compte.',
    ar?['جلسة أو اتصال منتهي','عطل خدمة أو شبكة','حساب أو ترخيص يحتاج تحققاً']:en?['Expired session or connectivity issue','Service or network incident','Account or licence requires verification']:['Session ou connectivité expirée','Incident de service ou de réseau','Compte ou licence à vérifier'],
    ar?['أي تطبيق يتأثر وما نص الخطأ ؟','هل يتأثر مستخدمون آخرون ؟','هل يعمل الوصول من متصفح أو شبكة أخرى ؟']:en?['Which app is affected and what is the exact error?','Are other users affected?','Does it work from another browser or network?']:['Quelle application est touchée et quel est le message exact ?','D’autres utilisateurs sont-ils concernés ?','Le service fonctionne-t-il depuis un autre navigateur ou réseau ?'],
    [common.network,ar?'تحقق من صفحة حالة Microsoft 365 المعتمدة في المؤسسة ومن وجود انقطاع عام.':en?'Check the organization-approved Microsoft 365 status page for a broader incident.':'Vérifiez la page de statut Microsoft 365 approuvée par l’organisation pour identifier un incident plus large.',ar?'Demande à l’utilisateur de fermer/réouvrir sa session et de tester une fenêtre privée, sans supprimer de données.':'Ask the user to sign out/in and test a private browser window without deleting data.'],
    [common.safe,ar?'إذا كان الأثر لمستخدم واحد، سلّم نتيجة التشخيص إلى مسؤول Microsoft 365 pour contrôle du compte, de la licence ou de MFA.':en?'If only one user is affected, hand the findings to the Microsoft 365 owner to check the account, licence, or MFA.':'Si un seul utilisateur est concerné, transmettez les constats au responsable Microsoft 365 pour contrôler le compte, la licence ou la MFA.'],
    [ar?'يعمل التطبيق من جديد، ولا تظهر رسالة الخطأ، ويؤكد المستخدم وصوله للوظيفة المطلوبة.':en?'The app works again, the error is gone, and the user confirms the required access.':'L’application fonctionne de nouveau, le message d’erreur a disparu et l’utilisateur confirme l’accès requis.'],
    ar?'Microsoft 365 : accès ou messagerie indisponible':'Microsoft 365: access or mail issue'
  );
  if(domain==='citrix')return make(
    ar?'نموذج تشخيص Citrix: حدّد إن كان العطل في الدخول أو تشغيل التطبيق أو داخل الجلسة، من دون تعديل إعدادات الخادم.':en?'Citrix diagnostic template: identify whether the failure is at sign-in, application launch, or inside the session, without changing server settings.':'Modèle de diagnostic Citrix : identifiez si l’échec survient à la connexion, au lancement de l’application ou dans la session, sans modifier les paramètres serveur.',
    ar?['عميل Citrix أو جلسة تالفة','شبكة أو VPN غير متاح','تطبيق منشور أو profil utilisateur indisponible']:en?['Citrix client or session issue','Network or VPN unavailable','Published app or user profile unavailable']:['Client Citrix ou session défaillante','Réseau ou VPN indisponible','Application publiée ou profil utilisateur indisponible'],
    ar?['هل يظهر البوابة وتسجيل الدخول ؟','هل يتأثر مستخدمون آخرون أو تطبيق آخر ؟','ما رمز الخطأ ووقت ظهوره ؟']:en?['Can the user reach the gateway and sign in?','Are other users or another app affected?','What error code and time are shown?']:['L’utilisateur atteint-il le portail et la connexion ?','D’autres utilisateurs ou une autre application sont-ils concernés ?','Quel code d’erreur et à quel moment apparaît-il ?'],
    [common.network,ar?'أغلق جلسة Citrix من الجهاز فقط ثم أعد فتح التطبيق المنشور؛ لا تُنهِ جلسات على الخادم.':en?'Close the Citrix session only on the workstation then reopen the published app; do not terminate server sessions.':'Fermez la session Citrix uniquement sur le poste puis relancez l’application publiée ; ne terminez pas de sessions côté serveur.',common.evidence],
    [common.safe,ar?'صعّد إلى فريق Citrix مع اسم التطبيق والوقت ورمز الخطأ وتأثير المستخدم.':en?'Escalate to the Citrix team with app name, time, error code, and user impact.':'Escaladez vers l’équipe Citrix avec le nom de l’application, l’heure, le code d’erreur et l’impact utilisateur.'],
    [ar?'يفتح التطبيق المطلوب، وتستقر الجلسة، ويمكن للمستخدم إنجاز العملية غير الحساسة المتفق عليها.':en?'The required application opens, the session is stable, and the user can complete the agreed non-sensitive task.':'L’application demandée s’ouvre, la session est stable et l’utilisateur peut réaliser l’opération non sensible convenue.'],
    ar?'Citrix : accès ou application indisponible':'Citrix: access or application unavailable'
  );
  if(domain==='sage1000')return make(
    ar?'نموذج تشخيص Sage 1000: احمِ البيانات comptables; لا تعيد تشغيل خدمات أو عمليات في الإنتاج دون المسؤول المالي وIT.':en?'Sage 1000 diagnostic template: protect accounting data; do not restart production services or jobs without the finance and IT owners.':'Modèle de diagnostic Sage 1000 : protégez les données comptables ; ne redémarrez aucun service ou traitement de production sans le responsable finance et IT.',
    ar?['توقف في التطبيق أو الجلسة','مشكلة شبكة أو جهاز','معالجة مالية أو صيانة en cours']:en?['Application or session issue','Network or workstation issue','Financial process or maintenance in progress']:['Incident applicatif ou de session','Problème de réseau ou de poste','Traitement financier ou maintenance en cours'],
    ar?['ما العملية التي كانت جارية ؟','هل توجد رسالة أو رقم مرجعي ؟','هل المستخدم الوحيد المتأثر ؟']:en?['Which business operation was running?','Is there an error or reference number?','Is this the only affected user?']:['Quelle opération métier était en cours ?','Existe-t-il un message ou un numéro de référence ?','Est-ce le seul utilisateur impacté ?'],
    [common.evidence,common.network,ar?'تحقق مع finance من عدم وجود clôture, export ou traitement critique avant toute reprise.':en?'Confirm with Finance that no close, export, or critical process is running before any retry.':'Confirmez avec la finance qu’aucune clôture, export ou traitement critique n’est en cours avant toute reprise.'],
    [common.safe,ar?'صعّد الطلب إلى مالك Sage et IT avec l’impact et l’heure; لا تحذف cache ou données.':en?'Escalate to the Sage owner and IT with impact and time; do not delete cache or data.':'Escaladez au propriétaire Sage et à l’IT avec l’impact et l’heure ; ne supprimez ni cache ni données.'],
    [ar?'يؤكد مالك التطبيق أن العملية متسقة ويمكن للمستخدم reprendre sans différence comptable.':en?'The application owner confirms the process is consistent and the user can resume with no accounting discrepancy.':'Le propriétaire applicatif confirme que le traitement est cohérent et que l’utilisateur peut reprendre sans écart comptable.'],
    ar?'Sage 1000 : accès ou traitement à vérifier':'Sage 1000: access or process to check'
  );
  if(domain==='pos')return make(
    ar?'نموذج تشخيص POS: احمِ المبيعات والمدفوعات؛ لا تعيد احتساب أو إلغاء عملية دفع من دون موافقة مسؤول POS/المالية.':en?'POS diagnostic template: protect sales and payments; do not reprocess or void a payment without POS/Finance owner approval.':'Modèle de diagnostic POS : protégez les ventes et paiements ; ne repassez ni n’annulez un paiement sans l’accord du responsable POS/finance.',
    ar?['محطة أو طابعة غير متصلة','شبكة محلية أو périphérique','عملية دفع غير مؤكدة']:en?['Terminal or printer disconnected','Local network or peripheral issue','Payment transaction not confirmed']:['Terminal ou imprimante déconnecté','Réseau local ou périphérique','Transaction de paiement non confirmée'],
    ar?['هل تم الخصم بالفعل ؟','ما رقم caisse et heure ?','هل محطات أخرى تعمل ؟']:en?['Was the payment already charged?','What are the till number and time?','Are other terminals working?']:['Le paiement a-t-il déjà été débité ?','Quel est le numéro de caisse et l’heure ?','D’autres terminaux fonctionnent-ils ?'],
    [common.network,common.evidence,ar?'احتفظ بتفاصيل العملية حسب سياسة sécurité et avise le responsable caisse قبل أي nouvelle tentative.':en?'Preserve the transaction details per security policy and notify the till manager before any retry.':'Conservez les détails de transaction selon la politique de sécurité et prévenez le responsable de caisse avant toute nouvelle tentative.'],
    [common.safe,ar?'إذا لم يؤكد POS العملية، استخدم مسار التصعيد المالي المعتمد لتجنب double débit.':en?'If POS does not confirm the transaction, use the approved Finance escalation path to avoid duplicate charging.':'Si le POS ne confirme pas la transaction, utilisez le circuit d’escalade finance approuvé pour éviter un double débit.'],
    [ar?'تأكيد حالة كل عملية من المسؤول المالي، وتشغيل المحطة أو مسار بديل معتمد.':en?'Finance confirms each transaction status and the terminal or approved fallback is operational.':'La finance confirme le statut de chaque transaction et le terminal ou le mode dégradé approuvé fonctionne.'],
    ar?'POS : incident caisse ou paiement':'POS: till or payment incident'
  );
  if(domain==='maintenance')return make(
    ar?'نموذج صيانة: أمّن الأشخاص والمعدات أولاً. لا تفتح جهازاً كهربائياً ولا تتجاوز وسائل الحماية.':en?'Maintenance template: protect people and equipment first. Do not open electrical equipment or bypass safety measures.':'Modèle maintenance : sécurisez d’abord les personnes et l’équipement. N’ouvrez pas un équipement électrique et ne contournez pas les protections.',
    ar?['عطل équipement','طاقة أو اتصال','تآكل أو ضرر مادي']:en?['Equipment fault','Power or connectivity issue','Wear or physical damage']:['Défaillance d’équipement','Alimentation ou connectivité','Usure ou dommage physique'],
    ar?['هل يوجد خطر فوري أو دخان/حرارة/ماء ؟','ما مكان ورقم الجهاز ؟','متى بدأ العطل وهل يعيق الخدمة ؟']:en?['Is there immediate danger, smoke, heat, or water?','What are the location and asset number?','When did it start and does it affect service?']:['Y a-t-il un danger immédiat, fumée, chaleur ou eau ?','Quel est l’emplacement et le numéro d’équipement ?','Depuis quand et quel impact sur le service ?'],
    [ar?'في حال وجود خطر، أبعد المستخدمين واتبع إجراء السلامة/الطوارئ المحلي.':en?'If there is danger, keep users away and follow the local safety/emergency procedure.':'En cas de danger, éloignez les utilisateurs et appliquez la procédure locale de sécurité/urgence.',common.evidence,ar?'تحقق فقط من alimentation, câble visible et indication d’état, sans démontage.':en?'Check only power, visible cabling, and status indicator, without disassembly.':'Contrôlez uniquement l’alimentation, le câblage visible et l’indicateur d’état, sans démontage.'],
    [common.safe,ar?'صعّد إلى الفريق المختص مع الموقع والأثر والصور غير الحساسة إذا سمحت السياسة.':en?'Escalate to the qualified team with location, impact, and non-sensitive photos if policy allows.':'Escaladez vers l’équipe qualifiée avec l’emplacement, l’impact et des photos non sensibles si la politique l’autorise.'],
    [ar?'يؤكد الفني المؤهل سلامة الجهاز وعودته للخدمة.':en?'A qualified technician confirms equipment safety and return to service.':'Un technicien qualifié confirme la sécurité de l’équipement et son retour en service.'],
    ar?'Maintenance : équipement à sécuriser':'Maintenance: equipment to secure','Maintenance'
  );
  const isNetwork=domain==='network'||domain==='general';
  return make(
    ar?(isNetwork?'نموذج تشخيص الشبكة: حدّد نطاق العطل قبل إعادة تشغيل أي جهاز شبكة.':'نموذج دعم IT: اجمع الأعراض بشكل آمن ثم صعّد بالدلائل.'):(en?(isNetwork?'Network diagnostic template: identify the incident scope before rebooting any network device.':'IT support template: collect symptoms safely, then escalate with evidence.'):(isNetwork?'Modèle de diagnostic réseau : déterminez le périmètre de l’incident avant de redémarrer un équipement réseau.':'Modèle de support IT : recueillez les symptômes de manière sûre puis escaladez avec les éléments utiles.')),
    ar?['انقطاع محلي','شبكة Wi-Fi أو câblage','خدمة خارجية أو إعداد جهاز']:en?['Local outage','Wi-Fi or cabling','External service or device setting']:['Incident local','Wi-Fi ou câblage','Service externe ou paramétrage du poste'],
    ar?['أي مواقع أو مستخدمين متأثرين ؟','هل يعمل جهاز أو شبكة أخرى ؟','ما الوقت ورسالة الخطأ ؟']:en?['Which locations or users are affected?','Does another device or network work?','What are the time and exact error?']:['Quels sites ou utilisateurs sont concernés ?','Un autre poste ou réseau fonctionne-t-il ?','Quelle est l’heure et le message exact ?'],
    [common.network,ar?'اختبر خدمة معتمدة من poste concerné et autre poste pour isoler le périmètre.':en?'Test an approved service from the affected workstation and another workstation to isolate the scope.':'Testez un service approuvé depuis le poste concerné puis un autre poste afin d’isoler le périmètre.',common.evidence],
    [common.safe,ar?'صعّد إلى فريق réseau avec périmètre, heure et résultats; لا تعيد تشغيل switch/routeur دون autorisation.':en?'Escalate to the network team with scope, time, and results; do not reboot a switch/router without authorization.':'Escaladez vers l’équipe réseau avec le périmètre, l’heure et les résultats ; ne redémarrez pas un switch/routeur sans autorisation.'],
    [ar?'تعمل الخدمة من الموقع المتأثر ويتم تأكيد الاستقرار من مستخدم واحد على الأقل.':en?'The service works from the affected location and at least one user confirms stability.':'Le service fonctionne depuis le site concerné et au moins un utilisateur confirme la stabilité.'],
    ar?(isNetwork?'Réseau : connectivité indisponible':'Support IT : incident à qualifier'):(isNetwork?'Network: connectivity unavailable':'IT support: incident to qualify')
  );
};
const fallbackAnswer=(domain:string,message:string,language:string)=>{
  const isEn=language==='en', isAr=language==='ar';
  const label=domain==='general'?'IT':domain;
  const operaUser=domain==='opera'&&/(?:ajout|ajouter|cré|cre|add|create|user|utilisateur)/i.test(message);
  if(operaUser){
    if(isAr)return {answer:'إضافة مستخدم إلى OPERA تتطلب أن ينفذها مسؤول مخوّل وفق الإجراء الداخلي المعتمد. لا ترسل كلمة مرور أو بيانات عميل في هذه المحادثة.',causes:['طلب صلاحية جديد أو حساب مستخدم غير متاح'],questions:['ما اسم الفندق أو المنشأة المعنية؟','ما القسم والدور المطلوبان؟','هل توجد موافقة المدير أو مالك التطبيق؟'],checks:['تأكد من وجود موافقة موثقة وحدد أقل صلاحيات لازمة للدور.','تحقق من أن الحساب ليس موجوداً مسبقاً أو معطلاً قبل إنشاء حساب جديد.','اطلب من المسؤول المخوّل إنشاء الحساب من واجهة OPERA المعتمدة، من دون مشاركة كلمة المرور.'],solution:['اربط الدور بالمنشأة والقسم المحددين فقط. أرسل دعوة أو بيانات الوصول عبر القناة المعتمدة في مؤسستك، ثم اطلب من المستخدم تغيير كلمة المرور عند أول اتصال إذا كانت سياستكم تفرض ذلك.'],validation:['يتصل المستخدم بنجاح ويصل فقط إلى الوظائف والمنشأة المصرح بها.','دوّن اسم المنفذ ووقت الإنشاء والدور في سجل التذكرة.'],assumptions:['هذه خطة آمنة عامة وليست إجراء OPERA داخلياً معتمداً؛ يجب أن ينفذها مسؤول OPERA مخوّل.'],suggested_ticket:{title:'OPERA : création d’un utilisateur',description:`Demande : ${message}\n\nÀ confirmer : hôtel, département, rôle, périmètre et approbation du responsable.`,category:'IT / Réseau',priority:'Normale'}};
    if(isEn)return {answer:'Adding an OPERA user must be performed by an authorized administrator under the approved internal process. Do not share a password or customer data in this conversation.',causes:['A new access request or an unavailable user account'],questions:['Which hotel or property is concerned?','What department and role are required?','Is manager or application-owner approval available?'],checks:['Confirm documented approval and define the least-privilege role needed.','Check that the account does not already exist or is not disabled before creating a new one.','Have an authorized administrator create the account using the approved OPERA interface, without sharing a password.'],solution:['Restrict the role to the requested property and department. Send the invitation or access details only through your organization’s approved channel, then require a password change at first sign-in if your policy requires it.'],validation:['The user signs in successfully and can access only the authorized property and functions.','Record the operator, creation time, and role in the ticket history.'],assumptions:['This is safe general guidance, not an approved internal OPERA procedure; an authorized OPERA administrator must perform it.'],suggested_ticket:{title:'OPERA: create a user',description:`Request: ${message}\n\nTo confirm: hotel, department, role, scope, and manager approval.`,category:'IT / Réseau',priority:'Normale'}};
    return {answer:'La création d’un utilisateur OPERA doit être réalisée par un administrateur habilité, selon la procédure interne approuvée. Ne communiquez jamais de mot de passe ni de donnée client dans cette conversation.',causes:['Nouvelle demande d’accès ou compte utilisateur indisponible'],questions:['Quel hôtel ou établissement est concerné ?','Quel département et quel rôle sont nécessaires ?','L’accord du responsable ou du propriétaire de l’application est-il disponible ?'],checks:['Vérifiez l’accord documenté et définissez le rôle avec le minimum de droits nécessaire.','Vérifiez que le compte n’existe pas déjà ou n’est pas désactivé avant toute création.','Demandez à un administrateur habilité de créer le compte depuis l’interface OPERA approuvée, sans partager de mot de passe.'],solution:['Limitez le rôle à l’hôtel et au département demandés. Envoyez l’invitation ou les accès uniquement via le canal approuvé par votre organisation, puis imposez un changement de mot de passe à la première connexion si votre politique le prévoit.'],validation:['L’utilisateur se connecte et accède uniquement aux fonctions et à l’établissement autorisés.','Consignez l’opérateur, la date de création et le rôle dans l’historique du ticket.'],assumptions:['Il s’agit de conseils généraux sûrs, pas d’une procédure OPERA interne validée ; un administrateur OPERA habilité doit effectuer l’action.'],suggested_ticket:{title:'OPERA : création d’un utilisateur',description:`Demande : ${message}\n\nÀ confirmer : hôtel, département, rôle, périmètre et approbation du responsable.`,category:'IT / Réseau',priority:'Normale'}};
  }
  if(isAr)return {answer:`وضع المساعدة المؤقت: يتعذر الوصول إلى خدمة الذكاء الاصطناعي حالياً. سنبدأ بتشخيص آمن لمشكلة ${label}.`,causes:['انقطاع الخدمة أو المشكلة غير محددة بما يكفي'],questions:['ما الرسالة الظاهرة بالضبط؟','منذ متى بدأت المشكلة؟','هل يتأثر مستخدم واحد أم عدة مستخدمين؟'],checks:['تحقق من اتصال الشبكة ومن وقت الجهاز — يجب أن يكونا صحيحين — دوّن النتيجة.','تحقق من وجود رسالة خطأ أو رقم مرجعي — يجب عدم مشاركة كلمات المرور أو البيانات الحساسة — أرفقه في الوصف.'],solution:['لا تغيّر إعدادات الإنتاج أو الحسابات تلقائياً. اجمع النتائج وأنشئ تذكرة إذا استمرت المشكلة.'],validation:['تأكد من عودة الخدمة للمستخدم المتأثر بعد إجراء التحقق المصرح به.'],assumptions:['هذه إرشادات مؤقتة وليست إجراءً داخلياً معتمداً. تتطلب أي خطوة مؤثرة مراجعة بشرية.'],suggested_ticket:{title:`${label}: ${message.slice(0,100)}`,description:`Demande initiale : ${message}\n\nVérifications proposées : connexion réseau, heure du poste, message d’erreur exact.`,category:'IT / Réseau',priority:'Normale'}};
  if(isEn)return {answer:`Temporary guidance mode: the AI provider is currently unavailable. We can still start a safe diagnosis for ${label}.`,causes:['Service interruption or insufficient incident details'],questions:['What exact error message is displayed?','When did the problem begin?','Does it affect one user or several users?'],checks:['Check network connectivity and device time — both should be correct — record the result.','Check for an error message or reference number — never include passwords or sensitive customer data — add it to the description.'],solution:['Do not change production settings or accounts automatically. Record the findings and create a ticket if the issue continues.'],validation:['Confirm the affected user can use the service again after an authorized check.'],assumptions:['This is temporary guidance, not an approved internal procedure. Human review is required for any impactful step.'],suggested_ticket:{title:`${label}: ${message.slice(0,100)}`,description:`Initial request: ${message}\n\nSuggested checks: network connectivity, workstation time, exact error message.`,category:'IT / Réseau',priority:'Normale'}};
  return {answer:`Mode d’accompagnement temporaire : le fournisseur IA est indisponible. Nous pouvons tout de même démarrer un diagnostic sûr pour ${label}.`,causes:['Indisponibilité du service ou informations insuffisantes'],questions:['Quel message d’erreur s’affiche exactement ?','Depuis quand le problème a-t-il commencé ?','Le problème concerne-t-il un utilisateur ou plusieurs ?'],checks:['Vérifiez la connexion réseau et l’heure du poste — elles doivent être correctes — notez le résultat.','Relevez le message d’erreur ou sa référence — ne transmettez jamais de mot de passe ni donnée client — ajoutez-le à la description.'],solution:['Ne modifiez pas automatiquement un compte ou un paramètre de production. Consignez les résultats et créez un ticket si le problème persiste.'],validation:["Vérifiez que le service refonctionne pour l’utilisateur concerné après une vérification autorisée."],assumptions:["Ces conseils temporaires ne constituent pas une procédure interne validée. Toute action à impact nécessite une validation humaine."],suggested_ticket:{title:`${label} : ${message.slice(0,100)}`,description:`Demande initiale : ${message}\n\nVérifications proposées : connexion réseau, heure du poste, message d’erreur exact.`,category:'IT / Réseau',priority:'Normale'}};
};

function parseAnswer(raw:string){
  try { const parsed=JSON.parse(raw.replace(/```json|```/g,'').trim()); return {
    answer:clean(parsed.answer,4000), causes:toText(parsed.causes), questions:toText(parsed.questions), checks:toText(parsed.checks), solution:toText(parsed.solution), validation:toText(parsed.validation), assumptions:toText(parsed.assumptions),
    suggested_ticket:{title:clean(parsed.suggested_ticket?.title,180),description:clean(parsed.suggested_ticket?.description,5000),category:clean(parsed.suggested_ticket?.category,80),priority:priority(parsed.suggested_ticket?.priority)}
  }; } catch { return {answer:clean(raw,4000),questions:[],checks:[],solution:[],validation:[],assumptions:['Réponse non structurée : validation humaine requise.'],suggested_ticket:{title:'',description:'',category:'IT / Réseau'}}; }
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:headers(req)});
  if(req.method!=='POST')return send(req,{error:'Méthode non autorisée.'},405);
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim();
  if(!token||!URL||!ANON)return send(req,{error:'Session utilisateur requise.'},401);
  const userClient=createClient(URL,ANON,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user}}=await userClient.auth.getUser(token);
  if(!user)return send(req,{error:'Session expirée ou invalide.'},401);
  // The procedure guide remains available even when no external AI key exists.
  if(!SERVICE)return send(req,{error:'Le service Assistant IT n’est pas configuré côté serveur.'},503);
  let input:any;try{input=await req.json();}catch{return send(req,{error:'Données invalides.'},400);}
  const action=input.action==='ticket'?'ticket':'chat';
  const domain=domains.has(input.domain)?input.domain:'general';
  const language=['fr','en','ar'].includes(input.language)?input.language:'fr';
  const service=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  let ticket:any=null;
  if(action==='ticket'){
    const ticketId=String(input.ticket_id??'');
    const {data,error}=await userClient.from('tickets').select('id,numero,titre,description,categorie,priorite,statut,hotel,assigne_a,created_at').eq('id',ticketId).maybeSingle();
    if(error||!data)return send(req,{error:'Ticket introuvable ou accès non autorisé.'},403);
    ticket=data;
  }
  let conversation:any=null;
  const message=clean(input.message,6000);
  if(action==='chat'){
    if(!message)return send(req,{error:'Décrivez votre problème avant de lancer l’assistant.'},400);
    const conversationId=String(input.conversation_id??'');
    if(conversationId){
      const {data,error}=await service.from('it_ai_conversations').select('*').eq('id',conversationId).eq('user_id',user.id).maybeSingle();
      if(error||!data)return send(req,{error:'Conversation introuvable ou accès non autorisé.'},403); conversation=data;
    }else{
      const {data,error}=await service.from('it_ai_conversations').insert({user_id:user.id,domain,title:message.slice(0,120)}).select().single();
      if(error)return send(req,{error:'Impossible de créer la conversation.'},500); conversation=data;
    }
  }
  const hotel=ticket?.hotel??null;
  const {data:allProcedures}=await service.from('it_procedures').select('id,title,domain,content,source_label,source_url,effective_date,hotel').eq('is_validated',true).in('domain',[domain,'general']).order('effective_date',{ascending:false}).limit(12);
  const procedures=(allProcedures??[]).filter(p=>p.hotel===null||p.hotel===hotel).slice(0,4);
  const procedureContext=procedures.map(p=>`[${p.id}] ${p.title} | ${p.source_label} | ${p.effective_date}\n${p.content}`).join('\n\n');
  let history:any[]=[];
  if(conversation){const {data}=await service.from('it_ai_messages').select('author,content').eq('conversation_id',conversation.id).order('created_at',{ascending:false}).limit(10);history=(data??[]).reverse();}
  const words=clean(ticket?.titre??message,120).split(/\s+/).filter(word=>word.length>=4).slice(0,3);
  let similarTickets:any[]=[];
  if(words.length){
    const term=words[0].replace(/[%_]/g,'');
    if(term){
      const query=userClient.from('tickets').select('id,numero,titre,description,categorie,statut,created_at').ilike('titre',`%${term}%`).order('created_at',{ascending:false}).limit(3);
      if(ticket)query.neq('id',ticket.id);
      const {data}=await query;similarTickets=(data??[]).map(item=>({...item,description:clean(item.description,700)}));
    }
  }
  // A provider-free guide is intentionally the first response for a chat.
  // It gives repeatable, safe steps and prevents an upstream outage from
  // replacing useful guidance with a vague generic fallback.
  if(action==='chat'){
    const answer=procedureGuide(domain,message,language);
    const sources=[{id:'onomo-initial-guide',title:language==='ar'?'نموذج تشخيص ONOMO':'Modèle de diagnostic ONOMO',source:language==='ar'?'مسودة للمراجعة من IT':'Brouillon à valider par l’IT',date:new Date().toISOString().slice(0,10),url:null,status:'review'}];
    await service.from('it_ai_messages').insert([
      {conversation_id:conversation.id,author:'user',content:message,metadata:{}},
      {conversation_id:conversation.id,author:'assistant',content:answer.answer,metadata:{...answer,sources}}
    ]);
    await service.from('it_ai_conversations').update({updated_at:new Date().toISOString()}).eq('id',conversation.id);
    return send(req,{conversation_id:conversation.id,answer,sources,similar_tickets:similarTickets,provider:'procedure-guide'});
  }
  if(action==='ticket'){
    const ticketDomain=ticket.categorie==='Maintenance'?'maintenance':domain;
    const answer=procedureGuide(ticketDomain,`${ticket.titre}\n${ticket.description??''}`,language);
    const sources=[{id:'onomo-initial-guide',title:language==='ar'?'نموذج تشخيص ONOMO':'Modèle de diagnostic ONOMO',source:language==='ar'?'مسودة للمراجعة من IT':'Brouillon à valider par l’IT',date:new Date().toISOString().slice(0,10),url:null,status:'review'}];
    return send(req,{ticket_id:ticket.id,answer,sources,similar_tickets:similarTickets,provider:'procedure-guide'});
  }
  const context=action==='ticket'?`Ticket ${ticket.numero}: ${ticket.titre}\nDescription: ${clean(ticket.description,5000)}\nCatégorie: ${ticket.categorie}; priorité: ${ticket.priorite}; statut: ${ticket.statut}; hôtel: ${ticket.hotel}`:`Domaine: ${domain}\nConversation précédente:\n${history.map(item=>`${item.author}: ${item.content}`).join('\n')}\nNouvelle demande: ${message}`;
  const prompt=`Tu es l’assistant IT interne d’un groupe hôtelier. Réponds en ${language==='ar'?'arabe':language==='en'?'anglais':'français'}.
Tu conseilles seulement : ne demande jamais ni n’affiche mots de passe, clés, jetons, données clients ou données de carte bancaire. N’affirme jamais qu’une procédure non citée est validée. Si les informations sont insuffisantes, pose au maximum trois questions ciblées à la fois. Pour Sage 1000, Citrix, OPERA PMS, POS, Microsoft 365 et réseau, ne fabrique jamais de commandes, paramètres ou procédures propres au client. Privilégie l’interface graphique. Si une commande est utile, précise son objectif, le résultat attendu et l’action suivante. Pour Sage, OPERA, POS et opérations de production, rappelle le risque, la sauvegarde et la validation humaine avant une action à impact. Ne propose jamais une action destructive ni un changement automatique.
Procédures internes validées (elles seules peuvent être décrites comme validées) :\n${procedureContext||'Aucune procédure validée applicable.'}\n\nIncidents similaires visibles pour cet utilisateur :\n${similarTickets.map(item=>`${item.numero} | ${item.titre} | ${item.categorie} | ${item.statut}\n${item.description}`).join('\n')||'Aucun incident similaire exploitable.'}\n\nContexte :\n${context}\n\nRéponds uniquement avec JSON : {"answer":"résumé du problème","causes":["causes probables"],"questions":["..."],"checks":["Vérification — résultat attendu — action suivante"],"solution":["..."],"validation":["..."],"assumptions":["..."],"suggested_ticket":{"title":"...","description":"résumé, diagnostic et vérifications déjà réalisées","category":"catégorie existante la plus proche","priority":"P1/P2/P3/P4 ou Urgente/Haute/Normale/Basse"}}.`;
  try{
    const providerName=GEMINI_KEY?'gemini':OPENAI_KEY?'openai':'anthropic';
    let response=GEMINI_KEY
      ?await requestProvider(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_KEY},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:1200}})})
      :OPENAI_KEY
      ?await requestProvider('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${OPENAI_KEY}`},body:JSON.stringify({model:'gpt-4o-mini',max_tokens:1200,response_format:{type:'json_object'},messages:[{role:'system',content:'Tu réponds uniquement avec un objet JSON valide.'},{role:'user',content:prompt}]})})
      :await requestProvider('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY!,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,messages:[{role:'user',content:prompt}]})});
    // Gemini can return 503 during high demand. Flash-Lite is also available
    // on the free tier, so use it as a no-cost failover before the safe UI
    // fallback is shown to the user.
    if(GEMINI_KEY&&!response.ok&&response.status===503&&GEMINI_MODEL!=='gemini-3.5-flash-lite'){
      response=await requestProvider('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_KEY},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:1200}})});
    }
    const providerUnavailable=!response.ok;
    const providerError=providerUnavailable?await response.text():'';
    if(providerUnavailable)console.error('AI provider',response.status,providerError.slice(0,500));
    const provider=providerUnavailable?null:await response.json();
    const providerText=providerName==='gemini'
      ?provider?.candidates?.[0]?.content?.parts?.map((part:any)=>part?.text ?? '').join('')
      :providerName==='openai' ? provider?.choices?.[0]?.message?.content : (provider?.content?.[0]?.text ?? '');
    const answer=providerUnavailable?fallbackAnswer(domain,message,language):parseAnswer(String(providerText));
    const sources=(procedures??[]).map(p=>({id:p.id,title:p.title,source:p.source_label,date:p.effective_date,url:p.source_url}));
    if(conversation){
      await service.from('it_ai_messages').insert([{conversation_id:conversation.id,author:'user',content:message,metadata:{}},{conversation_id:conversation.id,author:'assistant',content:answer.answer,metadata:{...answer,sources}}]);
      await service.from('it_ai_conversations').update({updated_at:new Date().toISOString()}).eq('id',conversation.id);
      return send(req,{conversation_id:conversation.id,answer,sources,similar_tickets:similarTickets});
    }
    return send(req,{ticket_id:ticket.id,answer,sources,similar_tickets:similarTickets});
  }catch(error){console.error('ai-it-assistant',error);const answer=fallbackAnswer(domain,message,language);const sources=[];if(conversation){await service.from('it_ai_messages').insert([{conversation_id:conversation.id,author:'user',content:message,metadata:{}},{conversation_id:conversation.id,author:'assistant',content:answer.answer,metadata:{...answer,sources,fallback:true}}]);return send(req,{conversation_id:conversation.id,answer,sources,similar_tickets:similarTickets});}return send(req,{ticket_id:ticket?.id,answer,sources,similar_tickets:similarTickets});}
});
