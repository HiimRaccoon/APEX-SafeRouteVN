# SafeRoute VN — Member 3 Integration Tasks

**Cập nhật:** 2026-10-08. Đọc [spec.md](spec.md) và [plan.md](plan.md) trước thực hiện. Chỉ có **7 phase lớn**, task IDs bên trong là checklist triển khai.

`[x]` = implementation + evidence hiện có; `[ ]` = chưa làm hoặc chưa nghiệm thu. Ghi BLOCKED chỉ trên task có phụ thuộc cụ thể; không coi mọi migration bị chặn khi còn việc độc lập. Tracker này dành cho M3 migration, không đổi trạng thái lịch sử mock Phase 1/1.5 trong `frontend/docs/tasks.md`.

| Phase | Trạng thái tại lúc viết | Điều kiện ra phase |
| --- | --- | --- |
| 1 — Foundation | Load/read S1 native đã PASS | Baseline tests khi bắt đầu Phase 2; không làm lại code Foundation. |
| 2 — Optimize | PASS native S1, 196 tests; 2026-10-07 | String revision + real comparison + lifecycle/polling/error gate. |
| 3 — Map + KPI | PASS native S1, extension 0.9.0; 234 frontend tests | Certified forecast + accepted geometry + non-null scopes, read-only map/reload/Driver gate PASS. |
| 4 — Select + Accept | PASS native S1 r2; 260 tests, review fixes verified | Local Select + certified current-basis Accept + server state. |
| 5 — Event + Re-optimization | PASS native S2/S3/S4; 294 tests, review fixes verified | Native S2/S3/S4 barrier/apply/re-optimize đúng. |
| 6 — Driver Execution / Replay | PASS native S0/S2; 327 tests, review fixes verified | Backend accepted Driver/replay controls + server session cross-tab. |
| 7 — Cutover + Cleanup + E2E | Chưa triển khai | E2E trước/sau cleanup, backend default/import graph sạch, mock lightweight chạy. |

## Cách thực hiện và ghi evidence

Mỗi task mới thực hiện test cycle: viết test có assertions bên dưới → chạy targeted Vitest trên test files ghi trong task, ví dụ `npm.cmd run test:run -- src/integrations/member3/revision.test.ts`, để thấy FAIL đúng hành vi chưa có → implement các interfaces trong plan → targeted PASS → `npm.cmd run typecheck` và `npm.cmd run build`. Cuối mỗi phase chạy full suite và browser gate của phase. Không tick “đã viết tests” nếu chưa chạy; ghi test count/exit code/native receipt path, không ghi bearer.

File paths là từ root repo. Lệnh npm và node bên dưới chạy trong `frontend/`. Interfaces chỉ định nghĩa một lần ở plan; task tiêu thụ đúng tên/type đó. Mỗi task có thể commit sau check trong Git checkout; không push nếu không có yêu cầu push cho thay đổi đó.

## Phase 1 — Frontend ↔ M3 Foundation

- [x] **P1-01 — Typed HTTP + backend/mock factory + real world load/read.**
  - Files: `src/integrations/member3/{client,types,errors,worldState}.ts`, `src/services/api/{BackendDispatchApi,createDispatchApi}.ts`, Context/shared types/env.
  - Produces: existing `getSnapshot/subscribe/loadScenario`, `M3Basis`, consistent current-world snapshots.
  - Evidence: commit `5e96749`; [guide](../../../../frontend/docs/member3-phase1.md), [verification](../../../../frontend/docs/evidence/m3-phase1-verification.json); 157 tests và typecheck/build ở baseline implementation.

- [x] **P1-02 — Native S1 browser và old Mock storage isolation.**
  - Assertions đã chạy: S1 8 orders/2 vehicles/9 locations đúng public responses, 11 markers, thời gian M3; no plan/route invented; refresh same session + fresh GET, old Mock 3-order snapshot ignored/preserved.
  - Evidence: [browser results](../../../../frontend/docs/evidence/m3-phase1-browser-results.json), [HTTP responses](../../../../frontend/docs/evidence/m3-phase1-http-responses.json), [snapshot](../../../../frontend/docs/evidence/m3-phase1-snapshot.json).

**Gate khi bắt đầu Phase 2:** chạy targeted Foundation tests và xác nhận backend owned session READY. Hai checkboxes trên là evidence lịch sử, không chứng nhận freshness hoặc full backend lifecycle hôm nay. Numeric revision mapping đã sửa theo review, có [receipt](../../../../frontend/docs/evidence/m3-revision-fix-verification.json); full-basis proposal/job helpers và import isolation còn ở P2-01/P7-02.

