// Supplemental pattern scan of CURRENT tracked text, not a full-history audit.
// Never print the matching secret, only path and pattern name.
const fs=require('node:fs');const {execFileSync}=require('node:child_process');
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['github-token',/\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,})\b/],['aws-access-key',/\bAKIA[A-Z0-9]{16}\b/]];
let failures=0,scanned=0;
for(const file of files){if(!/\.(?:js|cjs|mjs|ts|html|json|ya?ml|toml|sql|md|env)$/.test(file))continue;const content=fs.readFileSync(file,'utf8');scanned++;
 for(const [label,pattern] of patterns)if(pattern.test(content)){console.error(file+': '+label+' candidate (value suppressed)');failures++;}
 for(const jwt of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\b/g)){try{if(JSON.parse(Buffer.from(jwt[1],'base64url')).role==='service_role'){console.error(file+': service-role JWT candidate (value suppressed)');failures++;}}catch(_){} }
}
console.log('Tracked text scan: '+scanned+' files; '+failures+' candidates. Not a guarantee of no secrets.');if(failures)process.exit(1);
