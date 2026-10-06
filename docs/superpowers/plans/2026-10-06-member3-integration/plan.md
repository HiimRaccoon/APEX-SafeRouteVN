# SafeRoute VN — Member 3 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Chỉ dùng `subagent-driven-development` khi execution method được người dùng chọn hoặc chỉ dẫn áp dụng yêu cầu. Các bước theo checkbox ở [tasks.md](tasks.md).

**Goal:** Chuyển frontend hiện tại sang native M3/M2 theo 7 phase, giữ UI và mock offline/test, rồi cutover sau E2E.

**Architecture:** Admin/Driver → DispatchApi → BackendDispatchApi → typed Member3Client → M3 → M2. Adapter chuyển public views thành frontend models; một coordinator theo dõi world/comparison và bỏ stale responses. Mock API dùng entry riêng, không tham gia backend authority.

**Tech Stack:** React, TypeScript, Vite, Leaflet, Vitest/Testing Library, puppeteer-core đã có; M3 FastAPI 0.8.0/public M2 supplemental views. Không thêm framework state/network hoặc WebSocket cho migration này.

**Spec:** [spec.md](spec.md). **Task tracker:** [tasks.md](tasks.md). **Baseline:** commit `5e96749`, [Foundation guide](../../../../frontend/docs/member3-phase1.md).

## Global Constraints

- Giữ layout/Admin–Driver–Leaflet/route presentation; chỉ đổi nguồn và semantics cần thiết.
- `head_version`/`generation` giữ canonical decimal string int64 không âm, tối đa `9223372036854775807`; không `Number()`/`parseInt()` hay local increment production revision.
- Full basis gồm 9 fields liệt kê G-04; expected revision dùng hai decimal strings, không thay full-basis frontend guard.
- Token chỉ runtime/injected hoặc sessionStorage; không commit secret/VITE bearer/bundle credential.
- Backend lỗi không fallback mock/schematic/offline route; localStorage không physical authority.
- Mock engine/API/fixtures/decision packs giữ test/offline; heavy packs chỉ xóa sau native E2E gate Phase 7.
- Một coordinator mỗi API/provider/tab; terminal/hidden/unmount/session-switch ngừng poll, Abort không đồng nghĩa server cancel.
- Geometry giữ nguyên EDGE WGS84, scope/null/proxy metrics rõ; simulated replay không GPS/optimality/SLA.
- Tài liệu này có đúng 7 phase; implementation chưa được thực hiện bằng việc viết plan.

## Review Focus

1. Generation đổi nhưng head_version không đổi, hoặc hashes khác dù counters bằng nhau: stale proposal phải bị chặn; test P2-01/P4-01.
2. POST thành công nhưng response mất, receipt retry lịch sử sau world mutation: cùng request/body, fresh world không rewind; test P2-02/P4-02/P5-02.
3. Job COMPLETED nhưng no witness, RETURN_ONLY, PARTIAL hoặc group NON_COMPARABLE: UI không fake coverage/route/ranking; test P2-02/P3-03.
4. Autoplay Pause có tick đang reserved, event đúng barrier và reply cũ sau Reset: settle/fence rồi đọc server, không overwrite new session; test P5-01/P6-02/P6-03.
5. Mock import qua error class/presentation/dynamic chunk hoặc token lọt evidence: backend build và evidence phải audit thực tế; test P7-02/P7-03.

## File structure và ownership

Đường dẫn code dưới đây tính từ root repo. File ghi **new** chưa tồn tại; không tạo hàng loạt scaffolding trước task có consumer.

