# Bàn giao API bổ sung Member 3 — 06/10/2026

Backend `0.8.0` bổ sung comparison, autoplay, narrative và mock đọc riêng; SDK Step 7 giữ build `80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41`. Tài liệu mô tả contract triển khai. Kết quả native của bản hoàn tất sẽ nằm trong báo cáo nghiệm thu riêng; chưa suy ra PASS từ ví dụ này. Frontend/browser E2E chờ mã nguồn M4.

Các API native dùng envelope `saferoute-m3-http-response/1`: `status`, `data`, `diagnostics`, request ID do server cấp. GET cần owner đã xác thực; mutation cần owner có role dispatcher. Giữ [HTTP gốc](M3_API_HANDOFF.md), [job](M3_JOB_API_HANDOFF.md), [accept](M3_ACCEPT_API_HANDOFF.md), [event/replay](M3_EVENT_REPLAY_API_HANDOFF.md) và [runbook](M3_OPERATIONS_RUNBOOK.md).

Tại root team, Terminal A chạy installation mới đã cài/xác minh từ gói hoàn tất. Thay đường dẫn mẫu bằng root private thực tế; không dùng installation mặc định của bước cũ:

```powershell
$LocalRoot = 'D:\MLAI4\.local\<installation-m3-complete>'
$BasePython = 'C:\Python312\python.exe' # CPython đã được môi trường phê duyệt
& $BasePython backend/scripts/run_backend.py --local-root $LocalRoot --offline --port 8000
```

Launcher đợi `/ready`, chạy API và một worker, Ctrl+C dừng cả hai; log/receipt nằm trong installation private. Offline là Python socket policy đã mô tả trong runbook, không chứng nhận OS air-gap. Startup/solve có thể chậm theo lịch sử store; không có SLA realtime.

Terminal B nhận token native từ nguồn private của installation rồi đặt `SAFEROUTE_MEMBER3_TOKEN` trong môi trường. Không in hoặc commit token. Ví dụ nạp một phiên mới:

```powershell
$Base = 'http://127.0.0.1:8000'
$Headers = @{ Authorization = "Bearer $env:SAFEROUTE_MEMBER3_TOKEN" }
$Loaded = Invoke-RestMethod "$Base/api/scenarios/S0/load" -Method Post -Headers $Headers -ContentType 'application/json' -Body '{"request_id":"m4-load-S0-01"}'
$Sid = $Loaded.data.session.session_id
$View = $Loaded.data.execution_view
$Revision = @{ head_version = $View.basis.head_version; generation = $View.basis.generation }
```

`head_version`/`generation` là decimal string int64; không ép sang số JavaScript. Browser không gửi path, source/build hash, budget, routes hoặc physical state. Field lạ/duplicate JSON keys/nonfinite bị từ chối.

| API native | Body / kết quả |
| --- | --- |
| `POST /api/sessions/{sid}/profiles/compare` | `request_id`, optional `expected_revision`, optional đúng ba `job_ids`; trả 202 và `comparison_id` |
| `GET /api/sessions/{sid}/profiles/comparisons/{cid}` | Aggregate, typed child views, `outcome` |
| `GET /api/sessions/{sid}/profiles/comparisons/{cid}/narrative` | Trade-off từ cache certified; chỉ COMPARABLE có bảng metric, không gọi SDK mới |
| `POST /api/sessions/{sid}/profiles/comparisons/{cid}/cancel` | `request_id`; receipt hủy bền vững |
| `POST /api/sessions/{sid}/replay/start` | `request_id`, bắt buộc `expected_revision`, `speed` 1/2/4/8 (mặc định 1) |
| `POST /api/sessions/{sid}/replay/speed` | `request_id`, `speed` 1/2/4/8; không resume phiên đang pause |
| `POST /api/sessions/{sid}/replay/playback/pause` | `request_id`; chặn reservation tick mới |
| `GET /api/sessions/{sid}/replay/playback` | Controller cùng current `execution_view` |
| `GET /api/sessions/{sid}/replay/playback/history` | 100 control/stop/tick audit gần nhất |
| `GET /api/sessions/{sid}/narrative` | Narrative tiếng Việt từ current public execution facts |

Tạo ba forecast từ cùng full basis do server lưu; worker dùng budget server và ba job riêng:

