/* Extensions Onomo Support IT : rôles, accès restreint. */
(function(){
  'use strict';
  /* Voice recognition is intentionally disabled. The application must not start
     SpeechRecognition / webkitSpeechRecognition automatically or expose a
     dictation control. */
  const blocked=()=>{try{document.getElementById('voiceDictationBtn')?.remove();document.getElementById('voiceStatus')?.remove();}catch(_) {}};
  document.addEventListener('DOMContentLoaded',blocked);
  const observer=new MutationObserver(blocked);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
