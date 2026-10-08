# Bàn giao HTTP backend cho Member 4 — 0.8.0

Bản hiện hành thêm comparison, autoplay/speed, narrative và mock demo riêng; xem [handoff hoàn tất](M3_COMPLETION_API_HANDOFF.md) và `M3_OPENAPI_20261006.json`. Các luồng P0 bên dưới giữ semantics đã nghiệm thu; mô tả trạng thái M3-07 là lịch sử của bản 0.7.0.

Ngày: 05/10/2026. Root triển khai: `D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN`.

Backend đã có catalog S0–S8, load/read theo owner, optimize bất đồng bộ, durable queue, worker riêng, polling, cancel, accept certified job, pending events và replay theo bước bằng SDK thật. M3-07 thêm notification dedup trước SDK ack, recovery gate/validation phía server, immutable audit bundles và backup admin riêng. Bản 0.8.0 đã triển khai so sánh profile, automatic playback/speed, narrative và mock riêng; full frontend E2E còn chờ M4. OpenAPI hiện hành [M3_OPENAPI_20261006.json](M3_OPENAPI_20261006.json) dùng app `0.8.0`. Xem [luồng load/read](M3_SESSION_API_HANDOFF.md), [luồng optimize/poll/cancel](M3_JOB_API_HANDOFF.md), [accept/audit](M3_ACCEPT_API_HANDOFF.md), [event/replay](M3_EVENT_REPLAY_API_HANDOFF.md) và [notifications/recovery/artifacts](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md).

## Khởi chạy trên máy hiện tại

Chạy trong PowerShell:

```powershell
Set-Location -LiteralPath 'D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN'
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/start_backend.py
```

URL mặc định: `http://127.0.0.1:8000`; Swagger: `/docs`; schema: `/openapi.json`. Có thể thêm `--port 8013`. Script Python chạy trực tiếp, không cần thay ExecutionPolicy.

Mở terminal PowerShell thứ hai tại cùng root để chạy worker:

```powershell
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/start_worker.py
```

Chỉ một compute worker được giữ khóa hệ điều hành trên cùng metadata store. Worker thứ hai thoát mã 3 trước khi recovery. Budget mặc định 60 giây, cấu hình server bằng `SAFEROUTE_COMPUTE_BUDGET_SECONDS`; client không được gửi budget. Dừng bình thường chờ compute/recovery đang chạy để giữ khóa cho đến khi lệnh kết thúc.

Các biến cấu hình nằm trong `backend/.env.example`; app đọc environment của tiến trình, không tự nạp `.env`. Venv backend dùng `requirements-backend.lock.txt`; venv và lock của runtime M2 giữ riêng.

Token phát triển nằm tại `D:\MLAI4\.local\m3-step7\backend\dev_access.json`, theo actor `member3`/`member4`. File cấu hình server `auth_tokens.json` chỉ giữ SHA-256 token và role. Giữ token ngoài Git và dùng HTTP header `Authorization: Bearer <token>`; không đưa vào URL. Đây là credential cho demo local. Xóa token hash để thu hồi; app đọc lại cấu hình mỗi lần xác thực.

## Endpoint hiện có

