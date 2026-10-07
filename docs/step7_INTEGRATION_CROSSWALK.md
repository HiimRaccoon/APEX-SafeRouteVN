# M3 → M2 runtime → M4: supplemental contract

API v1 remains byte-identical. It does not represent arbitrary reload/mid-edge/
temporal/return-only actions. The old S2–S4 UNSUPPORTED examples are historical
contract fixtures, not the new runtime's event capabilities. Use the SDK and
`task02-m2-execution-view/2` for these trajectories; do not truncate them into
fake v1 static plans. `job_view` supplies a separate lifecycle/outcome view and
explicit `public_api_v1_dynamic_plan_available=false`.

| M3 input/persistence | Runtime public operation | Mutation | M4 / receipt |
|---|---|---|---|
| Authenticated scenario; server source/install config | bootstrap | new authority root | immutable basis, initial view |
| Request ID, profile (default BALANCED), budget, resolved basis | submit / compute | job only | QUEUED/RUNNING/COMPLETED/FAILED, forecast only |
| Chosen certified job + latest basis | accept | activation generation | accepted action trajectory, not delivered count |
| Server simulation clock and latest basis | advance | observed physical prefix | delivered, load, position, range, prefix metrics |
| Trusted due pending event ID + basis | apply_event | exactly-once event delta | S2 new order / S3 retained owner / S4 overlay |
| Job ID | cancel | lease/job only | FAILED/JOB_CANCELLED; physical commits unchanged |
| Session namespace | resolve/get_head/get_job/capabilities | none | typed view / IDs / simulation label |
| Server restart | recover | fences orphan leases | persisted same head and receipts, not a forecast |
| Outbox event ID | read_notifications/acknowledge | ack only | M3 dedup; no duplicate pickup/delivery |

M3 must not compute load/state from the UI response, accept self-asserted hashes,
construct trusted records from incoming jobs, or import Store/planner internals.
`ReferenceTransport` demonstrates durable accepted-command digest and notification
deduplication; real HTTP authentication, access control and persistence ownership
remain M3's work. M4 validates typed views and renders them; it does not certify
VRP/source feasibility or recalculate server hashes with JSON.stringify.

## Field mapping / null / units

`basis` binds session, root/head/source hashes, version, activation generation,
base context, effective overlay hash and installed build. `active_job_id=null`
means no activated suffix, not zero distance. `observed_metrics=null` means no
observation produced yet; zero metrics from a real observed frame mean zero.
Delivered-prefix, planned-served-suffix and unserved are unique disjoint sets
covering the current order universe (nine after S2). Planned ≠ delivered.

| View | UI meaning | Unit |
|---|---|---|
| current_time / position_timestamp | simulation time, not wall clock/GPS | ISO +07:00, ≤6 fractional digits |
| vehicles.position | map marker/directed-edge residual | WGS84 [longitude,latitude] |
| vehicles.current_load_kg / capacity_kg / onboard_order_ids | driver cargo with owner retained | kg |
| vehicles.remaining_range_m | remaining range, not nominal range | m |
| observed_metrics | executed prefix only | m, VND, µs, relative exposure proxy |
| planned_suffix_metrics | unexecuted forecast remainder | m, s, VND, exposure proxy |
| projected_whole_metrics | prefix + remaining suffix, not all executed | corresponding metric units |
| accepted_trajectory.vehicle_routes[*].actions | full return/reload/service geometry | signed µs, m, VND/km source rate |

Exact large integers are decimal strings; rational progress uses string numerator
and denominator. Nonfinite, duplicate keys and unsafe JS integer tokens are
rejected. The reference consumer displays SIMULATED REPLAY — not GPS. Exposure
is not an accident probability. Independent M2 source validation remains required.

## Consumer contract / upgrade

The lock records SDK signatures, operation set, schemas/checkers/vectors, units,
nulls, lifecycle and metric scopes separately from build identity. An internal
fix may require installing a new externally approved build. It does not license
silent contract changes: breaking semantics need a new version/adapter/migration
and Leader review. Current checker receipts never rewrite execution hashes.

## Exact portable and native commands

From a freshly extracted Integration ZIP (Python 3.12, Node installed):

