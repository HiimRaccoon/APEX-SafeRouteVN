# M3 forecast extension 0.9.0 supplemental release

Current release: `M3_forecast_extension_0.9.0_20261007_r2.zip`, a reproducible **code-only supplement**, not a standalone offline installation kit. Its sibling JSON manifest contains ZIP SHA-256, every payload pin and the public handoff lock digest. The archive contains the complete sealed runtime closure and backend production sources/scripts/lock. It excludes credentials, installation configuration, authority/metadata state, tests, caches, environments, M1 database copies and native wheels.

The published r1 ZIP with build `c333372...` is superseded: its inventory verified but its inherited handoff lock did not match the extended SDK, and its frozen public crosswalk was omitted. R1 bytes and native receipts remain historical; they are not relabelled as r2 acceptance.

The existing `M3_backend_0.8.0_20261006_113056.zip` and original M2 release packages remain immutable. This extension has its own build identity:

```text
Original M2 build: 80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41
Extension r2 build: d99f034a897b5c41f5b1c53efe32e57f62607072b237e858a6e1e3e11e68d756
Public lock SHA:   961222d072dbe18c5cf7ae549781693f2151a3180a5795370b8a4b076051fc63
Runtime production files: 143
HTTP app version: 0.9.0
```

The feature changes remain SDK/forecast. Release repair additionally versions `handoff.py`, includes the public crosswalk in `build.py`'s inventory, and generates a new `HANDOFF_CONTRACT_LOCK.json` through the public record function. `docs/step7_INTEGRATION_CROSSWALK.md` is copied unchanged from its verified baseline public pin and now included in inventory. The new lock schema is `task02-m2-runtime-handoff-contract-lock/2`, SDK public contract `/2`, with `job_forecast`, forecast view `/1`, units/scope and matching source/verifier pins. Frozen external API v1 is unchanged; `compatible(v1,v2)` requires explicit reviewed migration. The seal descriptor retains seal-time native status; later receipts are separate. This is not Leader production approval.

## Required inputs

Recipients need the original verified M1 handoff and frozen scenario/raw-source snapshots, the received M2 Step 7 runtime/integration handoff, approved Windows CPython 3.12 x64, and already installed dependencies matching `runtime/requirements-runtime.lock.txt` and `backend/requirements-backend.lock.txt`. The original offline kit's pinned wheelhouses may supply these dependencies. This supplement neither includes them nor authorizes replacing them with unpinned packages.

The baseline runtime comes from `SafeRouteVN_TASK02_Step7_Final_Release_Runtime_Windows_20261004.zip`; its external package SHA-256 is `d5345e75db2b41914cf4d0ed96a83e50e9c251637065ae1264eb1f33f41cbe4e`. The integration handoff is `SafeRouteVN_TASK02_Step7_Final_Release_Integration_Windows_20261004.zip`, SHA-256 `d59917dded655398a04f3856d1ae73c658cc3dec3002a3467fb24e8d4a45b5e7`. Keep the original M1 input verification and source receipts intact.

## Receive and verify

