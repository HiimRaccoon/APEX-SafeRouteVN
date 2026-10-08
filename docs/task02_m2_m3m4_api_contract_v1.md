# TASK-02 → M3/M4 API contract v1 (transport contract, no endpoints)

This is a versioned handoff contract, not backend or frontend code. The
machine-readable Draft 2020-12 schema is
`shared/contracts/task02_api_v1.schema.json`; the reference semantic checker,
portable vectors and examples are adjacent. M3 owns HTTP/persistence and M4
owns display. M2 owns projection of its *certified* witness or fail-closed
adapter rejection. No API endpoint, post-event state or three-profile M1
decision is implemented by this patch.

This final closure package supersedes the unshipped closure candidate ZIP
`9ee1cc313f0ffa52e97603049036f006d98505106690879a6ab1c61153a1ac2d`,
which itself superseded the earlier candidate
`a9a5c9cd82e2acdeb9f8c3ad9cd793565147d2c06b602f544b328e7bf30107d9`.
Leader confirmed that no M3/M4 implementation consumed that candidate, so the
wire versions remain `/1`. The 11 valid S0--S4 projection JSON files are byte
identical; only validation, trusted-source anchoring, vectors, documentation
and the projection manifest are hardened.

## HTTP boundary and job lifecycle

Proposed (not implemented): `POST /api/v1/decisions` accepts
`task02-m2-m3m4-request/1` and returns a
`task02-m2-m3m4-job/1` with `QUEUED` plus an opaque `run_id`;
`GET /api/v1/decisions/{run_id}` returns that same job envelope in
`QUEUED`, `RUNNING`, `COMPLETED` or `FAILED`. Only `COMPLETED` contains a
`task02-m2-m3m4-decision/1`. `FAILED` contains a system failure diagnostic
and no decision. It is **not** `PARTIAL` or input `INVALID_DATA`.

The request carries `request_id` as an idempotency key, `scenario_id`,
`state_ref={kind:SERVER_MANAGED,state_id}`, decision epoch, expected integer
state version, expected context version and nullable event ID. M3 must resolve
the state from its trusted source before acceptance. Client-provided source
hashes, `source_authentication`, routes and alternative selections are
forbidden by `additionalProperties:false`; a client cannot self-certify.
Repeated `request_id` with byte-independent canonical JSON-equivalent payload
returns the original job; a different payload returns
`IDEMPOTENCY_CONFLICT` at `request_id`. M3 must persist this comparison
atomically; the reference checker only defines the rule. Stale state/epoch
returns `VERSION_MISMATCH`, differing context `CONTEXT_MISMATCH`, and an
unresolvable state reference or source `SOURCE_MISMATCH`. Those are
`INVALID_DATA` diagnostics if a decision is emitted, not solver infeasibility;
a storage or validation system failure is job `FAILED` instead. Event requests
use the pending event timestamp as decision epoch while referring to the
pre-event state/version. No post-event state is fabricated.

## Public decision status and validation

| Public v1 status | Required payload | Meaning |
| --- | --- | --- |
| `FEASIBLE` | Full served set, empty unserved, non-null plan, validator `PASSED` | Independently valid witness; **not optimal**. |
| `PARTIAL` | Nonempty served and unserved, disjoint complete partition, reason per unserved order, valid plan | Witness serves only part of the state; not proof remaining orders are impossible. |
| `UNSUPPORTED` | Null plan, empty served/unserved, `coverage_evaluated=false`, validator `NOT_RUN` | Policy/features missing; adapter `UNSUPPORTED_POLICY` and `UNSUPPORTED_FEATURES` map here without losing diagnostic code. |
| `INVALID_DATA` | Null plan, no coverage claim, validator `NOT_RUN` | Version/context/source/shape error, with precise diagnostic. |
| `SEARCH_LIMIT`, `TIME_LIMIT` | Null plan if no validated witness, no coverage claim | Incomplete search; never `PROVEN_INFEASIBLE`. |

`NO_SERVICE` is reserved for a future v2 policy and is not a v1 enum.
Job `COMPLETED` may carry any public decision status; job `FAILED` never
masquerades as one. No-witness/unsupported validation is exactly
`{status:NOT_RUN,valid:null,validator_version:null,gate:null}`. A witness has
`PASSED`, `valid:true`, independent validator version and its source gate.
`validation.valid` certifies feasibility and metadata consistency against the
validated source, not optimality. `search` is telemetry, not a proof that
every limit or counter exhaustively describes the search. If supplied,
limits must contain positive time/route/road/label/arrival caps; bounded S1
`/1` must report `optimality_proven=false` and `search_complete=false`.
Every no-witness `UNSUPPORTED`, `INVALID_DATA`, `SEARCH_LIMIT` or `TIME_LIMIT`
decision must include at least one `ERROR` diagnostic with nonempty code,
path and message. This is the reason shown by M4; an empty list is invalid.

