# M3-04 — bàn giao API optimize, polling và cancel

Tài liệu dành cho Member 4 khi nối giao diện với backend Member 3. Khung HTTP, token, CORS và cách chạy chung xem [M3_API_HANDOFF.md](M3_API_HANDOFF.md); cách nạp kịch bản và đọc phiên xem [M3_SESSION_API_HANDOFF.md](M3_SESSION_API_HANDOFF.md). Kết quả kiểm thử và nghiệm thu M3-04 được ghi riêng tại [M3_STEP4_ACCEPTANCE_20261005.md](M3_STEP4_ACCEPTANCE_20261005.md).

M3-04 nhận yêu cầu optimize, lưu receipt/hàng đợi bền vững và cho worker riêng gọi SDK M2 thật. Compute tạo **dự báo**; chỉ một job hoàn thành có witness được validator chứng nhận mới có `plan_available: true`. Optimize không kích hoạt kế hoạch, tăng head hoặc generation, di chuyển xe, ghi delivered hay tạo số liệu quan sát thực tế.

## Luồng tích hợp giao diện

1. Nạp S0–S8, lấy `session.session_id` và `execution_view.basis` từ API phiên.
2. Tạo một UUID cho hành động optimize, lưu UUID cùng body cho đến khi có kết quả chắc chắn. Gửi POST optimize; HTTP 202 trả `job_id`, input basis và link polling/cancel.
3. Poll link được trả về, ban đầu khoảng 1–2 giây/lần; tăng khoảng nghỉ khi mất kết nối. Dừng polling khi lifecycle là `COMPLETED` hoặc `FAILED`.
4. Hiển thị riêng lifecycle, business outcome và witness. Tiếp tục lấy `/state` để hiển thị trạng thái vận hành; trạng thái job đang tính không thay thế execution view.
5. Khi người dùng hủy, tạo UUID mới cho hành động cancel. Nếu request mất kết nối, gửi lại cùng UUID và cùng body. HTTP 200 chỉ xác nhận receipt hủy; đọc job view để hiển thị kết quả lifecycle.

Không có endpoint HTTP cho client gọi `compute` hoặc `recover`. M3-05 đã thêm [API accept certified job](M3_ACCEPT_API_HANDOFF.md); nút “áp dụng” gọi API này với revision mới nhất rồi hiển thị execution view từ server. M3-06 đã thêm [API event/replay theo bước](M3_EVENT_REPLAY_API_HANDOFF.md); frontend gọi các API này và đọc execution view từ server khi tiến mô phỏng hoặc apply event.

App hiện hành `0.7.0` thêm [notifications/recovery/artifacts M3-07](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md). Notifications là summaries đã lưu trước SDK ack, không phải lệnh frontend thực hiện lại. Artifact owner-scoped giữ public job views/audit và bytes bất biến; SEARCH_LIMIT/no-witness vẫn không tạo plan giả. P1 profile comparison, autoplay và full frontend E2E còn chờ.

## Các endpoint

| Method và đường dẫn | Quyền | Thành công | Nội dung |
| --- | --- | --- | --- |
| `POST /api/sessions/{session_id}/optimize` | Chủ phiên có role `dispatcher` | 202 | Lưu input, submit job, enqueue compute |
| `GET /api/sessions/{session_id}/jobs/{job_id}` | Chủ phiên | 200 | Public typed `task02-m2-runtime-job-view/1` |
| `POST /api/sessions/{session_id}/jobs/{job_id}/cancel` | Chủ phiên có role `dispatcher` | 200 | Receipt `JOB_CANCELLED` hoặc `COMPLETED_IMMUTABLE` |
| `GET /api/sessions/{session_id}/state` | Chủ phiên | 200 | Execution view của phiên; không phải forecast job |
| `GET /ready` | Không cần token | 200 hoặc 503 | Kiểm G0, auth, metadata, runtime, catalog, queue và worker |

API lấy actor từ Bearer token do server cấp. Body không nhận `actor_id`, `session_id`, `job_id`, thời lượng solver, runtime command ID hay đường dẫn dữ liệu. Trường thừa bị từ chối. Token của actor khác không đọc hoặc điều khiển phiên này, kể cả khi biết session/job ID.

Mọi response `/api/` có `Cache-Control: no-store`. Giao diện giữ receipt/job ID cho retry, không sử dụng HTTP cache để suy ra state hiện tại. Không đưa token vào URL, log, ảnh chụp hoặc repository.

## Request và response

