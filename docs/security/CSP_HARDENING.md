# CSP hardening: first stage

The inline application script is authorized by a SHA-256 content hash rather than a blanket script-src unsafe-inline allowance. External scripts are limited to same-origin assets and the exact reviewed Supabase 2.117.2 UMD URL, which also has an integrity attribute in index.html.

After changing index.html, run `node scripts/csp-policy.cjs --write`, review vercel.json, then run `node --test tests/*.test.cjs`. The regression test fails if the inline hash becomes stale. Hash input follows HTML newline normalization.

## Remaining exception

`script-src-attr 'unsafe-inline'` remains necessary for static and dynamically rendered event-handler attributes. Styles also retain unsafe-inline. This is an incremental protection against injected script elements, NOT a strict CSP, complete XSS prevention, or completion of the security audit. The next stage must replace all inline event handlers with reviewed listeners before setting script-src-attr to none. Never add a shared static nonce or dynamically compile handler strings to bypass CSP.

## Release gate

Test a preview with the actual HTTP CSP header. Verify login, MFA, first-login password flow, navigation, ticket conversation and attachments, administration and dynamically loaded modules. Confirm an unapproved inline script and another jsDelivr package are refused. Do not promote an untested preview or modify production Auth settings as part of this frontend change.