| File | Trách nhiệm / phase |
| --- | --- |
| `frontend/src/integrations/member3/client.ts`, `types.ts`, `errors.ts` | Có sẵn; mở rộng typed HTTP requests/view validators/error mapping theo P2/P4/P5/P6. |
| `frontend/src/integrations/member3/worldState.ts` | Có sẵn; review fix đã bỏ Number revision, giữ string basis và numeric mock placeholder 0; consistent world read/authority P2/P3. |
| `frontend/src/integrations/member3/revision.ts` **new** | Decimal-string validation, full basis equality, currency/Accept guard, P2. |
| `frontend/src/integrations/member3/requestId.ts` **new** | Pending command identity/body persistence/retry/reconcile, mở rộng durable load hiện có, P2. |
| `frontend/src/integrations/member3/polling.ts` **new** | Single coordinator, scheduling/backoff/deadline/abort/lifecycle, P2/P6. |
| `frontend/src/integrations/member3/jobViewAdapter.ts` **new** | Validate job/group, distinguish lifecycle/outcome/witness/coverage, P2/P3. |
| `frontend/src/integrations/member3/executionViewAdapter.ts` **new** | Initial/post-accept/observed prefix/planned suffix vào operational frontend models, P3/P6; reuse M2 pure geometry helpers khi shape tương thích. |
| `frontend/src/integrations/member3/forecastViewAdapter.ts` **new, contract gate** | Proposal trajectory read-only từ M3 forecast contract sau bàn giao, P3. |
| `frontend/src/integrations/member3/metricsAdapter.ts` **new** | Scope/unit/null-safe KPI presentation, P3. |
| `frontend/src/integrations/member3/capabilities.ts` **new** | Dispatch capabilities theo mode/backend readiness contract; không suy ra role từ client token, P2/P6. |
| `frontend/src/integrations/member3/scenarioAdapter.ts` **new** | Catalog M3 → selector metadata S0–S4 hỗ trợ hiện tại; không lấy counts/fixture từ mock, P2. |
| `frontend/src/integrations/member3/sessionReference.ts` **new** | Origin-scoped session pointer/pending requests/UI preferences, cross-tab notification pointer only, P6. |
| `frontend/src/services/api/DispatchApi.ts`, `BackendDispatchApi.ts` | Có sẵn; orchestrate new operations, no solver/local physics; additive methods để mock không bị ép có server semantics. |
| `frontend/src/services/api/createDispatchApi.ts` | Có sẵn; giữ tên hiện tại, async mode-specific loading/cutover P7, không tạo factory trùng tên. |
| `frontend/src/config/dispatchMode.ts` **new** | Validate env/backend default cuối P7; non-secret config. |
| `frontend/src/shared/types/dispatch.ts`, `scenario.ts` | Backend revision/proposal/metric metadata; mock numeric model narrowing không đổi mock runtime. |
| `frontend/src/shared/dispatchErrors.ts` **new** | Common UI-safe error codes/guards, bỏ import MockStateEngine trong Context P7. |
| `frontend/src/shared/presentation.ts` **new** | Production ID/metadata/placeholder presentation, mock demo presentation chỉ explicit mock branch P7. |
| `frontend/src/app/DispatchContext.tsx` | Async API initialization, subscriber lifecycle, error/capability/mutation pending trạng thái; không tự world mutation. |
| `frontend/src/admin/AdminPage.tsx`, `adminMapPresentation.ts` | Lifecycle/KPI/stale/Select/Accept/Event, render source rõ; no layout rewrite. |
| `frontend/src/driver/DriverPage.tsx`, `ReplayControls.tsx` **new** | Accepted-only operational view, backend Step/Play/Pause/speed và mock controls riêng. |
| `frontend/src/shared/components/mapScene.ts`, `DispatchMap.tsx`, `routeLegPresentation.ts` | Reuse renderer/palette/visibility; đổi adapter input khi cần, không regenerate geometry. |
| `frontend/src/services/api/MockDispatchApi.ts`, `frontend/src/mocks/**` | Không đổi runtime behavior P1–P6; P7 tháo heavy wiring và narrow types nếu cần, giữ lightweight mock. |
| `frontend/src/integrations/member3/fixtures/*.json` **new, test-only** | Sanitized public contracts/replay/job cases, không import vào production app. |
| `frontend/docs/evidence/member3-integration/browser.mjs` **new** | Native browser harness từng phase/S0–S4; đọc credentials từ file riêng ngoài repo qua env, chỉ lưu public evidence. |
| `frontend/scripts/audit-backend-build.mjs` **new** | Audit Vite/Rollup module IDs, static/dynamic graph/chunks/asset membership và mock absence, P7. |
| `frontend/README.md`, `.env.example`, `frontend/docs/member3-phase1.md` | Hướng dẫn mode/auth/known boundaries; Phase 1 guide giữ evidence lịch sử, link migration mới khi cutover. |

## Interfaces khóa cho các task

Các tên sau là quyết định implementation, không phải tuyên bố wire contract chưa có. M3 wire fields/schema phải đối chiếu handoff/models trước khi parse.

