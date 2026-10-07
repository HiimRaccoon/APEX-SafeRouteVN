# SafeRoute VN — Member 3 backend

Current additive development extension: **0.9.0**, with an owner-scoped public certified job forecast read. See the [forecast API](../docs/M3_FORECAST_API_HANDOFF_20261007.md), [generated OpenAPI](../docs/M3_OPENAPI_20261007.json) and [supplemental release setup](../docs/M3_FORECAST_EXTENSION_RELEASE_20261007.md).

This source and its new sealed runtime are separate from the immutable received 0.8.0 release. The checkout contains the runtime production source dependency closure, but not the original verified M1 databases, native wheelhouse, credentials or authority. Use the received pinned dependencies and a fresh private installation with a genuine extension-bound preflight. Never relabel the original inventory, sessions or G0 receipt to make them appear compatible.

The release guide specifies private `SAFEROUTE_*` configuration and separate API/worker launch commands. `run_backend.py` can coordinate them when its documented installation layout is satisfied. `/health` is liveness; `/ready` requires verified source/build, auth, metadata and a fresh READY worker. Keep tokens and authority/metadata SQLite outside frontend assets and Git.

Public SDK access runs in an isolated byte-verified subprocess. M3 owns HTTP/session/request/queue/audit metadata; M2 owns physical authority, certification and simulated replay. Browser input cannot choose server paths, build, raw state or solver budget. Foreground and worker SDK reads share a bounded cross-process access lock. Integrity errors fail closed; forecast errors never trigger hidden recovery writes.

`GET /api/sessions/{session_id}/jobs/{job_id}/forecast` returns native certified geometry before Accept. No-witness jobs return null trajectory and metrics. The read preserves full input basis/job/profile/build and never computes, Accepts or advances execution. Existing comparison, explicit server Accept and replay APIs retain their prior semantics; connecting frontend operational controls remains later-phase work.

Run checks from a source checkout with the pinned installed interpreters:

```powershell
$env:M3_TEST_RUNTIME_PYTHON = $RuntimePython
& $BackendPython -B -m pytest backend/tests -q -p no:cacheprovider --basetemp $NewPrivateTestDirectory
& $RuntimePython -B -m pytest optimization/tests/test_job_forecast.py -q -p no:cacheprovider
```

Native acceptance is separate from synthetic unit tests. New forecast, explicit Accept/replay scopes and browser receipts are in `frontend/docs/evidence/member3-integration/phase3-forecast-*.json`; historical backend acceptance remains historical. Execution is `SIMULATED_REPLAY`, exposure is `PROXY`, and witnesses do not establish optimality, native SLA, real GPS observations or production calibration.

## Publication repair ? release revision 2

The r1 publication was rejected because its baseline public handoff lock did not match the shipped SDK. Functional browser receipts remain historical evidence for build c333372; they are not r2 acceptance. The replacement uses SDK task02-m2-runtime-sdk/2 and a generated handoff lock /2 covering job_forecast, forecast schema/units and verifier bytes. It includes the unchanged frozen crosswalk in the production closure. Both sealing and packaging invoke the shipped verify_lock() after inventory verification. Frozen external API v1 is unchanged; baseline-to-v2 compatibility requires explicit migration.

Current release and byte pins: [release guide](../docs/M3_FORECAST_EXTENSION_RELEASE_20261007.md). Fresh native G0/HTTP and release-verification receipts for r2 are separate from the earlier browser run. Reviewer sign-off on Phase 3 remains pending; the earlier DONE statement describes functional gates and is superseded for publication by this repair.
