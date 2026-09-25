# Architecture Document
## Surplus-to-Shelter — Track A

This document is the fixed technical reference. It resolves every "open" decision the problem statement leaves to the team. An AI coding agent should treat every choice below as final unless a workflow phase file explicitly says to revisit it — do not silently swap a library, pattern, or field name for an alternative that seems equivalent.

---

## 1. Tech Stack (locked)

| Layer | Choice | Do NOT substitute with |
|---|---|---|
| Frontend | React (Vite) + Tailwind CSS | Next.js, CRA, Vue — unless Phase 0 explicitly changes this |
| Backend | Node.js + Express | NestJS, FastAPI, Django |
| Realtime | Socket.io | Raw WebSocket, SSE |
| Database | PostgreSQL + PostGIS extension | MongoDB, SQLite (SQLite acceptable only as local dev fallback if Postgres setup fails, and must be flagged) |
| Geo/Distance | PostGIS `ST_DWithin` / `ST_Distance` (straight-line for MVP) | Do not integrate a routing API (OSRM/Mapbox) until Phase 5 stretch |
| Auth | JWT, 3 hardcoded roles (`donor`, `recipient`, `driver`) | OAuth, magic links, session cookies |
| Notifications | Resend (email) — chosen for zero-friction free tier | Twilio SMS is the documented alternative; pick one in Phase 0 and do not build both |
| Hosting (frontend) | Vercel | Netlify |
| Hosting (backend+DB) | Render or Railway | Heroku, AWS from scratch (too slow to set up in 24h) |

---

## 2. System Diagram

```
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│ Donor View   │  │ Recipient   │  │ Driver View  │
│ (React route)│  │ View (route)│  │ (React route)│
└──────┬──────┘  └──────┬──────┘  └──────┬───────┘
       │                │                 │
       └────────┬───────┴─────────────────┘
                 ▼
        ┌─────────────────┐
        │  Express API      │  REST endpoints (see §5)
        │  + Socket.io       │  WS events (see §6)
        └────────┬──────────┘
                 │
    ┌────────────┼─────────────┐
    ▼             ▼             ▼
┌─────────┐ ┌───────────┐ ┌───────────┐
│ Matching │ │ Notification│ │ Impact    │
│ Service  │ │ Service     │ │ Calculator│
│ (§4)     │ │ (Resend)    │ │ (§7)      │
└────┬────┘ └───────────┘ └───────────┘
     ▼
┌──────────────────┐
│ PostgreSQL+PostGIS │
└──────────────────┘
```

---

## 3. Database Schema (DDL-level — exact field names, do not rename)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  location GEOGRAPHY(POINT) NOT NULL,
  address_text TEXT NOT NULL,
  city_id TEXT NOT NULL DEFAULT 'demo-city',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  location GEOGRAPHY(POINT) NOT NULL,
  address_text TEXT NOT NULL,
  city_id TEXT NOT NULL DEFAULT 'demo-city',
  accepted_food_types TEXT[] NOT NULL,
  capacity_current NUMERIC NOT NULL DEFAULT 0,
  capacity_max NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_phone TEXT,
  current_location GEOGRAPHY(POINT),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','en_route','busy')),
  city_id TEXT NOT NULL DEFAULT 'demo-city'
);

CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES donors(id),
  food_description TEXT NOT NULL,
  food_type TEXT NOT NULL CHECK (food_type IN ('prepared_meals','produce','bakery','dairy','dry_goods','other')),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('lbs','kg','servings')),
  weight_kg NUMERIC, -- normalized weight, computed at intake for impact calc
  pickup_location GEOGRAPHY(POINT) NOT NULL,
  pickup_address TEXT NOT NULL,
  posted_at TIMESTAMPTZ DEFAULT now(),
  expiry_window_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted'
    CHECK (status IN ('posted','matched','picked_up','delivered','expired','cancelled')),
  matched_recipient_id UUID REFERENCES recipients(id),
  matched_driver_id UUID REFERENCES drivers(id),
  city_id TEXT NOT NULL DEFAULT 'demo-city'
);

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  pickup_eta TIMESTAMPTZ,
  dropoff_eta TIMESTAMPTZ,
  actual_pickup_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ
);