```ts
// revision.ts; consumes M3Basis hiện có
interface ServerRevision { headVersion: string; generation: string }
function sameBasis(a: M3Basis, b: M3Basis): boolean;
function expectedRevision(b: M3Basis): { head_version: string; generation: string };
function isAcceptableJob(job: M3JobView, current: M3Basis): boolean;

// types.ts / jobViewAdapter.ts
type M3JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
type ComparisonStatus = "QUEUED" | "RUNNING" | "CANCEL_REQUESTED" |
  "COMPLETED" | "FAILED" | "CANCELLED";
function parseJobView(raw: unknown): M3JobView;
function parseComparisonView(raw: unknown): M3ComparisonView;
// M3JobView mirrors contracts.py exact job-view fields; M3ComparisonView mirrors
// ProfileService.poll including jobs[].view nullable and outcome.comparison nullable.

// client.ts additions, all return public validated payloads; optional abort signal
compareProfiles(sid: string, body: CompareProfilesRequest, signal?: AbortSignal): Promise<M3ComparisonReceipt>;
comparison(sid: string, cid: string, signal?: AbortSignal): Promise<M3ComparisonView>;
job(sid: string, jid: string, signal?: AbortSignal): Promise<M3JobView>;
cancelComparison(sid: string, cid: string, requestId: string): Promise<M3ComparisonCancellation>;
accept(sid: string, jid: string, body: AcceptPlanRequest): Promise<M3AcceptanceView>;
acceptances(sid: string, signal?: AbortSignal): Promise<M3AcceptanceAudit>;
events(sid: string, signal?: AbortSignal): Promise<M3PendingEventsView>;
replayHistory(sid: string, signal?: AbortSignal): Promise<M3ReplayAudit>;
applyEvent(sid: string, eid: string, body: ApplyEventRequest): Promise<M3ReplayMutationView>;
step(sid: string, body: ReplayStepRequest): Promise<M3ReplayMutationView>;
startPlayback(sid: string, body: StartPlaybackRequest): Promise<M3PlaybackView>;
setPlaybackSpeed(sid: string, body: PlaybackSpeedRequest): Promise<M3PlaybackView>;
pausePlayback(sid: string, requestId: string): Promise<M3PlaybackView>;
playback(sid: string, signal?: AbortSignal): Promise<M3PlaybackView>;
resetReplay(sid: string, requestId: string): Promise<M3ReplayMutationView>;

// requestId.ts: only local command intent metadata, never physical snapshot/token
type PendingCommand = { requestId: string; sessionId: string | null;
  operation: string; resourceId?: string; body: Record<string, unknown> };
interface PendingCommandStore {
  begin(intent: Omit<PendingCommand, "requestId">): PendingCommand;
  read(): PendingCommand | null;
  complete(requestId: string): void;
}

// polling.ts: exactly one instance owned by BackendDispatchApi
interface PollCoordinator {
  watchWorld(sessionId: string): void;
  watchComparison(sessionId: string, comparisonId: string): void;
  refresh(): Promise<void>;
  stop(): void;
}
function createPollCoordinator(options: PollOptions): PollCoordinator;
interface PollOptions {
  readWorld(sid: string, signal: AbortSignal): Promise<DispatchSnapshot>;
  readComparison(sid: string, cid: string, signal: AbortSignal): Promise<M3ComparisonView>;
  publishWorld(snapshot: DispatchSnapshot): void;
  publishComparison(view: M3ComparisonView): void;
  onError(error: unknown): void;
  now(): number;
  schedule(callback: () => void, delayMs: number): () => void; // cancel timer
  isVisible(): boolean;
  subscribeVisibility(callback: () => void): () => void;
  comparisonDeadlineMs?: number; // default 600000, not a server SLA
}
// serialize physical mutations with consistent reads, skip queued periodic reads.

// Backend metadata attached to shared snapshots/alternative content
type ProposalOrigin =
  | { kind: "MOCK"; sessionId: string; stateVersion: number }
  | { kind: "MEMBER3"; sessionId: string; comparisonId: string; jobId: string;
      profile: PlanProfile; inputBasis: M3Basis };
type ProposalCurrency = "CURRENT" | "STALE";
function proposalCurrency(proposal: ProposedAlternative, snapshot: DispatchSnapshot): ProposalCurrency;
// Mock uses numeric identity; backend uses origin.inputBasis vs snapshot.backend.basis.

// metricsAdapter.ts; unavailable fields stay null, no mock scaling
type MetricScope = "FORECAST_ONLY" | "OBSERVED_PREFIX_ONLY" |
  "PLANNED_SUFFIX" | "PROJECTED_WHOLE";
interface ScopedMetrics { scope: MetricScope;
  values: Record<string, number | null>; units: Record<string, string> }
function adaptMetrics(raw: unknown, scope: MetricScope, units: Record<string, string>): ScopedMetrics;

// adapters -> existing card/map models, no fresh route solve
function adaptAcceptedExecution(view: M3ExecutionView): {
  planState: PlanState; executionState: ExecutionState };
function adaptJobForecast(raw: unknown, origin: Extract<ProposalOrigin,
  { kind: "MEMBER3" }>): ProposedAlternative; // blocked until public wire locked

// capabilities.ts; read-only normalised UI features, no role invention
interface DispatchCapabilities { mode: "backend" | "mock";
  optimize: boolean; accept: boolean; applyEvent: boolean;
  replay: boolean; driverActions: boolean; forecastGeometry: boolean }
// scenarioAdapter.ts -> snapshot.backend.scenarios -> existing selector
interface ScenarioOption { id: ScenarioId; orderCount: number;
  vehicleCount: number; initialTime: string; fixtureSha256: string }
function adaptScenarioCatalog(catalog: M3Catalog): ScenarioOption[];

// additive DispatchApi members, optional during migration; existing methods kept
capabilities?(): Promise<DispatchCapabilities>;
applyEvent?(eventId: string): Promise<DispatchSnapshot>;
replayStep?(): Promise<DispatchSnapshot>;
replayStart?(speed?: 1 | 2 | 4 | 8): Promise<DispatchSnapshot>;
replaySpeed?(speed: 1 | 2 | 4 | 8): Promise<DispatchSnapshot>;
replayPause?(): Promise<DispatchSnapshot>;
resetSession?(): Promise<DispatchSnapshot>;
// Backend triggerFixtureEvent can delegate applyEvent; urgent toggle/pickup/deliver/
// advanceDemoClock remain unsupported, UI backend branch cannot invoke them.
```

