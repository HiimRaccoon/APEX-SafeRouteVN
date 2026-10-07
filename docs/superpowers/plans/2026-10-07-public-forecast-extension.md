# Public forecast extension implementation plan

> Use subagent-driven-development for the independent SDK, HTTP and frontend tasks; TDD for every behavior change.

**Goal:** Complete the authorized P3-01/P3-02 proposal branch by exposing certified native geometry before Accept, without changing physical state.

**Spec:** `2026-10-06-member3-integration/spec.md`, P3-01/P3-02/P3-03 in `tasks.md`. The user explicitly authorized adding the missing M2 projection and M3 HTTP API on 2026-10-07.

**Architecture:** Add `RuntimeClient.job_forecast(session_id, job_id)` as a public supplemental projection. M3 exposes `GET /api/sessions/{session_id}/jobs/{job_id}/forecast`, verifies ownership, persisted submit binding, profile and installed build. Frontend reads current certified forecasts through its existing coordinator and presents a local preview choice separately from accepted execution. Release a new explicitly sealed runtime build with fresh authority; preserve the received 0.8.0 ZIP and historical receipts.

## Contract locked for this extension

Exact top-level fields: `schema_version: task02-m2-job-forecast/1`, `session_id`, `job_id`, `profile`, `input_basis` (all nine fields), `build_sha256`, `job_view` (unchanged job-view/1), `trajectory` (nullable, same portable shape as accepted_trajectory: job_id/profile/forecast/domain_sha256/vehicle_routes), `metrics` (nullable numeric native forecast metrics), `units`, `metric_scope: FORECAST_ONLY`, `execution_mode: SIMULATED_REPLAY`, `real_world_observation: false`.

Units: `distance=m`, `duration=s`, `action_time=us`, `cost=VND`, `mass=kg`, `geometry_crs=WGS84`, `geometry_order=longitude_latitude`, `exposure=PROXY`. No-witness, queued, running, failed: trajectory and metrics null; preserve typed job outcome. Certified FEASIBLE/PARTIAL/RETURN_ONLY: exact wire-safe directed route actions, all fractions/source geometry retained. No rounding int64/rationals. Historical reads may return input_basis unchanged; frontend only previews when all basis fields match current state.

HTTP 401/403/404 for auth/owner/session/job. Binding, malformed or installed build changes fail closed with 503. GET never accepts client state/routes or invokes accept/advance/compute/recover; no private store or offline geometry frontend access. API app extension version 0.9.0, documented separately from handed-off 0.8.0.

## Global constraints

Preserve mock/offline behavior and existing UI shell; Driver displays accepted routes only. Admin applies return and visibility filters solely to presentation and derives leg colors before filtering. Preview selection is a local read-only choice (Phase 4 Accept remains unsupported). No hidden Accept. Null metrics unavailable; distinct scopes. No token/authority/metadata/installation paths in published artifacts. Verify production inventory before imports and generate a new build identity; never edit old inventory, pinned packages or receipts to pretend compatibility.

## Review focus

Full basis same counters/different hashes; lifecycle without witness; partially traversed EDGE and RETURN_ONLY; selection/reload/stale state; old installation mistakenly loading modified SDK; explicit native test Accept must be separate from proof of read-only forecast.

## Task 1 — Supplemental SDK forecast

Files: new `optimization/runtime/forecast.py`, `optimization/tests/test_job_forecast.py`; modify `optimization/runtime/sdk.py`.

- [x] RED: certification/null outcomes, exact EDGE/µs/rational output, malformed binding/coverage, no store mutation and SDK delegation.
- [x] Implement `project_job_forecast(job)` and `validate_job_forecast(value)`; SDK fetches server-owned verified job via existing Store boundary and returns only public projection.
- [x] GREEN and self-review; report test evidence. No changes to legacy job-view/1 or solver.

## Task 2 — Owner-scoped M3 read

Files: new `backend/services/forecast_service.py`, `backend/tests/test_forecast.py`; modify jobs router, runtime bridge/gateway and API main.

- [x] RED: owner/auth/unknown job, viewer-owned read, exact submit/profile/full basis/build binding, no-witness and malformed projection rejection, no mutations before/after reads.
- [x] Implement HTTP GET, verify submit row plus typed forecast at bridge boundary; portable validator is imported only from the verified installed SDK inside bridge. Cache-Control no-store remains.
- [x] GREEN backend suite; new 0.9.0 OpenAPI generated separately.

## Task 3 — Frontend native preview

Files: `types.ts`, `client.ts`, new `forecastViewAdapter.ts/.test.ts`, BackendDispatchApi plus tests, shared dispatch/map types, mapScene/adminMapPresentation/AdminPage plus tests.

- [x] RED: exact geometry/fractions preserved, full basis/profile/job rejection, preview distinct from accepted, Driver accepted-only, stable palettes/return filters, no-witness/stale/error fail closed.
- [x] Implement typed public forecast read; reuse accepted adapter's portable geometry validation via a clearly named shared projection seam, without inventing accepted physical state. Store proposed segments in additive native metadata and use current local preview choice; keep Accept unsupported.
- [x] GREEN targeted/frontend full/typecheck/build. Forecast loading belongs to existing API/coordinator; no panel polls or duplicate in-flight world reads.

## Task 4 — Seal, native acceptance, publish

- [x] Create an isolated fresh extension install from verified original production inventory plus declared changed production files; compute new inventory/build and genuine G0/runtime/source checks, never rewrite old receipts.
- [x] Native S1: ready API+worker; compute certified profile forecasts; public GET forecast before/after physical state equality; browser preview input equals public geometry, Driver has no unaccepted route; reload same session.
- [x] Separate explicit native acceptance/replay test for non-null observed/planned/projected scope equality, not part of preview retrieval.
- [ ] Fresh full checks, independent review, sanitized evidence/contract/task updates. Tick only actual gates proven. Synchronize only explicit source/release artifacts to publication checkout; commit/push using existing authorization.