## Crosswalk, units and source authentication

| M1/M2 source | API v1 field | Meaning |
| --- | --- | --- |
| Receipt-gated `DecisionState/2` | request `state_ref`, decision `state_version`, `context_version`, `source` | `stateVersion` remains an integer. Deserializing a client claim is not source authentication. |
| `EventEnvelope/1` pending S2/S3/S4 | request/decision `event_id`, event timestamp | Event not applied; `post_event_state=null`. |
| S0/S1 solution + independent validation + manifest | `plan`, `validation`, `derived_from` | Projection, **not** raw solver wire or a new solve. Every derived artifact SHA is pinned. |
| `served_orders` + state orders | `order_ids`, `served_orders`, `unserved_orders` | Semantic validator enforces full partition for FEASIBLE/PARTIAL. |
| route `legs[].geometry` | GeoJSON `LineString.coordinates` | WGS84 `[longitude,latitude]`; directed edge IDs and selected geometry preserved. |
| `total_exposure` | `total_exposure_proxy` | Raw relative exposure proxy, **not** accident probability. |
| M1 `costPerKmVnd` | rate unit `VND/km` | S1 cost already computed in solver; no API recomputation. |

Canonical public units are mass **kg**, distance **meter**, duration
**second**, rate **VND/km**, computed cost **VND**, WGS84 GeoJSON
`[longitude,latitude]`, ISO time with explicit `+07:00`. `S0` has no
certified VND cost: `total_cost_vnd=null`, `cost_available=false`, and each
route cost null—not zero. S1 loads from the pinned fixture are V1 **12.008
kg**, V2 **13.426 kg** (fleet **25.434 kg**).

`source` and `derived_from` inside JSON are provenance *claims*. A consumer
trusts them only when M3 resolved the state from the receipt-gated loader or
independently rechecked raw bytes, run manifest, artifact SHA and validator
gate. The examples were built with that loader on the pinned M1 snapshot;
the portable tests deliberately do not need the 1.49 GB SQLite files.

The projector authenticates its three local inputs before reading their child
artifacts by comparing raw manifest bytes with reviewed checkpoint digests:
S0 `d7a259215003272fde0b3b0a778998a3a2c46088b7f2469860f43aa9ff01e55b`,
S1 `4ba0e8bdb419164f5df8d43148e8e75a04d4d22956ad9b36698168f48c169357`,
and Gate 1 `ecea384ab8867d6465c7248cc5a70578050d4f2253fef2c3d8be5b3852926b31`.
It then verifies child bytes and hashes. These local pins are a reviewed trust
anchor, not a digital signature and not proof against replacement of both code
and trust store.

`validate_job(job, resolved_state)` is deliberately an offline shape and
semantic checker. It cannot authenticate `request_id`, `validation.gate` or
`derived_from` merely because they are present. M3 acceptance/persistence must
use `validate_bound_job(job, accepted_request, resolved_state, trusted_job)`.
That mode compares job/request IDs and run ID with server-controlled records;
for completed jobs it also compares scenario/event/epoch/state/context plus
the validation gate and full `derived_from` evidence. For queued, running and
failed jobs it compares the persisted request/run IDs without requiring a
decision. A failed job still carries no decision.

Bound mode fails closed with `TRUSTED_STATE_REQUIRED` at `resolved_state` when
the server-resolved state is absent or incomplete. It never reconstructs that
state from client request/job provenance. `trusted_job` likewise means an
independent record read from M3 persistence or reviewed evidence. Production
code must not build it from the incoming job. The projector's private
`_trusted_job_record(job)` is only a final consistency check after that job has
already been derived from the three raw-manifest pins; it is not an endpoint
authentication pattern.

The checker rejects non-finite numbers even if Python's permissive decoder
created `NaN`, `Infinity`, `-Infinity` or converted `1e999` to infinity.
Route continuity checks are intentionally structural only: each leg endpoint
and stop node must align with `node_sequence`. They do not revalidate graph
edges, forbidden turns, load, deadlines or VRP feasibility; those claims are
trusted only through the pinned independent validator evidence above.

## Evidence-backed examples and policy boundary

`shared/contracts/examples_v1/s0_job.json` projects
`S0_20260929T174046567846Z` (3/3; historical `s0_gate=PASS`);
`s1_job.json` projects `S1_20260930T043601841406Z` (8/8;
`S1_VALIDATED_FULL_8_OF_8`, manifest `/2`, validator `/2`). Each has a
matching request. Routes, stop order, directed edge IDs, geometry, D/T/raw
exposure, served set and available metrics come from those solution bytes;
`derived_from` gives relative artifact path and SHA-256. The examples are
**projections**, not actual persisted M3 jobs.

