# Public forecast extension — M3 0.9.0 / M2 supplemental job-forecast/1

This is an additive development extension authorized by the Member 4 user on 2026-10-07. The received M3 0.8.0 ZIP and M2 Step 7 build `80694f51…` remain immutable historical releases. This extension has its own production inventory/build and acceptance evidence; it does not claim original Member 2/3 or Leader production approval.

## Read contract

`GET /api/sessions/{session_id}/jobs/{job_id}/forecast` requires a bearer actor who owns the session. A viewer may read their own session; dispatcher role is required for mutations, not this GET. Body and query parameters are rejected. Responses use the existing `saferoute-m3-http-response/1` envelope and `Cache-Control: no-store`.

The exact data schema is `task02-m2-job-forecast/1`:

| Field | Contract |
| --- | --- |
| `session_id`, `job_id`, `profile` | Opaque bounded IDs; locked FASTEST/BALANCED/SAFER profile from the persisted submit |
| `input_basis` | All nine immutable M3Basis fields; head_version/generation are decimal strings |
| `build_sha256` | Equals input_basis.build_sha256 and the installed extension build |
| `job_view` | Unchanged exact `task02-m2-runtime-job-view/1` |
| `trajectory` | Null without a certified witness; otherwise job_id/profile/forecast=true/domain_sha256/vehicle_routes, same portable action/route shape as execution-view/2 accepted_trajectory |
| `metrics` | Null without a witness; otherwise finite nonnegative numeric native forecast metrics |
| `units` | `{distance:"m",duration:"s",action_time:"us",cost:"VND",mass:"kg",geometry_crs:"WGS84",geometry_order:"longitude_latitude",exposure:"PROXY"}` |
| `metric_scope` | `FORECAST_ONLY` |
| `execution_mode`, `real_world_observation` | `SIMULATED_REPLAY`, false |

No additional top-level fields are permitted. Certified FEASIBLE/PARTIAL/RETURN_ONLY use exact directed source EDGE geometry, action order, fractions and wire-safe int64/rationals. Null does not mean an empty feasible plan. Failed/cancelled jobs keep their real typed lifecycle/outcome. RETURN_ONLY keeps mandatory continuation in source; Admin may hide return presentation, Driver displays accepted execution only.

Historical forecast reads retain the input basis; they do not refresh it to current state. Job coverage may include previously delivered orders; routes describe only the future suffix. The SDK producer verifies the private certified anchor's delivered prefix plus route suffix exactly covers served_orders; the portable checker validates suffix inclusion and service ordering. Frontend subtracts the current public delivered_prefix only after full basis equality.

## Authority and errors

The SDK verifies its Store journal before reading the retained job and never exposes its private result, request, validation anchor, installation path or authority store. M3 verifies installed inventory before importing the SDK/validator, then verifies session/job/profile/full basis against its persisted submission. Forecast read never invokes solver/compute, Accept, event, replay or recovery. SDK-access locking may serialize reads, without changing physical head or custody.

401 means missing/invalid token; 403 means non-owner; 404 means unknown session/job or job outside the requested session. 422 rejects query/body. 503 JOB_BINDING_CHANGED / RUNTIME_UNAVAILABLE / typed integrity diagnostics fail closed. Only bounded transient RUNTIME_BUSY/RUNTIME_TIMEOUT retries are appropriate. Forecast failures do not trigger recovery records as a hidden read side effect.

The frontend loads forecasts through its existing comparison lane, validates complete bindings, and stores only a local previewJobId preference. Stale/malformed/auth/network failure clears preview. Selecting a forecast never Accepts it; operational Select/Accept/Event/Replay migration is still later-phase work.

## Release and evidence

`backend/scripts/seal_forecast_runtime.py` creates a fresh derived runtime from the externally pinned received runtime plus exactly `optimization/runtime/sdk.py` and `optimization/runtime/forecast.py`. It checks baseline bytes, computes a new production inventory, and refuses overwriting an existing destination. Use a fresh authority/metadata/auth installation for the new build; old session pointers are intentionally incompatible across builds.

Native receipt files under `frontend/docs/evidence/member3-integration/` distinguish read-only forecast proof (`phase3-forecast-http-native.json`) from the separate explicit Accept/replay scope test (`phase3-forecast-scopes-http-native.json`) and browser/map gate (`phase3-forecast-browser-native.json`). Browser instrumentation only observes actual L.polyline arguments and calls the original renderer. Existing historical receipts are not rewritten.

Public rain polygons and authoritative accepted action completion mapping remain unavailable. Preserve those labels; no offline geometry or invented completed prefix is used. This extension does not change mock/offline packs or default mode, and does not certify full Phase 7 E2E or production deployment.
