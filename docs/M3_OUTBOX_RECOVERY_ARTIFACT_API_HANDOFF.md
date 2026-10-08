# Bàn giao notifications, recovery và artifacts — M3-07

Ngày 05/10/2026. Backend app `0.7.0`. Các route dùng envelope `saferoute-m3-http-response/1`, bearer và owner phiên như các bước trước. SDK, source và contracts M1/M2 giữ nguyên build đã pin.

| HTTP | Vai trò | Nội dung |
| --- | --- | --- |
| `GET /api/sessions/{sid}/notifications?after=0&limit=100` | Owner | Notifications đã lưu bền vững, cursor và trạng thái ack |
| `POST /api/sessions/{sid}/artifacts` | Owner dispatcher | Tạo snapshot bất biến với body `{"request_id":"audit-1"}` |
| `GET /api/sessions/{sid}/artifacts` | Owner | Danh sách đầy đủ các bundle đã hoàn tất của phiên |
| `GET /api/sessions/{sid}/artifacts/{artifact_id}` | Owner | Manifest, basis và hash của 11 tài liệu |
| `GET /api/sessions/{sid}/artifacts/{artifact_id}/content` | Owner | `content_utf8`, SHA-256 và số byte chính xác của bundle |

## Notifications

Worker gọi public `read_notifications`, lưu batch trong transaction M3, dedup theo installation/session/event ID, rồi mới gọi public `acknowledge`. Mỗi notification có command ID ack được lưu trước lần gọi SDK đầu tiên. Sau crash, worker tiếp tục ack các dòng pending đã lưu kể cả khi SDK không còn trả chúng. Ack và receipt của riêng ack không sinh notification mới.

Startup đồng bộ toàn bộ phiên đã validate trước khi mở gate. Polling định kỳ quay vòng công bằng từng phiên, chờ 10 giây sau mỗi lượt hoàn tất; phiên mới được thêm vào vòng và không bỏ đói phiên cũ. Đây là eventual coverage, không cam kết mỗi phiên cập nhật trong 10 giây. Khi dừng, worker chờ các SDK mutation đang chạy và durable receipt M3 hoàn tất trước khi nhả singleton lock.

HTTP đọc dữ liệu M3 và không ack. Field công khai mỗi dòng gồm `cursor`, `session_id`, `event_id`, `kind`, `body_sha256`, `created_at`, `acked_at`, `status`. `event_id` là journal hash của SDK; nó khác source event ID như `S3-E1`. SDK không công khai body journal nên backend không suy đoán pickup/delivery từ notification summary.

`cursor`/`next_cursor` là chuỗi số nguyên int64 không âm chính tắc. `limit` từ 1 đến 500. Client lưu `next_cursor` và tiếp tục đến khi `has_more=false`; cursor có thể có khoảng trống vì được cấp toàn server. Danh sách sắp theo cursor và giới hạn trong phiên. `status` là `PENDING_ACK` hoặc `ACKNOWLEDGED`. UI dedup theo session/event ID và đọc state khi cần; notification không tự thực hiện lại event hay delivery.

Nếu một event ID xuất hiện với kind/body hash khác, backend báo `OUTBOX_CONFLICT`, chặn ghi và giữ dữ liệu cũ. Lỗi lưu M3 báo `OUTBOX_METADATA_UNAVAILABLE`; chưa có durable record thì không ack.

## Recovery phía server

Worker giữ OS singleton lock trước khi recovery. Khi startup, các phiên READY chuyển vào gate `RECOVERING`; source/build/installation được kiểm lại. Worker dùng public SDK để fence job RUNNING mồ côi, `validate_session`, lấy execution view và outbox. View, recovery receipt và validation phải đúng schema/binding. Sau khi lưu bằng chứng, phiên chuyển VALIDATED và HTTP vẫn bị chặn ghi. Chỉ worker startup được reconcile request pending bằng command ID/basis/payload cũ ở giai đoạn này. Khi outbox, queue và pending requests đã được đối soát xong, phiên mới chuyển VERIFIED và worker READY để nhận ghi/dispatch mới.