Production model seam: `DecisionState.version` giữ numeric mock counter; backend để compatibility placeholder `0`, không sao chép counter server vào field này. Mọi validity backend dùng `ProposalOrigin.inputBasis` và current backend full basis. `generatedForStateVersion`/assessment numeric fields là mock legacy; chúng không quyết định backend currency. `ProposalOrigin`, scoped metrics và backend job registry là metadata, không local accepted world. Giữ nguyên runtime/type numeric của mock trong revision fix.

## Phase 1 — Frontend ↔ M3 Foundation

**Tasks:** P1-01/P1-02. **Input:** code và native evidence hiện có. **Output:** baseline verified, không lặp việc đã hoàn thành.

- Rà file/client/factory/context/read consistency against native snapshot; giữ mode `mock` default tạm đến Phase 7.
- Chạy `npm.cmd run test:run -- src/services/api/BackendDispatchApi.test.ts src/integrations/member3/client.test.ts src/services/api/createDispatchApi.test.ts src/app/DispatchContext.test.tsx` từ `frontend`.
- Kiểm native readiness/session access trong môi trường local trước browser mới; nếu credential/backend unavailable ghi điều kiện môi trường, không thay mock làm acceptance.
- Gate: S1 acceptance cũ có hashes/IDs/refresh assertions; mọi regression mới không phá mock/UI baseline.

## Phase 2 — Optimize thật qua M3/M2

**Tasks:** P2-01/P2-02/P2-03; dependency P1. File và interface ở bảng trên là scope chính.

- P2-01 tiếp tục numeric/mock vs string/backend seam đã sửa; validation hiện dùng BigInt chỉ để kiểm int64, wire giữ string. Add centralized full-basis helpers và proposal origin; UI backend stale guard không dùng numeric-only comparator. Không cần làm lại Number-conversion correction đã có regression evidence.
- P2-02 typed compare/job/cancel API và PendingCommandStore. Body expected_revision giữ lúc begin command; GET retry không làm POST mới. Repeated intentional Optimize sau terminal tạo ID mới; unknown outcome giữ pending command để reconcile/retry nguyên body. Auth/validation/binding lỗi không transient retry. Scenario adapter lấy selector counts/time/fixture binding từ backend catalog, filter S0–S4 hiện hỗ trợ.
- P2-03 coordinator publish intermediate lifecycle snapshots để Admin pending state không chỉ spinner 10 phút. `optimize()` submit/publish/watch rồi trả snapshot queued; polling tiếp qua subscribe. Mutations/read dùng API operation queue hiện có nhưng periodic reads coalesce, command không bị dồn sau vô hạn poll. `getSnapshot()` vẫn fresh initial read; background lỗi giữ last snapshot kèm stale/error để disable action.
- Pause world poll trong sequence mutating command + consistent read; resume fresh afterward. Stop watches on unsubscribe cuối, hidden/unmount/session switch; resume current IDs read-only, không resubmit. Các client GET hiện có cũng cần nhận AbortSignal.
- Gate: native comparison có ba bound profile jobs, lifecycle/verdict/diagnostics đúng; unit fake-clock kiểm rare transitions/cancellation và safety cases. S0/S1 có thể COMPARABLE và profiles trùng nhau hợp lệ.

