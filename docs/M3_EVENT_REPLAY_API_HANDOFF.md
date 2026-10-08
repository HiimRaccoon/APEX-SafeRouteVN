# M3-06 — bàn giao API event và replay theo bước

Tài liệu dành cho Member 4 khi nối pending events và nút replay với backend Member 3. Contract HTTP/token/CORS xem [M3_API_HANDOFF.md](M3_API_HANDOFF.md); optimize/worker xem [M3_JOB_API_HANDOFF.md](M3_JOB_API_HANDOFF.md); activation xem [M3_ACCEPT_API_HANDOFF.md](M3_ACCEPT_API_HANDOFF.md). Kết quả kiểm thử được ghi riêng tại [M3_STEP6_ACCEPTANCE_20261005.md](M3_STEP6_ACCEPTANCE_20261005.md).

App hiện hành `0.7.0` bổ sung [notifications/recovery/artifact export M3-07](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md). Replay/receipt semantics dưới đây giữ nguyên; gate phía server chặn mutation/reconcile khi phiên RECOVERING/BLOCKED. Outbox được persist/dedup trước SDK ack, browser đọc summaries và không thực hiện lại event. P1 comparison, autoplay và full frontend E2E còn chờ.

Replay tiến thời gian mô phỏng dựa trên actions của một kế hoạch đã được accept, qua public SDK M2 và validator nguồn thật. Event chỉ áp dụng tại đúng timestamp nguồn trong phiên đang chạy. Mỗi thay đổi trả receipt bền vững cùng execution view được đọc mới. Toàn bộ luồng vẫn mang nhãn `SIMULATED_REPLAY`, `real_world_observation: false`; vị trí và delivered state là quan sát mô phỏng, không phải GPS hoặc xác nhận giao hàng ngoài đời.

## Endpoint và quyền

Tất cả đường dẫn dưới đây có prefix `/api/sessions/{session_id}`. Dùng opaque session ID do server trả.

| Method và đường dẫn | Quyền | Nội dung |
| --- | --- | --- |
| `GET /events` | Chủ phiên | Pending event metadata đã xác minh, basis/current time và `apply_allowed` |
| `POST /events/{event_id}/apply` | Chủ phiên, role `dispatcher` | Áp dụng event nguồn đúng một lần |
| `GET /replay` | Chủ phiên | Controller theo bước và execution view hiện tại |
| `POST /replay/step` | Chủ phiên, role `dispatcher` | Advance đến target hợp lệ hoặc một bước mặc định |
| `POST /replay/pause` | Chủ phiên, role `dispatcher` | Ghi acknowledgement manual pause |
| `POST /replay/reset` | Chủ phiên, role `dispatcher` | Tạo phiên mới từ cùng verified fixture |
| `GET /replay/history` | Chủ phiên | Tối đa 100 receipt event/replay/control gần nhất |

Các response thành công đều HTTP 200 trong envelope `saferoute-m3-http-response/1`. Actor lấy từ Bearer token, không nhận từ body. Response `/api/` có `Cache-Control: no-store`; dùng state hiện tại để cập nhật bản đồ. Token actor khác không đọc/điều khiển phiên này dù biết đúng ID.

## Luồng chạy một kịch bản có event

1. Load phiên, optimize từ basis hiện tại, chờ witness rồi accept.
2. Đọc `/events` để biết timestamp barrier. Step đến đúng barrier; server không cho bước qua event còn pending.
3. Khi `apply_allowed: true`, POST apply bằng event ID server trả và expected revision mới nhất.
4. Apply commit event và suspend forecast cũ: `active_job_id`/`accepted_trajectory` trở thành `null`. Physical prefix đã thực hiện được giữ nguyên.
5. Đọc state sau event, optimize lại từ full basis mới, chờ witness rồi accept kế hoạch mới. Apply không tự tạo compute job hoặc tự accept.
6. Tiếp tục step theo actions đã accept. Đọc `/state` và `/orders` để phân biệt đã giao trong mô phỏng với planned suffix.

Trong bộ S2/S3/S4 hiện tại, event nguồn lần lượt là `S2-E1`, `S3-E1`, `S4-E1`, cùng tại `2026-09-27T21:15:00+07:00`. Frontend vẫn đọc metadata server thay vì hard-code ID/timestamp. Dữ liệu nguồn xác định event, client không cấp payload đơn/xe/mưa tùy ý.

## Pending events và controller

`GET /events` trả `data.schema_version: "saferoute-m3-pending-events/1"`, full `basis`, `current_time`, nhãn mô phỏng và `events`:

