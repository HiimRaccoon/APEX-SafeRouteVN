# SDD ledger — plan: docs/superpowers/plans/2026-10-07-public-forecast-extension.md

Authorization: user requests implementing the missing M2 public projection and M3 HTTP route; existing migration spec provides frontend behavior and native gates. No request to alter solver, fixtures or existing accepted state.

Pre-flight interface review:

| Tasks | Interface/files | Finding |
| --- | --- | --- |
| 1 / 2 | SDK job_forecast and validator / runtime bridge | Exact supplemental forecast contract above; bridge must verify installed inventory before import. |
| 1 / 3 | public JSON / TS adapter | Source trajectory shape is portable accepted shape, but proposal is separately identified; no implicit acceptance. |
| 2 / 3 | owner-scoped GET / Member3Client | Same session/job binding plus all nine basis fields; historical reads permitted, stale preview prohibited. |
| 1 | SDK and tests | Legacy job-view remains unchanged; new production bytes require new build. |
| 2 | HTTP and tests | Read returns no witness as null; malformed certified payload fails closed. |
| 3 | preview and tests | Native metadata separate from mock model and acceptedExecution; local choice is read-only. |
| 4 | release and acceptance | Native installation must use new verified build/fresh authority; historic 0.8.0 remains intact. |

Ruling: use the existing authorized P3 spec plus an additive implementation contract instead of asking the user to approve the same missing-API scope again — purpose and constraints already established — any incompatible wire detail requires documented correction.

Ruling: prepare source in the root workspace and publish selected files through its existing isolated `.publish` checkout on a feature branch — root has no Git and existing workflow is user-specified — final audits must include source byte equality and publication dependencies.

## Implementation and review evidence

| Task | TDD and verification | Independent review |
| --- | --- | --- |
| 1 SDK | Missing public projection observed RED, then 54 focused tests PASS. Real Store synthetic tests prove journal/head/jobs/receipts/metadata/outbox unchanged. Portable/golden checks also passed; these fixture tests are not native witnesses. | Approved, no Critical/Important issues. |
| 2 HTTP | Owner/auth/full-basis/build/no-witness/malformed/read-only observed RED then GREEN. Final root backend suite: 875 PASS, one existing Starlette/httpx warning. Tiny bounded-deadline float correction has a deterministic regression. | Approved. |
| 3 Frontend | Adapter/API/map/Driver tests observed RED then GREEN; publication checkout fresh 234 tests/35 files, typecheck/build PASS. Existing large bundle warning remains while offline packs are preserved. | Approved, no Critical/Important issues. |
| 4 Release | Sealer 4 RED→GREEN tests; packager 7 RED→GREEN tests. Publication checkout SDK/release tests: 65 PASS. New build c333372abc263b14e3308580524b20bf2c959176b99e26fb14201240d008c381, 142 production files. | Missing publication builder dependency found Important and closed: full verified production source closure published; reviewer independently resealed exact build from checkout, original runtime unchanged. |

Native G0 is a fresh extension-bound technical preflight: verified raw M1 inputs/source gate, pinned native smoke, Python normal/optimized portable and golden corpus, JS portable/golden, portable API v1 and fresh S0 bootstrap/resolve. Installation/config/auth/state/logs remain private. The original release ZIP and historical receipts are unchanged.

Native HTTP S1 read-only gate PASS: three certified PARTIAL forecasts, full basis/metric equality, 401/403/404, whole execution view exactly unchanged before/after reads. Explicit Accept/replay scope gate was a separate fresh-installation test; observed/planned/projected metrics are non-null. Neither gate uses hidden acceptance to retrieve proposal geometry.

Ruling: the publication source must include the verified runtime production dependency closure, rather than only the two changed SDK files. All included baseline files matched sealed pins, with no conflicting existing publication files. `.gitattributes` preserves sealed bytes across checkout line-ending conversions; the ZIP remains the exact sealed release artifact.

Browser gate troubleshooting: the first harness overwrote UI preferences on reload; corrected conditional initial pointer injection. A rerun also revealed the harness waited only for the Optimize class although an existing comparison changes it to Re-optimize; corrected its readiness selector. Final rerun reuses the current completed native comparison via public GET, so it must not claim a fresh UI Optimize submission. Final browser completion and publication status are recorded only after actual receipt/push verification.

Full historical `optimization/tests` has four missing-frozen-artifact failures (117 other tests passed); these are separate from the 54 supplemental SDK tests and unchanged solver. No assertion that every historical project test passes is made.

Final native browser gate PASS: existing current completed comparison read-only, 1207 source EDGE/1159 visible drawable EDGE, exact public source fractions and geometry plus actual Leaflet input equality. Preview survives reload; Driver renders accepted-only source including mandatory return. Non-null observed/planned/projected cards match public state; whole before/after world equal and zero POST in browser requests. Receipt: `frontend/docs/evidence/member3-integration/phase3-forecast-browser-native.json`. Phase 3 gates are closed; Phase 4–7 are not certified by this run.

Final independent review approved the native receipt, current task/guide scope and release portability. It independently checked every source/drawable EDGE, partial exact fraction, accepted-only Driver and all three scope values, with 184 browser requests / zero POST / zero page errors. No remaining Critical/Important issues. See the sanitized `phase3-forecast-review.md`.

Publication preparation audit PASS: source/publication byte equality, all 142 staged production pins, runtime token absence in selected source/evidence and dist, protected road packs/default mock factory unchanged, original 0.8.0 ZIP unchanged. Git whitespace check passes with inherited `blank-at-eof` warnings excluded: eight imported baseline files retain their original trailing blank lines to preserve sealed bytes.