## Phase 2 — Optimize thật qua M3/M2

### P2-01 — Revision string và proposal identity

**Dependencies:** P1. **Files:** new `frontend/src/integrations/member3/revision.ts`, `revision.test.ts`; modify `types.ts`, shared `dispatch.ts`, consumers dùng stale numeric guards; giữ review fix trong `worldState.ts`. **Consumes:** M3Basis/DispatchSnapshot. **Produces:** ServerRevision, sameBasis, expectedRevision, isAcceptableJob, ProposalOrigin/proposalCurrency theo plan.

**Đã có trước task này:** Number conversion removed; full int64 strings/generation-only refresh/projection mismatch/malformed revision regressions PASS trong BackendDispatchApi tests. Backend `version=0` chỉ là mock compatibility. Các checkbox dưới vẫn mở vì centralized helpers và proposal/job consumers chưa triển khai.

- [x] Viết test `preserves_int64_revision_strings`: `head_version="9007199254740993"`, `generation="9223372036854775807"` map/serialize nguyên giá trị, không reject vì JS safe integer; reject `01`, số JS, negative và `9223372036854775808`.
- [x] Viết test `full_basis_detects_generation_and_hash_changes`: generation-only, head/source/context/overlay/build/session thay đổi → STALE; bằng đủ 9 fields → CURRENT.
- [x] Chạy revision/API helper tests thấy FAIL vì helpers chưa có; implement full-basis currency/expected revision/job guard; giữ numeric mock lifecycle và backend placeholder 0; dùng centralized currency guard trên mọi Admin/map Select validity consumer khi nối real jobs.
- [x] Targeted PASS + typecheck/build; full mock suite giữ behavior. Ghi receipt và commit task.

### P2-02 — Real comparison submit/job lifecycle/errors/idempotency

**Dependencies:** P2-01. **Files:** modify member3 `client.ts/types.ts/errors.ts`, BackendDispatchApi/shared types/AdminPage; new `jobViewAdapter.ts`, `jobViewAdapter.test.ts`, `requestId.ts`, `requestId.test.ts`, `scenarioAdapter.ts`, `scenarioAdapter.test.ts`; extend existing client/API tests. **Consumes:** expectedRevision/PendingCommandStore/M3Catalog. **Produces:** typed compare/job/cancel methods, parsed job/group registry trên snapshot backend metadata, optimize submit/watch seed, adaptScenarioCatalog cho selector.

- [x] Test `compare_submits_current_revision_once`: POST `/profiles/compare`, no `job_ids`, expected_revision giữ strings; timeout/lost reply → cùng request_id/body khi retry/refresh, không tạo thêm batch.
- [x] Test `distinguishes_lifecycle_from_business_outcome`: QUEUED/RUNNING/COMPLETED/FAILED, COMPLETED no witness, PARTIAL, RETURN_ONLY, FAILED+JOB_CANCELLED; no-witness không thành all-unserved hoặc fake plan.
- [x] Test `comparison_verdict_controls_ranking`: COMPARABLE với ba metrics trùng nhau vẫn valid; NON_COMPARABLE hoặc outcome.comparison=null không rank và không fake comparative KPI.
- [x] Test `scenario_selector_uses_server_catalog`: S0–S4 counts/time/fixture hashes match catalog, S5–S8 không làm UI hỗ trợ giả; backend selector không dùng fixtureCatalog hoặc demo order counts.
- [x] Test errors 401/403/409 và invalid binding fail closed; BUSY bounded retry; idempotency conflict không tạo new request. Thấy FAIL trước implement client/parser/store/API/UI status (giữ layout).
- [x] Targeted PASS + typecheck/build; evidence bao gồm comparison/job IDs khi native harness P2-03 chạy.

### P2-03 — Single polling coordinator và native Optimize gate

**Dependencies:** P2-02. **Files:** new `polling.ts`, `polling.test.ts`, `capabilities.ts`; modify BackendDispatchApi, client abort signals, Context/Admin state/tests; new `frontend/docs/evidence/member3-integration/browser.mjs`. **Consumes:** readWorld/readComparison, job terminal/verdict and subscribe. **Produces:** PollCoordinator theo plan, capabilities and reusable browser harness CLI.