| Endpoint | Xác thực | Kết quả |
| --- | --- | --- |
| `GET /health` | Không | 200 khi tiến trình HTTP sống |
| `GET /ready` | Không | 200 khi G0, auth, metadata, catalog, queue, acceptance/replay/outbox/recovery/artifact metadata, SDK và heartbeat worker cùng sẵn sàng; 503 kèm check cụ thể nếu thiếu |
| `GET /api/runtime/capabilities` | Bearer | 200 với typed capabilities lấy từ public SDK đã xác minh; 401 nếu token không hợp lệ; 503 nếu runtime lỗi |
| `GET /docs`, `GET /openapi.json` | Không | Swagger và HTTP schema |
| `GET /api/scenarios` | Bearer | Catalog S0–S8 với counts, source/version/units |
| `GET /api/scenarios/{scenario_id}` | Bearer | Metadata và tóm tắt sự kiện của fixture |
| `POST /api/scenarios/{scenario_id}/load` | Dispatcher | 201, phiên server tạo; body chỉ có request_id |
| `GET /api/sessions/{session_id}` | Owner | Metadata và links đọc |
| `GET /api/sessions/{session_id}/state` | Owner | Execution view /2 hiện hành từ SDK |
| `GET /api/sessions/{session_id}/orders` | Owner | Metadata đơn, status và custody từ view hiện hành |
| `GET /api/sessions/{session_id}/vehicles` | Owner | Xe từ SDK và metadata cố định |
| `GET /api/sessions/{session_id}/locations` | Owner | Depot và địa điểm giao các đơn hiện có |
| `POST /api/sessions/{session_id}/optimize` | Owner + dispatcher | 202 với job ID, profile, input basis và links polling/cancel |
| `GET /api/sessions/{session_id}/jobs/{job_id}` | Owner | Public typed job-view /1; giữ lifecycle, outcome, witness và diagnostics |
| `POST /api/sessions/{session_id}/jobs/{job_id}/cancel` | Owner + dispatcher | 200 với receipt; job hoàn tất trả COMPLETED_IMMUTABLE |
| `POST /api/sessions/{session_id}/jobs/{job_id}/accept` | Owner + dispatcher | 200, historical receipt và fresh execution view; expected_revision bắt buộc |
| `GET /api/sessions/{session_id}/acceptances` | Owner | Tối đa 100 receipt accept thành công gần nhất của phiên |
| `GET /api/sessions/{session_id}/events` | Owner | Pending event ID/type/timestamp từ fixture đã pin, cùng basis và điều kiện apply |
| `POST /api/sessions/{session_id}/events/{event_id}/apply` | Owner + dispatcher | 200, apply event đúng barrier một lần và suspend plan cũ; expected_revision bắt buộc |
| `GET /api/sessions/{session_id}/replay` | Owner | Manual controller: mode STEP, paused=true, step_seconds và current execution view |
| `POST /api/sessions/{session_id}/replay/step` | Owner + dispatcher | 200, ADVANCED hoặc NOOP; target_time tùy chọn, expected_revision bắt buộc |
| `POST /api/sessions/{session_id}/replay/pause` | Owner + dispatcher | 200, acknowledgement PAUSED của manual mode; không mutate runtime head |
| `POST /api/sessions/{session_id}/replay/reset` | Owner + dispatcher | 200, phiên mới từ cùng verified fixture, receipt lineage và view phiên mới; phiên nguồn giữ nguyên |
| `GET /api/sessions/{session_id}/replay/history` | Owner | Tối đa 100 receipt advance/NOOP, event, pause và reset gần nhất |
| `GET /api/sessions/{session_id}/notifications?after=0&limit=100` | Owner | Durable SDK summaries đã lưu ở M3, cursor int64 string, trạng thái ack và has_more; không ack khi đọc |
| `POST /api/sessions/{session_id}/artifacts` | Owner + dispatcher | 201 với manifest snapshot bất biến; body chỉ có request_id, retry giữ đúng bundle cũ |
| `GET /api/sessions/{session_id}/artifacts` | Owner | Danh sách đầy đủ artifact đã hoàn tất của phiên |
| `GET /api/sessions/{session_id}/artifacts/{artifact_id}` | Owner | Manifest, captured basis và hash: /1 lịch sử có 11 file; /2 mới có 12 file |
| `GET /api/sessions/{session_id}/artifacts/{artifact_id}/content` | Owner | content_utf8, SHA-256 và byte count chính xác của JSON bundle đã lưu |

Khi cả API và worker hoạt động, `/ready` có thể trả 200. Nếu chưa có heartbeat: `WORKER_NOT_CONFIGURED`; heartbeat STOPPED/DEGRADED, sai binding hoặc quá 30 giây: `WORKER_NOT_READY`. Worker cập nhật heartbeat mỗi 2 giây, kể cả khi compute. Khi tiến trình bị kill, READY cũ có thể còn được chấp nhận tối đa 30 giây. Queue quarantine hoặc recovery gate chưa VERIFIED khiến readiness thất bại. Startup đánh dấu các phiên READY là RECOVERING, fence orphan job rồi kiểm source/session và lưu bằng chứng trước khi cho ghi tiếp. HTTP optimize/cancel/accept/replay và worker reconcile đều kiểm gate; lỗi corruption/source/outbox giữ phiên BLOCKED. Khi worker dừng, submit vẫn có thể lưu job QUEUED nếu gate của phiên cho phép; nó không bỏ qua phiên bị chặn.

Các origin mặc định: `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000`. CORS cho phép GET/POST/OPTIONS, header Authorization/Content-Type, không wildcard hoặc cookie. Browser đọc được `X-Request-ID` và `X-Process-Time` (giây).

