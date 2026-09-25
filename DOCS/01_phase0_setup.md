# Phase 0 — Setup, Schema, Seed Data, Deploy Skeleton
**Target window:** Hours 0–3

## Inputs
- ARCHITECTURE.md §1 (tech stack), §3 (schema), §8 (env/deployment)

## Tasks
1. Scaffold monorepo: `/frontend` (Vite + React + Tailwind), `/backend` (Node + Express).
2. Decide notification provider NOW (Resend email or Twilio SMS) per ARCHITECTURE.md §1 — write the choice into a `DECISIONS.md` file so later phases don't re-litigate it.
3. Provision PostgreSQL with PostGIS on Render/Railway. Run the exact DDL from ARCHITECTURE.md §3 — do not modify field names or types.
4. Write `/backend/scripts/seed.js`:
   - Pull ~15–20 real restaurant coordinates and ~8–10 real shelter/food-bank coordinates for one chosen demo city via OpenStreetMap Overpass API (`amenity=restaurant`, `social_facility=food_bank`).
   - Insert as `donors` and `recipients` rows with realistic `accepted_food_types` / `capacity_max` values.
   - Insert 5–6 `drivers` with status `available`.
5. Deploy backend (with DB connected) to Render/Railway. Deploy a placeholder frontend to Vercel. Confirm both are reachable via public URL.
6. Set up JWT auth scaffolding: `/api/auth/register` and `/api/auth/login` for the three roles, per ARCHITECTURE.md §5.

## Do Not
- Do not build any donation/matching logic yet — this phase is infrastructure only.
- Do not choose a different DB, ORM, or hosting provider than ARCHITECTURE.md specifies.
- Do not invent extra seed tables.

## Definition of Done
- [ ] Backend deployed and reachable; `GET /api/impact/summary` (even if returning zeros) responds 200.
- [ ] Frontend deployed (placeholder page is fine).
- [ ] DB has seeded donors, recipients, drivers with real-world coordinates.
- [ ] A user can register and log in as each of the 3 roles and receive a valid JWT.
- [ ] `DECISIONS.md` records the notification provider choice.