- [x] Fake-clock test `polls_without_overlap_and_stops_terminal`: comparison 1000 ms/world 2500 ms **sau completion**, one request kind in flight, no panel timers; terminal group stop, không mỗi child thêm poll loop.
- [x] Test `aborts_stale_session_and_unmount`: hidden/resume, unsubscribe/StrictMode, late old-session response ignored; mutation queue ưu tiên khỏi periodic read backlog; errors giữ snapshot stale/actions disabled.
- [x] Test `bounded_retries_and_deadline`: backoff 1000/2000/4000 ms tối đa 3 retry, 10-minute deadline báo unknown thay FAILED/CANCELLED; server cancel chỉ qua real cancel endpoint, abort không fake cancel.
- [x] Quan sát FAIL → implement coordinator/subscribe/capabilities + harness `--phase N --scenario Sx`/`--all`; targeted/full tests, typecheck/build PASS.
- [x] Native `node docs/evidence/member3-integration/browser.mjs --phase 2 --scenario S1`: POST M3 compare thật, 3 profiles/jobs, basis/lifecycle/verdict/error evidence; no offline call. Gate Phase 2 và cập nhật evidence paths.

## Phase 3 — Map + KPI từ kết quả backend

Progress 2026-10-07: user-authorized public forecast extension M3 0.9.0 implemented via TDD. Native HTTP certified geometry/read-only/auth gate PASS; separate explicit Accept/replay gives non-null scopes. [Browser/map/reload/Driver gate PASS](../../../../frontend/docs/evidence/member3-integration/phase3-forecast-browser-native.json): 1207 source EDGE, 1159 drawable EDGE after Admin filters, unchanged world, accepted-only Driver. Phase 3 DONE within its current public-contract scope; completed-action mapping and rain polygons remain unavailable. See `frontend/docs/member3-phase3.md` and the [extension ledger](../2026-10-07-public-forecast-ledger.md); historical fixture tests are separate from these native runs.

### P3-01 — Khóa public job forecast geometry contract với M3

**Dependencies:** P2; original 0.8.0 gap resolved by user-authorized SDK + M3 0.9.0 extension. **Files:** `frontend/docs/member3-forecast-contract.md`, contract samples in adapter tests and sanitized native receipts; client/types. **Consumes:** [extension public forecast contract](../../../M3_FORECAST_API_HANDOFF_20261007.md). **Produces:** locked read-only endpoint/schema/binding/error matrix để adaptJobForecast dùng.

- [x] Ghi bằng chứng khoảng trống hiện tại: GET job không geometry; comparison chỉ metrics/basis; GET state là accepted trajectory. Không gọi Accept ngầm hoặc invent API path trước thỏa thuận.
- [x] Owner-scoped public forecast read từ certified M2 witness, bound job/session/profile/full basis/build; no-witness/RETURN_ONLY/PARTIAL và units/EDGE fractions. Extension contract/release riêng, không tuyên bố đã có trong 0.8.0.
- [x] Test contract `forecast_read_does_not_mutate_world`: native before/after execution view bằng nhau; 401/403/404 PASS, malformed/basis mismatch covered by SDK/HTTP/frontend tests. Public receipt `phase3-forecast-http-native.json` không token/private stores.
- [x] Public rain polygons unavailable; không thêm offline geometry. Native HTTP receipt chứa directed EDGE thật và cùng full basis; contract note khóa source/build.

### P3-02 — Proposal/accepted execution adapters và exact EDGE map

**Dependencies:** P2-03; proposal branch cần P3-01, accepted branch làm được độc lập. **Files:** new `forecastViewAdapter.ts/.test.ts`, `executionViewAdapter.ts/.test.ts`; modify shared types/mapScene/adminMapPresentation, reuse existing Member2 geometry helpers. **Consumes:** approved forecast, ProposalOrigin, M3ExecutionView. **Produces:** adaptJobForecast/adaptAcceptedExecution theo plan và frontend route/map models.

