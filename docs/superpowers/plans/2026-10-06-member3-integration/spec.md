# SafeRoute VN — Frontend ↔ Member 3 Integration Spec

**Ngày:** 2026-10-06. **Người thực hiện:** Member 4 frontend; Member 3 cung cấp HTTP contract/runtime. **Phạm vi:** đúng 7 phase lớn dưới đây.

Đọc cùng [plan.md](plan.md) và [tasks.md](tasks.md). Bộ tài liệu này mô tả migration tiếp theo, không thay thế tracker mock frontend cũ và không chứng nhận các phase chưa chạy.

## Mục tiêu và trạng thái xuất phát

Admin và Driver giữ giao diện hiện tại nhưng đọc cùng world/session do M3 quản lý. Optimize, Accept, event và replay đi qua M3 → M2 runtime thật. Frontend chỉ hiển thị kết quả đã kiểm tra và giữ lựa chọn UI; không tự tạo trạng thái vật lý.

Foundation đã triển khai tại commit `5e9674960ea844871c8b1c39b0ac198950e0c777`: typed client, `BackendDispatchApi`, factory chọn backend/mock, load/read S1 qua native M3. [Bằng chứng browser](../../../../frontend/docs/evidence/m3-phase1-browser-results.json) ghi session `session-b798833e5b5a4683a3db88dcc40f50ce`, 8 orders O001–O008, 2 vehicles V1/V2, 9 locations, thời gian `2026-09-27T21:00:00+07:00`, `SIMULATED_REPLAY`, chưa có accepted/proposed route. Refresh bỏ qua old Mock localStorage và đọc lại cùng session từ M3. Kết quả 157 tests/typecheck/build là baseline lịch sử, không phải verification của migration đầy đủ.

Các khoảng trống hiện tại:

- Review correction đã bỏ `Number(basis.head_version)`: full basis giữ decimal strings đến int64 maximum, backend legacy `DecisionState.version=0` không là server revision. [Verification](../../../../frontend/docs/evidence/m3-revision-fix-verification.json) có 164 tests/typecheck/build và replay public native S1 payloads. Helper validity cho jobs/proposals thật vẫn thuộc Phase 2; không dùng giới hạn safe integer của JS làm giới hạn revision M3.
- Factory mặc định `mock`, import tĩnh cả hai adapter; Context còn import error class từ mock engine, Admin/Driver còn import mock presentation. Chưa đủ điều kiện production cutover.
- Backend mode chưa nối Optimize/Select/Accept/Event/Replay, chưa có coordinator polling world hoặc đồng bộ Admin–Driver.
- `job-view/1` hiện không chứa route geometry; comparison chứa metrics và basis, không phải ba trajectory. Cần contract forecast đọc trước Accept cho proposal map, chi tiết ở Phase 3.

## Ràng buộc xuyên suốt

