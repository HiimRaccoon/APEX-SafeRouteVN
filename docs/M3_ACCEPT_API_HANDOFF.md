# M3-05 — bàn giao API chấp nhận kế hoạch

Tài liệu này hướng dẫn Member 4 nối nút chấp nhận kế hoạch với backend Member 3. Contract HTTP/token/CORS xem [M3_API_HANDOFF.md](M3_API_HANDOFF.md); load và đọc state xem [M3_SESSION_API_HANDOFF.md](M3_SESSION_API_HANDOFF.md); optimize/poll/cancel và worker xem [M3_JOB_API_HANDOFF.md](M3_JOB_API_HANDOFF.md). Kết quả kiểm thử được ghi riêng trong [M3_STEP5_ACCEPTANCE_20261005.md](M3_STEP5_ACCEPTANCE_20261005.md).

Accept kích hoạt một forecast đã được chứng nhận từ **đúng basis hiện tại**, gắn nó thành active job và tăng generation đúng một lần. Nó giữ nguyên physical head/head version, thời gian mô phỏng, vị trí và tải xe, delivered prefix, observed metrics. Giao diện có thể hiển thị tuyến dự kiến sau accept; không đổi đơn thành “đã giao” hoặc xe thành “đang di chuyển” chỉ vì đã kích hoạt plan.

Tài liệu này mô tả accept và lịch sử receipt của M3-05. API apply event/advance, manual pause và reset tạo phiên mới đã được bổ sung ở M3-06; xem [handoff event/replay](M3_EVENT_REPLAY_API_HANDOFF.md). Phần so sánh P1/các profile vẫn được hoãn sang công việc tiếp theo; không suy ra phần đó đã hoàn thành từ API accept.

App hiện hành `0.7.0` bổ sung [notifications/recovery/artifact export M3-07](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md). Accept và worker reconcile phải qua recovery gate; phiên RECOVERING/BLOCKED trả 503. Audit export giữ toàn bộ receipt đã lưu, safe actor/request/command lineage và public observations; không thay đổi CAS/activation hoặc fabricate trajectory lịch sử. P1, autoplay và full frontend E2E vẫn còn chờ.

## Luồng frontend

1. Poll job và kiểm `job_status === "COMPLETED"`, `plan_available === true`, `validation.valid === true`.
2. Đọc `/api/sessions/{session_id}/state` mới nhất. Kiểm job input basis còn khớp đầy đủ với state basis; nếu khác, yêu cầu optimize lại từ state mới.
3. Tạo UUID cho hành động accept, lưu body chứa UUID và `head_version`/`generation` hiện tại dưới dạng chuỗi. Gửi POST accept với Bearer token của chủ phiên có role `dispatcher`.
4. Khi thành công, lưu receipt vào lịch sử và dùng `execution_view` trả về để hiển thị **state hiện tại**. Giữ forecast và delivered state riêng.
5. Nếu timeout/mất kết nối/503, gửi lại **cùng body và UUID**. Không tăng revision trong body cũ để thử lại; không tạo hành động mới chỉ vì chưa nhận được HTTP response.

Không dùng `business_status === "FEASIBLE"` làm điều kiện duy nhất bật nút accept. `PARTIAL` có witness vẫn có thể được chấp nhận. Internal `RETURN_ONLY` đã được validator chứng nhận có `plan_available: true` nhưng public business status là `UNSUPPORTED`; nếu người dùng chọn kế hoạch quay về, server vẫn cho phép accept. Ngược lại, lifecycle `COMPLETED` với `SEARCH_LIMIT`, `TIME_LIMIT` hoặc các kết quả không có witness không đủ điều kiện.

## Endpoint và quyền

| Endpoint | Quyền | Response thành công |
| --- | --- | --- |
| `POST /api/sessions/{session_id}/jobs/{job_id}/accept` | Chủ phiên, role `dispatcher` | HTTP 200, `saferoute-m3-acceptance-view/1` |
| `GET /api/sessions/{session_id}/acceptances` | Chủ phiên | HTTP 200, `saferoute-m3-acceptance-audit/1` |

Actor lấy từ token server, không lấy từ body. Job phải thuộc session đang hỏi. Token actor khác nhận 403, kể cả khi biết đúng ID. Response `/api/` có `Cache-Control: no-store`; đọc lại state thay vì dùng HTTP cache để xác định kế hoạch đang hoạt động.

Body accept chỉ nhận `request_id` và `expected_revision`. Client không gửi actor, full basis, runtime command ID, plan/witness tự tạo, timestamp audit hoặc đường dẫn store/source. Trường thừa bị từ chối.