Recovery của SDK không có durable command receipt: lần gọi lại có thể trả danh sách `fenced_jobs` khác. Audit M3 ghi từng attempt, wall clock và kết quả thực tế. Không gọi recover từ browser hoặc trong lúc worker khác đang compute. Repeated cancellation vẫn phải chờ SDK kết thúc trước khi nhả khóa.

Graceful shutdown chờ hết snapshot request pending đang được reconcile, không chỉ RPC hiện tại; do đó có thể kéo dài qua nhiều giới hạn timeout SDK. Singleton vẫn được giữ trong suốt thời gian đó. Trước backup, operator phải xác nhận API và worker đã dừng hoàn toàn.

API và worker phối hợp SDK call ngoài compute bằng OS mutex theo resolved authority location, không theo riêng metadata M3. Deadline bao gồm cả chờ lock và subprocess; hết thời gian chờ trả `RUNTIME_BUSY` 503 trước khi gọi SDK, không đổi recovery gate thành corruption. Compute được tách để giữ poll/cancel, nên không tuyên bố loại trừ mọi internal SDK transaction. Lượt native thứ tư ghi nhận `STORE_INVALID` khi đọc state ở foreground. Tranh lock là suy luận được hỗ trợ bởi cách pinned SDK ánh xạ lỗi SQLite, public lineage validation S2/S3/S4 đạt khi helpers đã dừng, và probe thật chạy đồng thời notification batch với HTTP state sau khi thêm phối hợp. Raw HTTP diagnostic chưa chứng minh trực tiếp nguyên nhân SQLite. Không sửa hoặc reset authority để xử lý lỗi đó.

Worker đã READY gặp `RUNTIME_BUSY` giữ pending ack/request và queue, thử lại bằng command/basis cũ ở vòng sau; không quarantine hoặc đánh dấu integrity failure. Startup chưa đối soát xong vẫn không được mở gate; BUSY trong startup là lỗi phối hợp và cần hoàn tất lần xác minh tiếp theo trước khi sẵn sàng. Các SDK STORE/journal/source rejection thực sự vẫn chặn ghi và giữ nguyên bằng chứng.

`STORE_INVALID`, `STORE_MISSING`, journal/outbox corruption, source/build mismatch hoặc invalid public evidence chặn mutation của phiên và khiến readiness không đạt. HTTP optimize/cancel/accept/replay và worker reconcile đều kiểm gate. Các receipt/queue/source/authority cũ được giữ lại; backend không xóa hoặc tạo lại authority để vượt kiểm tra.

Checklist khi readiness lỗi:

1. Dừng yêu cầu ghi; lưu diagnostics, heartbeat và receipt thư mục lần chạy.
2. Dừng HTTP API và worker; kiểm worker process đã kết thúc và khóa được nhả.
3. Giữ authority/source/metadata lỗi làm bằng chứng; không sửa SQLite live, không đổi source/hash/browser payload.
4. Member 2 và Leader xác định nguyên nhân, bản backup/source/build phù hợp và thủ tục restore/upgrade có fence.
5. Khởi động worker lại; chỉ tiếp tục ghi khi public validation, gate, queue và `/ready` đều đạt. Job FAILED/quarantined không tự solve lại bằng request ID cũ.

## Artifacts và audit

Tạo bundle bằng request ID trong namespace actor/session. Retry cùng ID trả đúng snapshot/bytes cũ; ID mới chụp trạng thái mới. Bundle chỉ READY sau khi toàn bộ bytes/manifest được lưu atomic. Nếu state hoặc metadata thay đổi trong lúc chụp, trả `409 ARTIFACT_STATE_CHANGED`; retry cùng ID. Hai store không có shared transaction: export ghi rõ kiểm tra ổn định trước/sau, basis và thời gian riêng của từng observation.

Bundle gồm `session.json`, `requests.json`, `jobs.json`, `acceptances.json`, `events.json`, `execution_frames.json`, `accepted_trajectories.json`, `notifications.json`, `recovery.json`, `validation.json`, `provenance.json`. Mỗi file là canonical JSON UTF-8, có byte count và SHA-256 trong manifest. Để kiểm hash, encode nguyên `content_utf8` thành UTF-8; không stringify lại object. Hash frame công khai khác private SDK `head_sha256`.