| ID | Yêu cầu |
| --- | --- |
| G-01 | Giữ Admin/Driver layout, Leaflet, route colors/leg presentation và responsive shell. Chỉ đổi dữ liệu, trạng thái hành động và controls cần thiết để phản ánh backend. |
| G-02 | M3/M2 là authority của orders, custody/load/position, thời gian, events, accepted trajectory và execution. Không clone mock world để thay backend lỗi. |
| G-03 | `head_version` và `generation` là canonical decimal string int64 không âm, tối đa `9223372036854775807`. Không `Number()`, `parseInt()` hoặc tự tăng revision trong production. |
| G-04 | Proposal current khi **toàn bộ** `input_basis` bằng current `M3Basis`: session_id, head_version, generation, build_sha256, root_sha256, head_sha256, source_sha256, context_version, overlay_sha256. Counter bằng nhau chưa đủ. |
| G-05 | Không commit bearer thật vào TS, JSON, README, env mẫu, bundle, screenshot/log hoặc evidence. Token qua injected runtime provider hoặc sessionStorage hiện tại; không thêm `VITE_M3_TOKEN` chứa secret. |
| G-06 | Backend fail closed khi auth/readiness/runtime/validation/binding lỗi. Không fallback fixtureCatalog, decisionPacks, offline road-pack hoặc schematic route. |
| G-07 | Giữ MockDispatchApi/MockStateEngine/fixtureCatalog/decisionPacks hoạt động cho tests và offline demo; không xóa heavy packs trước E2E gate Phase 7. Thay đổi type plumbing có thể cần nhưng không đổi mock lifecycle để giả backend. |
| G-08 | localStorage chỉ lưu session pointer/provenance binding, pending request metadata và UI preference. Không hydrate physical world/plan/progress/clock từ localStorage trong backend mode. |
| G-09 | Một coordinator polling cho mỗi API/provider trong một tab; không từng panel tự poll. Giữa các tab dùng cùng server session; thông báo session pointer chỉ kích hoạt read M3, không vận chuyển world làm authority. |
| G-10 | `SIMULATED_REPLAY`, `real_world_observation=false`; exposure là proxy và witness không chứng minh optimality. Không ghi GPS/live driver observation hoặc SLA chưa được chứng minh. |
| G-11 | Giữ mọi điểm/thứ tự EDGE geometry WGS84 `[longitude, latitude]`, hướng và fraction server cung cấp. Không nối stop thành route, snap/simplify hoặc mượn trajectory từ session/profile khác. |
| G-12 | Triển khai theo 7 phase; test/typecheck/build và evidence cho mỗi phase. Chỉ tick task khi có kết quả kiểm tra. Backend source/runtime là bàn giao riêng của M3, không copy Python vào `frontend/`. |

Không thuộc phạm vi: rewrite giao diện, đổi solver/fixture M1, WebSocket, real GPS, endpoint Pickup/Delivered tự đặt, toggle OFF event đã áp dụng, tự chạy recovery/store mutation, dashboard audit/narrative mới hoặc tuyên bố production calibration/solver feasibility tổng quát.

## Domain và contract dùng chung

**World** là execution view và các projections cùng full basis/time. **Proposal** là forecast job có nguồn job/session/profile/basis xác định; chưa phải accepted route. **Accepted trajectory** là kết quả server đã accept. **Observed prefix** là execution đã quan sát bằng simulated replay; **planned suffix** là forecast chưa diễn ra. UI preference không thuộc world.

Giữ revision string trên wire; frontend có `ServerRevision { headVersion: string; generation: string }`, chuyển sang `expected_revision: { head_version, generation }` bằng đổi tên field, không đổi giá trị. M3Basis vẫn là nguồn kiểm tra full binding. Tách legacy numeric mock version khỏi production revision.

Tất cả HTTP đọc envelope `saferoute-m3-http-response/1`, giữ `request_id`, HTTP status, diagnostic code/path/message. Các command có request ID riêng cho một ý định và body bất biến khi retry; double-click/lost response không tạo command mới. Receipt có thể lịch sử: sau mutation phải lấy fresh state, không ghi receipt cũ đè world mới.

401: yêu cầu cấu hình lại credential; 403: không có quyền session/role; 404 session: cho chọn/load session khác, không tự tạo thay lịch sử mất; 409 stale: refresh và re-optimize, không tự Accept lại basis mới; transient BUSY/TIMEOUT: retry có giới hạn; STORE_INVALID/validation/schema/binding lỗi: dừng hành động. Timeout phía browser không đồng nghĩa job server đã failed/cancelled.

## HTTP contract đã đối chiếu

Nguồn chính: [M3 API handoff](../../../M3_API_HANDOFF.md), [OpenAPI 0.8.0](../../../M3_OPENAPI_20261006.json), `backend/api/routers/`, `backend/models/http.py`, `backend/models/playback.py`, `optimization/runtime/contracts.py`. Source/OpenAPI bàn giao phải có trong môi trường triển khai; không giả định mọi file backend đã publish trong repo frontend.

Các đường dẫn dưới đây có prefix `/api/sessions/{sid}` khi ghi bắt đầu bằng `/...` trong nhóm session.

