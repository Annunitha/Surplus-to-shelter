# Phase 5 — Realtime Updates, UI Polish, Demo Data
**Target window:** Hours 18–21

## Inputs
- SRS.md FR-5.3, NFR-2
- ARCHITECTURE.md §6 (exact WebSocket event names)

## Tasks
1. Integrate Socket.io: server emits `donation:status_changed`, `offer:new`, `assignment:new` at the exact points defined in ARCHITECTURE.md §6 (on every status transition from Phases 2–3).
2. Frontend subscribes and updates donor/recipient/driver/dashboard views live, without requiring a page refresh.
3. UI pass against NFR-2: check mobile-width layout for recipient and driver views specifically (they're the least technical users), ensure large touch targets, remove any jargon in labels.
4. Prepare a scripted demo scenario: pre-seed 2–3 donations timed so that during the live demo, judges see a donation go from `posted` to `delivered` in a few minutes, plus at least one reject-triggers-cascade moment (per Phase 2 DoD).
5. Re-verify all Phase 0–4 Definition-of-Done checklists still pass after integration — this phase often breaks earlier phases' assumptions.

## Do Not
- Do not introduce new WebSocket event names beyond ARCHITECTURE.md §6.
- Do not use this phase to add new features — polish and realtime wiring only.

## Definition of Done
- [ ] All three role views update live on status change without manual refresh.
- [ ] Mobile-width layout is usable for recipient and driver views.
- [ ] A rehearsed demo script exists and has been run at least once end-to-end successfully.
- [ ] Regression check: Phases 0–4 acceptance criteria still all pass.
