Member 4 ownership — Admin Decision Workspace and Driver Operational Web.

Phase 1 is a React + TypeScript + Vite demo. It implements `/admin` for the
dispatcher and `/driver` for the driver, with a shared mock state engine and
`localStorage` persistence. It uses the pinned Member 1 S0/S2/S3/S4 fixtures.
Phase 1.5 uses offline Member 2 road routes for the matching initial S0/S2/S3/S4
worlds. All three profiles were computed and certified with the released runtime.
Their supplied geometry, assignment and forecast metrics are consumed together.
Five exact post-event worlds also use locally computed M2 forecasts, with
independent raw-source validation and a bounded subset candidate policy.
Unmatched execution worlds fall back to explicitly schematic demo plans.
Live backend integration remains Phase 2.

## Run locally

```powershell
cd C:\Users\Windows\Downloads\SafeRoute\frontend
npm.cmd install
npm.cmd run dev
```

Open the URL Vite prints, then use `/admin` or `/driver`. For two-tab sync,
open one route in each tab of the same browser profile.

## Verify

```powershell
npm.cmd run test:run
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Demo flow: load S0 → Optimize → Select → Accept → open `/driver`
→ trigger one event → Re-optimize → Select → Accept. Reset Demo starts a new
round. Direct S2/S3/S4 loads the fixture initial state and leaves its event
ready for Dispatcher to trigger.

To see the new road routes after an earlier demo, refresh and **Reset Demo →
Optimize → Select → Accept**. In Admin's right **Decision Intelligence** panel,
turn **V1 Route** and/or **V2 Route** ON. Both start OFF on refresh; markers stay
visible. These view controls never change the plan or Driver state. A valid selected
proposal previews by itself; otherwise the active accepted route is shown.
V1 uses blue/cyan legs; V2 uses green for leg 1 and dark green for leg 2.
The scrollable legend lists leg targets. Both maps hide return-to-depot forecasts
without modifying the supplied plan. Driver uses the same leg palette as Admin.
Completed Admin travel is hidden; Driver retains dimmed completed history.
Existing accepted history is not silently changed.
S0's three runtime profiles happen to produce identical routes. Offline source
time is a forecast label; the UI continues to use the deterministic demo clock.
Absent runtime on-time percentage displays as a dash; runtime total cost is
route cost, not fuel cost. Manual execution remains a mock lifecycle.

Event road demo (trigger before manual Pickup/Delivered):

| Starting world / event | Current exported result, all three profiles |
| --- | --- |
| S0 / Urgent Order | 4/4 served, FEASIBLE, capacities remain 15 kg |
| S0 / Vehicle Unavailable | 3/3 served by available vehicle, FEASIBLE |
| Direct S2 / Urgent Order | 8/9 served, PARTIAL; O007 unserved |
| Direct S3 / Vehicle Unavailable | 5/8 served, PARTIAL; O001 remains with unavailable V1 |
| Direct S4 / Rain | 8/8 served, FEASIBLE |
| S0 / Rain | Unsupported by M2 pinned S4 rain root; schematic fallback |

Trigger → Re-optimize → select → enable the vehicle routes to preview → Accept.
Driver receives the new route only after Accept. Every road point comes from M2;
the frontend neither links stops nor calls a Directions service. These are static
manual-world forecasts, not authenticated native SDK replay or live solves.
Source forecast time is shown next to the map title, separately from Demo time.
Physical pickup/delivery changes require a separately computed matching export;
do not reuse a pack from a different custody/position/world.

A new/reset S0 round starts with **three orders and Urgent Order OFF**. ON adds
the fixture urgent order; OFF cancels only that order while it is still waiting.
After pickup it cannot be switched OFF. A toggle marks the accepted plan stale;
**Re-optimize → Select → Accept** to update Driver. ON/OFF/ON does not duplicate
orders. The round remains reserved for this event; Reset or Load Scenario before
trying a different event. Refresh restores your saved round. To see the clean
starting screen after an earlier demo, use **Demo tools → Reset Demo** once.

For source hashes, raw certified jobs and offline recomputation commands, see
[Member 2 runtime](../m2_runtime/README.md). No Python setup is needed to run the
frontend with the generated asset.

- [Phase 1 design spec](docs/phase-1-design-spec.md)
- [Phase 1 implementation plan](docs/phase-1-implementation-plan.md)
- [Phase and task tracker](docs/tasks.md)

## Repository checkout

Keep `frontend/` alongside the repository's pinned Member 1
`scenarios/fixtures/thu-duc-binh-thanh-v1/` directory. Its S0/S2/S3/S4 JSON files
are required by the mock fixture adapter. Member 2 execution-view contract tests
use exact handoff samples pinned in `src/integrations/member2/fixtures/`; a
separate local Member 2 source checkout is not required to run these tests.
The fixture README records their origin and SHA-256 hashes. These samples are
test-only and are not imported by the app.
