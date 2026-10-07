# Phase 3 ledger — plan: docs/superpowers/plans/2026-10-06-member3-integration/plan.md

Base: 42ab9c379af7209d76cef5240364d0d9bef54590. User authorized TDD implementation and GitHub push.

Pre-flight: P3-01 supplies proposal geometry to P3-02; local M3 0.8.0 has no public forecast read. P3-03 comparison metrics and P3-02 accepted execution are independent of that gate.

Ruling: Implement and publish independent Phase 3 work while keeping the forecast gate pending — approved tasks explicitly allow this; claiming complete Phase 3 would misrepresent native acceptance — cost: proposal map remains unavailable until M3 handoff.

Ruling: Native accepted routes use a separate optional PlanState acceptedExecution projection rather than synthesizing legacy accepted plan metrics, stops or acceptedAt — the public trajectory does not supply those legacy fields; Driver operations remain gated until Phase 6 — cost: legacy stop workflow stays unavailable in backend mode.

Ruling: Work in the root integration workspace and synchronize reviewed frontend/docs changes to an isolated publication branch — native source binding and separately handed-off backend must be preserved — cost: publication requires byte equality verification.

P3-01: pending external public contract. P3-02: in progress (accepted branch only). P3-03: in progress.

TDD: initial adapter stubs produced 5 failing tests; UI and map tests failed before integration. Two added EDGE identity/observation-bound tests also failed before their fixes. Targeted 41/41 GREEN; root full suite 207/207 across 33 files, typecheck/build PASS.

Native: API/worker startup recovered and reached READY after bounded SDK contention; read-only S1 browser gate PASS (`phase3-scopes-native.json`). Comparison/card metrics equal public payload; refresh same session/comparison; only GET/OPTIONS and before/after world equal. No Accept or forecast geometry gate claimed.

P3-03: scoped KPI implementation and comparison/native-null checks complete; full native scopes gate remains PARTIAL (non-null observed/planned/projected accepted/replay state not checked). Full Phase 3 acceptance remains pending P3-01 and proposal branch of P3-02. P3-02 accepted branch implemented and unit-tested; no new native acceptance/replay mutation performed.

Final review: 6 Important, 0 Critical, 0 Minor; regraded by user effect, all six enter one TDD fix pass (see phase3-review.md). Declined-to-judge items remain explicit existing future gates; no rejected findings.

Ruling: Public execution-view lacks decision_epoch or source completed action IDs, so native completion remains unavailable rather than comparing action offsets with Unix timestamps — public contract cannot prove a completed prefix — cost: dimming remains pending an authoritative public progress/time-origin handoff.

Ruling: Preserve the full source EDGE geometry and add a separate drawable fraction following handed-off M2 directed haversine interpolation — partial EDGE actions carry full source polylines — cost: drawable endpoints are interpolated display points while exact source coordinates remain retained.

Final: fixed all 6 Important findings in one pass — 8 unit/UI regression cases RED→GREEN (including correction of the old epoch assertion), native KPI viewport bounds RED→GREEN, and synthetic-HTML/real-CSS browser wheel scrolling RED→GREEN. Publication local full suite 214/214 across 33 files, typecheck/build PASS; not independent CI checks. No deferred minors and no second review. Build retains the existing offline-pack large-chunk warning; asset cleanup is Phase 7.

Final: declined-to-judge items resolve to existing authorized future gates — forecast/rain public handoff, later operational APIs/Driver stops, and Phase 7 default/import/pack/cross-tab changes remain pending; none are reported as accepted by this release.

Final portable-validation checks also reproduced array-valued action kind/layer acceptance RED, then rejected these scalar-type violations GREEN within the same fix pass. Final native receipt rerun after scoped wrapping/scrolling PASS with 1280/1440/1920px bounds; no live accepted mutation performed.

User review follow-up at `2fdebc0`: verified Important Admin accepted status/coverage mismatch and Minor unstable native leg numbering. Two regression cases failed RED; after fixes targeted 19/19 GREEN, with a passing comparison-only guard. Backend status uses native acceptedExecution; coverage uses public delivered_prefix/planned_served_suffix; leg numbers derive from source ordinals before visibility filtering. Evidence wording now explicitly distinguishes local checks from CI and synthetic CSS/browser regression from native app/M3 acceptance. Full Phase 3 stays NOT DONE; no Phase 4 work started.

User review follow-up at `7ce9839`: verified Important presentation mismatch against spec P3-02: Admin displayed return geometry and native legs used only the first palette colour. Four regression cases failed RED (including corrected return-only expectation), then targeted 26/26 GREEN. Shared supplied-leg presentation derives stable source ordinals and existing cyclic V1/V2 colours before filtering; Admin excludes return segments/legends, while Driver forwards every accepted segment including mandatory return to Leaflet. Geometry adapter, source trajectory and scoped KPI remain unchanged. Added tests prove source snapshot equality and stable V2 colours when V1 is hidden. Tracker summary now says PARTIAL; full Phase 3 still NOT DONE. Fresh local verification recorded in phase3-presentation-verification.json, without a new native Accept/replay run.
