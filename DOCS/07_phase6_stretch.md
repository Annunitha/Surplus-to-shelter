# Phase 6 — Stretch Goals (ONLY if Phases 0–5 are fully done)
**Target window:** Hours 21–24 — buffer/rehearsal takes priority over new stretch work after hour 22

## Rule
Do not start this phase unless every Definition-of-Done checkbox in Phases 0–5 is genuinely satisfied. If in doubt, spend the time on rehearsal and bug-fixing instead — a polished MVP beats a broken stretch feature every time in judging.

## Pick AT MOST ONE of the following (do not attempt more than one)

### Option A — Cascading re-match tuning + visible demo of it
Make the reject/timeout cascade (already built in Phase 2) visibly dramatic in the UI — e.g. an animated "searching for next recipient" state — for demo impact. No backend logic changes required, UI only.

### Option B — Multi-stop routing for drivers
If a driver has 2+ assigned pickups, integrate a routing API (OSRM demo server or Mapbox Directions, free tier) to suggest an optimized stop order. This is the ONLY phase where a routing API integration is permitted — do not add it earlier.

### Option C — NLP-assisted donation intake
Add a free-text parser (LLM call) that lets a donor type "40 lbs of pasta and bread, good until 8pm" and auto-fills the structured fields from SRS.md §6. The structured fields remain the source of truth — the LLM only pre-fills them; the donor must still be able to review/edit before submit.

## Do Not
- Do not attempt computer-vision food classification — too high risk for remaining time.
- Do not attempt an agentic multi-party negotiation system — out of scope per SRS.md §9.
- Do not start a second stretch option if the first isn't finished with time to spare for rehearsal.

## Definition of Done
- [ ] Chosen stretch option is fully working end-to-end, not partially wired.
- [ ] It does not break any Phase 0–5 acceptance criteria.
- [ ] At least 30 minutes remain before the deadline for final rehearsal.
