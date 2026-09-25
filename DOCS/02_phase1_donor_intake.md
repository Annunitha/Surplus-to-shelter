# Phase 1 — Donor Intake
**Target window:** Hours 3–6

## Inputs
- SRS.md FR-1, §6 (exact field list)
- ARCHITECTURE.md §5 (`POST /api/donations`, `GET /api/donations/mine`)

## Tasks
1. Build the donor-facing donation form using EXACTLY the fields in SRS.md §6 — no more, no fewer.
2. Implement address → lat/lng geocoding on submit (use a free geocoding API, e.g. Nominatim/OpenStreetMap; cache result on the donation row as `pickup_location`).
3. Implement `POST /api/donations`: validates required fields, rejects if `expiry_window_end` is not in the future, computes `weight_kg` from `quantity`/`unit` (servings → estimate 0.4 kg/serving; document the conversion constant used), inserts row with status `posted`.
4. Implement `GET /api/donations/mine` for the donor to see their own donation history/status.
5. Stub the matching trigger as a TODO call — actual matching logic is Phase 2, but the hook point should exist (e.g., call an empty `matchDonation(donationId)` function).

## Do Not
- Do not add fields beyond SRS.md §6 (no photo upload, no notes field, no price/value field).
- Do not build matching logic in this phase — stub it only.
- Do not skip the future-date validation on `expiry_window_end` — this is a hard NFR-3 requirement tested later.

## Definition of Done
- [ ] Donor can complete the form and submit in well under 60 seconds of interaction.
- [ ] Donation appears in `/api/donations/mine` with status `posted` and a correctly geocoded location.
- [ ] Submitting with a past `expiry_window_end` is rejected with a clear error.
- [ ] `weight_kg` is populated and the conversion logic is documented in code comments.
