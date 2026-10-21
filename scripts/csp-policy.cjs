// Deterministic CSP for the static frontend. HTML parsers normalize CRLF to LF.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const supabaseScript = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
function scriptSources(html) {
  const normalized = html.replace(/\r\n?/g, '\n');
  const hashes = [];
  // Match complete scripts before looking for the next HTML comment. Comments
  // inside JavaScript template strings are part of the hash, not HTML comments.
  for (const match of normalized.matchAll(/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (match[1] === undefined) continue;
    const attrs = match[1];
    if (/\bsrc\s*=/i.test(attrs)) {
      const source = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!source) throw new Error('Unsupported script source syntax');
      if (/^(?:https?:)?\/\//i.test(source) && source !== supabaseScript) throw new Error('Unreviewed external script source');
      continue;
    }
    if (/\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(attrs)) continue;
    hashes.push("'sha256-" + crypto.createHash('sha256').update(match[2]).digest('base64') + "'");
  }
  if (!hashes.length) throw new Error('Expected inline application script missing');
  return ["'self'", supabaseScript, ...new Set(hashes)].join(' ');
}
function harden(policy, html) {
  const directives = policy.split(';').map(x => x.trim()).filter(Boolean)
    .filter(x => !/^script-src(?:-elem|-attr)?\s/.test(x));
  directives.push('script-src ' + scriptSources(html));
  // Transitional exception: legacy static and dynamically rendered handlers.
  // Do not describe this phase as a strict CSP or complete XSS protection.
  directives.push("script-src-attr 'unsafe-inline'");
  return directives.join('; ');
}
if (require.main === module) {
  const file = path.join(root, 'vercel.json');
  const originalText = fs.readFileSync(file, 'utf8');
  const config = JSON.parse(originalText);
  const header = config.headers.find(x => x.source === '/(.*)').headers.find(x => x.key === 'Content-Security-Policy');
  const expected = harden(header.value, fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  if (process.argv.includes('--write')) {
    fs.writeFileSync(file, originalText.replace(JSON.stringify(header.value), JSON.stringify(expected)));
    console.log('Updated CSP hash and reviewed script source.');
  } else if (header.value !== expected) {
    console.error('CSP differs from application script. Run node scripts/csp-policy.cjs --write and review the diff.');
    process.exitCode = 1;
  } else console.log('PASS CSP matches application script.');
}
module.exports = {scriptSources, harden, supabaseScript};
