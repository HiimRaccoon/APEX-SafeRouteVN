# Phase 2 execution ledger

Plan: `plan.md`; authority: `spec.md`; scope: P2-01 through P2-03.

- Approved implementation and GitHub push requested on 2026-10-07.
- Baseline foundation: 27 tests / 4 files PASS.
- Pre-flight: P2-01 full basis feeds P2-02 registry; P2-02 validated comparison feeds P2-03 coordinator. No interface conflict.
- Ruling: implement in the supplied root workspace and synchronize only reviewed frontend/docs changes to the existing publication checkout on `feat/member3-phase2`. Root has no Git metadata and contains separately delivered backend/runtime; this preserves the operator's native installation binding. Cost if wrong: synchronization needs explicit file/diff verification before publishing.
- UI registry displays certified job metadata without constructing ProposedAlternative content; forecast geometry and metric adaptation remain Phase 3.
- P2-01: revision/helper test module missing before implementation; 3 revision tests PASS. Int64/full-basis seam and Admin map currency helper integrated.
- P2-02: compare/abort/API lost-reply/UI tests failed before implementation; client/parser/catalog/store/API/UI implemented. BUSY regression initially 1 attempt rather than 4; then PASS with 1/2/4 second backoff and identical body. Native READY checked on this installation.
- P2-03: coordinator missing initially; deadline regression showed unbounded in-flight GET; independent deadline abort now PASS. Targeted integration/API/UI 50 tests PASS; then deadline suite 10 PASS; full suite 192 tests / 31 files PASS; typecheck/build PASS.
- Browser attempts interrupted by development hot reload are not PASS evidence. Frozen-source native gate is running; final receipt and review findings pending.
- Ruling: network loss retains pending intent for explicit Refresh reconciliation; typed transient BUSY/timeouts get three automatic command retries. Cost if wrong: operators may need Refresh after a transport-only outage; no duplicate batch IDs are created.
- Ruling: `browser.mjs --all` rejects unimplemented future phase gates rather than reporting incomplete coverage as migration success. Cost if wrong: full migration CLI must be extended in later phases.
- Final independent whole-change review: two Important findings, no Critical/minor findings. Reviewer reproduced a definite STALE_HEAD pending trap and storage durability bypass/lost comparison-reference handoff. Three regression tests FAIL before fixes, then PASS; targeted API/store 28 tests PASS and typecheck PASS.
- Final fixed: definite STALE_HEAD retires only the rejected intent, fresh world read, new explicit Optimize uses new ID; ambiguous transport/auth/idempotency conflicts retain identity. Transactional command writes and required comparison-pointer persistence keep recovery identity across storage failures. Full suite after fixes pending below.
- Final review set-aside ruling: Phase 3 geometry/KPI, Phases 4–6 Select/Accept/Event/Replay/cross-tab and Phase 7 import isolation remain at their documented gates. Cost if wrong: no claim beyond Phase 2; consumers must keep those features disabled. Reviewer did not certify native acceptance; that requires the actual receipt below.
- P2-01, P2-02, P2-03 complete: final publication checkout 196 tests / 31 files PASS, typecheck/build PASS. Final native S1 browser gate PASS: session `session-1354a1db5cca45e48a58769ec613209a`, comparison `comparison-15b5c0c29cf3405f9671cfb343221937`, three bound native jobs, group COMPLETED/COMPARABLE, world/basis unchanged, no Accept/offline planning, read-only refresh, terminal comparison polling stopped; real 401 and 409 STALE_HEAD HTTP evidence.
- Final receipts: `frontend/docs/evidence/member3-integration/{phase2-latest.json,verification.json,review.md}`. Earlier interrupted development runs are not acceptance claims. The final run started with all transport/recovery fixes in place; the only subsequent UI change wrapped long job IDs to preserve card width.
- Final publish: source-byte equality, staged/build bearer scan and unchanged mock-runtime diff checked before commit. Shared main remains a0f49a5 before this authorized publish; push is fast-forward only.
