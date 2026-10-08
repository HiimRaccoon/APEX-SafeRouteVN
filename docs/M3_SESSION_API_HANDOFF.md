# Luồng catalog, load và read API — M3-03

Ngày 05/10/2026. Base URL mặc định `http://127.0.0.1:8000`. Khởi chạy và credential local: [M3_API_HANDOFF.md](M3_API_HANDOFF.md). Schema hiện hành: [OpenAPI export](M3_OPENAPI_20261005.json).

App hiện hành `0.7.0` đã bổ sung [notifications/recovery/artifacts M3-07](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md). Luồng load/read dưới đây giữ nguyên; outbox summaries, immutable audit bundle và backup admin riêng không tạo thêm authority vật lý. P1 comparison, autoplay và full frontend E2E còn chờ.

## Luồng cho frontend

1. Gửi bearer token đến `GET /api/scenarios` để lấy catalog S0–S8, counts, versions, seed, source units và projection units. `GET /api/scenarios/S2` trả metadata cùng event ID/type/timestamp; fixture của S2 bắt đầu 8 đơn/2 xe.
2. Tạo request ID mới cho một lần load chủ động. Gửi `POST /api/scenarios/S2/load`, body `{"request_id":"m4-load-s2-001"}`. Chỉ dispatcher được tạo phiên.
3. HTTP 201 trả `data.schema_version=saferoute-m3-loaded-session/1`, `data.session` và `data.execution_view`. Dùng session ID/link do server trả; browser không chọn session/owner/source/build/store.
4. Đọc `GET /api/sessions/{session_id}/state` cho view hiện hành; orders/vehicles/locations là các projection để dựng bảng và bản đồ. Mọi route phiên đều kiểm owner từ token trước khi gọi SDK.

Ví dụ load trong PowerShell sau khi khởi chạy server:

```powershell
$backendAccess = Get-Content -Raw -Encoding UTF8 -LiteralPath 'D:\MLAI4\.local\m3-step7\backend\dev_access.json' | ConvertFrom-Json
$backendToken = ($backendAccess.credentials | Where-Object actor_id -eq 'member3').token
$backendHeaders = @{ Authorization = "Bearer $backendToken" }
$loadedSession = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/scenarios/S0/load' -Headers $backendHeaders -ContentType 'application/json' -Body '{"request_id":"member3-load-s0-001"}'
$sessionReadUrl = 'http://127.0.0.1:8000' + $loadedSession.data.session.links.state
Invoke-RestMethod -Uri $sessionReadUrl -Headers $backendHeaders
```

Envelope HTTP giữ schema `saferoute-m3-http-response/1`; request ID trace mới mỗi lần, status OK/ERROR và diagnostics. Body request ID là khóa retry, tách với trace ID.

## Retry và tạo phiên mới

Cùng actor + request ID + scenario trả lại cùng data load receipt, cùng session ID; envelope trace ID mới. Receipt này giữ view tại lần load đầu. Muốn trạng thái hiện tại, gọi GET state. Request ID mới tạo phiên mới từ cùng fixture; không rewind hoặc xóa phiên cũ.

Đổi scenario dưới request ID đã dùng trả 409 `IDEMPOTENCY_CONFLICT`. Cùng request ID ở hai actor độc lập không dùng chung phiên. Load đang được xử lý trả 409 `REQUEST_IN_PROGRESS`; retry cùng ID sau khi request đầu kết thúc. Session chưa load xong trả 409 `SESSION_NOT_READY`.

Backend lưu session ID/command ID trước bootstrap và dùng lại chúng khi timeout hoặc phản hồi gián đoạn. Claim bootstrap có lease 120 giây; nếu HTTP process crash, retry cùng ID sau khi lease hết hạn. Đổi server installation/store/build không rebind phiên cũ; trả 409 `INSTALLATION_BINDING_CHANGED` và giữ receipt cũ. Không tự đổi request ID sau lỗi không rõ đã commit hay chưa.

## Ý nghĩa từng view

