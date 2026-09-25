# Software Requirements Specification
## Surplus-to-Shelter: Real-Time Food Rescue Routing (AmiHacks — Track A)

**Purpose of this document:** This SRS is the single source of truth for scope. Any AI coding agent (e.g. Antigravity) working on this project must treat every requirement below as fixed and must NOT invent, rename, or add fields, endpoints, roles, or features not listed here. If something is ambiguous, it should be flagged rather than assumed.

---

## 1. Scope

Build a web application with three roles — **Donor**, **Recipient**, **Driver** — that lets a donor post surplus food, automatically matches it to a nearby recipient organization, dispatches a driver, tracks status end-to-end, and reports aggregate impact.

**In scope (MVP, 24-hour build):**
- Donor donation posting
- Rule-based matching engine
- Recipient accept/reject
- Driver dispatch view
- Status tracking state machine
- Impact dashboard
- Notifications (email or SMS — pick ONE for MVP)

**Out of scope (do not build unless explicitly told to move to Phase 6+):**
- Computer-vision food classification
- Agentic negotiation between parties
- Multi-city / multi-tenant support
- Payment or billing
- Native mobile apps (web-responsive only)

---

## 2. Actors / Roles

| Role | Description | Auth |
|---|---|---|
| Donor | Restaurant, grocer, caterer, campus dining posting surplus food | JWT, role = `donor` |
| Recipient | Shelter / food-rescue nonprofit receiving donations | JWT, role = `recipient` |
| Driver | Volunteer/gig driver performing pickup & delivery | JWT, role = `driver` |

There is no "admin" role in the MVP. Do not add one unless requested.

---

## 3. Functional Requirements

### FR-1 — Donation Intake (Donor)
- FR-1.1: Donor can create a donation with: food description (free text), food_type (enum, see §6), quantity, unit, pickup location (address → geocoded to lat/lng), expiry_window_end (datetime).
- FR-1.2: Form submission to visible "posted" status must take < 1 minute of user interaction (per problem statement) — i.e., no more than the fields in §6, no multi-step wizard.
- FR-1.3: On submit, system immediately triggers matching (FR-2).

### FR-2 — Matching Engine
- FR-2.1: System finds all recipients within a configurable radius (default 8 km) of the donation's pickup location, using accepted `food_types` and `capacity_current < capacity_max`.
- FR-2.2: System scores each candidate recipient using the formula in ARCHITECTURE.md §4 and assigns to the highest-scoring recipient.
- FR-2.3: If no recipient accepts within a configurable timeout (default 10 minutes, but compressible for demo), the system automatically re-offers to the next-ranked recipient.
- FR-2.4: If food's `expiry_window_end` has passed with no match, mark donation `expired` and exclude from all future matching.

### FR-3 — Recipient Response
- FR-3.1: Recipient sees incoming matched donations with distance, quantity, food_type, expiry countdown.
- FR-3.2: Recipient can Accept or Reject a matched donation.
- FR-3.3: On Accept, donation status → `matched`, system searches for an available driver (FR-4).
- FR-3.4: On Reject, system re-triggers FR-2.3 cascade immediately (no wait for timeout).
- FR-3.5: Recipient can set/update `capacity_current`, `capacity_max`, and `accepted_food_types` at any time.

### FR-4 — Driver Dispatch
- FR-4.1: System assigns the nearest available driver to a `matched` donation (nearest = straight-line or routed distance to pickup location — pick straight-line for MVP, note routed as stretch).
- FR-4.2: Driver sees assigned pickup: donor location, recipient location, food description, expiry countdown.
- FR-4.3: Driver can mark status: `picked_up`, then `delivered`. These are the only two driver-triggered transitions.
- FR-4.4: If no driver is available, donation remains `matched` and displays "awaiting driver" — do not auto-fail it.

### FR-5 — Status Tracking
- FR-5.1: Every donation has exactly one status at a time, from the enum in §7.
- FR-5.2: All status changes must be timestamped and stored (for the impact log and for driver/recipient UI).
- FR-5.3: Status changes must propagate to all relevant UIs in near-real-time (WebSocket push or ≤15s poll — pick one, document the choice in ARCHITECTURE.md).

### FR-6 — Impact Dashboard
- FR-6.1: On `delivered`, system computes: `meals_estimate = weight_kg / 0.545` (1.2 lb ≈ 1 meal → convert lb to kg: 1.2 lb = 0.545 kg) and `co2e_avoided_kg` using a fixed EPA WARM-derived factor documented in ARCHITECTURE.md.
- FR-6.2: Dashboard shows running totals: total meals rescued, total weight diverted, total CO2e avoided, count of active donations by status.
- FR-6.3: Dashboard is read-only and accessible without role restriction (public-facing impact view).

### FR-7 — Notifications
- FR-7.1: System sends a notification to the matched recipient when a donation is offered (FR-2.2).
- FR-7.2: System sends a notification to the assigned driver when dispatched (FR-4.1).
- FR-7.3: MVP uses ONE channel only (email via SendGrid/Resend, or SMS via Twilio — decide once, do not build both).

---

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Matching must return a result in < 2 seconds for a demo dataset of ≤500 recipients. |
| NFR-2 | UI must be usable by non-technical shelter staff and drivers — no jargon, minimal required fields, large touch targets on mobile-width viewports. |
| NFR-3 | The system must never match/route a donation whose `expiry_window_end` has already passed. This is a hard filter in every matching query, not a UI-only warning. |
| NFR-4 | Donor/recipient contact details are hidden from each other until a match reaches `matched` status. |
| NFR-5 | Schema must include a `city_id`/`region` field on donors, recipients, and donations, even though the MVP only serves one city (scalability requirement from the brief). |
| NFR-6 | No payment processing, no storage of payment data anywhere in the system. |

---

## 5. Data Entities (see ARCHITECTURE.md §3 for full schema/DDL)

`donors`, `recipients`, `drivers`, `donations`, `deliveries`, `impact_log`. No other tables should be created without updating this document first.

---

## 6. Donation Input Fields (exact set — do not add/remove)

| Field | Type | Required | Notes |
|---|---|---|---|
| food_description | text | yes | free text |
| food_type | enum | yes | `prepared_meals`, `produce`, `bakery`, `dairy`, `dry_goods`, `other` |
| quantity | number | yes | |
| unit | enum | yes | `lbs`, `kg`, `servings` |
| pickup_address | text → geocoded | yes | |
| expiry_window_end | datetime | yes | must be in the future at submit time |

---

## 7. Donation Status Enum (exact set)

`posted` → `matched` → `picked_up` → `delivered`
Alternate terminal states: `expired` (no match found in time), `cancelled` (donor cancels before match).

No other status values are permitted. Do not introduce `in_transit`, `confirmed`, etc.

---

## 8. Acceptance Criteria for MVP Demo

1. A donor can post a donation in under 60 seconds of interaction.
2. The system auto-matches it to a real, seeded recipient within the radius/capacity/food-type rules.
3. The recipient can accept it from their dashboard.
4. A driver is assigned and can progress the donation through `picked_up` → `delivered`.
5. The impact dashboard updates its totals after delivery.
6. A notification (of the one chosen channel) fires at least once, visibly, during the demo.
7. No donation past its expiry window is ever offered to a recipient.

---

## 9. Explicit Non-Goals (say this out loud if an agent suggests these — refuse)

- Do not add user-generated reviews/ratings.
- Do not add a chat/messaging feature between donor and recipient.
- Do not add a generic "admin panel" beyond what's needed to seed data.
- Do not integrate a real payment gateway.
- Do not build native iOS/Android apps.