```
python -m pip install -r requirements-runtime.lock.txt
python -m optimization.runtime.portable_tests --view examples/S2_execution_view.json --view examples/S3_execution_view.json --view examples/S4_execution_view.json
python -O -m optimization.runtime.portable_tests --view examples/S2_execution_view.json --view examples/S3_execution_view.json --view examples/S4_execution_view.json
node optimization/runtime/consumer_test.mjs
node optimization/runtime/reference_consumer.mjs examples/S2_execution_view.json
node optimization/runtime/reference_consumer.mjs examples/S3_execution_view.json
node optimization/runtime/reference_consumer.mjs examples/S4_execution_view.json
python -m optimization.runtime.consumer_golden --examples examples
python -O -m optimization.runtime.consumer_golden --examples examples
node optimization/runtime/consumer_golden.mjs examples
python -m pytest -q -p no:cacheprovider shared/contracts/test_task02_api_v1_portable.py
```

From Runtime ZIP: create a fresh writable store; configure the externally pinned
M1 snapshot and approved build digest from the external receipt. No PYTHONPATH,
frozen full-tree outputs, hidden seed or source SQLite copy is required.

```
python -m optimization.runtime.rolling_flow --snapshot-root <READ_ONLY_M1> --output-root <NEW_RUN_DIRECTORY> --scenario-id S8 --budget-seconds 120 --all-profiles --expected-build-sha256 <EXTERNALLY_APPROVED_BUILD_SHA>
```

Source-backed/review tests need full TASK02, frozen Step1–6 artifacts and M1 with
both SQLite DBs. They are not advertised as portable Integration-ZIP tests.
Native command captures and filled A01–A67 specify the actually tested build,
budgets, interpreter and exit code. Latency target 30 s is not a certified SLA.
S7 cold attempts in the preceding release returned SEARCH_LIMIT (no witness),
not a proof of infeasibility. Performance target remains NOT_MET. Use async
polling and structured timeout/no-witness handling, not a realtime claim.

## Release closure: compatible validation hardening

SDK/1, command/response/1, job-view/1, execution-view/2 and API v1 valid
payloads remain unchanged. A build digest is not a wire version. Current
consumer checks reject malformed trajectories previously accepted; the shared
golden corpus must continue to pass before an internal Step8/9 update. M3 only
updates its approved install digest via admin upgrade; M4 need not rewrite UI
for a build hash change. Breaking wire changes require Leader-reviewed version
and adapter/migration. Capability `release_status` describes implementation,
not a self-issued release certificate: trust the separate external delivery
receipt for the exact tested ZIP/build/environment and its acceptance verdict.

| Public SDK method | Input / precondition | Result / diagnostic and trust |
|---|---|---|
| RuntimeClient(snapshot_root, store_path, expected_build_sha256) | keyword-only server installation; approved Windows Python 3.12, locked packages | verifies production/lock bytes and actual installed versions; not client config |
| command(operation, command_id, session_id=None, **fields) | command/1 operation-specific fields; latest basis for physical mutation | response/1 OK or FAIL with code/path; idempotency conflict and STALE_HEAD are not solver PARTIAL |
| read_notifications(session_id) | server authority namespace | durable at-least-once outbox until acknowledged; M3 dedup event_id |
| acknowledge(session_id, command_id, event_id) | scoped persisted event; retry same key | ACKNOWLEDGED; different-payload retry fails; no physical mutation |
| validate_session(session_id) | admin trusted root/journal plus pinned source | current raw physical checker receipt; never overwrites execution hashes |
| backup(new_server_path) | admin new destination, verified authority | BACKUP_VERIFIED; no user source/store path accepted over HTTP |
| job_view(session_id, job_id) | server persisted job | lifecycle/result separately; dynamic API v1 plan unavailable |
| compare_profiles(session_id, job_ids) | completed validated jobs | COMPARABLE only identical input basis AND physical domain, otherwise NON_COMPARABLE |

Cancelled/stale workers cannot publish or rewind head; completed jobs are
immutable. Store corruption produces STORE_INVALID with a field path and
leaves bytes/evidence for admin recovery, not a fabricated FAILED result or
reset head. A rollback is an authorized monotonic build transition, never a
physical rewind. Old execution inventories remain historical; current checker
and environment attestations are separate.

Ownership/upload map: Member2 supplies optimization/runtime/*, its transitive
production optimization modules/assets, runtime_entry.py and dependency lock;
shared API v1 files are frozen bytes. Leader reviews/installs packages. M3 owns
transport/auth/server config/public persistence and calls only RuntimeClient;
M4 uses reference_consumer.mjs, schemas, golden vectors and simulated views.
No backend/frontend files or M1 SQLite are included. Install a separate runtime
package directory, not an overwrite of another member's entire project.
