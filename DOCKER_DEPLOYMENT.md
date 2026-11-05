# Docker deployment — Ticketing + OnoSign

This is a staging setup. It retains Supabase Cloud and does not modify production deployments.

## Directory layout

Clone both repositories side by side and check out branch `chore/docker-preparation` in each:

```
workspace/
  onomo-ticketing/
  Onosign/
```

## Configuration

In `onomo-ticketing/`, copy `.env.docker.example` to `.env`.
Set the **OnoSign** Supabase project URL and publishable key. Never add service-role keys or secrets to this file or commit it.

## Start

From `onomo-ticketing/`:

```sh
docker compose config
docker compose up -d --build
docker compose ps
```

Ticketing: http://localhost:8080
OnoSign: http://localhost:3000

The services bind to localhost only. Configure HTTPS and a reverse proxy before remote access. Update Supabase Auth redirect URLs for the new domains. Preserve all Supabase Edge Functions, Auth, Storage and database services during this stage.

## Validation

- Check `docker compose logs --tail=100 ticketing onosign`.
- Test login/logout, role restrictions, MFA, ticket creation, uploads, notifications and PDF workflow with test accounts.
- Verify Supabase RLS policies and CORS settings for the staging domain.
- Check PWA service worker updates, caching and browser console errors.
- Back up the database and storage before any production cutover.

## Stop

```sh
docker compose down
```

No production changes are made by this compose file. Docker image builds and functional tests still need to run on a Docker-capable host.