- [x] Test `preserves_all_edge_points_direction_and_fraction`: coordinates/source action IDs/order giữ nguyên; không nối stop/simplify; missing geometry hiện unavailable, binding mismatch reject; partial EDGE không vẽ full edge giả.
- [x] Test `keeps_proposal_and_accepted_sources_separate`: highlighting proposal không đổi accepted; state accepted_trajectory=null → no accepted route; initial vehicle thiếu timestamp/activity không invented observation.
- [x] Test planned suffix/RETURN_ONLY continuation/PARTIAL unserved; Admin visibility/return filters/V1–V2 palette, Driver accepted only, tile error. Completed action mapping remains explicitly unavailable because public decision epoch/progress is absent; no invented dimmed prefix.
- [x] FAIL → implement adapters/renderer input; targeted/full checks PASS; native S1 forecast preview read-only + exact geometry equality public response, actual Leaflet input equality, reload same comparison/local preference and accepted-only Driver PASS; gate không dùng packs/schematic.

### P3-03 — Scoped KPI và provenance

**Dependencies:** P2-02; không cần chờ P3-01 cho comparison KPI. **Files:** new `metricsAdapter.ts/.test.ts`; modify shared dispatch/PlanMetrics/provenance/AdminPage/components consuming metrics, extend UI tests. **Consumes:** comparison metrics/public units/execution metric scopes. **Produces:** ScopedMetrics/adaptMetrics, backend source/session/job/profile/basis/build labels.

- [x] Test `does_not_conflate_observed_and_forecast`: observed=null stays unavailable; planned/projected values riêng; no sum/double count; served denominator only khi coverage_evaluated=true.
- [x] Test `preserves_proxy_units_and_missing_values`: fuel/on-time missing → null/placeholder, exposure không mock `/100`/`x` khi không contract, metric strings/nonfinite invalid; source MEMBER3_HTTP khác offline.
- [x] FAIL → implement unit-safe conversion/display (m→km/s→min khi declared); card shell giữ nguyên; targeted/full checks PASS.
- [x] Native metrics/provenance equal corresponding public job/comparison/execution scopes; three non-null execution scopes match public payload and rendered values. Separate explicit scope HTTP receipt + forecast browser receipt. Geometry contract and map/KPI gates PASS; Phase 3 DONE.

## Phase 4 — Select + Accept thật

### P4-01 — Local selection và current-basis guard

**Dependencies:** P2/P3. **Files:** BackendDispatchApi/shared proposal registry, revision tests, AdminPage/adminMapPresentation and UI tests. **Consumes:** ProposalOrigin/job validation/current basis. **Produces:** existing `selectAlternative(planId)` local semantics, centralized isAcceptableJob/currency.

- [x] Test `select_is_ui_only`: selection switch không POST/no world write/no delivered/custody change; preserve accepted map/view independently.
- [x] Test `accept_guard_checks_full_basis_and_witness`: same head/different generation hoặc hashes STALE; QUEUED/FAILED/no witness/invalid validation/no plan disable; current COMPLETED certified plan enable only khi fresh/no pending mutation.
- [x] FAIL → implement selection/guards; targeted PASS + typecheck/build; browser record zero POST Select và active accepted unchanged.

### P4-02 — Server Accept, receipt reconciliation và fresh state

**Dependencies:** P4-01. **Files:** client/types/errors/BackendDispatchApi/requestId, execution adapter, Admin/Driver consumers and API/UI tests; extend browser harness. **Consumes:** selected job ID/PendingCommandStore/expectedRevision. **Produces:** acceptSelectedPlan real operation, server accepted record/current trajectory.

- [x] Test POST `/jobs/{selectedJobId}/accept` with strings + request_id; successful response followed by consistent fresh world, no local generation++/clone selected plan into physical authority.
- [x] Test `lost_accept_response_retries_without_double_accept`: same body/ID after refresh; historical receipt basis may differ from fresh state, current active route not rewound. 409 stale refresh/re-optimize, no automatic new Accept.
- [x] Test GET acceptances history rehydrate confirmed records only, active accepted job/trajectory vẫn từ fresh state; thiếu historical geometry giữ record metadata, không clone current route thành lịch sử.
- [x] FAIL → implement accept and pending reconciliation; targeted/full tests/typecheck/build PASS.
- [x] Native Phase 4 S1 gate: correct job accepted, server generation returned, accepted geometry mapped, zero orders DELIVERED merely due Accept; stale two-tab race rejected and refreshed.

## Phase 5 — Event + Re-optimization

### P5-01 — Events catalog/readiness và one-way controls

**Dependencies:** P4. **Files:** client/types/capabilities/BackendDispatchApi/AdminPage, related API/UI tests; harness replay-step helper. **Consumes:** M3PendingEventsView + server apply_allowed. **Produces:** events/apply UI capability, client.step prerequisite for native barrier testing (no Driver autoplay UI yet).