## POST accept

```http
POST /api/sessions/{session_id}/jobs/{job_id}/accept
Authorization: Bearer <token server cấp>
Content-Type: application/json
```

```json
{
  "request_id": "00000000-0000-4000-8000-000000000005",
  "expected_revision": {
    "head_version": "0",
    "generation": "0"
  }
}
```

UUID và revision trong ví dụ là placeholder. Tạo UUID mới bằng `crypto.randomUUID()` cho hành động mới, lấy nguyên revision từ response `/state`; không hard-code `0`. `expected_revision` **bắt buộc**, thiếu nhận 422. Hai counter phải là canonical decimal string không âm, trong signed int64; không chuyển thành JavaScript `Number`.

Server đối chiếu hai counter client gửi với revision hiện tại, tự lấy full basis rồi kiểm job input basis khớp **toàn bộ** binding session/root/head/source/context/overlay/build/revision. Khi thấy witness hợp lệ, M3 lưu request và basis trước khi gọi SDK. SDK M2 kiểm lại witness trên nguồn thật, build/source binding và CAS của authority tại thời điểm commit. Public `validation.valid: true` đã đọc trước đó không cho phép client bỏ qua bước kiểm lại này.

Response nằm trong envelope chung `saferoute-m3-http-response/1`, `status: "OK"`, `diagnostics: []`. `data` có ba trường:

| Trường | Nội dung |
| --- | --- |
| `schema_version` | `saferoute-m3-acceptance-view/1` |
| `receipt` | Receipt lịch sử đã lưu bền vững |
| `execution_view` | Public `task02-m2-execution-view/2` được resolve mới sau khi lưu receipt |

Receipt có schema `saferoute-m3-plan-acceptance/1` và các trường:

| Trường | Ý nghĩa |
| --- | --- |
| `acceptance_id` | ID opaque do server tạo cho hành động này |
| `session_id`, `job_id` | Phiên và forecast được kích hoạt |
| `status` | `ACCEPTED` |
| `input_basis` | Full basis trước activation, giữ nguyên theo request gốc |
| `basis` | Full basis ngay sau activation: chỉ `generation` tăng một |
| `recorded_at` | Thời gian server lưu audit có timezone; không phải thời gian giao hàng |
| `links.state`, `links.job` | Link đọc state hiện tại và public job view |

Sau accept mới thành công:

- `execution_view.active_job_id` là job vừa accept.
- `execution_view.basis.generation` tăng một; các basis field khác giữ nguyên.
- `accepted_trajectory.forecast` là `true`; route/actions và `planned_served_suffix` là kế hoạch dự kiến.
- Physical time/vehicles/delivered/observed metrics giữ nguyên. API orders đánh dấu `planned_in_accepted_suffix`, không tạo `DELIVERED` vì accept.

Receipt là **lịch sử**, execution view là **hiện tại**. Trong lần trả response đầu, hai basis có thể trùng nhau. Khi retry sau một hoạt động hợp lệ khác, `receipt.basis` vẫn giữ generation của lần accept gốc còn `execution_view.basis` phản ánh state mới. Không kiểm chúng bắt buộc bằng nhau trên frontend, không thay state hiện tại bằng basis hoặc trajectory cũ trong receipt. HTTP audit `X-Request-ID`/envelope request ID cũng mới cho từng request và khác khóa `request_id` trong body.

## Retry, audit và lỗi sau commit

Khóa idempotency accept gắn với actor + session + body request ID; fingerprint bao gồm job và toàn bộ body. Retry cùng nội dung trả đúng receipt đã lưu, không tạo acceptance/audit khác và không tăng generation lần hai. Dùng lại ID với job/revision khác trả 409 `IDEMPOTENCY_CONFLICT`.

Sau khi SDK commit activation, M3 lưu receipt và audit **trong cùng transaction metadata**, rồi mới resolve execution view cho HTTP response. Authority M2 và metadata M3 là hai store riêng; khoảng trống giữa runtime commit và metadata commit được nối lại bằng runtime command ID đã lưu, không phải một transaction chung hai store.

Nếu resolve mới thất bại sau khi receipt/audit đã lưu, HTTP có thể trả 503 dù activation đã commit. Giao diện giữ body gốc, retry cùng ID; server lấy lại receipt rồi resolve state hiện tại. Nếu process chết trước khi M3 lưu receipt, worker hoặc HTTP retry dùng command ID/basis cũ để lấy lại receipt runtime, hoàn tất audit một lần và không kích hoạt lại.