| Phase | Endpoint thật | Request/ý nghĩa |
| --- | --- | --- |
| 1 | `GET /ready`, `GET /api/runtime/capabilities`, `GET /api/scenarios` | Ready fail closed, build/capabilities/catalog qua M3. |
| 1 | `POST /api/scenarios/{scenarioId}/load` | `{ request_id }`, HTTP 201, session thật. |
| 1 | `GET /state`, `/orders`, `/vehicles`, `/locations` | Fresh physical state và metadata cùng basis/time. |
| 2 | `POST /profiles/compare` | `{ request_id, expected_revision }`, HTTP 202; bỏ `job_ids` để tạo NEW_BATCH. |
| 2 | `GET /profiles/comparisons/{comparisonId}` | Group lifecycle, child job views, `outcome.comparison` verdict/metrics. |
| 2 | `GET /jobs/{jobId}` | `task02-m2-runtime-job-view/1`, lifecycle/business outcome/validation/coverage. |
| 2 | `POST /profiles/comparisons/{comparisonId}/cancel`, `POST /jobs/{jobId}/cancel` | `{ request_id }`; hỗ trợ cancellation/recovery UX, không dùng browser abort thay server cancel. |
| 2 | `POST /optimize` | `{ request_id, profile, expected_revision }`; API đã có nhưng không dùng làm fallback tự động cho compare. |
| 4 | `POST /jobs/{jobId}/accept` | `{ request_id, expected_revision }`, HTTP 200; receipt + fresh execution view. |
| 4 | `GET /acceptances` | Receipt history khi cần hiển thị/reconcile; không suy ra physical world từ audit. |
| 5 | `GET /events`, `POST /events/{eventId}/apply` | Apply body `{ request_id, expected_revision }`; dùng `apply_allowed` server. |
| 5–6 | `GET /replay/history` | Confirmed event/replay/control receipts khi refresh; lịch sử có giới hạn, missing history không tự tạo receipt. |
| 6 | `GET /replay`, `POST /replay/step` | Step body `{ request_id, expected_revision, target_time? }`; target nếu có phải ISO `+07:00`, không vượt barrier. |
| 6 | `POST /replay/start`, `POST /replay/speed` | Start có request_id/expected_revision/speed; speed có request_id/speed; speed ∈ 1,2,4,8. |
| 6 | `GET /replay/playback`, `POST /replay/playback/pause` | Pause autoplay body `{ request_id }`; đọc controller để xác nhận settle. |
| 6 | `POST /replay/pause` | Manual pause acknowledgement, không phải endpoint dừng autoplay. |
| 6 | `POST /replay/reset` | `{ request_id }`, tạo session mới cùng scenario, giữ lịch sử cũ. |

SDK child job wire chỉ có `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`; cancelled child thường là `FAILED` + diagnostic `JOB_CANCELLED`. Comparison group có `QUEUED`, `RUNNING`, `CANCEL_REQUESTED`, `COMPLETED`, `FAILED`, `CANCELLED`. Không dùng enum chung làm mất khác biệt. `COMPLETED` không đảm bảo có witness hoặc comparison `COMPARABLE`.

## Phase 1 — Frontend ↔ M3 Foundation

**FR-01:** Chọn backend/mock qua factory/env, typed HTTP/auth/errors; fetch catalog từ M3, load session thật, read orders/vehicles/locations/current time/execution mode. Không tạo accepted plans/routes khi state chưa trả.

**Acceptance:** Native S1 hiện 8 orders, 2 vehicles, 9 locations với IDs/coordinates/time bằng public M3 responses; refresh cùng session sau khi chèn old Mock S0 3 orders vẫn hiện S1. Các projections lệch basis/time bị re-read có giới hạn, không merge world lẫn nhau. Concurrent load không để response cũ ghi đè lựa chọn mới; Mock test/offline còn chạy.

**Trạng thái:** load/read acceptance đã PASS theo evidence hiện có. Không cần làm lại Phase 1; kiểm tra baseline trước Phase 2. Catalog M3 có S0–S8, UI hiện hỗ trợ S0–S4; mở rộng S5–S8 không bắt buộc cho migration này. Không lấy selector metadata từ fixtureCatalog trong backend.

## Phase 2 — Optimize thật qua M3/M2

**FR-02:** Dùng revision seam string đã sửa, bổ sung full-basis job/proposal validity trước khi submit. Optimize tạo một profile comparison NEW_BATCH từ current expected revision, giữ FASTEST/BALANCED/SAFER theo profile identity. Poll group và chỉ đọc child riêng khi cần; không vừa poll group vừa mở ba vòng poll trùng lặp.