S2, S3 and S4 request/job examples project the real Gate 1 adapter rejection
artifact. They show public `UNSUPPORTED`, null plan and post-event state,
`coverage_evaluated=false` and the unchanged diagnostic codes respectively
`DEPOT_RELOAD_POLICY_MISSING`, `CUSTODY_POLICY_MISSING`, and
`POST_RAIN_FEATURES_MISSING`. Under Leader policy
`task02-m1-event-policy/1`, no event has been applied: dispatch/depot reload,
custody transfer and post-rain features/context are not materialized.
`lifecycle_jobs.json` is explicitly transport-only and does not claim an
underlying solver run.

The Phase A `DecisionResult` (string `state_version`, exactly FASTEST,
BALANCED, SAFER alternatives) is unchanged and **not** this one-witness
envelope. A future multi-profile API must introduce a new version or an
additive explicitly versioned extension after real M1 profile validation;
neither S0 nor S1 is silently expanded into three routes.

## Portable and source-backed acceptance

The ZIP supports two deliberately separate levels. After extracting it into a
clean directory, M3 can run the **portable** suite with only Python and the
bundled requirements:

```powershell
python -m pip install -r shared/contracts/requirements-test.txt
python -m pytest -q shared/contracts/test_task02_api_v1_portable.py
```

That suite imports no `optimization` module and needs no SQLite or external
run directory. It checks the Draft 2020-12 schema, neutral vectors, all 11
projection JSON files, finite-number handling, malformed status containers,
route structure, offline/bound separation, required server state and package
hashes. M4 can consume `task02_api_v1_vectors.json` in another language; the
Python test is the reference result, not a requirement to embed Python in M4.

The ZIP is also a patch package for the full TASK-02 tree. The
**source-backed** suite requires that full tree, pinned S0/S1/Gate 1 run
directories, the reviewed M1 snapshot and its two SQLite files. From the
TASK-02 root:

```powershell
$M1_ROOT = 'C:\Users\DOTHANHSON\Documents\Codex\Member1MappingAudit_20260928'
python -m optimization.integration.member1_mapping_audit --snapshot-root $M1_ROOT
python -m optimization.tests.member1_decision_state_real_source_gate --snapshot-root $M1_ROOT
python -O -m optimization.tests.member1_decision_state_real_source_gate --snapshot-root $M1_ROOT
python -O -m optimization.integration.member1_api_contract_projection --snapshot-root $M1_ROOT --output-root <new-empty-dir>
python -m pytest -q optimization/tests/test_member1_api_contract.py
python -m pytest -q
```

`optimization/tests/test_member1_api_contract.py` intentionally contains
source-backed pin/projector checks and is therefore not the portable ZIP-only
command. Running it without frozen artifacts is expected to fail rather than
silently downgrade source authentication.

M3 may now implement state resolution, atomic idempotency, POST/GET job
persistence and HTTP status mapping against the schema and vectors. M4 may
render lifecycle separately from business status, show `NOT_RUN` and
`coverage_evaluated=false` honestly, display metrics/geometry with declared
units and use the same vector JSON. Neither may infer post-event results or
three profiles from these examples. The reference validator returns stable
code/path diagnostics; schema checks shape and semantic checks use a
server-resolved state summary. Production trust and concurrency remain M3
responsibilities.

Version rule: additive optional fields may be added only with a documented
compatible revision; changing required fields, enum/status meaning, units,
nullability, gate interpretation, or idempotency semantics requires `/2`.
Frozen DecisionState/2, EventEnvelope/1, adapter/2 and solver wires do not
change. Gate labels remain `S0_GATE_PASS`, `S1_VALIDATED_FULL_8_OF_8`,
`GENERAL_M1_NOT_VALIDATED`, `E4_NOT_RUN`,
`PRODUCTION_CALIBRATION_UNCONFIGURED`, `S2_S8_SOLVER_NOT_VALIDATED`.

## Windows acceptance record (2026-09-30)

Python 3.12.14, pytest 8.4.2, OR-Tools 9.15.6755 and jsonschema 4.25.1.
M1 `verify-scenarios` exited 0 with `verified=true`, 9 fixtures and
`integrated=false`; TASK-02 audit exited 0 at 9/9; normal and `python -O`
crosswalks exited 0 at 9/9. The projector itself ran under `python -O`,
exited 0 and wrote `outputs/member1_api_contract/API_V1_20260930T052550Z`:
11 projected JSON files plus `manifest.json`. Its manifest reports nine
receipt-gated states and independently checked SHA-256/bytes for 11/11 files;
the 11 projected files match the shared examples byte-for-byte. The run
manifest is 3,298 bytes, SHA-256
`da45e33cc3313c443d0a011527f2933548a0ab5a4096876d4cdbde93f0fcae8f`.
The separate `lifecycle_jobs.json` is explicitly synthetic transport
documentation, not a projection from a run.

