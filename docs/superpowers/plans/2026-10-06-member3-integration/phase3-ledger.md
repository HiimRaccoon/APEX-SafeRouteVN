# Phase 3 ledger — plan: docs/superpowers/plans/2026-10-06-member3-integration/plan.md

Base: 42ab9c379af7209d76cef5240364d0d9bef54590. User authorized TDD implementation and GitHub push.

Pre-flight: P3-01 supplies proposal geometry to P3-02; local M3 0.8.0 has no public forecast read. P3-03 comparison metrics and P3-02 accepted execution are independent of that gate.

Ruling: Implement and publish independent Phase 3 work while keeping the forecast gate pending — approved tasks explicitly allow this; claiming complete Phase 3 would misrepresent native acceptance — cost: proposal map remains unavailable until M3 handoff.

Ruling: Native accepted routes use a separate optional PlanState acceptedExecution projection rather than synthesizing legacy accepted plan metrics, stops or acceptedAt — the public trajectory does not supply those legacy fields; Driver operations remain gated until Phase 6 — cost: legacy stop workflow stays unavailable in backend mode.

Ruling: Work in the root integration workspace and synchronize reviewed frontend/docs changes to an isolated publication branch — native source binding and separately handed-off backend must be preserved — cost: publication requires byte equality verification.

P3-01: pending external public contract. P3-02: in progress (accepted branch only). P3-03: in progress.

TDD: initial adapter stubs produced 5 failing tests; UI and map tests failed before integration. Two added EDGE identity/observation-bound tests also failed before their fixes. Targeted 41/41 GREEN; root full suite 207/207 across 33 files, typecheck/build PASS.

Native: API/worker startup recovered and reached READY after bounded SDK contention; read-only S1 browser gate PASS (`phase3-scopes-native.json`). Comparison/card metrics equal public payload; refresh same session/comparison; only GET/OPTIONS and before/after world equal. No Accept or forecast geometry gate claimed.

P3-03: independent scoped KPI implementation/native checks complete; full Phase 3 acceptance remains pending P3-01 and proposal branch of P3-02. P3-02 accepted branch implemented and unit-tested; no new native acceptance/replay mutation performed.
