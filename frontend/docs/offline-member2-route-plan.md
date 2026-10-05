# Offline Member 2 road routes

**Goal:** Download the pinned M1 snapshot and released M2 runtime, compute matching S0/S2/S3/S4 profile routes offline, then consume supplied geometry in the existing mock frontend without changing its visual design.

**Architecture:** Keep the released solver and isolated Python environment in `m2_runtime`. Run the public RuntimeClient with the external approved build digest and read-only M1 snapshot. Export verified JSON profile packs outside the immutable runtime root. Frontend chooses an offline pack only when its scenario, order/custody/vehicle state and event phase match; all other worlds retain explicitly schematic prepared plans. No browser routing or live backend is introduced.

**Constraints:** Keep English UI, deterministic mock lifecycle, Accept-only dispatch, immutable accepted plan content and subscriptions. Preserve every supplied EDGE coordinate and order. Do not combine replay sample geometry with unrelated assignments or claim backend/GPS integration. Physical event replay output may differ from the UI mock world; bind explicitly before use.

## Tasks

- [x] R01: Find release/snapshot files on Drive; download only required databases and context metadata; verify Runtime/Integration ZIP hashes.
- [x] R02: Install workspace-local Windows Python 3.12; source catalog/fixture/manifest audit passes for all nine pinned scenarios.
- [x] R03: Install exact M2 dependency lock, attest CP-SAT and production inventory.
- [x] R04: Compute three profiles per supported initial scenario via public SDK; retain raw jobs, source pins, validation and execution views. All twelve profiles FEASIBLE/certified, no failures. Native post-event generation is outside this verified scope.
- [x] R05: TDD offline pack binding, action-to-stop/EDGE projection, missing/incompatible pack fallback, supplied geometry source and accepted/proposed independence.
- [x] R06: Wire matching offline packs into MockStateEngine proposals; preserve UI shell and label schematic fallback. Verify persistence compatibility and custody after Pickup/Delivered/events.
- [x] R07: Full frontend checks, browser route screenshots, document exact run/recompute commands and task status with evidence.

## Evidence — 2026-10-05

- Exact pinned M1 SQLite source hashes, runtime production inventory/build digest and locked Python environment verified. CP-SAT smoke OPTIMAL; nine-scenario source audit passes.
- Twelve certified completed FEASIBLE witnesses exported in four INITIAL packs; 13,232 EDGE geometries/actions match the raw jobs exactly (`tools/verify_generated.py`). Two exporter unit tests pass.
- TDD RED/GREEN observed for offline binding/wiring, completion, metric absence/scopes, fleet ETA labels, Driver incoming-leg aggregation and Leaflet class preservation on tile failure.
- Full frontend suite **97/97** passes; typecheck/lint/build exit 0. Bundle warning remains: approximately 3.55 MB JS / 875 kB gzip, including all four road packs.
- Browser initial S0/S2/S3/S4 Admin/Driver exact route counts, persistent hydrate and unmatched-event fallback pass in [offline-route-results.json](evidence/offline-route-results.json).
- Admin 1280/1440 and Driver 360/390/430 px all have `overflowPx=0`, nonzero map dimensions and supplied routes. Forced tile failure keeps 564 road paths / 6 markers and Leaflet classes. [Visual results](evidence/visual-results.json) and screenshots are retained.
- Review corrected mixed route/fuel comparisons, fleet-time-as-ETA labels, fabricated offline vehicle ETAs and first-edge-only Driver leg metrics. Tile failure previously overwrote Leaflet classes; a regression test now covers this.
- Real device/WebView/touch/focus remains open. Native post-event/current-world road integration requires separately bound snapshots or Member 3, not reuse of INITIAL geometry.

## Verification focus

1. Source SQLite bytes, no sidecars and external build digest match the release.
2. Scenario S0 has three orders; S2/S3/S4 initial worlds have eight, with S3 initial onboard custody. Packs cannot cross these worlds.
3. Only certified completed witnesses with all three profiles can replace prepared data; partial results preserve unserved diagnostics.
4. Geometry comes from ordered EDGE actions, including return legs. Do not fabricate depot-return execution actions or claim manual UI progress is native runtime replay.
5. Changed custody, unavailable vehicles, delivered orders and rain expiry invalidate an initial pack match; retained accepted geometry remains immutable.