Contract tests: 33 passed. Contract + S1/S0/adapter/audit group: 168 cases
(rerun after sealing the package manifest); full `python -m pytest -q`:
369 passed, 0 failed, 0 skipped, 3 existing SWIG deprecation warnings.
One E3.1 test intermittently failed during the *previous S1 closure turn*;
the cause remains unproven, although it did not fail in this contract turn.
After the full suite rewrote three legacy B1.1 report JSON files, those
bytes were restored from the frozen checkpoint and compared again. B1.1
200/200, B2 FinalCorrection 12/12, E4 historical outputs 53/53, Gate 1
8/8, and S1 closure 7/7 remain byte-identical; S0/S1 pinned payloads
still match their manifests. The package manifest lists exact byte/SHA for
all included source, examples, vectors, documentation and projection output.

## API v1 closure acceptance (Windows, 2026-09-30)

The pre-fix counterexample selection produced 17 failures: a mutually
tampered S1 solution/manifest was accepted; four no-witness statuses accepted
an empty diagnostic list; seven non-finite Python/decoder values lacked the
stable finite-number diagnostic; request binding had no entry point; two
route discontinuities passed; and two self-declared evidence claims passed
offline. After the narrow patch, the focused set passed 19 tests, all contract
tests except the intentionally not-yet-resealed package check passed 59, and
the contract/S0/S1/adapter/audit group passed 205 with one deselected package
check. The resealed package check then passed independently.

M1 `verify-scenarios` exited 0 with `verified=true`, nine scenarios and
`integrated=false`. TASK-02 source audit exited 0 at 9/9; normal and optimized
(`python -O`) crosswalks each exited 0 at 9/9. The optimized projector exited
0 and created `API_V1_CLOSURE_20260930T110454834911Z`. Its 11 projection
payloads match the candidate examples byte-for-byte (11/11); its 3,575-byte
manifest SHA-256 is
`6ea1084fa7f8aa645997df6aaf2b5fb45145b4ab1fc6a8c9dd0ad90df89cdd92`
and records the new code/schema/checker hashes plus all three reviewed manifest
pins. This is projection from existing evidence, not a solver run.

The single final full regression ran under Python 3.12.14, pytest 8.4.2,
OR-Tools 9.15.6755 and jsonschema 4.25.1: **396 passed, 0 failed, 0 skipped**
in 44.75 seconds, with three existing SWIG deprecation warnings. S2--S4
remain `UNSUPPORTED` with null plan and post-event state; S5--S8 solver,
rolling replay, E4 and production calibration remain outside this closure.

## Final handoff closure acceptance (Windows, 2026-09-30)

Technical-review counterexamples were first run against the closure candidate.
Both malformed status cases raised `TypeError: unhashable type`, while both
bound calls without a resolved state incorrectly returned no issues: **4
failed, exit 1**. After the narrow guard, those four tests passed. Array/object
status now returns `SCHEMA_INVALID` at `status` for direct decision validation
and `decision.status` for job/bound validation. Missing or incomplete trusted
state returns `TRUSTED_STATE_REQUIRED` at `resolved_state`. With the correct
state, a changed fixture digest returns `SOURCE_MISMATCH` at
`source.fixture_sha256`; offline `validate_job(job, None)` remains intentionally
source-unbound.

The portable suite is now a separate bundled file and passed **46/46**. The
source-backed API contract tests passed 67 with one package check temporarily
deselected during resealing; S0/S1/adapter/audit/integration tests passed 146.
The one final full regression used Python 3.12.14, pytest 8.4.2, OR-Tools
9.15.6755 and jsonschema 4.25.1: **450 passed, 0 failed, 0 skipped** in 69.35
seconds, with the same three SWIG deprecation warnings. Three legacy B1.1 JSON
files written by tests were restored exactly from the frozen checkpoint.

M1 `verify-scenarios` again exited 0 (`verified=true`, nine scenarios,
`integrated=false`); source audit, normal crosswalk and optimized crosswalk each
exited 0 at 9/9. Optimized projection created
`API_V1_FINAL_20260930T120010773335Z`. Its 11 payload JSON files are byte-equal
to the preceding closure candidate. The 3,575-byte run manifest SHA-256 is
`79d2e5f6d8455e9b26e817c6b4e3940957066b947dc2a6c7110c016f3b27e907`;
the changed checker hash is recorded while schema and three source-manifest
pins remain fixed. No solver was rerun by this projection.
