# Phase 4 — Impact Dashboard + Notifications
**Target window:** Hours 14–18

## Inputs
- SRS.md FR-6, FR-7
- ARCHITECTURE.md §7 (exact impact constants), §5 (`GET /api/impact/summary`), `DECISIONS.md` from Phase 0 (chosen notification channel)

## Tasks
1. On donation reaching `delivered` (from Phase 3's trigger point), compute and insert an `impact_log` row using the EXACT constants from ARCHITECTURE.md §7 (`MEALS_PER_KG`, `CO2E_KG_PER_KG_FOOD`) — do not invent different conversion factors.
2. Implement `GET /api/impact/summary` (public, no auth) returning: total meals rescued, total weight diverted (kg), total CO2e avoided (kg), and a breakdown of active donation counts by status.
3. Build the public impact dashboard page consuming that endpoint — simple, glanceable, large numbers.
4. Implement notifications using the SINGLE channel chosen in Phase 0:
   - On offer creation (Phase 2 trigger point) → notify the recipient.
   - On driver assignment (Phase 3 trigger point) → notify the driver.
5. Wire notification sending as a fire-and-forget call that does not block the main request/response cycle (don't let a slow email API call delay the matching response).

## Do Not
- Do not build both email and SMS — only the Phase-0-chosen channel.
- Do not change the meals/CO2e conversion constants.
- Do not gate the impact dashboard behind login — it must be public per FR-6.3.

## Definition of Done
- [ ] A `delivered` donation produces a correct `impact_log` row with the documented formula.
- [ ] `/api/impact/summary` returns correct running totals matching the sum of `impact_log`.
- [ ] Impact dashboard renders and updates after a delivery completes.
- [ ] A real notification (email/SMS) visibly arrives when an offer is created and when a driver is assigned — test this end-to-end, not just that the API call didn't error.