```powershell
$Body = @{ request_id = 'm4-compare-new-01'; expected_revision = $Revision } | ConvertTo-Json -Depth 4
$Created = (Invoke-RestMethod "$Base/api/sessions/$Sid/profiles/compare" -Method Post -Headers $Headers -ContentType 'application/json' -Body $Body).data
$CompareUrl = "$Base/api/sessions/$Sid/profiles/comparisons/$($Created.comparison_id)"
do {
  Start-Sleep -Seconds 2
  $Group = (Invoke-RestMethod $CompareUrl -Headers $Headers).data
} until (@('COMPLETED','CANCELLED','FAILED') -contains $Group.status)
```

Aggregate có `QUEUED → RUNNING → COMPLETED`, hoặc `CANCEL_REQUESTED → CANCELLED`, hoặc `FAILED`. Child `view=null` nghĩa là chưa quan sát được, không phải job lỗi. Khi đủ certified witnesses, `outcome.comparison.status` giữ nguyên verdict SDK `COMPARABLE`/`NON_COMPARABLE`. Chỉ COMPARABLE mới cho phép trình bày trade-off trên cùng authenticated basis/domain; không tự xếp hạng hoặc tự accept profile.

`COMPLETED` với `outcome.comparison=null`, reason `NO_CERTIFIED_WITNESS_FOR_EVERY_PROFILE` là kết quả vận hành hợp lệ. Giữ từng job SEARCH_LIMIT/TIME_LIMIT/no-witness và `coverage_evaluated=false`; không suy ra infeasible hoặc tạo verdict NON_COMPARABLE giả.

So sánh ba job đã có không solve lại; IDs phải cùng phiên và đúng một FASTEST/BALANCED/SAFER:

```json
{"request_id":"m4-compare-existing-01","job_ids":["job-fastest","job-balanced","job-safer"]}
```

Thay IDs mẫu bằng handles thực đã đọc. Có thể so sánh historical jobs khác basis; SDK sẽ báo NON_COMPARABLE. Hủy NEW_BATCH fence các child chưa hoàn tất; child completed giữ immutable. Hủy EXISTING_JOBS chỉ hủy aggregate, không hủy/recompute input jobs. Request mới dùng latest revision; accept vẫn qua route `/api/sessions/{session_id}/jobs/{job_id}/accept` và certified witness/CAS riêng.

Mọi mutation có `request_id`: retry giữ cùng body/key để nhận receipt cũ, kể cả sau head thay đổi; key cũ với body khác trả 409. So sánh hoặc compute không đổi physical head. Revision browser chỉ kiểm xung đột; server/SDK dùng full basis đã xác thực. 401/403 là auth/owner; 422 là shape; 409 là conflict; 503 kèm diagnostic là runtime/store/source chưa sẵn sàng. Chỉ retry RUNTIME_BUSY/RUNTIME_TIMEOUT có giới hạn với key cũ; không bỏ qua corruption hoặc binding failure.

Sau khi accept, đọc state mới rồi start autoplay bằng revision mới:

```powershell
$View = (Invoke-RestMethod "$Base/api/sessions/$Sid/state" -Headers $Headers).data
$Body = @{ request_id = 'm4-play-start-01'; speed = 1; expected_revision = @{ head_version = $View.basis.head_version; generation = $View.basis.generation } } | ConvertTo-Json -Depth 4
Invoke-RestMethod "$Base/api/sessions/$Sid/replay/start" -Method Post -Headers $Headers -ContentType 'application/json' -Body $Body
Invoke-RestMethod "$Base/api/sessions/$Sid/replay/speed" -Method Post -Headers $Headers -ContentType 'application/json' -Body '{"request_id":"m4-speed-01","speed":4}'
Invoke-RestMethod "$Base/api/sessions/$Sid/replay/playback/pause" -Method Post -Headers $Headers -ContentType 'application/json' -Body '{"request_id":"m4-pause-01"}'
```

Autoplay là `DISCRETE_BEST_EFFORT`: mặc định server tăng **60 giây mô phỏng mỗi tick**. Speed 1 yêu cầu một tick mỗi giây đồng hồ; 2/4/8 tăng cadence yêu cầu. Nhãn 1x không có nghĩa thời gian mô phỏng bằng thời gian thực. SDK/queue có thể làm tick chậm; không catch-up burst, không tự nội suy GPS. Đọc `step_seconds` thực tế nếu operator đã cấu hình khác.