## Phase 3 — Map + KPI từ kết quả backend

**Tasks:** P3-01/P3-02/P3-03; dependency P2. P3-01 là **M3 contract gate**, không frontend code giả lập.

- P3-01 lưu contract note tại `frontend/docs/member3-forecast-contract.md`: endpoint/method/schema/owner auth/source/basis/profile binding, validated public examples trước Accept, semantics no-witness/RETURN_ONLY/partial EDGE. M3 bổ sung read-only public API nếu release hiện tại thiếu. Endpoint chưa được chọn trước bàn giao; không tự ghi path mới vào client.
- Trong lúc gate pending, P3-03 metrics và phần accepted adapter của P3-02 vẫn làm được; chặn DONE Phase 3/proposal preview/full E2E, không chặn mọi công việc khác.
- P3-02 job forecast adapter chỉ nhận approved wire, compare matching origin/current world; accepted execution adapter đọc actual accepted_trajectory/actions và observed prefix. Pure EDGE helper Member2 tái sử dụng nếu parse shape đúng; validator post-plan cũ không áp máy móc lên initial vehicles thiếu fields.
- P3-03 backend provenance source riêng `MEMBER3_HTTP` (không “Member 2 offline runtime”), scope/unit/null KPI; sửa Admin mock exposure scaling predicate. Missing fuel/onTime/rain polygon không synthesize giá trị.
- Gate: test strict point equality, direction/fraction/basis, distinct proposal vs accepted, null scopes/PARTIAL/RETURN_ONLY. Native preview không làm accepted generation/order status đổi và không cần offline packs.

## Phase 4 — Select + Accept thật

**Tasks:** P4-01/P4-02; dependency P2/P3 contract-bound proposal. `selectAlternative(planId)` đổi UI ID, backend registry resolve job ID; không POST Select.

- P4-01 centralized `proposalCurrency`/`isAcceptableJob`, UI capabilities/pending/freshness guard; preserve accepted current view khi user highlight khác. UI guard không thay server CAS.
- P4-02 accept durable intent → M3 accept → consistent fresh world/projections → map active plan server. Receipt/GET acceptances phục vụ lịch sử thôi; retry lịch sử không ép active job quay lại. On STALE_HEAD refresh; show re-optimize, không reaccept tự động.
- Gate: actual Accept generation server, no delivered-on-accept; same-head different generation/hashes fails frontend guard; two-tab race server reject; response loss retry không double-generation.

## Phase 5 — Event + Re-optimization

**Tasks:** P5-01/P5-02; dependency P4. Handoff source `backend/services/replay_service.py`: event `apply_allowed` chỉ true ở exact timestamp với observed_metrics non-null.

- P5-01 events client/type/UI; backend controls Apply/Applied/not due, mock Urgent toggle không đổi. Chỉ event thật trong active session; no polygon from fixture. Add client `step` ở task này để native harness tiến đến barrier, chưa thêm Driver replay UI.
- P5-02 Apply durable intent/expected revision, consistent refresh, stale proposal/historical accepted semantics, re-optimize user action. GET replay/history reconcile confirmed APPLIED receipts khi refresh, không suy ra applied chỉ từ event absent. Không áp event tự động chỉ vì polling đến timestamp.
- Test/native harness accept → steps/target_time đến barrier → Apply. Partial response hoặc repeated Apply cùng request ID giữ semantic đúng; new ID cho event đã applied báo server conflict. S3 custody không reassigned; S4 expiry authoritative.
- Gate: S2/S3/S4 transitions + correct comparison input basis post-event. Phase 5 không phụ thuộc autoplay UI Phase 6, nên dependency graph không có vòng.

## Phase 6 — Driver Execution / Replay

**Tasks:** P6-01/P6-02/P6-03; dependency P4/P5. Backend map prefix/suffix/time vào Driver shell và shared renderer, backend controls thay mock actions theo mode.