```json
{
  "event_id": "S2-E1",
  "event_type": "URGENT_ORDER",
  "timestamp": "2026-09-27T21:15:00+07:00",
  "apply_allowed": false
}
```

Server đối chiếu pending IDs từ runtime với verified fixture, sắp theo timestamp rồi event ID. `apply_allowed` chỉ đúng khi current time **khớp chuỗi timestamp nguồn** và đã có observed replay frame. Event đã apply biến mất khỏi pending list. Metadata này giúp bật nút; server vẫn kiểm lại revision và trạng thái khi nhận POST.

`GET /replay` có `data.schema_version: "saferoute-m3-replay-controller/1"`, `mode: "STEP"`, `paused: true`, `step_seconds` và `execution_view`. Hiện chỉ có điều khiển theo bước thủ công. `paused: true` thể hiện mode này, không phải trạng thái lifecycle compute job. Dùng endpoint cancel job riêng khi cần hủy compute.

## POST step

```http
POST /api/sessions/{session_id}/replay/step
Authorization: Bearer <token server cấp>
Content-Type: application/json
```

Body có target rõ ràng:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000006",
  "expected_revision": {
    "head_version": "0",
    "generation": "1"
  },
  "target_time": "2026-09-27T21:15:00+07:00"
}
```

UUID/revision trong ví dụ là placeholder. `request_id` là identifier dài **1–200 ký tự**, khớp `^[A-Za-z0-9][A-Za-z0-9_.:/-]*$`; khuyến nghị tạo UUID mới cho hành động mới. Lấy `head_version`/`generation` từ basis mới nhất dưới dạng canonical decimal string. `expected_revision` **bắt buộc**. Target nếu có phải là ISO datetime hợp lệ với timezone `+07:00` và tối đa **6 chữ số phần giây**; không dùng `Z`, timezone khác hoặc độ chính xác nanosecond.

Có thể bỏ `target_time` hoặc gửi `null`. Server tính `current_time + step_seconds`, mặc định **60 giây**, rồi clamp tới event pending gần nhất. M3 cấu hình `SAFEROUTE_REPLAY_STEP_SECONDS` bằng số nguyên trong `[1,3600]`; frontend không gửi thời lượng bước tùy ý. Step duration này độc lập với budget compute.

Quy tắc thời gian:

- Chưa có active accepted plan: 409 `ACCEPTED_PLAN_REQUIRED`.
- Target nhỏ hơn current time: 409 `TIME_REWIND`. Reset tạo phiên mới khi cần chạy lại.
- Target vượt timestamp event pending: 409 `EVENT_TRANSITION_REQUIRED`.
- Đang đúng hoặc quá barrier còn pending mà dùng bước mặc định: 409 `EVENT_TRANSITION_REQUIRED`; apply event trước khi đi tiếp.
- Target bằng current time: SDK có thể trả `NOOP`, giữ nguyên basis. Target tới event boundary được server chuẩn hóa về **đúng chuỗi timestamp nguồn**; target khác được chuẩn hóa về ISO `+07:00` với độ chính xác cần thiết.

Server lưu target **đã tính/clamp/chuẩn hóa** và full input basis trước khi gọi SDK. Khi retry một bước mặc định sau timeout hoặc restart, server dùng target cũ đã lưu, không tính thêm một bước từ current time mới.

## POST apply event

```http
POST /api/sessions/{session_id}/events/{event_id}/apply
```

```json
{
  "request_id": "00000000-0000-4000-8000-000000000007",
  "expected_revision": {
    "head_version": "1",
    "generation": "1"
  }
}
```

Event ID phải có trong verified scenario và còn pending. Request chỉ nhận `request_id` và revision; dữ liệu event lấy từ nguồn server đã xác minh. Server yêu cầu current time đúng timestamp event và một observed replay frame có sẵn. SDK xác minh candidate/proof từ nguồn và CAS full basis khi commit.

`APPLIED` tăng `head_version` một, giữ nguyên `generation`, suspend plan cũ và loại event khỏi pending set. Apply không tăng thời gian hoặc viết lại delivered prefix/observed metrics đã có. M3 kiểm binding receipt, gồm event ID/hash và basis hậu commit. Với rain WHAT-IF, overlay hash mới được phép thay đổi; base context/source/build binding vẫn giữ nguyên.

## Receipt và execution view

Step/apply/pause trả `data.schema_version: "saferoute-m3-replay-view/1"` với `receipt` và `execution_view`. Receipt có schema `saferoute-m3-replay-receipt/1`:

| Trường | Nội dung |
| --- | --- |
| `mutation_id`, `session_id` | ID opaque hành động và phiên nguồn |
| `operation` | `advance`, `apply_event`, `pause` hoặc `reset` |
| `status` | `ADVANCED`, `NOOP`, `APPLIED`, `PAUSED` hoặc `RESET` |
| `source` | `M2_PUBLIC_SDK`, `M3_MANUAL_CONTROL` hoặc `M3_NEW_SESSION` |
| `input_basis`, `basis` | Basis trước hành động và basis lịch sử của kết quả |
| `recorded_at` | Timestamp server lưu receipt có timezone |
| `links.state`, `links.history` | State đích và history của phiên nguồn |
| `target_time` | Target đã lưu của `advance` |
| `event_id`, `event_sha256`, `event_type` | Binding event của `apply_event` |

`ADVANCED` tăng head version một, giữ activation generation; `NOOP` giữ nguyên basis. State sau SDK replay có observed metrics/physical frame thực tế trong mô phỏng. Accepted trajectory vẫn là forecast; không dùng nó thay observed position.

Receipt là **lịch sử**, `execution_view` được resolve **mới** sau khi lưu receipt. Retry sau các bước khác giữ receipt cũ nhưng trả current view mới; hai basis có thể khác nhau. Frontend giữ receipt để audit và dùng execution view cho bản đồ, không áp historical basis/target cũ lên state hiện tại.

## Pause và reset

Cả hai control nhận body chỉ có `request_id`, theo identifier rules nêu trên:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000008"
}
```

