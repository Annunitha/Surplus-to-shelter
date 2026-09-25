# Phase 3 — Driver Dispatch + Status State Machine
**Target window:** Hours 10–14

## Inputs
- SRS.md FR-4, FR-5, §7 (exact status enum)
- ARCHITECTURE.md §3 (`deliveries` table), §5

## Tasks
1. On donation reaching `matched` status, implement driver assignment: find nearest `available` driver (straight-line distance via PostGIS to `pickup_location`), create a `deliveries` row, set `donation.matched_driver_id`, set driver status to `en_route`.
2. If no driver is available, leave donation in `matched` with a visible "awaiting driver" state in the UI — do not auto-expire it (FR-4.4).
3. Build driver dashboard: `GET /api/drivers/me/assignment` showing donor location, recipient location, food description, expiry countdown.
4. Implement `POST /api/drivers/me/assignment/:donationId/picked-up` → donation status → `picked_up`, `deliveries.actual_pickup_time` set.
5. Implement `POST /api/drivers/me/assignment/:donationId/delivered` → donation status → `delivered`, `deliveries.actual_delivery_time` set, driver status back to `available`. This should trigger the impact calculation (Phase 4 will consume this).
6. Enforce the exact status enum from SRS.md §7 everywhere (DB constraint already enforces it — make sure application code never attempts an out-of-enum transition).

## Do Not
- Do not let a driver skip from `matched` directly to `delivered` — both `picked_up` and `delivered` steps are required and must be distinct UI actions.
- Do not introduce additional statuses like `in_transit` or `confirmed`.
- Do not auto-expire a `matched` donation just because no driver is available yet.

## Definition of Done
- [ ] A `matched` donation with an available driver gets assigned within seconds.
- [ ] Driver UI shows pickup + dropoff info and expiry countdown.
- [ ] Driver can progress `matched` → `picked_up` → `delivered`, each a distinct explicit action.
- [ ] `deliveries` table is correctly populated with timestamps at each step.
- [ ] Donation with no available driver stays visibly in an "awaiting driver" state without erroring or expiring.