| Route | Data schema | Nội dung |
| --- | --- | --- |
| `/state` | `task02-m2-execution-view/2` | Typed view từ SDK: basis, thời gian, orders coverage, vehicles, pending events, metrics, accepted trajectory |
| `/orders` | `saferoute-m3-orders-view/1` | Order metadata đã pin và status/custody suy từ delivered prefix + onboard IDs của view hiện hành |
| `/vehicles` | `saferoute-m3-vehicles-view/1` | `vehicles` giữ nguyên từ SDK; `vehicle_metadata` chứa type, cost/range/working window cố định |
| `/locations` | `saferoute-m3-locations-view/1` | Depot và delivery point của các order ID đang hiện diện trong view |

Các projection có `basis` và `current_time`. Nhiều GET có thể đọc các revision khác nhau khi mutation được thực hiện; đối chiếu basis trước khi ghép dữ liệu hiển thị. `/state` cung cấp một view thống nhất. Luồng tiến mô phỏng và apply event hiện có được mô tả trong [handoff event/replay M3-06](M3_EVENT_REPLAY_API_HANDOFF.md).

Từ M3-07, view public ở load và `/state` được lưu thành immutable observation với basis/capture time riêng; metadata capture lỗi có thể trả 503 dù SDK đã đọc được state. Notifications API đọc summaries đã persist trước ack, dùng cursor decimal string; không thực hiện lại event hoặc delivery. Artifact API xuất saved initial view/current views, receipt/audit/notifications đầy đủ và ghi rõ historical frames/trajectory còn thiếu. Không dùng hash JSON view công khai thay private SDK head hash.

Status order là DELIVERED nếu có trong delivered prefix, ONBOARD nếu xe đang giữ ID đó, còn lại WAITING. `planned_in_accepted_suffix` và `unserved_reason` là thông tin kế hoạch riêng. Xe UNAVAILABLE vẫn giữ custody; forecast không biến order thành DELIVERED. SDK view hiện chưa cung cấp timestamp từng pickup/delivery trong order projection.

Metadata đơn gấp S2 được đọc từ payload event đã pin; delivery point chỉ xuất hiện khi runtime đưa order ID mới vào view. Nếu runtime có ID không có metadata đã xác minh, endpoint trả 503 `ORDER_METADATA_UNAVAILABLE`.

Projection dùng **m, s, kg, VND**, ISO `+07:00`. `service_time_s` được đổi từ fixture hours; `range_m` từ fixture km. Field `cost_per_km_vnd` ghi rõ đơn giá theo km. Coordinates là WGS84 `[longitude, latitude]`. `graph_node_id` ở static metadata là chuỗi decimal; positions SDK giữ wire gốc. Counter int64 string, rational và `null` giữ nguyên.

`observed_metrics=null` khi chưa có observation. SIMULATED_REPLAY và `real_world_observation=false` luôn giữ trong view. Đây là dữ liệu mô phỏng của suite đã pin; chưa phải observation GPS hay chứng nhận general feasibility/SLA.

## Lỗi và trạng thái hiện tại

401 thiếu/sai token; 403 sai role/owner; 404 phiên không tồn tại; 422 scenario ngoài S0–S8 hoặc body sai. Catalog/fixture khác byte đã pin trả 503 `SOURCE_CHANGED`; startup không xác minh được catalog/receipt trả 503 `CATALOG_NOT_VERIFIED`. Runtime/source/store failure giữ diagnostic thực tế và không chuyển sang mock.

Tại mốc nghiệm thu M3-03, đã kiểm S0–S8 qua HTTP/SDK thật, hai phiên S0, quyền cả năm route và restart process; `/ready` khi đó còn 503 vì worker M3-04 chưa có. Các bước tiếp theo đã bổ sung [optimize/poll/cancel](M3_JOB_API_HANDOFF.md), [accept/audit](M3_ACCEPT_API_HANDOFF.md), [event/replay M3-06](M3_EVENT_REPLAY_API_HANDOFF.md) và [outbox/recovery/artifacts M3-07](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md). Readiness hiện kiểm thêm outbox/recovery/artifact metadata; startup fence/validate phiên, lỗi giữ RECOVERING/BLOCKED và chặn optimize/cancel/accept/replay/reconcile. Readiness và các dependency khác theo [handoff HTTP hiện hành](M3_API_HANDOFF.md); kết quả kiểm thử lịch sử vẫn nằm trong báo cáo nghiệm thu tương ứng.