## Response và lỗi

```json
{
  "schema_version": "saferoute-m3-http-response/1",
  "request_id": "server-generated-uuid",
  "status": "OK",
  "data": {
    "schema_version": "task02-m2-runtime-capabilities/1",
    "default_profile": "BALANCED",
    "execution_mode": "SIMULATED_REPLAY",
    "real_world_observation": false
  },
  "diagnostics": []
}
```

Ví dụ trên chỉ trích các field capabilities; response thật giữ toàn bộ typed capabilities của SDK. Envelope HTTP không đổi schema frozen của view nằm trong `data`.

```json
{
  "schema_version": "saferoute-m3-http-response/1",
  "request_id": "server-generated-uuid",
  "status": "ERROR",
  "data": null,
  "diagnostics": [
    {"severity": "ERROR", "code": "UNAUTHORIZED", "path": "authentication", "message": "Bearer token required"}
  ]
}
```

Readiness lỗi vẫn trả `data` với danh sách check để vận hành. Các lỗi request thông thường có `data=null`. `request_id` trong envelope bằng header X-Request-ID; app luôn tạo ID mới, không tin ID trace do browser gửi. `request_id` trong **body load/mutation** là khóa idempotency do client giữ ổn định cho retry; hai giá trị có mục đích khác nhau.