- [x] Test `event_is_not_due_until_observed_exact_barrier`: apply_allowed=false → disabled/not due; timestamp đúng nhưng chưa observation cũng không enabled; S1 absent events không tạo event từ fixture.
- [x] Test backend urgent Apply/Applied không OFF; mock urgent toggle/Pickup/Delivered không đổi; missing public polygon không lấy mock rain geometry.
- [x] FAIL → implement server event metadata/client step/harness + mode controls; targeted/typecheck/build PASS.
- [x] Native S2/S3/S4 harness Accept → real replay/step exact target_time → server apply_allowed=true. Không tự advanceDemoClock hoặc vượt pending event.

### P5-02 — Apply transition và re-optimize new world

**Dependencies:** P5-01. **Files:** client/BackendDispatchApi/requestId/execution/world adapter/Admin event state, API/UI tests/harness. **Consumes:** event ID/current expected revision. **Produces:** `applyEvent(eventId)`, legacy backend triggerFixtureEvent delegation, fresh world and stale proposals.

- [x] Test `applies_once_then_refreshes`: command body/ID durable, EVENT_NOT_DUE/ALREADY_APPLIED/STALE_HEAD preserved; retry same ID one mutation, new ID for applied event rejected; no frontend toggle rollback.
- [x] Test refresh GET replay/history restores APPLIED chỉ từ confirmed receipts; absent event/truncated 100-receipt history không tạo applied transition giả.
- [x] Test S3 onboard ownership/delivered prefix retained, S2 new orders from projection, S4 context server expiry; old proposal stale after basis mutation. Re-optimize binds new full basis, not old fixture/version.
- [x] FAIL → implement; targeted/full tests/typecheck/build PASS.
- [x] Native Phase 5 S2/S3/S4 apply + comparison evidence; record barrier/time/input/output bases/diagnostics. Driver replay UI vẫn Phase 6, không dependency vòng.

## Phase 6 — Driver Execution / Replay

### P6-01 — Driver accepted execution from M3

**Dependencies:** P4/P5, accepted adapter P3-02. **Files:** DriverPage/shared card/map consumers/executionViewAdapter/capabilities/tests. **Consumes:** current server accepted trajectory/observed prefix/custody. **Produces:** backend Driver render branch giữ shell, no manual physical buttons backend.

- [x] Test `driver_renders_only_server_accepted_execution`: no accepted empty; proposal selection not driver route; planned deliveries not delivered; observed prefix/current load/onboard/location/time exactly state, absent position timestamp null.
- [x] Test backend không gọi pickupOrder/deliverOrder/advanceDemoClock, mock branch giữ controls; dispatcher owner writes/read-only valid owner UI disabled on insufficient capability/error.
- [x] FAIL → implement mode-aware Driver/card data; targeted/typecheck/build PASS, visual checks 360/390/430 không overflow.

### P6-02 — Step/Play/Pause/Speed/Reset qua backend

**Dependencies:** P6-01. **Files:** new Driver `ReplayControls.tsx/.test.tsx`; client/types/API/polling/capabilities, replay API tests/harness. **Consumes:** expectedRevision/PendingCommandStore/server controller. **Produces:** additive replayStep/replayStart/replaySpeed/replayPause/resetSession APIs.

- [x] Test correct endpoint bodies: step/start expected_revision strings; speed only request_id/speed; Pause `/replay/playback/pause`, not manual `/replay/pause`; 1/2/4/8 accepted, others disabled/rejected.
- [x] Test `pause_waits_for_reserved_tick_settlement`: controller may show one settling tick; no invented instant freeze. Speed change paused does not resume. Barrier requires Apply, final-return stop server-owned.
- [x] Test reset returns new session pointer, historical old session preserved; late old reply ignored; ambiguous start/step/reset retry same intent/body; accepted required before replay.
- [x] FAIL → implement controls/client/controller handling; targeted/full checks PASS; native playback/step/pause/speed/reset evidence và Driver layout preserved.

### P6-03 — Admin–Driver cùng server session và polling lifecycle

**Dependencies:** P6-02/P2-03. **Files:** new `sessionReference.ts/.test.ts`; BackendDispatchApi/Context/polling/Driver selectors/browser harness tests. **Consumes:** origin-scoped pointer + fresh reads. **Produces:** cross-tab pointer notification/server convergence, UI-only selected vehicle/visibility preferences.