Hiển thị lifecycle, solver/business outcome, validation, coverage và error độc lập. Có no-witness `SEARCH_LIMIT`/`TIME_LIMIT`/`UNSUPPORTED` thì không tạo empty fake route hoặc gán tất cả orders là unserved. PARTIAL giữ đúng served/unserved partition/reasons; RETURN_ONLY giữ mandatory continuation theo supplemental view, không bị đánh đồng với no-plan chỉ vì business status UNSUPPORTED. Ranking chỉ khi M3 verdict `COMPARABLE`; ba profile trùng route/metrics vẫn hợp lệ nếu server trả như vậy.

Coordinator schedule sau khi request hoàn thành: world mặc định 2500 ms khi active, comparison 1000 ms; retry transient tối đa 3 lần với backoff 1000/2000/4000 ms. Deadline theo dõi comparison mặc định 10 phút, có thể cấu hình; hết hạn ngừng polling và báo chưa xác định, không đổi job status. Abort/ignore stale responses khi đổi session/unmount; stop terminal, auth/binding lỗi và hidden tab, resume bằng fresh read. Khoảng thời gian là lựa chọn frontend, không SLA backend.

**Acceptance:** Có comparison/job IDs M3 thật; thấy QUEUED/RUNNING/terminal theo response hoặc test clock, không bắt buộc browser bắt kịp mọi trạng thái ngắn. Lost submit response retry cùng request ID chỉ tạo một comparison. Counters trên `2^53` và generation-only change vẫn đúng. World đổi trong lúc solve làm proposal stale. Browser không gọi offline planner.

## Phase 3 — Map + KPI từ kết quả backend

**FR-03:** Adapter job/comparison/execution view chuyển backend payload sang card/map model hiện tại. EDGE geometry giữ nguyên; KPI có đơn vị và scope `FORECAST_ONLY`/observed-prefix/planned-suffix/projected-whole, missing/null hiện unavailable. Không dùng mock exposure scaling/fuel calculation để giả metric backend. Provenance có session/job/profile/full basis/build; raw proxy units chỉ đổi đơn vị khi contract định nghĩa, không tự gọi là xác suất rủi ro.

**Phụ thuộc hợp đồng cần M3 bàn giao:** Source hiện tại của GET job và comparison không trả forecast trajectory trước Accept. GET state chỉ trả **current accepted** trajectory. M4 cần public, owner-scoped, read-only forecast view bound vào job/profile/full input basis/build để preview cả ba proposal. M3 xác nhận endpoint/schema/examples và nguồn certified M2 geometry; tài liệu này không tự đặt endpoint đã tồn tại. Không Accept ngầm để lấy geometry, không đọc private store/solver files từ browser. Trong lúc chờ vẫn làm KPI/comparison và adapter accepted execution; proposal geometry phải hiện unavailable, Phase 3 chưa DONE.

Weather polygon tương tự: GET events hiện chỉ có ID/type/time/apply_allowed. Nếu public current-world không có polygon/context thì không dựng rain overlay từ fixture; ghi rõ unavailable và yêu cầu public context contract nếu muốn giữ overlay thật.

**Acceptance:** Với forecast contract đã khóa, preview từng profile giữ đúng từng điểm/thứ tự EDGE, metadata/basis match, partial geometry giữ fraction gốc; missing/tampered binding reject. Geometry accepted không tráo sang proposal. KPI khác scope không cộng/chia sai, null không thành 0. Map filters hiện có như ẩn return trên Admin chỉ đổi visibility, không đổi trajectory/KPI. OSM tile lỗi vẫn giữ backend markers/routes.

## Phase 4 — Select + Accept thật

**FR-04:** Select là UI state, không HTTP mutation. Backend proposal mang đúng job ID/profile/input basis/validation. Accept enable khi job COMPLETED, `validation.valid=true`, `plan_available=true`, proposal full basis=current basis, không pending mutation. Server CAS vẫn là quyết định cuối cùng.

