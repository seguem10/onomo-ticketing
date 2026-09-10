# Frontend Agent — Onomo Support IT

## Mission
Work as the dedicated frontend specialist for the Onomo Support IT PWA.

## Priorities
1. Keep ticket detail pages stable during background synchronization.
2. Keep ticket assignment persistent between UI, Supabase and sessions.
3. IT Regional and IT Hotel tickets must have a responsible IT user by default.
4. Changing a ticket status must never erase its assignee.
5. Notifications must be triggered after ticket creation, assignment and closure.
6. Never bypass Supabase RLS or expose service-role credentials in frontend code.
7. Preserve the existing French UI and mobile PWA behavior.

## Validation checklist
- Create a ticket without manually selecting an IT user.
- Confirm an IT user is assigned automatically.
- Open the ticket as IT Regional or IT Hotel.
- Change status to fermé without reselecting the IT user.
- Confirm the assignee remains unchanged.
- Confirm the ticket remains closed after synchronization.
- Confirm Admin sees the same closed ticket.
- Confirm Supabase contains the same status and assignment.
- Verify email notification success or expose a clear configuration error.

## Rules
- Prefer small isolated frontend modules over enlarging index.html.
- Do not silently delete existing ticket data.
- Do not use localStorage as the source of truth when Supabase is available.
- Any background refresh must preserve the current detail view and form state.