- [x] Test pointer storage/events contain no world/orders/plan/progress/token; old Mock key ignored/preserved; two tabs refresh same session, no storage write loops.
- [x] Test different origin/unauthorized owner stale pointer cannot load silently; switch/reset abort old coordinator and fetch before enabling actions; hidden tab resume fresh state/no resubmit commands.
- [x] FAIL → extract session reference + pointer notifications; targeted/full checks PASS.
- [x] Native two-tab Admin Accept/Event/Replay → Driver sees same server basis/time/order states after poll settles; Driver writes under authorized owner → Admin converges. Record no duplicate panel polls/no local physics.

## Phase 7 — Production Cutover + Cleanup + E2E

### P7-01 — Native E2E gate trước cleanup

**Dependencies:** P1–P6 và approved P3-01. **Files:** browser harness + `frontend/docs/evidence/member3-integration/` reports/screenshots/public samples, README migration matrix. **Consumes:** integrated backend mode, native API/worker/runtime. **Produces:** pre-cleanup E2E receipt; authorization gate kỹ thuật để xóa heavy packs.

- [x] Chạy `node docs/evidence/member3-integration/browser.mjs --all` trên real M3/M2, cases S0/S1/S2/S3/S4 + failure matrix của spec; chỉ synthetic HTTP trong unit tests, không E2E claims.
- [x] Chạy full `npm.cmd run test:run`, `typecheck`, `build`; responsive 1280/1440 Admin, 360/390/430 Driver, OSM failure giữ routes; touch/WebView chưa chạy ghi pending riêng.
- [x] Check evidence secret-free/native flag/IDs/bases/profile/schema/units; verify no offline call backend mode. P7-01 chưa PASS thì không delete packs hoặc claim cutover done.

### P7-02 — Backend default/import isolation/pack cleanup

**Dependencies:** P7-01 PASS. **Files:** new config dispatchMode/shared dispatchErrors/shared presentation/audit script; modify factory→async, Context, env/README, UI mock imports, Mock API/engine wiring; delete 4 heavy files chỉ khi consumer/tests đã chuyển. **Consumes:** baseline E2E approved + lightweight offline behavior. **Produces:** clean backend artifact/default, explicit offline mock entry.

- [x] Test default backend/invalid mode error/mock explicit/injection; async initialization StrictMode/unmount no duplicate API. FAIL → implement mode config/dynamic mock loader/Context handling.
- [x] Test production Context/Admin/Driver errors/presentation do not import mock engine/fixtures; server thiếu customer/driver identity shows ID/placeholder, mock demo labels remain mock only.
- [x] Giữ lightweight MockStateEngine/MockDispatchApi/fixtureCatalog/decisionPacks; tháo offlineRoadPlans/catalog wiring. Pack-specific tests chuyển tiny test-only fixtures hoặc retire test chỉ kiểm asset đã bỏ; capacity/custody/geometry regression giữ coverage.
- [x] Xóa `frontend/src/mocks/data/member2-road-packs.json`, `member2-event-road-packs.json`, `src/mocks/engine/offlineRoadPlans.ts`, `offlineRoadPackCatalog.ts` khi không còn consumer; no production schematic fallback.
- [x] Implement audit actual build modules/chunks/assets (static + dynamic), reject mock-only modules/assets in backend artifact; mock entry explicit build/mode vẫn chạy offline. Targeted/full tests/typecheck/build PASS.

### P7-03 — E2E sau cleanup, artifact/security audit và handoff

**Dependencies:** P7-02. **Files:** final evidence receipts/README/env/task statuses. **Consumes:** production build sau cleanup. **Produces:** final integration acceptance và run instructions.

- [x] Fresh full tests/typecheck/build; `node scripts/audit-backend-build.mjs` PASS; run native `browser.mjs --all` against built frontend (không chỉ dev source), lưu **post-cleanup** receipt riêng.
- [x] Verify browser network/backend artifact no road-pack/mock fixture/engine/schematic; runtime bearer absent source/dist/evidence/staged files; env mẫu chỉ non-secret backend/base URL.
- [x] Run explicit mock/offline smoke và unit injection; README startup/auth/session/phase/failure limitations đúng release; không công bố native SLA/GPS/calibration/optimality.
- [x] Tick final gate khi every task checked + public forecast contract satisfied + spec E2E matrix evidence đầy đủ. Ghi result counts/paths/commit; residual manual device checks ghi rõ scope, không claim chưa chạy.