Pause chặn tick mới; tick đã reserve có thể settle một lần. `in_flight=true` nghĩa là còn command cần đối soát; chỉ `fully_paused=true` mới có thể coi controller đã dừng hẳn. Sau worker restart controller pause với `PAUSED_WORKER_RESTART`; người dùng phải start lại bằng request mới/latest revision. Reset tạo phiên mới; không rewind phiên cũ.

Autoplay dừng chính xác tại `EVENT_BARRIER`, để event còn pending; không tự apply/replan/accept. M4 đọc `/events`, apply đúng event/barrier rồi optimize/accept và chủ động resume. Dừng `PLAN_COMPLETE` tính cả final return; thay head/plan/context có thể dừng `STALE_HEAD`. Khi không có accepted plan, start bị từ chối.

Narrative giữ ba scope `OBSERVED_PREFIX_ONLY`, `PLANNED_SUFFIX_FORECAST`, `PROJECTED_WHOLE_FORECAST`. `available=false`, `metrics=null` nghĩa chưa có số liệu; không đổi thành 0. Khoảng cách m, tiền VND, forecast s, observed/action us. Canonical string microseconds được giữ nguyên; dùng BigInt/decimal xử lý exact counters, không ép string dài sang Number. Exposure luôn PROXY, không phải xác suất tai nạn. Narrative không thêm delivery, chọn profile hoặc tuyên bố tối ưu.

```powershell
curl.exe --silent --show-error -H "Authorization: Bearer $env:SAFEROUTE_MEMBER3_TOKEN" "$Base/api/sessions/$Sid/narrative"
```

Export mới qua API artifacts giữ manifest/bundle `/2`, **12 file** gồm `decision_narrative.json` từ view đã capture ổn định. Artifact `/1` cũ có 11 file vẫn đọc/retry nguyên byte; không rewrite lịch sử. Kiểm SHA-256/bytes và version của từng manifest, tránh hard-code luôn 11 hoặc luôn 12. Narrative và bundle không tự chứng nhận E2E/native/optimality.

`GET /api/sessions/{sid}/profiles/comparisons/{comparison_id}/narrative` giải thích bảng trade-off đã lưu, không gọi SDK mới. Chỉ SDK `COMPARABLE` có bảng ba profile với metric/units và coverage thật; `NON_COMPARABLE`, no-witness hoặc pending không có bảng so sánh hay đề xuất. Nhãn `HISTORICAL_FORECAST` và full basis/domain giữ riêng với observed hiện hành. `decision_narrative.json` trong export cũng lưu phần giải thích historical comparisons cùng lịch sử batch/cancel và playback control/tick.

Mock là process riêng đọc pinned examples, không có authority hay real job. Dùng token mock riêng trong file private ngoài project; đặt đường dẫn file trong `SAFEROUTE_MOCK_TOKEN_FILE`, rồi chạy ở terminal riêng:

```powershell
$BackendPython = Join-Path $LocalRoot 'backend-venv\Scripts\python.exe'
& $BackendPython -m backend.mock.serve --enable-read-only-demo --token-file $env:SAFEROUTE_MOCK_TOKEN_FILE --port 8001
```

GET authenticated: `/api/mock/capabilities`, `/api/mock/scenarios`, `/api/mock/scenarios/{S2|S3|S4}/execution-view`, `/source`. Mỗi response có `X-SafeRoute-Mode: MOCK_DEMO`; `/source` giữ exact bytes và `X-Fixture-SHA256`. Hiển thị nhãn demo trong UI. Mutation trả 405/MOCK_READ_ONLY; GET body/query không được nhận. Historical fixture execution build `41c792...` giữ nguyên, tách source package `80694f51...`. Mock không thay native khi lỗi. Chi tiết ở [backend/mock/README](../backend/mock/README.md).

M4 giữ một poll đang chạy, dùng backoff có giới hạn và structured diagnostics; tránh mở nhiều panel cùng poll authority. Lấy main execution view theo nhịp chung; đọc projection orders/vehicles/locations lúc load hoặc head thay đổi. Tách observed/forecast/null, preserve exact strings/rationals, và dùng canonical consumer cho trajectory geometry/reload/return. Corpus/reference PASS không thay browser E2E; lưu source/UI hash, session/build, case result và screenshot/frame theo [checklist](M3_M4_E2E_CHECKLIST.md).
