/* Problem search engine shared by the knowledge base page, the suggestions
   of the new ticket form and the IT assistant.
   - Text is compared without accents or case; "Wi-Fi", "wi fi" and "wifi"
     meet.
   - Words are reduced to a simple root, so "imprimer", "imprime" and
     "imprimante" meet, as do "connect", "connexion" and "connecting".
   - Synonyms used by hotel staff are expanded ("mail" → messagerie,
     outlook; "mdp" → mot de passe; "figé" → bloqué, plante, freeze…), in
     French and English.
   - Small typos are tolerated on longer words ("imprimente", "outlok").
   - An article answering more words of the question ranks higher; a
     title match counts more than a body match. */
(function(root){
 'use strict';
 const STOP=new Set(('les des une est pas sur dans pour avec que qui mon mes plus par aux ces cet cette son ses leur nous vous ils elles mais tout tous tres '
  +'bonjour merci svp stp aide besoin probleme problemes souci soucis marche fonctionne fonctionner veut peut faire avoir etre suis ont sont '
  +'the and not for with that this from have has are was were you your our can cant cannot does doesnt dont please help issue problem work working '
  +'mon ma je il elle de du la le un et ou en au ne se sa ce on').split(/\s+/));
 // Synonym groups: any word of a group finds the others.
 const GROUPS=[
  'mail email courriel messagerie outlook boite inbox',
  'mdp motdepasse password passe identifiant login connexion connecter signin',
  'imprimante printer impression imprimer print copieur photocopieur',
  'scanner scan numeriser numerisation',
  'wifi internet reseau network connexion sansfil wireless',
  'lent lenteur slow ralenti rame lag',
  'bloque fige plante freeze crash gele bug coince stuck frozen',
  'ordinateur ordi pc poste computer laptop portable',
  'ecran moniteur screen display noir black',
  'carte badge cle key keycard serrure lock vingcard encodeur',
  'caisse pos micros simphony tpe till',
  'telephone phone poste tonalite combine standard pabx',
  'tv tele television chaine channel',
  'teams reunion meeting visio appel call camera micro microphone son audio',
  'mfa authentificateur authenticator double verification code',
  'phishing hameconnage arnaque suspect spam frauduleux fraude',
  'vpn distance remote teletravail',
  'onedrive sharepoint synchronisation sync fichier file',
  'opera pms ohip fidelio reservation folio checkin checkout',
  'virus usb cle malware',
  'mise update maj windows redemarrage restart',
  'client guest hote voyageur',
  'sage comptabilite compta ecriture comptable',
  'citrix workspace session',
  'tpe terminal paiement cb',
  'cloture nightaudit audit endofday eod',
  'onduleur ups bip batterie',
  'partager partage share lien'
 ].map(g=>g.split(/\s+/));
 const normalize=value=>String(value??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/([a-z0-9])-(?=[a-z0-9])/g,'$1').replace(/\bwi fi\b/g,'wifi').replace(/\bmot de passe\b/g,'motdepasse').replace(/\bsans fil\b/g,'sansfil')
  .replace(/\b(e mail|e-mail)\b/g,'email').replace(/\bcheck (in|out)\b/g,'check$1').replace(/\bnight audit\b/g,'nightaudit').replace(/\bend of day\b/g,'endofday');
 // Light stemming for French and English.
 const SUFFIXES=['issements','issement','ements','ement','ations','ation','ateurs','ateur','atrice','antes','ante','ants','ant','ances','ance','ences','ence','ings','ing','ions','ion','euses','euse','eurs','eur','ables','able','ites','ite','ives','ive','ies','ers','er','ez','es','ed','ee','e','s'];
 function stem(word){
  let w=word;
  for(const s of SUFFIXES){if(w.length-s.length>=4&&w.endsWith(s)){w=w.slice(0,-s.length);break;}}
  return w;
 }
 const tokens=value=>normalize(value).split(/[^a-z0-9]+/).filter(w=>w.length>=2&&!STOP.has(w));
 const SYNONYMS=new Map();
 for(const group of GROUPS){const stems=group.map(stem);for(const s of stems){const set=SYNONYMS.get(s)||new Set();stems.forEach(x=>x!==s&&set.add(x));SYNONYMS.set(s,set);}}
 // Edit distance, stopped early: only distances 0 or 1 matter.
 function close(a,b){
  if(a===b)return true;
  // Numbers (ticket numbers, models, serials) must match exactly.
  if(/\d/.test(a)||/\d/.test(b))return false;
  if(Math.abs(a.length-b.length)>1||Math.min(a.length,b.length)<5)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){
   if(a[i]===b[j]){i++;j++;continue;}
   if(++edits>1)return false;
   if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}
  }
  return edits+(a.length-i)+(b.length-j)<=1;
 }
 // Query → terms; each term carries its alternatives (root, synonyms).
 function parse(query){
  const seen=new Set(),terms=[];
  for(const word of tokens(query)){
   const root=stem(word);if(root.length<2||seen.has(root))continue;seen.add(root);
   terms.push({word,root,alternatives:[root,...(SYNONYMS.get(root)||[])]});
  }
  return terms;
 }
 function index(text){
  const words=tokens(text).map(stem);
  return {words:new Set(words),joined:` ${words.join(' ')} `};
 }
 // Score of one text for one term: exact root 3, synonym 2, prefix 2, typo 1.
 function termScore(term,doc){
  if(doc.words.has(term.root))return 3;
  for(const alt of term.alternatives.slice(1))if(doc.words.has(alt))return 2;
  if(term.root.length>=4&&doc.joined.includes(` ${term.root}`))return 2;
  // A longer root of the text that starts the typed word ("imprim" in "imprimente").
  for(const w of doc.words)if(w.length>=5&&term.word.startsWith(w))return 2;
  for(const w of doc.words)if(close(term.root,w))return 1;
  return 0;
 }
 /* items: array; fields(item) → {title, body} (strings, any language).
    Returns the matching items, best first. An empty query returns all. */
 function rank(query,items,fields,{limit}={}){
  const terms=parse(query);
  const list=Array.isArray(items)?items:[];
  if(!terms.length)return limit?list.slice(0,limit):list.slice();
  const phrase=normalize(query).trim();
  const scored=[];
  for(const item of list){
   const f=fields(item)||{};
   const title=index(f.title),body=index(f.body);
   let score=0,matched=0;
   // A short title that matches is more general than a long, specific one
   // ("L'imprimante n'imprime plus" before "Sage 1000 : imprimer un état").
   const titleWords=Math.max(1,title.words.size);
   for(const term of terms){
    const t=termScore(term,title),b=termScore(term,body);
    if(t||b)matched++;
    score+=t*3+b+(t?6/titleWords:0);
   }
   if(!matched)continue;
   // Coverage: answering most of the question matters more than repeating one word.
   score*=0.5+matched/terms.length;
   if(phrase.length>=6&&normalize(f.title).includes(phrase))score+=6;
   scored.push({item,score,matched});
  }
  scored.sort((a,b)=>b.score-a.score);
  // With several words, keep only results that answer a fair share of them.
  const best=scored[0]?.matched||0;
  const kept=terms.length>=3?scored.filter(s=>s.matched>=Math.max(1,Math.ceil(best/2))):scored;
  const out=kept.map(s=>s.item);
  return limit?out.slice(0,limit):out;
 }
 // Highlights, in already-escaped HTML, the words of the text that match the query.
 function highlight(escapedText,query){
  const terms=parse(query);if(!terms.length)return escapedText;
  return String(escapedText).replace(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:-[A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g,word=>{
   const root=stem(normalize(word).replace(/-/g,''));
   if(root.length<2||STOP.has(normalize(word)))return word;
   return terms.some(t=>t.alternatives.includes(root)||(t.root.length>=4&&root.startsWith(t.root))||close(t.root,root))?`<mark>${word}</mark>`:word;
  });
 }
 // Does a text (a ticket's title, description…) answer the query? At least
 // half of the query's words must be found, with roots, synonyms and typos.
 function matches(query,text){
  const terms=parse(query);if(!terms.length)return false;
  const doc=index(text);
  const hit=terms.filter(term=>termScore(term,doc)>0).length;
  return hit>=Math.max(1,Math.ceil(terms.length/2));
 }
 root.ProblemSearch={rank,matches,highlight,parse,normalize,stem,_close:close};
})(typeof window!=='undefined'?window:globalThis);