Gọi accept bằng selected **job_id**, expected revision string và durable request ID; sau response fetch current state. Accepted history lấy receipt/audit; active trajectory lấy fresh state. Không suy ra active từ receipt cũ hoặc local selected card. Accept tăng generation server; frontend không tự tăng, không tự đánh DELIVERED. 409 stale báo re-optimize; mutation ambiguous giữ request/body để retry chính ý định cũ, không tạo accept khác.

**Acceptance:** Select không có POST; Accept một certified current job tạo đúng server accepted trajectory, Driver chưa có delivery mới chỉ do Accept. Hai tab race Accept/Replay/Event khiến stale bị reject và UI refresh. Retry receipt lịch sử sau mutation mới không rewind world. Invalid/no-witness/stale/binding-mismatch không Accept được.

## Phase 5 — Event + Re-optimization

**FR-05:** Pending events lấy M3, hỗ trợ URGENT_ORDER/VEHICLE_UNAVAILABLE/LOCAL_RAIN_WHAT_IF khi scenario thật có event. Apply chỉ khi `apply_allowed=true`: đúng timestamp và đã có observed replay frame. Trước mốc hiện not due; event là transition một chiều. APPLIED dựa receipt/history được server xác nhận, không tự suy ra mọi event mất khỏi list là applied.

Sau Apply fetch world, invalidate proposal bằng full basis, hiển thị plan cần re-optimization theo server view và Optimize lại. Urgent không OFF; quay lại bằng Reset/new session Phase 6. Không mutate orders/vehicle/weather/time trong React hoặc mock engine. S1 không có event thì không bịa nút event áp dụng được.

**Acceptance:** S2 urgent, S3 unavailable/custody, S4 rain dùng đúng event IDs từ server, đạt exact barrier bằng accepted replay, Apply một lần rồi re-optimize từ world mới. EVENT_NOT_DUE/EVENT_ALREADY_APPLIED/STALE_HEAD xử lý đúng; retry cùng ID không nhân event. Custody/delivered prefix không rollback, S4 hết thời gian theo server.

**Phụ thuộc thứ tự:** Phase 5 chưa cần Driver autoplay UI Phase 6. Native nghiệm thu dùng test harness gọi replay/step thật đến barrier; đây là prerequisite của event contract, không phase bổ sung và không tự advance clock trong frontend.

## Phase 6 — Driver Execution / Replay

**FR-06:** Driver chỉ render accepted route/current state qua M3 execution-view/2: positions/load/onboard/delivered prefix/planned suffix/unserved. Completed display chỉ từ observed prefix, không lấy plan forecast làm delivered. Trước accepted plan giữ empty state; missing timestamps giữ null.

Backend Driver dùng Step/Play/Pause/speed 1/2/4/8, không Pickup/Delivered hay local demo clock. Mock mode giữ controls cũ. Backend dispatcher owner thực hiện writes; read-only role phải là owner hợp lệ theo contract hiện tại, không giả observer actor có quyền session người khác hoặc invent driver login API.

Autoplay chạy server; Pause dùng `/replay/playback/pause`. Một tick đã reserved có thể settle sau Pause; read controller/world đến khi `in-flight` hết thay vì promise freeze tức thời. Event barrier bắt buộc pause/chờ Apply; speed không tự resume paused controller. Reset tạo new session ID, clear UI selection/job pointers của session cũ, bind cả Admin/Driver tới pointer mới.

Admin và Driver mỗi tab có coordinator riêng, cùng backend-origin/session pointer và credential owner. Tab khác đổi pointer thì đọc server lại. Polling không có panel duplication, không storage write loop; error giữ snapshot gần nhất với trạng thái unavailable/stale và chặn mutation cần freshness.

**Acceptance:** Hai tab thấy cùng basis/time/custody/accepted plan sau poll settle; refresh chỉ GET world. Step/Play/Speed/Pause/Reset đúng endpoints, Pause settle, barrier không vượt, old in-flight response không ghi đè new session. Không có POST pickup/deliver hoặc local physical mutation.

## Phase 7 — Production Cutover + Cleanup + E2E

