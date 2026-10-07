# Forecast release public-lock repair

User request: fix Important review finding at `8b71c442` / implementation `c830f218`, then push GitHub. The public handoff lock pins the old SDK and its verifier cannot validate the shipped extension. Frozen 0.8.0 inputs and published r1 ZIP/receipts remain unchanged; r1 is superseded for publication.

Authorized design: version the supplemental handoff lock to `/2`, SDK public contract `/2`; declare `job_forecast`, `task02-m2-job-forecast/1`, forecast scope/units and pin forecast/verifier files. Frozen external API v1 and command/response/execution/job views remain unchanged. Baseline-to-v2 compatibility requires explicit reviewed migration, not a silent compatibility claim.

Generate the lock through `handoff.record` after verified baseline copying and declared source overlays. Verify baseline public file pins as well as old inventory, copy the previously omitted frozen crosswalk, generate the new inventory, then invoke the shipped `verify_lock` in an isolated interpreter after production-byte verification. Packaging must repeat this check before writing a ZIP, including when a malicious/stale SDK and inventory were self-consistently rehashed.

- [x] RED: seal lock/crosswalk regression, public v2 semantics/forecast tamper/migration, stale-lock packaging regression.
- [x] GREEN: SDK/handoff/seal/package focused checks; full backend verification.
- [x] Fresh derived build and r2 ZIP; extract/reverify actual shipped lock/public files, immutable baseline/r1 checks and independent review.
- [x] Fresh new-build native G0 and forecast HTTP smoke. Earlier browser receipts keep their original build and are not relabelled.
- [x] Prepare source/contract/release/evidence publication; verify staged bytes and secret-free payload. Push and remote HEAD verification follow after this receipt.

Additional RED/GREEN: actual SDK VERSION_SDK versus generated lock, forecast version and units; SDK bumped to /2 before final reseal. Focused 74 tests PASS, full backend 878 PASS; frontend 234 tests/typecheck/build PASS. Final build d99f034a897b5c41f5b1c53efe32e57f62607072b237e858a6e1e3e11e68d756; extracted verifier and reproducible ZIP confirmed independently.

Final native session session-e81d0eb1f92741cd92074666e748c91c: fresh G0, three certified profile forecasts/read-only/auth and separate explicit Accept/replay scope checks PASS. Current ZIP c7d0ee00c8d3ca8ab3cf9f403610fee8f4a6df7455ba554f7e4af7591234bea1. Browser receipts retain r1 provenance. See phase3-forecast-contract-lock-verification.json for exact release/check scope. Git whitespace verification preserves inherited blank EOF lines in frozen sources.
