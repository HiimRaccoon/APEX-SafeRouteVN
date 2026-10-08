# Step7 release closure candidate — Windows Python 3.12

This is a code package, not a self-issued READY receipt. Leader approves the
separate delivery receipt/build/environment. API v1 is unchanged. Runtime
SDK/1, job-view/1 and execution-view/2 are supplemental dynamic contracts.
All motion is SIMULATED_REPLAY, NOT GPS. Exposure is a relative proxy.

Install exactly `python -m pip install -r requirements-runtime.lock.txt` in an
approved Windows CPython 3.12 environment. A previously approved environment
may be reused: record executable, ABI, versions, native RECORD/import/CP smoke.
Do not disable Application Control if a fresh environment is blocked.
Configure external read-only M1 snapshot with both pinned SQLite databases,
no WAL/SHM/journal, private NEW authority store, and approved build digest from
server installation configuration, never from the incoming command.

Pre-import verify/start (commands are strict JSON on stdin):
`python runtime_entry.py --inventory production_inventory.json --expected-build-sha256 <APPROVED_SHA> --snapshot-root <M1> --store <NEW_STORE>`

Native cold/miss plus warm current-domain CP-SAT, accept, observed replay,
recovery and reference M3 transport (fresh output):
`python -m optimization.runtime.rolling_flow --snapshot-root <M1> --output-root <NEW_OUTPUT> --scenario-id S8 --budget-seconds 120 --all-profiles --expected-build-sha256 <APPROVED_SHA>`
Repeat with `python -O` and a DIFFERENT new output. This performs real engine
execution; examples/portable PASS do not certify it. Default online target30s
is not an SLA. Use asynchronous submit/compute/get_job; tested larger budgets
are explicit and performance is separately NOT_MET where measured.

Portable commands, SDK signatures/ownership and upgrade/rollback are in
docs/step7_INTEGRATION_CROSSWALK.md. Internal compatible validation fixes can
update approved build/lock through admin upgrade without rewriting M3/M4 UI;
breaking wire changes require reviewed version/adapter/migration. Existing
authority must be raw revalidated before upgrade; old workers are fenced.
Old valid commuting pickups retain their historical order. Invalid causal
history is BLOCKED, never silently repaired/reset/relabelled.

No endpoint/frontend, M1 databases, venv or historical solver stores are bundled.
GENERAL_M1_NOT_VALIDATED; E4_NOT_RUN; PRODUCTION_CALIBRATION_UNCONFIGURED.
