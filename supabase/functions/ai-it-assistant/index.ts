// ONOMO Support IT — secure, advisory IT assistant.
// Required secrets: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const AI_KEY=Deno.env.get("ANTHROPIC_API_KEY");
const domains=new Set(['microsoft365','sage1000','citrix','opera','pos','network','maintenance','general']);
const allowedOrigin=(origin:string)=>origin==='https://onomo-ticketing.vercel.app'||/^https:\/\/onomo-ticketing(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
const headers=(req:Request)=>({"Access-Control-Allow-Origin":allowedOrigin(req.headers.get('origin')??'')?req.headers.get('origin')??'':"https://onomo-ticketing.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS",Vary:"Origin","Content-Type":"application/json"});
const send=(req:Request,body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:headers(req)});
const clean=(value:unknown,max=6000)=>String(value??'').replace(/\b(?:password|mot de passe|token|api[_ -]?key|secret)\s*[:=]\s*\S+/gi,'[REDACTED]').replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,})\b/g,'[REDACTED]').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[REDACTED_EMAIL]').replace(/\b(?:\d[ -]*?){13,19}\b/g,'[REDACTED_PAYMENT]').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const toText=(items:unknown)=>Array.isArray(items)?items.map(item=>clean(item,900)).filter(Boolean).slice(0,8):[];
const priority=(value:unknown)=>{const key=String(value??'').toLowerCase();if(/crit|urgent|p1/.test(key))return 'Urgente';if(/haut|high|p2/.test(key))return 'Haute';if(/bas|low|p4/.test(key))return 'Basse';return 'Normale';};

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
  if(!AI_KEY||!SERVICE)return send(req,{error:'Le service Assistant IT n’est pas configuré côté serveur.'},503);
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
  const context=action==='ticket'?`Ticket ${ticket.numero}: ${ticket.titre}\nDescription: ${clean(ticket.description,5000)}\nCatégorie: ${ticket.categorie}; priorité: ${ticket.priorite}; statut: ${ticket.statut}; hôtel: ${ticket.hotel}`:`Domaine: ${domain}\nConversation précédente:\n${history.map(item=>`${item.author}: ${item.content}`).join('\n')}\nNouvelle demande: ${message}`;
  const prompt=`Tu es l’assistant IT interne d’un groupe hôtelier. Réponds en ${language==='ar'?'arabe':language==='en'?'anglais':'français'}.
Tu conseilles seulement : ne demande jamais ni n’affiche mots de passe, clés, jetons, données clients ou données de carte bancaire. N’affirme jamais qu’une procédure non citée est validée. Si les informations sont insuffisantes, pose au maximum trois questions ciblées à la fois. Pour Sage 1000, Citrix, OPERA PMS, POS, Microsoft 365 et réseau, ne fabrique jamais de commandes, paramètres ou procédures propres au client. Privilégie l’interface graphique. Si une commande est utile, précise son objectif, le résultat attendu et l’action suivante. Pour Sage, OPERA, POS et opérations de production, rappelle le risque, la sauvegarde et la validation humaine avant une action à impact. Ne propose jamais une action destructive ni un changement automatique.
Procédures internes validées (elles seules peuvent être décrites comme validées) :\n${procedureContext||'Aucune procédure validée applicable.'}\n\nIncidents similaires visibles pour cet utilisateur :\n${similarTickets.map(item=>`${item.numero} | ${item.titre} | ${item.categorie} | ${item.statut}\n${item.description}`).join('\n')||'Aucun incident similaire exploitable.'}\n\nContexte :\n${context}\n\nRéponds uniquement avec JSON : {"answer":"résumé du problème","causes":["causes probables"],"questions":["..."],"checks":["Vérification — résultat attendu — action suivante"],"solution":["..."],"validation":["..."],"assumptions":["..."],"suggested_ticket":{"title":"...","description":"résumé, diagnostic et vérifications déjà réalisées","category":"catégorie existante la plus proche","priority":"P1/P2/P3/P4 ou Urgente/Haute/Normale/Basse"}}.`;
  try{
    const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':AI_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,messages:[{role:'user',content:prompt}]})});
    if(!response.ok){console.error('AI provider',response.status);return send(req,{error:'Le service Assistant IT est temporairement indisponible.'},502);}
    const provider=await response.json(); const answer=parseAnswer(String(provider?.content?.[0]?.text??''));
    const sources=(procedures??[]).map(p=>({id:p.id,title:p.title,source:p.source_label,date:p.effective_date,url:p.source_url}));
    if(conversation){
      await service.from('it_ai_messages').insert([{conversation_id:conversation.id,author:'user',content:message},{conversation_id:conversation.id,author:'assistant',content:answer.answer,metadata:{...answer,sources}}]);
      await service.from('it_ai_conversations').update({updated_at:new Date().toISOString()}).eq('id',conversation.id);
      return send(req,{conversation_id:conversation.id,answer,sources,similar_tickets:similarTickets});
    }
    return send(req,{ticket_id:ticket.id,answer,sources,similar_tickets:similarTickets});
  }catch(error){console.error('ai-it-assistant',error);return send(req,{error:'Le service Assistant IT est temporairement indisponible.'},502);}
});
