# Phase 2 — Matching Engine + Recipient Offer Flow
**Target window:** Hours 6–10

## Inputs
- SRS.md FR-2, FR-3
- ARCHITECTURE.md §4 (exact matching formula), §5, §6

## Tasks
1. Implement `matchDonation(donationId)` per ARCHITECTURE.md §4:
   - Candidate filter using `ST_DWithin`, `food_type = ANY(accepted_food_types)`, `capacity_current < capacity_max`.
   - Hard filter: exclude if `expiry_window_end` has already passed (NFR-3 — non-negotiable).
   - Score all candidates with the exact weighted formula; pick the max.
   - Set `donation.matched_recipient_id`, status stays `posted` until recipient accepts — the "offer" is pending, not yet committed. (Clarify in code: `matched` status is only set on accept, per FR-3.3.)
2. Build recipient dashboard: `GET /api/recipients/me/offers` listing pending offers with distance, quantity, food_type, live expiry countdown.
3. Implement `POST /api/recipients/me/offers/:donationId/accept` → sets donation status to `matched`, increments recipient `capacity_current`.
4. Implement `POST /api/recipients/me/offers/:donationId/reject` → clears the offer, immediately re-runs matching against remaining candidates (FR-3.4), excluding the rejecting recipient.
5. Implement the timeout cascade (FR-2.3): a scheduled job (interval, e.g. every 30s for demo purposes) checks for offers pending longer than the configured timeout and re-offers to the next-ranked candidate.
6. Build recipient capacity/preferences update: `PATCH /api/recipients/me`.

## Do Not
- Do not change the 0.5/0.3/0.2 scoring weights.
- Do not allow a donation whose expiry has passed to appear in any recipient's offer list — verify this with a test case, not just code review.
- Do not skip the reject-triggers-cascade requirement — this is a specifically called-out demo moment.

## Definition of Done
- [ ] Posting a donation results in the correct (verifiably highest-scoring, in-radius, capacity/food-type-matching) recipient receiving an offer.
- [ ] Recipient can accept → donation status becomes `matched`.
- [ ] Recipient can reject → a different eligible recipient receives the offer within seconds, without needing an app restart.
- [ ] A donation seeded with an already-past expiry never appears as an offer to any recipient.
- [ ] Timeout cascade demonstrably re-offers after the configured window (test with a short timeout, e.g. 30s, for verification).
