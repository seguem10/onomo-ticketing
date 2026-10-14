# Audit de sécurité ONOMO — 14 octobre 2026

## Périmètre et limites

Première tranche, non exhaustive. Base de code : `2c80643`. Branche : `security/onomo-audit-20261014`.
Inspection du code, métadonnées SQL en lecture seule et tests locaux avec données fictives. Aucun scan intrusif, téléchargement de document réel, changement de configuration ou déploiement de production. Aucune certification ASVS.
La modification utilisateur préexistante de `.gitignore` est exclue de cette branche.

## Architecture vérifiée

Site statique HTML/CSS/JavaScript sans framework ni package.json ; modules globaux et multiples wrappers ; Supabase Auth, REST, RLS, Realtime et Storage ; Edge Functions Deno ; hébergement Vercel ; EmailJS/Resend et fournisseurs IA côté serveur. SDK navigateur 2.117.2 épinglé avec SRI. Plusieurs imports serveur utilisent encore `@2` sans version exacte.

## Constats confirmés

| ID | Gravité | Preuve non sensible | Correction / état |
| --- | --- | --- | --- |
| SEC-01 | Moyenne | saveTickets/saveCommentaires persistaient les contenus dans dh_tickets/dh_comments | En configuration Supabase, nouvelles écritures supprimées et ces clés purgées ; démo locale conservée. Branche seulement. |
| SEC-02 | Moyenne | renderReportHotel interpolait un nom d’hôtel dans onclick JavaScript | Valeur transférée dans attribut data échappé ; handlers constants. Une entrée contenant une apostrophe pouvait casser le handler ; exploitation XSS complète non testée. |
| SEC-03 | Moyenne | Plusieurs Edge imports npm:@supabase/supabase-js@2 | Versions exactes et lockfiles à préparer avec tests API ; non corrigé pour éviter une migration arbitraire. |
| SEC-04 | Moyenne | Protection anti-brute-force complémentaire navigateur dans modern-features.js | Ne remplace pas la limite Auth serveur ; configuration Auth/WAF non vérifiée. |
| SEC-05 | Moyenne | Envoi des notifications initié par navigateur et claim limité à 30 secondes | Fiabilité non durable et preuve événement insuffisante ; file serveur transactionnelle à concevoir, sans changer le workflow sans validation. |

## Risques à confirmer

Jetons persistants accessibles au JavaScript : risque de vol en cas de XSS. CSP comporte unsafe-inline. Vérification de signature des pièces jointes principalement cliente ; MIME/limites Storage ne constituent pas un antivirus. Accès ticket par assigned_to/created_by subsiste dans RLS sans périmètre explicite sur ces branches : vérifier les cas de retrait d’hôtel avec fixtures isolées. Journal activity_log écrit par le navigateur : ne pas le traiter comme une preuve forensique inviolable.

## Résultats et maturité

41 tests locaux PASS ; voir SECURITY_TEST_RESULTS. 26/26 tables publiques ont RLS ; 4/4 buckets privés. Ces contrôles de configuration ne prouvent pas l’isolation inter-hôtels en conditions réelles.
ASVS niveau 2 : NON ÉVALUÉ intégralement ; pas de déclaration de conformité.
Score documentaire indicatif : 35/100, non un taux de sécurité. Accès/configuration 15/25 ; auth/session 8/20 ; uploads/frontend 6/20 ; CI/preuves 4/20 ; reprise/surveillance 2/15. Score conservateur basé sur preuves disponibles, aucune extrapolation aux éléments non vérifiés.

## Livraison et retour arrière

Correctifs locaux et CI proposés en PR, sans fusion ni production. Réversion du commit de branche rétablit le code précédent ; elle ne reconstitue pas les caches de données purgés. Données métier et Storage inchangés. Aucune migration SQL nouvelle nécessaire dans cette tranche. Toute future migration devra fournir un script inverse, un test isolé et une autorisation de production.