1. Compare the ZIP's SHA-256 with the sibling public JSON manifest. Extract to a new directory. Verify each `files` entry against the extracted bytes; `release_manifest.json` inside the ZIP describes the payload independently of the archive hash.
2. Run `runtime/runtime_entry.py`'s `verify_install` against the extracted inventory and externally pinned r2 build **before importing its SDK/verifier**. Then call the shipped `optimization.runtime.handoff.verify_lock(runtime_root, expected_lock_digest)` with the public lock digest above. Both checks must PASS. Keep the runtime separate from earlier installations.
3. Receive the supplement's complete `backend/` source tree into the team checkout. Preserve the original verified M1 scenarios/source handoff and existing frontend assets. Backend markdown and environment examples from the old kit are omitted to avoid stale installation paths; this document describes the extension.
4. Create a new private authority directory, M3 metadata database, server configuration and credentials. New configuration must point `runtime_root` to this extension runtime, `runtime_python` to the pinned interpreter, `snapshot_root` to the verified M1 input root, and `expected_build_sha256` to the extension digest. Set the private `authority_store_parent` and `latest_preflight_receipt` explicitly. Never carry old session pointers or change an old store's build label.
5. Obtain a **fresh extension-bound preflight** by actually running the original trusted input/source checks, installed inventory verification, pinned native environment smoke and SDK bootstrap/resolve checks against the new build and fresh authority. Persist their real results. A copied original G0 receipt is incompatible with this build. Do not rewrite its digest or relabel it as extension evidence. The legacy `preflight_m3.py` and `install_backend_offline.py` target the original release; they are not an extension G0/installer.
6. Start the API and worker with the existing backend launcher and explicit private configuration. Check `/ready`. Use the authenticated owner-scoped `GET /api/sessions/{session_id}/jobs/{job_id}/forecast`; witness-free jobs return null trajectory/metrics. Reads and local preview selection do not Accept or replay a plan. Driver routes remain accepted execution only.

For a configured fresh private installation, set these variables in both terminals and use the existing launch scripts from the team checkout:

```powershell
$env:SAFEROUTE_INSTALLATION_CONFIG = $InstallationConfig
$env:SAFEROUTE_AUTH_FILE = $AuthFile
$env:SAFEROUTE_METADATA_DB = $MetadataDatabase
$env:SAFEROUTE_WORKER_HEARTBEAT = $WorkerHeartbeat
$env:SAFEROUTE_OFFLINE_MODE = 'loopback-only'
$env:SAFEROUTE_OFFLINE_AUDIT_DIR = $PrivateNetworkAuditDirectory

# API terminal:
& $BackendPython -B backend/scripts/start_backend.py
# Separate worker terminal, with the same environment variables:
& $BackendPython -B backend/scripts/start_worker.py
```

The variables are recipient-provided private paths. The scripts use the pinned backend interpreter and genuine configuration, credentials, metadata and preflight prepared in steps 4-5. Run exactly one worker for the installation. The coordinated `run_backend.py` launcher is also available when its existing layout requirements are met: a `backend-venv` under the private local root and a snapshot root equal to the team checkout.

## Reproduce the seal and archive

From the current extension source checkout, use the pinned runtime interpreter and an untouched verified baseline runtime. Both output destinations must be new. Define the variables with local paths; no such installation paths are published in this archive.

```powershell
& $RuntimePython -B -m backend.scripts.seal_forecast_runtime `
  --original-runtime $OriginalVerifiedRuntime `
  --source-root $SourceRoot `
  --destination $NewSealedRuntime `
  --expected-baseline-build 80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41

& $BackendPython -B -m backend.scripts.package_forecast_extension `
  --runtime-root $NewSealedRuntime `
  --source-root $SourceRoot `
  --output $NewSupplementZip `
  --expected-build d99f034a897b5c41f5b1c53efe32e57f62607072b237e858a6e1e3e11e68d756
```

The sealer verifies baseline inventory and public pins, applies declared overlays, generates lock v2 with `record`, and derives a fresh inventory. Sealer and packager both run the **shipped** public verifier after byte verification in an isolated interpreter. A self-consistent inventory with a stale lock is rejected before archive writing. Packaging rejects detected private paths/credentials and fixes entry order/timestamps/permissions. Identical input bytes under the same Python/zlib version produce identical ZIP bytes. A changed source/seal needs a new artifact identity; r1 is preserved, not overwritten.

The published HTTP contract is supplemental `task02-m2-job-forecast/1`; existing `task02-m2-runtime-job-view/1` is unchanged. Geometry is WGS84 longitude/latitude, action time is exact microseconds, metrics are `FORECAST_ONLY`, execution is `SIMULATED_REPLAY`, and exposure is `PROXY`. This supplement does not claim real GPS observations, solver optimality, full Phase 7 acceptance, or production calibration.
