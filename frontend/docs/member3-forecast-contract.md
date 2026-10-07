# Public forecast contract gate — Phase 3

Status: **pending M3 handoff**, checked against local M3 HTTP 0.8.0 on 2026-10-07.

The current `docs/M3_OPENAPI_20261006.json`, `backend/api/routers/jobs.py`, `backend/api/routers/profiles.py` and runtime job view contract expose lifecycle, certification, coverage, basis and comparison metrics. They do not expose an owner-scoped public pre-Accept route geometry read. `GET /api/sessions/{session_id}/state` contains `accepted_trajectory` only after explicit acceptance. Historical backend receipts do not establish a frontend forecast gate.

No forecast endpoint, forecast sample, implicit Accept, private store read, offline road geometry or fabricated stop-to-stop route has been added. Public rain polygons are also unavailable in the current world contract.

M3 handoff must specify the public endpoint/schema, release/build, owner access, certified witness requirements, job/session/profile/full nine-field basis binding, no-witness/PARTIAL/RETURN_ONLY semantics, exact directed EDGE coordinates/fractions/action ordering, units and 401/403/404/error behavior. The native gate must compare the public response with the rendered input and prove head/generation/orders/custody/active job unchanged by the forecast read.

Independent comparison KPI and accepted execution projection do not close this gate. See [Phase 3 progress](member3-phase3.md).

Accepted execution completion also needs an authoritative public `decision_epoch` or completed action/progress projection. Action `start_us`/`end_us` are relative offsets; the current view supplies ISO observation timestamps but no mapping to those offsets. Native completion is explicitly unavailable until that handoff, while supplied accepted geometry remains visible.
