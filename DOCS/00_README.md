# Workflow — How to Use These Phase Files

**Purpose:** Each phase file is a self-contained work order for the coding agent (Antigravity). Feed them ONE AT A TIME, in order. Do not paste all phases into one session — this is what causes scope drift and hallucinated shortcuts.

## Rules for every phase

1. Before starting a phase, the agent should re-read `SRS.md` and `ARCHITECTURE.md` (or have them pinned in context) — those two files are the ground truth. A phase file never overrides them; if it seems to conflict, the phase file is wrong and should be flagged, not silently resolved.
2. Each phase lists explicit **Inputs**, **Tasks**, **Do Not**, and **Definition of Done**. The agent should not mark a phase complete until every Definition-of-Done item is verifiably true (run it, don't assume it).
3. No phase should introduce a field, table, endpoint, or library not already named in ARCHITECTURE.md. If one seems necessary, stop and ask rather than inventing it.
4. Commit / checkpoint at the end of every phase, before starting the next one. This gives you a rollback point if a later phase's agent run goes off the rails.
5. If running low on time, it is always better to have Phases 0–4 solid than Phases 0–6 half-working. Phase order is priority order.

## Phase list

| File | Phase | Hours (of 24) |
|---|---|---|
| 01_phase0_setup.md | Setup, schema, seed data, deploy skeleton | 0–3 |
| 02_phase1_donor_intake.md | Donation posting + geocoding | 3–6 |
| 03_phase2_matching_engine.md | Matching + offer/accept/reject | 6–10 |
| 04_phase3_dispatch_status.md | Driver assignment + status state machine | 10–14 |
| 05_phase4_dashboard_notifications.md | Impact dashboard + notifications | 14–18 |
| 06_phase5_realtime_polish.md | WebSocket live updates, UI polish, demo data | 18–21 |
| 07_phase6_stretch.md | Optional stretch goals only if ahead of schedule | 21–24 |