Các UUID trong ví dụ là placeholder; tạo UUID mới bằng `crypto.randomUUID()` cho mỗi hành động mới. `{session_id}` và `{job_id}` lấy nguyên giá trị opaque từ server.

### Optimize

```http
POST /api/sessions/{session_id}/optimize
Authorization: Bearer <token server cấp>
Content-Type: application/json
```

Body tối thiểu:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000001"
}
```

Body có lựa chọn profile và kiểm revision:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000002",
  "profile": "BALANCED",
  "expected_revision": {
    "head_version": "0",
    "generation": "0"
  }
}
```

`profile` nhận `FASTEST`, `BALANCED`, `SAFER`; mặc định là `BALANCED`. `expected_revision` là tùy chọn. Nếu dùng, copy `head_version` và `generation` **dưới dạng chuỗi** từ basis mới nhất của `/state`. Server từ chối bằng 409 `STALE_HEAD` khi revision không khớp. Server luôn tự lấy và lưu **đầy đủ input basis**, gồm binding snapshot/build/session; client không được cấp basis tùy ý.

Receipt thành công có dạng:

```json
{
  "schema_version": "saferoute-m3-http-response/1",
  "request_id": "00000000-0000-4000-8000-000000000003",
  "status": "OK",
  "data": {
    "schema_version": "saferoute-m3-job-submission/1",
    "session_id": "<opaque session ID>",
    "job_id": "<opaque job ID>",
    "profile": "BALANCED",
    "input_basis": {
      "session_id": "<opaque session ID>",
      "root_sha256": "<hash server trả>",
      "head_sha256": "<hash server trả>",
      "head_version": "0",
      "generation": "0",
      "source_sha256": "<hash server trả>",
      "context_version": "<context version server trả>",
      "overlay_sha256": null,
      "build_sha256": "<hash build server trả>"
    },
    "links": {
      "poll": "/api/sessions/{session_id}/jobs/{job_id}",
      "cancel": "/api/sessions/{session_id}/jobs/{job_id}/cancel"
    }
  },
  "diagnostics": []
}
```

Ví dụ response là minh họa cấu trúc; lấy nguyên object `input_basis` từ server thay vì dựng lại các giá trị ví dụ. HTTP 202 không chứng minh đã tìm được kế hoạch, không cam kết thời điểm hoàn thành và không cam kết phục vụ được mọi đơn.

Server cấp budget mặc định **60 giây** cho compute và lưu budget vào request/hàng đợi trước khi dispatch. M3 cấu hình riêng bằng `SAFEROUTE_COMPUTE_BUDGET_SECONDS`, trong khoảng `(0, 600]`; frontend không gửi giá trị này. Thời gian tổng còn gồm kiểm package, dựng domain và validation nên không xem budget là HTTP SLA hoặc deadline tổng. Mục tiêu 30 giây của bản bàn giao M2 chưa phải SLA.

### Polling public job view

`data` là projection public từ SDK, không chứa private raw result/store. Giữ nguyên các trường sau:

| Trường | Cách dùng trên giao diện |
| --- | --- |
| `job_status` | Lifecycle: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` |
| `input_basis` | Basis gắn với lần submit; không thay bằng basis của lần đọc state sau |
| `business_status`, `internal_status` | Kết quả nghiệp vụ/tìm kiếm; giữ `null` khi chưa có |
| `validation.status`, `validation.valid` | `NOT_RUN`/`null` nếu không có witness; `VALIDATED`/`true` khi được chứng nhận |
| `plan_available` | Có witness hợp lệ để xem xét áp dụng; không có nghĩa là đang chạy plan |
| `coverage_evaluated` | Chỉ kết luận coverage khi giá trị là `true` |
| `served_orders`, `unserved_orders` | Forecast coverage; không đổi thành “đã giao” |
| `diagnostics` | Giữ code/reason để giải thích thất bại hoặc giới hạn tìm kiếm |
| `execution_view_required` | Luôn `true`; trạng thái vận hành phải đọc execution view |
| `public_api_v1_dynamic_plan_available` | Luôn `false`; không ép projection này thành dynamic plan API v1 |

Quy tắc hiển thị:

- `QUEUED`/`RUNNING`: job chưa có kết quả; business/internal status là `null`, validation chưa chạy và `plan_available: false`.
- `COMPLETED` + `plan_available: true`: có witness đã validated. `FEASIBLE` hoặc `PARTIAL` mô tả forecast coverage; `PARTIAL` phải hiển thị cả served và unserved. Witness `RETURN_ONLY` có business `UNSUPPORTED`; không diễn giải thành phục vụ đơn thành công.
- `COMPLETED` + `plan_available: false`: tiến trình tính đã kết thúc nhưng không có witness phục vụ được chứng nhận. Các kết quả như `SEARCH_LIMIT`, `TIME_LIMIT`, `UNSUPPORTED`, `INVALID_DATA` phải giữ đúng nghĩa. Internal `NO_SERVICE` được public projection thành business `UNSUPPORTED`; không suy ra chứng minh bất khả thi từ tên lifecycle hoặc các mảng coverage rỗng.
- `FAILED`: lỗi lifecycle, cancel hoặc recovery; xem diagnostics. Cancel có diagnostic `JOB_CANCELLED`. Không trình bày thành “bài toán vô nghiệm”.

Không thay `null` bằng `0`, `false` hay `[]` khi schema không yêu cầu. Không chuyển số nguyên chính xác dạng decimal string sang JavaScript `Number`. Phân biệt planned served suffix với delivered prefix, projected metrics với `observed_metrics` của execution view. Runtime hiện là `SIMULATED_REPLAY`, không phải vị trí GPS hoặc quan sát ngoài đời.

### Cancel

```json
{
  "request_id": "00000000-0000-4000-8000-000000000004"
}
```

Receipt `data` có schema `saferoute-m3-job-cancellation/1`, `session_id`, `job_id`, `status` và `links.poll`.

- `JOB_CANCELLED`: với job đang queued/running, cancel fence để không được publish kết quả muộn; typed view chuyển sang `FAILED` với diagnostic `JOB_CANCELLED`. Nếu job đã `FAILED` từ trước, failure cũ được giữ nguyên; luôn đọc diagnostics của job view thay vì thay bằng reason từ receipt cancel.
- `COMPLETED_IMMUTABLE`: compute hoàn thành trước khi cancel thắng; kết quả đã hoàn thành giữ nguyên. Giao diện hiển thị đã hoàn thành thay vì khẳng định hủy thành công.

Cancel không đảm bảo native solver dừng CPU ngay tại thời điểm trả receipt. Worker có thể chờ bridge đang tính kết thúc; fencing ngăn kết quả muộn trở thành kế hoạch hợp lệ cho job đã hủy. Cả hai kết quả cancel đều không thay đổi physical head hoặc delivered state.

## Retry và lỗi

`request_id` trong **body** là khóa idempotency của hành động. `request_id` trong envelope và `X-Request-ID` là ID audit **mới cho từng HTTP request**; không dùng chúng thay khóa body.

Request optimize được gắn với actor + session + operation + body request ID. Server lưu fingerprint body, basis, profile, budget và runtime command ID. Gửi lại cùng nội dung trả cùng `job_id`/receipt, kể cả sau khi restart. Dùng cùng ID với profile/revision/nội dung khác trả 409 `IDEMPOTENCY_CONFLICT`. Cancel cũng lưu receipt và gắn với job; không dùng lại ID cancel cho job khác.

| HTTP/code thường gặp | Hành động giao diện |
| --- | --- |
| 401 | Kiểm Bearer token đang dùng |
| 403 | Actor không sở hữu phiên hoặc không có role dispatcher |
| 404 `JOB_NOT_FOUND` | Job không thuộc session đang hỏi; kiểm ID/link đã lưu |
| 409 `IDEMPOTENCY_CONFLICT` | Giữ nguyên body khi retry; hành động mới phải có ID mới |
| 409 `REQUEST_IN_PROGRESS` | Chờ rồi retry cùng ID và cùng body |
| 409 `STALE_HEAD`/`JOB_STALE` | Đọc lại state, giải thích revision đã đổi; hành động optimize mới dùng ID mới |
| 422 | Body không đúng contract, extra field hoặc JSON không hợp lệ |
| 503 timeout/runtime/metadata/queue | Chưa kết luận thất bại vĩnh viễn; retry cùng ID sau khoảng nghỉ, kiểm readiness |

Server giữ receipt lỗi xác định cho một số request bị từ chối; gửi lại đúng ID không biến request đã bị từ chối thành hành động mới. Không tự tạo ID mới chỉ vì timeout: runtime có thể đã nhận submit trước khi kết nối bị đứt.

## Chạy HTTP server và compute worker

Chạy từ thư mục project MLAI4 ở hai terminal riêng. Dependency FastAPI nằm ở backend venv; bridge compute sử dụng runtime venv đã được pin/verify, không cài dependency HTTP vào runtime.

```powershell
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B .\backend\scripts\start_backend.py --port 8000
```

```powershell
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B .\backend\scripts\start_worker.py
```

Worker là process riêng, có singleton OS lock. Worker thứ hai bị từ chối với `WORKER_ALREADY_RUNNING`, exit code 3, trước khi recovery hoặc claim job. Server có thể nhận và lưu optimize khi worker dừng nếu recovery gate của phiên cho phép; job giữ queued cho tới khi worker hợp lệ chạy. Phiên RECOVERING/BLOCKED trả 503 và không nhận optimize/cancel hay worker reconcile. Giao diện nên kiểm `/ready` để báo khả năng xử lý trước khi cho người dùng khởi tạo hành động.

`/health` chỉ báo HTTP process còn sống. `/ready` trả 200 khi mọi dependency cần thiết đạt; có thể 503 nếu worker chưa chạy, heartbeat không hợp lệ/cũ, queue bị quarantine, recovery gate/outbox/artifact metadata lỗi hoặc runtime/G0 không đạt. Worker ghi heartbeat khoảng 2 giây/lần; readiness chỉ nhận heartbeat `READY`, đúng installation/build và tuổi từ 0 đến **30 giây**. Nếu process bị kill đột ngột, heartbeat cũ có thể còn được chấp nhận trong khoảng TTL này; không diễn giải readiness thành phép kiểm liveness tức thời. Khi worker đang compute, heartbeat vẫn được cập nhật và readiness có thể tiếp tục 200.

Ctrl+C theo luồng shutdown sẽ giữ singleton ownership trong lúc chờ compute/recovery bridge còn hoạt động hoàn tất rồi ghi `STOPPED` và nhả lock. Dừng cưỡng bức được xử lý bằng recovery khi singleton kế tiếp khởi động; không khởi chạy worker thứ hai để “sửa” worker đang sống.

## Hàng đợi bền vững và khôi phục

M3 lưu request receipts/queue trong metadata SQLite riêng. M2 authority store chỉ được truy cập qua public SDK; code HTTP không sửa Store hoặc solver internals.

- Trước submit, server lưu đúng installation, input basis, profile, budget và command ID. Nếu chết sau khi runtime nhận submit nhưng trước khi lưu response/enqueue, worker hoặc retry tiếp tục bằng **command ID cũ** để nối lại receipt mà không tạo job mới.
- Lưu receipt thành công và enqueue là một transaction metadata. Claim queue có token riêng; stale dispatcher không hoàn tất claim của worker khác.
- Worker mới chỉ recovery sau khi có singleton lock. M3-07 đặt gate RECOVERING cho các phiên READY, kiểm source/installation, gọi public SDK recovery/validate_session và lưu current view/audit; lỗi giữ BLOCKED. Với phiên đã VERIFIED, worker đối chiếu queue running, đọc typed job view rồi khôi phục hoặc kết thúc queue theo outcome runtime. Restart không lập lịch accept/replay mới; worker tiếp tục request đã persist bằng command/basis/payload cũ sau khi gate cho phép. [Handoff M3-07](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md) có chi tiết fence, outbox và backup admin.
- Binding/corruption hoặc lỗi không thể xác minh được đưa queue vào `QUARANTINED`, worker thành `DEGRADED`, readiness 503. Không xóa metadata/authority hoặc bỏ verification để ép job chạy lại. Lỗi timeout/lifecycle được đối chiếu outcome sau recovery; terminal outcome được giữ nguyên.
- SDK bridge xác minh package trước import, chạy process cô lập và chỉ trả public projection. Việc thử lại không thay đổi build contract, JSON exact-number rules hay dữ liệu nguồn M1/M2.

Khi nghiệm thu hoặc chạy verifier, xem receipt/log của lần chạy cụ thể để phân biệt native witness, lỗi lifecycle và race cancel. Tài liệu API này mô tả hành vi triển khai; không thay thế kết quả kiểm thử trong báo cáo nghiệm thu M3-04.

Terminal typed job view và các SDK execution observations từ M3-07 được lưu làm bằng chứng bất biến. Artifact xuất đầy đủ các record M3 đã lưu, gồm safe actor/request/command lineage và notifications/ack; không xuất raw authority/job records. Historical frames/trajectory chưa capture được công bố là khoảng trống, không giải lại solver để điền lịch sử.