401: thiếu/sai token. 403: sai role hoặc owner của phiên. 404: route/phiên/event/artifact không tồn tại. 409: idempotency conflict, request đang chạy, phiên chưa sẵn sàng, stale revision/basis, thiếu accepted plan/observed frame, time rewind, event chưa due hoặc step vượt event barrier; `ARTIFACT_STATE_CHANGED` yêu cầu retry cùng ID khi capture gặp mutation đồng thời. Installation binding đã đổi cũng trả 409. 413: body vượt 1 MiB. 415: body không phải MIME application/json hoặc application/*+json. 422: JSON/model/cursor không hợp lệ. 500: lỗi nội bộ đã che chi tiết. 503: dependency/gate chưa sẵn sàng hoặc source/runtime/receipt/artifact binding không xác minh được. Client hiển thị diagnostics, không tự thay lỗi bằng mock.

Response `/api/*` có `Cache-Control: no-store`. HTTP GET job 200 thể hiện đọc view thành công; kết quả nghiệp vụ có thể SEARCH_LIMIT hoặc FAILED. Không biến một kết quả thiếu witness thành infeasible hoặc kế hoạch có thể accept.

JSON được kiểm trên byte đầu vào trước decoder của FastAPI: duplicate keys, NaN/Infinity/overflow, integer token ngoài ±(2^53−1), UTF-8 sai, root không phải object và depth từ 96 bị từ chối. Pydantic kiểm strict types và từ chối field lạ. Counter int64 phải là decimal string canonical, ví dụ `"9007199254740993"`; giữ rational numerator/denominator và `null`, không đổi sang JavaScript Number hoặc số 0.

## Request models

Các model dưới đây đã dùng ở route tương ứng. Session/job/event/artifact ID lấy nguyên giá trị opaque từ server và đặt trong path; actor, full basis và SDK command ID do server xác định.

| Model | Body |
| --- | --- |
| LoadScenarioRequest | `request_id`; dùng cho load và artifact export |
| OptimizeRequest | `request_id`, `profile` (mặc định BALANCED), `expected_revision` tùy chọn |
| AcceptPlanRequest | `request_id`, `expected_revision` bắt buộc; job ID nằm trong path |
| ApplyEventRequest | `request_id`, `expected_revision` bắt buộc; event ID nằm trong path |
| ReplayStepRequest | `request_id`, `expected_revision` bắt buộc, `target_time` tùy chọn hoặc null |
| CancelJobRequest | `request_id` |
| ReplayControlRequest | `request_id`; dùng cho pause/reset |

Ví dụ optimize body:

```json
{
  "request_id": "m4-optimize-001",
  "profile": "BALANCED",
  "expected_revision": {"head_version": "1", "generation": "0"}
}
```

Revision chỉ là điều kiện chống stale; server vẫn resolve binding thật. Timestamp dùng ISO `+07:00`, tối đa sáu chữ số phần thập phân. Client không được gửi path, source/build digest, actor, routes, state/load tự khai hoặc solver budget. Quyền lấy từ token server và owner metadata. M3 metadata không giữ authority vật lý.

## Ranh giới runtime

Gateway gọi subprocess bằng interpreter runtime với `-I -B`. Bridge xác minh production inventory trước import, kiểm nguồn import SDK rồi gọi public RuntimeClient cho capabilities/bootstrap/resolve/submit/compute/job_view/cancel/recover/accept/advance/apply_event và các public method read_notifications/acknowledge/validate_session/backup. Batch startup/outbox chỉ ghép các public SDK call; không thêm operation vào frozen SDK. Store private riêng: `D:\MLAI4\.local\m3-step7\state\backend_authority.sqlite`. Catalog/fixture được kiểm từ trusted receipt đã pin trong inventory. Metadata M3 lưu owner/install identity/request receipt, queue, acceptance/replay audit, notifications/ack, recovery gate/audit, immutable public observations và artifact bytes; trạng thái vật lý hiện hành đọc từ SDK. Pause là acknowledgement manual mode; reset dùng load với key server đã lưu để tạo phiên mới. API không chạy recovery; worker chỉ recovery sau khi đã giữ singleton lock. Backup toàn authority chỉ qua admin CLI, không có HTTP download store.

Timeout subprocess cho `capabilities` là **60 giây**, gồm xác minh source/production inventory và khởi tạo SDK; `/ready` cũng dùng lệnh này. Probe trên máy hiện tại ghi nhận hai lần tuần tự **8,703/8,485 giây**, và hai lần chạy đồng thời **8,500/15,922 giây**, đều xác minh đúng pinned build. Số đo đồng thời vượt giới hạn cũ 15 giây nên capabilities có timeout riêng; đây là quan sát chẩn đoán, không chứng nhận SLA. Resolve/job-view/submit/cancel/recover có timeout thông thường **60 giây**, bootstrap/accept 60 giây, advance/apply và outbox/validation/comparison/backup 120 giây; compute bằng budget server cộng 45 giây. Từ bản 0.8.0, startup inspection ghép tối đa hai phiên trong một bridge, với bound 120 giây cho mỗi phiên; từng phiên vẫn được recover/validate/resolve/notification-check riêng và giữ thứ tự đầu vào.

Worker reconcile pending replay/event/control, acceptance và submit/cancel bằng row đã persist, giữ full basis/payload/command ID cũ. Không tính lại default target hoặc tạo reset load key mới khi retry. Receipt/history của mỗi replay mutation lưu trong một transaction metadata trước khi resolve current view. Timeout replay/apply mặc định 120 giây, lease request 240 giây; lỗi commit/read không rõ kết quả phải retry cùng body/request ID. Malformed receipt hoặc sai counter/hash/context/overlay binding bị từ chối trước audit; dependency không xác minh được khiến worker degraded. Authority SDK và metadata M3 vẫn là hai store riêng, không có transaction chung hai store.

Các SDK call ngoài compute dùng chung OS access lock theo authority path đã resolve, để API và polling worker không đồng thời tranh write lock mà SDK dùng cả cho việc đọc/verify. Thời gian chờ cộng subprocess cùng nằm trong deadline hiện có; hết thời gian chờ báo `RUNTIME_BUSY` 503, không gọi SDK hoặc đánh dấu corruption. Compute vẫn chạy song song để cho phép poll/cancel; đây không phải cơ chế loại trừ toàn bộ internal transaction của SDK. STORE/journal/source rejection vẫn được giữ và chặn ghi theo gate.

Giữ ý nghĩa Step 7: compute là forecast, accept là kích hoạt, delivered chỉ từ observed replay. SIMULATED_REPLAY không phải GPS; `observed_metrics=null` giữ nguyên khi chưa có observation. Capabilities không chứng nhận SLA 30 giây, calibration hoặc luồng E2E đã hoàn thành.

Accept mới yêu cầu full job input basis bằng current basis và completed certified witness; SDK revalidate source/build/witness rồi CAS. Accept chỉ tăng generation đúng một, không tăng head_version hoặc chuyển đơn sang DELIVERED. Request accept cũ replay command/job/basis đã lưu trước mọi kiểm stale mới. Response tách `receipt` lịch sử với `execution_view` hiện tại; hai basis có thể khác nhau khi retry sau mutation tiếp theo. Receipt/audit persist atomically trước đọc live view. Chi tiết lỗi commit/read và retry nằm trong handoff accept.

Step mặc định tiến 60 giây và clamp tới pending event gần nhất; `SAFEROUTE_REPLAY_STEP_SECONDS` nhận số nguyên trong `[1,3600]`. Event đã due phải được apply trước bước tiến tiếp. Explicit target không được rewind hoặc vượt event chưa apply; server giữ timestamp nguồn chính xác khi chạm barrier. ADVANCED tăng head_version một, NOOP giữ basis; apply tăng head_version một, giữ generation và suspend plan. Sau event, optimize/accept lại trước khi advance. Reset không rewind head cũ. Chi tiết receipt/current view, invariants S2/S3/S4 và điều khiển thủ công nằm trong [handoff event/replay](M3_EVENT_REPLAY_API_HANDOFF.md).

Worker lưu notification trước SDK ack, dedup theo installation/session/event ID và giữ stable ack command ID cho crash/retry. HTTP notifications chỉ đọc M3 summaries; event_id là journal hash, khác pending source ID như S3-E1. Cursor/next_cursor là decimal string int64, limit từ 1 đến 500. Artifact export theo actor/session/request ID giữ immutable UTF-8 bundle và file hashes; ID mới tạo snapshot mới. Bản 0.8.0 tạo manifest/bundle `/2` gồm 12 file với `decision_narrative.json` và persisted comparison/playback history; bundle `/1` cũ giữ nguyên 11 file/bytes khi đọc hoặc retry. Bundle giữ public views, toàn bộ lịch sử M3 đã lưu và chỉ rõ historical frame/trajectory chưa được capture. Lấy hash từ byte UTF-8 của content_utf8, không stringify lại JSON; không suy ra full feasibility/E2E/SLA từ validation/export. [Handoff M3-07](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md) mô tả nghiệm thu bản 0.7.0 lịch sử, recovery checklist và lệnh backup admin sau khi API/worker đã dừng; worker lock không thay thế việc dừng HTTP writes.

## Kiểm tra lại

```powershell
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B -m pytest backend/tests -q -p no:cacheprovider
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/verify_step2.py --output 'D:\MLAI4\.local\m3-step7\backend\native_http_smoke.json'
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/verify_step3.py --output 'D:\MLAI4\.local\m3-step7\backend\native_sessions.json'
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/verify_step4.py --output 'D:\MLAI4\.local\m3-step7\backend\native_jobs.json'
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/verify_step5.py --output 'D:\MLAI4\.local\m3-step7\backend\native_accept.json'
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/verify_step6.py --budget-seconds 120 --output 'D:\MLAI4\.local\m3-step7\backend\native_replay.json'
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/verify_step7.py --output 'D:\MLAI4\.local\m3-step7\backend\native_outbox_artifacts.json'
```

Lệnh smoke mở Uvicorn trên cổng local tạm, kiểm HTTP/SDK thật và dừng helper sau kiểm tra. Step 4/5/6 khởi chạy cả worker riêng; chạy khi chưa có worker đang giữ lock. Step 5 compute và accept một S0 riêng, không advance/apply event. Step 6 mặc định kiểm S2/S3/S4 bằng initial solve/accept, replay tới barrier, apply event, replan/accept, replay tiếp, pause/reset và restart; có thể chọn riêng bằng `--scenarios S2` (hoặc S3/S4). `--budget-seconds 120` chỉ override budget của HTTP/worker helpers do verifier khởi chạy, không đổi production default 60 giây hay cấu hình runtime M2. Các bước tạo phiên test riêng trong private stores, giữ lại để kiểm receipt/restart. Kết quả thực tế nằm trong receipt output và báo cáo nghiệm thu từng bước; tài liệu này không tuyên bố PASS hoặc số test. Test fixture có route `/test/*` và FakeGateway chỉ được đăng ký trong test, không tồn tại trong app chạy thực tế.

Step 7 cũng khởi chạy worker riêng; cần receipt native M3-06 đã PASS, mặc định chọn receipt private thành công mới nhất hoặc chỉ rõ bằng `--source-receipt`. Verifier đối chiếu lại S2/S3/S4 đã có witness, kiểm outbox/ack crash boundaries, recovery/restart, artifact bytes và backup/corruption trên bản sao riêng; không solve lại các witness đó. Chạy khi API/worker phục vụ thực tế đã dừng. Xem receipt và báo cáo riêng để biết kết quả thực tế; handoff này mô tả contract đã triển khai.

Tài liệu framework tham khảo: [FastAPI middleware](https://fastapi.tiangolo.com/tutorial/middleware/) và [Pydantic strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/).