- P6-01 accepted-only Driver view, get capabilities + role/error handling; ID placeholders thay mock presentation ở P7. Mock Pickup/Delivered giữ offline.
- P6-02 client playback/reset controls + ReplayControls. Single mutation pending gate; start/step dùng expected revision từ latest consistent read. Pause autoplay đúng path; poll controller until reserved tick settles, block conflicting start/reset during local pending where needed. Speed update không resume paused state.
- P6-03 extract existing session pointer persistence vào sessionReference; notify only pointer/UI preference. Backend session scoped origin+owner access; each tab runtime token separately. Session change abort old watches, clear session UI selection, fetch new world before render actions. Hidden tab resume fresh M3. Không BroadcastChannel world snapshots.
- Gate: two-browser-tabs consistent world, autoplay barrier/final-stop/Pause settle, reset new sid, no local authoritative writes/endpoints pickup/deliver.

## Phase 7 — Production Cutover + Cleanup + E2E

**Tasks:** P7-01/P7-02/P7-03; dependency P1–P6 + public forecast contract.

- P7-01 native E2E on current backend mode **before deleting any packs**; screenshots/payloads/manifest secret-free, cases spec matrix. Performance observations không thành SLA. Existing offline tests still pass.
- P7-02 isolate imports và backend default: `createDispatchApi` chuyển `Promise<DispatchApi>` dùng dynamic mock entry chỉ khi explicit mock; Context initializes one API Promise, injected mocks unchanged. Update factory tests/env typing. Common errors/presentation tách khỏi mocks; production displays server metadata/ID placeholders, mock gets own presentation via mode-specific loader. Có thể đổi build entry/alias để backend artifact exclude mock-only chunks; audit cả static và dynamic modules, không chỉ grep initial JS.
- Giữ lightweight MockDispatchApi/MockStateEngine/fixtureCatalog/decisionPacks. Tháo pack wiring, adapt heavyweight-specific tests bằng tiny test-only fixtures rồi remove 4 heavy files nếu không còn consumers. Không xóa tests meaningful về capacity/custody/EDGE chỉ để suite pass.
- P7-03 rerun unit/full typecheck/build/native E2E trên production build vừa cleanup; audit module IDs/chunk/asset và browser network prove no road-pack/mock loading; scan secrets evidence/artifact; update README/default/offline demo commands. Chỉ lúc này migration DONE.

## Verification commands và evidence

Chạy từ `frontend/` trên Windows PowerShell:

```powershell
npm.cmd run test:run -- src/integrations/member3/revision.test.ts
npm.cmd run test:run -- src/integrations/member3/polling.test.ts src/services/api/BackendDispatchApi.test.ts
npm.cmd run test:run
npm.cmd run typecheck
npm.cmd run build
# Chỉ sau khi tasks tạo harness/audit script và M3 native READY:
node docs/evidence/member3-integration/browser.mjs --phase 2 --scenario S1
node docs/evidence/member3-integration/browser.mjs --all
node scripts/audit-backend-build.mjs
```

Harness `--phase <1..7> --scenario <S0..S4>` và `--all` được tạo P2-03, mở rộng mỗi phase. Kết nối M3 native, token đọc in-memory từ `M3_ACCESS_FILE` ngoài repo; không lưu Authorization/header/dev_access vào report. Result JSON chứa native flag, base URL, session/comparison/job IDs, full bases, assertions, public response samples, screenshots và run timestamps. `--all` trước/sau cleanup có receipts riêng.

Test cycle ở tasks: add named regression + assertions → targeted Vitest FAIL đúng lý do → implementation → targeted PASS → typecheck/build → phase-native gate. Pure docs không cần software suite; không đổi dependency chỉ để có format checker. Commit có thể theo task/phase sau checks khi triển khai trong git checkout đúng repo, không push tự động từ việc viết plan.

## Điều kiện bàn giao và kết thúc

M3 phải cung cấp running native API+worker+owned dispatcher credential qua kênh local riêng, pinned source/build/catalog và public forecast read contract P3-01. Nếu chưa có một điều kiện, ghi rõ task phụ thuộc; tiếp tục task độc lập có thể làm mà không fake API/authority.

Checklist hoàn thành ở [tasks.md](tasks.md), requirement mapping ở spec. Không nhảy sang xóa pack vì chỉ Foundation/SDK backend tests đã pass; không gộp manual WebView pending vào browser PASS. Lượt này chỉ authoring tài liệu; thực thi các task là công việc tiếp theo.