| HTTP/code | Cách xử lý |
| --- | --- |
| 401/403 | Kiểm token, ownership và role dispatcher |
| 404 `JOB_NOT_FOUND` | Kiểm job/session ID; job không thuộc phiên này |
| 409 `STALE_HEAD` | State hoặc full job input basis đã thay đổi; đọc lại state và optimize mới |
| 409 `WITNESS_REQUIRED` | Job queued/running/failed hoặc completed không có witness; không tự suy ra vô nghiệm |
| 409 `WITNESS_INVALID` | SDK không chứng nhận lại được witness; giữ diagnostics, không kích hoạt plan bằng frontend |
| 409 `IDEMPOTENCY_CONFLICT` | Nội dung khác dùng lại ID; retry body gốc hoặc tạo ID mới cho hành động mới |
| 409 `REQUEST_IN_PROGRESS` | Request đang được xử lý; chờ rồi retry cùng ID/body |
| 422 | Thiếu revision, counter/JSON/extra field không đúng contract |
| 503 `RUNTIME_TIMEOUT`/metadata/runtime | Chưa kết luận activation không xảy ra; retry cùng ID/body sau khoảng nghỉ |

Lần accept đầu tăng generation, nên job cũ giữ `input_basis` cũ. Một **request mới** để accept lại cùng job thường bị 409 `STALE_HEAD`, kể cả client gửi revision hiện tại. Để chấp nhận kế hoạch tiếp theo, đọc state mới, optimize bằng request ID mới từ basis mới, chờ witness mới rồi accept với revision mới. Để lấy lại receipt của hành động cũ, retry đúng ID/body cũ.

## GET lịch sử accept

`GET /api/sessions/{session_id}/acceptances` trả envelope với `data`:

```json
{
  "schema_version": "saferoute-m3-acceptance-audit/1",
  "session_id": "<opaque session ID>",
  "acceptances": []
}
```

`acceptances` chứa tối đa **100 receipt thành công gần nhất**, mới nhất trước; mỗi entry có đúng dạng receipt public nêu trên. Phiên chưa accept có mảng rỗng. API này chỉ đọc audit, không tính kế hoạch hoặc sửa state. Public history không lộ runtime command ID, token/auth metadata, request claims hoặc bảng authority nội bộ. Không dùng history thay cho `/state` khi xác định active plan hiện tại.

Muốn xuất đầy đủ lịch sử đã lưu, dùng artifact API M3-07; bundle riêng chứa safe actor/request/command audit fields và hash từng tài liệu. View sau accept được capture theo basis thực tế và thời điểm observation; nó có thể mới hơn receipt nếu có mutation đồng thời. Trajectory/frame chưa được lưu ở các bước cũ được công bố là missing evidence, không gán current view thành lịch sử.

## Vận hành và khôi phục

Khởi chạy HTTP và worker theo [hướng dẫn M3-04](M3_JOB_API_HANDOFF.md#chạy-http-server-và-compute-worker). Từ thư mục project MLAI4, chạy hai terminal:

```powershell
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B .\backend\scripts\start_backend.py --port 8000
```

```powershell
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B .\backend\scripts\start_worker.py
```

SDK bridge accept có timeout server mặc định **60 giây** vì phải kiểm witness/source thật. Claim request accept có lease **120 giây**. Hai giới hạn này phục vụ điều phối/retry; không phải SLA, thời lượng solver hay thời gian giao hàng. Claim chưa hết hạn trả `REQUEST_IN_PROGRESS`; sau crash, worker/retry tiếp tục request đã lưu khi có thể claim lại.

Worker reconcile pending acceptance bằng đúng installation, full basis, job, acceptance ID và runtime command ID đã lưu, sau khi recovery gate cho phép. Nó không lấy revision mới để biến request cũ thành một hành động khác. Các từ chối xác định giữ outcome; sự cố không xác minh được làm worker degraded để readiness phản ánh lỗi. `/ready` kiểm metadata acceptances và các dependency outbox/recovery/artifacts của M3-07; source/build/store lỗi giữ bằng chứng và chặn ghi. Chỉ worker giữ singleton hoặc admin đã fence mới điều phối recovery; browser không có endpoint recover/backup.

Audit public và receipt giúp đối chiếu hành động đã commit. Không xóa metadata/authority, chỉnh generation hoặc bỏ verification để thử accept lại. Kiểm kết quả native/unit và tình trạng phần P1 còn lại trong báo cáo nghiệm thu M3-05; tài liệu này mô tả API, không tuyên bố kết quả kiểm thử.