Audit ghi actor/request/command/session/job/event, input/result basis, outcome hoặc diagnostic đã lưu. Wall clock UTC (`recorded_at`/`captured_at`) tách simulation time `+07:00`. Load, terminal compute, state read và view sau accept/replay từ M3-07 được lưu thành immutable observations. View sau receipt là observation hiện tại, có thể có basis mới hơn receipt; export không gán nó thành exact historical frame.

Lịch sử M3 xuất đầy đủ, không dùng giới hạn 100 dòng của API history. Các trajectory/frame trước M3-07 chưa được lưu thì nằm trong `history_gaps`/`missing_historical_job_ids`; không dựng lại bằng private Store hoặc giải lại solver. Original HTTP body và wall time commit vật lý lịch sử cũng có thể thiếu. Notification đã được ack trước khi M3 lưu không thể khôi phục qua public SDK. Export giữ receipt hash/basis có sẵn và công bố khoảng trống.

Job view là forecast; no-witness/SEARCH_LIMIT không tạo plan giả. `observed_metrics`, forecast suffix/whole metrics và null giữ nguyên scope của SDK. Safety là relative exposure **PROXY**, không phải xác suất tai nạn. Không suy ra native/E2E verdict chỉ từ việc tạo được export.

## Backup admin riêng

Backup SDK sao chép **toàn bộ authority đa phiên**; không có route browser/download authority. Thực hiện trong terminal admin sau khi đã dừng HTTP và worker hoàn toàn:

```powershell
Set-Location -LiteralPath 'D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN'
& 'D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe' -B backend/scripts/backup_backend.py --api-stopped
```

`--api-stopped` là xác nhận của operator; script không thể phát hiện mọi API process/port. OS worker lock chỉ loại trừ worker, không loại trừ HTTP accept/event đang chạy. Script giữ khóa, dùng public SDK backup vào đường dẫn **mới do server sinh**, backup metadata M3 bằng SQLite backup, kiểm integrity và ghi manifest/hash. Backup nằm trong thư mục private `backend/backups/<timestamp_uuid>` ngoài project. Không kèm file bearer/auth config. Nếu thất bại, giữ partial backup và marker INCOMPLETE; không overwrite/delete bằng chứng.

Restore/upgrade/rollback do Member 2 và Leader review khi cả API lẫn worker đã fence. Không thay runtime/source/authority live, không restore qua HTTP, không lấy per-owner artifact làm global authority backup. Trước mở lại traffic phải kiểm pin/source, public session validator, committed head/lineage và queue.

## Nghiệm thu và giới hạn

SDK call thông thường, gồm public execution/job reads, có giới hạn **60 giây**; các SDK inspection/notification/admin call có giới hạn **120 giây**, inspection recovery kiểm từng phiên, tối đa **1 phiên/call**. Polling notifications định kỳ cũng kiểm **1 phiên/lượt** để giảm thời gian giữ mutex. Native harness chờ toàn bộ startup tối đa **1800 giây**. Các giới hạn này không phải SLA; startup phải xác minh toàn bộ lịch sử nên có thể chậm. Các lượt lỗi đọc state ở timeout 15 và 60 giây được giữ trong báo cáo. Log timeout ghi operation, thời gian chờ và ngân sách subprocess còn lại, không ghi request fields, token, output SDK hay server path. Ngân sách solver không thay đổi.

Xem `M3_STEP7_ACCEPTANCE_20261005.md/json` và native report đi kèm. Native dùng các phiên S2/S3/S4 đã có witness M3-06, kiểm SHA của receipt/frames và head thực tế; không tạo witness mới. Một phiên S0 mới kiểm hai ranh giới commit bằng reopen repository và stable-key retry; đây không phải process fault injection. Bản sao backup riêng dùng để kiểm corruption rejection; authority gốc được giữ nguyên.

Giữ `GENERAL_M1_NOT_VALIDATED`, `E4_NOT_RUN`, `PRODUCTION_CALIBRATION_UNCONFIGURED`, `PERFORMANCE_NOT_MET`, `SIMULATED_REPLAY_NOT_GPS`, `NOT_OPTIMALITY`. S4 vẫn là synthetic what-if; S7 cold SEARCH_LIMIT chưa chứng minh infeasible. M3-08 full E2E/offline/packaging và P1 profile comparison vẫn chưa được nghiệm thu bởi bước này.
