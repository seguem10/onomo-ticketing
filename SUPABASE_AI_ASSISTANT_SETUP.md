# Assistant IT — mise en service Supabase

## Mode procédures guidées sans API IA

L'application fournit un premier niveau de diagnostic local pour Microsoft 365, Sage 1000, Citrix, OPERA PMS, POS, réseau et maintenance. Il fonctionne même si aucun fournisseur IA n'est configuré. Les réponses sont marquées **« modèle à valider par l'IT »** : elles ne sont pas des procédures fournisseur officielles.

Après `p21`, exécutez aussi `supabase/p22_it_procedure_review_workflow.sql`. Il ajoute le statut de revue et la langue aux procédures. Après contrôle par l'équipe IT, un administrateur peut approuver une procédure avec :

```sql
update public.it_procedures
set approval_status = 'approved',
    is_validated = true,
    validated_by = auth.uid(),
    validated_at = now()
where id = '<id-du-guide>';
```

## 1. Base de données

Dans Supabase SQL Editor, exécuter une seule fois :

```sql
-- contenu de supabase/p21_ai_it_assistant.sql
```

Les tables créées sont :

- `it_procedures` : procédures internes, avec source, date et validation.
- `it_ai_conversations` et `it_ai_messages` : conversations privées de chaque utilisateur.
- `ticket_ai_solutions` : propositions et solutions validées des tickets.

Les procédures ne deviennent visibles à l'assistant que si `is_validated = true`.

Exemple de procédure approuvée :

```sql
insert into public.it_procedures
  (title, domain, content, source_label, effective_date, is_validated, created_by, validated_by, validated_at)
values
  ('Contrôle Outlook hors connexion', 'microsoft365',
   'Ouvrir Outlook > Envoyer/Recevoir > vérifier le mode Hors connexion. Ne jamais demander le mot de passe.',
   'Runbook IT ONOMO', current_date, true, auth.uid(), auth.uid(), now());
```

## 2. Edge Function

Déployer la fonction :

```bash
supabase functions deploy ai-it-assistant --project-ref aljnwqrjplqvehctsdqj
```

Configurer les secrets uniquement côté Supabase (jamais dans le navigateur ni Git) :

```bash
supabase secrets set ANTHROPIC_API_KEY="..." SUPABASE_SERVICE_ROLE_KEY="..." --project-ref aljnwqrjplqvehctsdqj
```

`SUPABASE_URL` et la clé publishable sont normalement déjà fournies par Supabase à la fonction. La clé de service est nécessaire pour enregistrer de façon contrôlée les réponses générées par l’assistant.

## 3. Contrôles de sécurité

- Ne jamais ajouter une clé fournisseur IA dans `index.html`, Vercel ou le stockage navigateur.
- Ne valider une procédure que depuis un compte Administrateur.
- Vérifier les politiques RLS avec un compte Demandeur, IT Hôtel et IT Régional avant la mise en production.
- L’absence de secret ou un fournisseur indisponible retourne un message explicite, sans créer de ticket ni enregistrer de fausse réponse.