**FR-07:** Sau native E2E S0–S4 baseline PASS, backend là default; env mẫu chỉ `VITE_DISPATCH_MODE=backend` và `VITE_M3_BASE_URL=http://127.0.0.1:8000`. Mock chỉ explicit mode hoặc injection cho tests/offline. Unknown mode báo lỗi.

Tách production import graph khỏi MockStateEngine/MockDispatchApi/fixtureCatalog/decisionPacks/presentation demo data và road packs. Common error/type definitions không import ngược mock engine. UI dùng backend metadata hoặc ID/placeholder khi thiếu thông tin; không trình bày tên/địa chỉ/số điện thoại demo như dữ liệu server. Có thể dùng dynamic mock entry hoặc build alias; backend artifact không chứa heavy mock assets và không tải mock chunks trong backend mode.

Chỉ sau gate trên mới xóa `src/mocks/data/member2-road-packs.json`, `member2-event-road-packs.json`, `src/mocks/engine/offlineRoadPlans.ts`, `offlineRoadPackCatalog.ts` nếu không còn consumer. Giữ lightweight mock engine/decision packs cho offline; bỏ wiring heavy packs và thay pack-specific tests bằng tiny test fixtures ở test-only paths trước khi xóa. Chạy lại full suite và E2E trên build sau cleanup. Không dùng kết quả trước xóa làm acceptance cuối.

**Ma trận native E2E:**

| Case | Chứng minh bắt buộc |
| --- | --- |
| S0 | Load baseline; compare đúng verdict; Select local; Accept server; Driver replay; refresh/cross-tab nhất quán. |
| S1 | 8 orders/2 vehicles/9 locations; ba jobs thật; EDGE/KPI/provenance từ M3; old Mock 3-order storage bị bỏ qua. Không buộc ba profile khác nhau. |
| S2 | Accept → replay đúng urgent barrier → Apply → fresh orders → compare/re-accept; one-way event, không duplicate. |
| S3 | Unavailable event giữ onboard owner/delivered prefix; partial/unserved reason nếu server trả; không giao lại đơn đã delivered. |
| S4 | Rain what-if/event barrier, server context validity/expiry; geometry và exposure scope đúng; không lấy polygon mock. |
| Failure | 401/403, unavailable ready/runtime, invalid schema/binding, BUSY retry bound, stale Accept, ambiguous command retry, cancellation/timeout, missing geometry/null metrics, late response sau session switch. |

**Acceptance:** Lưu HTTP public payloads, IDs/basis, assertions, screenshots Admin 1280/1440 và Driver 360/390/430, tests/typecheck/build receipts, import/bundle audit, secret scan. Browser/native dùng real M3+M2, không `backend/mock` và không static fake HTTP làm chứng cứ E2E. Test giả HTTP chỉ cho unit/component tests. UI controls accessibility và tile-failure regression giữ nguyên. Manual touch/WebView chưa chạy phải ghi pending, không gộp browser evidence thành đã đạt thiết bị thật.

## Traceability và Definition of Done

| Requirement | Task | Gate |
| --- | --- | --- |
| FR-01, G-02/05/06/08 | P1-01, P1-02 | Native S1 load/read + mock isolation đã có evidence. |
| FR-02, G-03/04/09 | P2-01, P2-02, P2-03 | Real compare, string revision, bounded polling/lifecycle tests. |
| FR-03, G-10/11 | P3-01, P3-02, P3-03 | Public forecast contract + exact EDGE/KPI/provenance. |
| FR-04 | P4-01, P4-02 | Full-basis select/accept/current-world refresh. |
| FR-05 | P5-01, P5-02 | Native event/barrier/re-optimize; no toggle authority. |
| FR-06, G-01/09 | P6-01, P6-02, P6-03 | Driver replay, pause settle, cross-tab server consistency. |
| FR-07, G-07/12 | P7-01, P7-02, P7-03 | E2E trước cleanup và sau cleanup; backend graph sạch. |

Hoàn thành migration khi mọi task mới có evidence, forecast contract Phase 3 đã giải quyết, native matrix PASS và backend build không phụ thuộc offline authority. Baseline Foundation PASS không tương đương full integration PASS. Tài liệu/checkbox không thay kết quả thực thi.