## Evidence index

| Nội dung | Artifact / trạng thái |
| --- | --- |
| Foundation native S1 | Existing [browser receipt](../../../../frontend/docs/evidence/m3-phase1-browser-results.json), [HTTP](../../../../frontend/docs/evidence/m3-phase1-http-responses.json), [verification](../../../../frontend/docs/evidence/m3-phase1-verification.json). |
| Phase 2 | [Native S1](../../../../frontend/docs/evidence/member3-integration/phase2-latest.json), [verification](../../../../frontend/docs/evidence/member3-integration/verification.json), [review fixes](../../../../frontend/docs/evidence/member3-integration/review.md). 196 tests/typecheck/build PASS; comparison COMPARABLE, physical world unchanged. |
| Phase 3 | [Native browser/map/scopes](../../../../frontend/docs/evidence/member3-integration/phase3-forecast-browser-native.json), [HTTP/read-only](../../../../frontend/docs/evidence/member3-integration/phase3-forecast-http-native.json), [explicit scopes](../../../../frontend/docs/evidence/member3-integration/phase3-forecast-scopes-http-native.json), [verification](../../../../frontend/docs/evidence/member3-integration/phase3-forecast-verification.json) PASS. 234 frontend/54 SDK/875 backend tests; typecheck/build PASS. |
| Phase 4 | P4-01/P4-02 PASS; [implementation and receipts](../../../../frontend/docs/member3-phase4.md). |
| Phase 5 | P5-01/P5-02 PASS; [implementation, native S2/S3/S4 and verification](../../../../frontend/docs/member3-phase5.md). 294 tests/38 files, typecheck/build PASS; native continuations documented. |
| Phase 6 | P6-01/P6-02/P6-03 PASS; [Driver/replay, two-tab native S0/S2 and verification](../../../../frontend/docs/member3-phase6.md). 327 tests/43 files, typecheck/build PASS; prerequisites and review fixes documented. |
| Forecast public contract | User-authorized [0.9.0 extension](../../../M3_FORECAST_API_HANDOFF_20261007.md), separate sealed build/receipts from received 0.8.0. |
| Pre-cleanup E2E / post-cleanup E2E | [Pre-cleanup](../../../../frontend/docs/evidence/member3-integration/phase7-pre-cleanup-native.json) and [post-cleanup built native](../../../../frontend/docs/evidence/member3-integration/phase7-post-cleanup-native.json) PASS independently: S0–S4, 25 layouts and 10 native failure branches each. |
| Artifact/import/secret audit | [Final verification](../../../../frontend/docs/evidence/member3-integration/phase7-final-verification.json), [backend graph audit](../../../../frontend/docs/evidence/member3-integration/phase7-backend-build-audit.json), [secret scan](../../../../frontend/docs/evidence/member3-integration/phase7-final-secret-scan.json) and [explicit offline mock](../../../../frontend/docs/evidence/member3-integration/phase7-mock-smoke.json) PASS. 342 tests/46 files; typecheck/build and 9 audit tests PASS. [Phase 7 handoff](../../../../frontend/docs/member3-phase7.md); [fresh review](../../../../frontend/docs/evidence/member3-integration/phase7-review.md) PASS, Critical/Important/Minor 0. Candidate `176884e`; separate manual/publication scopes remain pending. |

Bộ spec/plan/tasks đã viết không đồng nghĩa implementation các tasks chưa tick đã hoàn thành.

## Publication repair ? release revision 2

The r1 publication was rejected because its baseline public handoff lock did not match the shipped SDK. Functional browser receipts remain historical evidence for build c333372; they are not r2 acceptance. The replacement uses SDK task02-m2-runtime-sdk/2 and a generated handoff lock /2 covering job_forecast, forecast schema/units and verifier bytes. It includes the unchanged frozen crosswalk in the production closure. Both sealing and packaging invoke the shipped verify_lock() after inventory verification. Frozen external API v1 is unchanged; baseline-to-v2 compatibility requires explicit migration.

Current release and byte pins: [release guide](../../../M3_FORECAST_EXTENSION_RELEASE_20261007.md). Fresh native G0/HTTP and release-verification receipts for r2 are separate from the earlier browser run. Reviewer sign-off on Phase 3 remains pending; the earlier DONE statement describes functional gates and is superseded for publication by this repair.
