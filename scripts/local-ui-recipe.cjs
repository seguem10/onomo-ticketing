// UI-only isolation harness. No proxy, credentials, or production API access.
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function sanitize(source){
 return source.replace(/https:\/\/[a-z0-9-]+\.supabase\.co/gi,'http://127.0.0.1:65439')
  .replace(/sb_publishable_[A-Za-z0-9_-]+/g,'local-recipe-no-credentials');
}
const csp="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
function handler(req,res){
 res.setHeader('Content-Security-Policy',csp);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
 let relative;try{relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'index.html';}catch(_){res.writeHead(400);return res.end();}
 // Explicit allowlist: never serve Git metadata, env, migrations or reports.
 if(!(relative==='index.html'||relative==='manifest.webmanifest'||/^assets\/[a-zA-Z0-9_./-]+$/.test(relative))||relative.split('/').includes('..')){res.writeHead(404);return res.end();}
 const target=path.resolve(root,relative);if(!target.startsWith(root+path.sep)){res.writeHead(404);return res.end();}
 try{
  const bytes=fs.readFileSync(target);const ext=path.extname(target);
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2'};
  res.setHeader('Content-Type',types[ext]||'application/octet-stream');
  const body=['.html','.js','.css','.json','.webmanifest'].includes(ext)?sanitize(bytes.toString('utf8')):bytes;
  res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
 }catch(_){res.writeHead(404);res.end();}
}
if(require.main===module){http.createServer(handler).listen(8127,'127.0.0.1',()=>console.log('UI-only recipe: http://127.0.0.1:8127 — APIs and service workers blocked'));}
module.exports={sanitize,handler,csp};