Pause ghi receipt `PAUSED`, `source: "M3_MANUAL_CONTROL"`, `mode: "STEP"`, `paused: true`. Nó không gọi SDK mutation, không thay head/generation hoặc tự đổi thời gian; response đọc execution view hiện tại. Hiện chưa có automatic playback/autoplay.

Reset gọi load **cùng verified scenario** bằng load request key do server tạo và lưu bền vững. Nó tạo session mới thuộc cùng actor, giữ nguyên session nguồn và lịch sử đã chạy. Retry reset cùng ID trả đúng lineage/session mới đã tạo; không tạo phiên thứ ba. Reset không rewind hoặc sửa head của phiên nguồn.

Reset trả `data.schema_version: "saferoute-m3-replay-reset/1"` với:

- `source_session_id`: phiên nguồn đã reset.
- `session`: metadata public của phiên mới.
- `receipt`: receipt lịch sử `RESET`, `source: "M3_NEW_SESSION"`, `new_session_id`, `new_session`, input basis nguồn và basis ban đầu của session mới.
- `execution_view`: state **hiện tại của session mới** được resolve mới; trên retry muộn có thể khác initial basis đã lưu trong receipt.

Frontend chuyển active session theo `session.session_id` trả về và vẫn cho phép đọc history session cũ. Link `receipt.links.state` trỏ tới session mới; link history trỏ tới session nguồn để giữ parent/new-session lineage.

## Ý nghĩa S2/S3/S4

- **S2 URGENT_ORDER:** server dùng payload đã pin để thêm O009 đúng một lần. Từ 8 đơn ban đầu thành 9; prefix đã giao và physical vehicle/custody frame giữ nguyên tại apply. Đơn mới chỉ được xem là delivered sau accepted replay thật trong mô phỏng.
- **S3 VEHICLE_UNAVAILABLE:** V1 chuyển `UNAVAILABLE`, activity thành `IMMOBILIZED`; SDK suspend commitment đang hoạt động nếu có. Vị trí, tải, onboard order IDs, range và custody giữ nguyên. Replan phải tôn trọng chủ hàng hiện có, không chuyển đơn onboard sang xe khác để làm coverage đẹp hơn. Hiển thị diagnostics/unserved khi hàng của xe unavailable chưa thể được phục vụ.
- **S4 LOCAL_RAIN_WHAT_IF:** đây là **SYNTHETIC WHAT-IF** từ fixture, không phải dữ liệu mưa đang xảy ra. Receipt giữ `event_type: "LOCAL_RAIN_WHAT_IF"`; overlay rain có hash riêng, base context giữ nguyên. Replay SDK xử lý ranh giới start/end, gồm microsecond và temporal segments. Không giả định route nhất định có WET exposure dương, hoặc `overlay_sha256` tự thành `null` khi rain hết hiệu lực: hash overlay có thể còn được giữ để xác định scope/provenance. Exposure là relative proxy theo contract nguồn.

## Retry, history và khôi phục

Body `request_id` là khóa hành động. Envelope request ID và `X-Request-ID` là ID audit mới cho mỗi HTTP request. Replay idempotency gắn actor + session + operation + `request_id`; fingerprint gồm body và event ID nếu có. Retry cùng nội dung trả cùng receipt, không tăng counter hay thêm history. Dùng lại ID với body/event khác trả 409 `IDEMPOTENCY_CONFLICT`.