CREATE TABLE impact_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id),
  weight_kg NUMERIC NOT NULL,
  meals_estimate NUMERIC NOT NULL,
  co2e_avoided_kg NUMERIC NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_recipients_location ON recipients USING GIST(location);
CREATE INDEX idx_donors_location ON donors USING GIST(location);
```

---

## 4. Matching Algorithm (exact formula — do not redesign)

```
Candidate filter (SQL, PostGIS):
  recipients WHERE
    ST_DWithin(location, donation.pickup_location, RADIUS_METERS)  -- default 8000
    AND food_type = ANY(accepted_food_types)
    AND capacity_current < capacity_max

Score per candidate:
  distance_km = ST_Distance(location, donation.pickup_location) / 1000
  capacity_fit = 1 - (capacity_current / capacity_max)     -- prefers emptier recipients
  urgency = 1 - (time_remaining_seconds / initial_window_seconds)  -- rises as expiry nears

  score = (0.5 * (1 / (distance_km + 0.1)))
        + (0.3 * capacity_fit)
        + (0.2 * urgency)

Pick MAX(score). Offer to that recipient. On reject/timeout, remove from
candidate pool and re-run against remaining candidates.
```

Weights (0.5 / 0.3 / 0.2) are fixed for MVP. Do not tune without updating this file.

---

## 5. REST API (exact routes — do not add undocumented endpoints)

```
POST   /api/auth/login
POST   /api/auth/register            { role: donor|recipient|driver, ... }

POST   /api/donations                (donor) create donation → triggers matching
GET    /api/donations/:id            (any authenticated) view one donation
GET    /api/donations/mine           (donor) list own donations

GET    /api/recipients/me/offers     (recipient) pending matched offers
POST   /api/recipients/me/offers/:donationId/accept
POST   /api/recipients/me/offers/:donationId/reject
PATCH  /api/recipients/me            update capacity / accepted_food_types

GET    /api/drivers/me/assignment    (driver) current assigned donation
POST   /api/drivers/me/assignment/:donationId/picked-up
POST   /api/drivers/me/assignment/:donationId/delivered

GET    /api/impact/summary           (public) totals for dashboard
```

---

## 6. WebSocket Events (exact event names)

```
Server → Client:
  "donation:status_changed"   { donationId, status, timestamp }
  "offer:new"                 { donationId, recipientId }
  "assignment:new"            { donationId, driverId }

Client → Server: none required for MVP (all writes go through REST; sockets are push-only)
```

---

## 7. Impact Calculation Constants (fixed, cite in report)

```
MEALS_PER_KG = 1 / 0.545        // derived from Feeding America's ~1.2 lb per meal
CO2E_KG_PER_KG_FOOD = 2.5        // EPA WARM model, food waste landfill diversion factor (documented estimate — cite source in submission, do not present as precise)
```

---

## 8. Environment / Deployment

- Single monorepo: `/frontend`, `/backend`.
- `.env` for backend: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY` (or `TWILIO_*` if SMS chosen).
- Seed script: `/backend/scripts/seed.js` — pulls real donor/recipient coordinates from OpenStreetMap Overpass API for the demo city, generates synthetic donations via Faker.
- Deploy backend + Postgres to Render/Railway by end of Phase 1 (deploy early, not at the end).

---

## 9. Explicit Guardrails for the Coding Agent

- Do not introduce new tables, fields, or status values without a corresponding edit to SRS.md and this file first.
- Do not change the matching formula's weights or filters without updating §4.
- Do not add authentication providers beyond JWT.
- Do not silently pick a different notification provider than the one chosen in Phase 0.
- If a phase file's task seems to require a new field/endpoint not listed here, stop and flag it instead of inventing one.