M3 lưu installation, full basis, payload đã xác định và runtime command ID trước mutation. Sau SDK commit, receipt và history được lưu trong **một transaction metadata**, rồi mới resolve current view. Authority SDK và metadata M3 là hai store riêng; recovery dùng command ID cũ để nối khoảng trống commit, không giả định có transaction chung hai store.

Nếu resolve mới thất bại sau khi receipt/history đã lưu, client có thể nhận 503 dù bước đã commit. Retry cùng body/ID. Sau crash, worker reconcile đúng row/payload/command ID đã lưu; không lấy basis mới, tính lại target mặc định hoặc tạo lại load key reset. Timeout công khai cho SDK replay/apply mặc định **120 giây**, lease request **240 giây**; đây là giới hạn điều phối/retry, không phải SLA hoặc tốc độ phát mô phỏng.

M3-07 recovery chạy sau khi worker giữ singleton, fence orphan jobs và validate từng phiên trước khi cho phép reconcile/dispatch. Source/store/journal/outbox hoặc evidence lỗi giữ BLOCKED; không xóa authority để tiếp tục. SDK recover không có durable command receipt, nên recovery audit ghi từng attempt thực tế. Các execution views sau receipt được lưu thành observations với basis/capture time riêng, không đổi receipt lịch sử.

`GET /replay/history` trả `data.schema_version: "saferoute-m3-replay-history/1"`, `session_id` và `history`: tối đa **100 receipt gần nhất**, mới nhất trước. History có cả advance/NOOP, apply, pause và reset; reset receipt nằm ở phiên nguồn. API chỉ đọc, không chạy replay. Receipt public không lộ token/auth metadata, runtime command ID hoặc request claim nội bộ.

Artifact M3-07 xuất toàn bộ replay/audit records đã lưu, safe actor/request/command lineage và hash của public frames/trajectories. Exact historical frames hoặc accepted trajectories chưa capture được công bố trong history_gaps, không dựng lại từ private Store hoặc current state. Notifications chứa journal hash event_id, khác source pending ID; event summary không phải bằng chứng frontend tự áp dụng delivery.

## Lỗi thường gặp

| HTTP/code | Cách xử lý frontend |
| --- | --- |
| 401/403 | Kiểm token, chủ phiên và role dispatcher |
| 404 `EVENT_NOT_FOUND` | Dùng event ID từ verified `/events` của đúng phiên |
| 409 `STALE_HEAD` | Đọc current view mới; hành động mới dùng revision/request ID mới |
| 409 `TIME_REWIND` | Chọn target tiến tới hoặc reset sang session mới |
| 409 `EVENT_TRANSITION_REQUIRED` | Step đến barrier rồi apply pending event trước khi tiến tiếp |
| 409 `EVENT_NOT_DUE` | Event chưa đúng thời điểm; replay tới timestamp nguồn |
| 409 `EVENT_ALREADY_APPLIED` | Đọc pending list/current view; retry hành động cũ bằng request ID/body gốc khi cần receipt |
| 409 `ACCEPTED_REPLAY_REQUIRED` | Cần observed replay frame từ plan đã accept trước event |
| 409 `ACCEPTED_PLAN_REQUIRED` | Optimize/accept plan hợp lệ; sau event cần replan/accept lại |
| 409 `REQUEST_IN_PROGRESS` | Chờ rồi retry cùng request ID/body |
| 409 `IDEMPOTENCY_CONFLICT` | Giữ body gốc cho retry; hành động mới có request ID mới |
| 422 | Kiểm revision, timestamp ISO `+07:00`, JSON/extra fields |
| 503 timeout/metadata/source/binding | Chưa kết luận mutation không xảy ra; giữ ID/body, kiểm readiness rồi retry |

Source/runtime/build frozen phải giữ đúng pin. HTTP backend chỉ gọi public SDK; không sửa authority SQLite, planner internals, graph/context nguồn hoặc contract để ép replay/event qua lỗi. Package/source/binding không xác minh được phải được khôi phục đúng bản bàn giao trước khi xử lý tiếp.

Chạy HTTP/worker theo [M3_JOB_API_HANDOFF.md](M3_JOB_API_HANDOFF.md#chạy-http-server-và-compute-worker). Outbox/recovery/artifacts đã triển khai ở [M3-07](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md); P1 comparison, automatic playback và full frontend E2E còn chờ. Tài liệu này mô tả contract và giữ báo cáo nghiệm thu/native riêng của từng bước.
