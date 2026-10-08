# Nghiệm thu M3-06 — Event và replay theo bước

Ngày: 05/10/2026. Root: `D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN`.

**M3_STEP6_EVENT_REPLAY_PASS.** API event/replay đã triển khai và chạy với public SDK Step 7 thật. Native S2, S3, S4 hoàn thành vòng `load → optimize → accept → advance → apply_event → replan → accept → advance`. Mỗi kịch bản có hai solve native tạo certified witness trong bước này; lượt cuối đối chiếu các bằng chứng đã đạt và kiểm restart chung. Không dùng mock hoặc historical solver seed.

## Hành vi đã có

- Pending events từ verified fixture, gồm timestamp/basis và `apply_allowed`. Apply kiểm owner/dispatcher, revision, đúng pending ID và exact source time sau observed replay.
- Step yêu cầu accepted plan, không tua ngược hoặc vượt pending event barrier. Bước mặc định 60 giây được clamp tới barrier; target đã chuẩn hóa được persist trước SDK mutation và dùng lại khi retry. Hỗ trợ thời gian chính xác đến microsecond, NOOP giữ basis.
- Apply tăng physical head version một, giữ generation, observed prefix/time/metrics; đình chỉ suffix cũ. Cần optimize/accept lại để replay tiếp. S2 thêm O009 đúng một lần. S3 giữ vị trí/load/range/custody. S4 gắn overlay SYNTHETIC WHAT-IF, giữ base context.
- Pause là acknowledgement manual STEP, không đổi SDK head. Reset tạo session mới từ cùng fixture, giữ phiên cũ và parent/new-session lineage. History gồm tối đa 100 receipt event/replay/control gần nhất.
- Full basis/payload/installation/command ID lưu trước mutation. Receipt và audit commit cùng transaction trước resolve live view. Retry dùng command/basis/target/load key cũ; receipt lịch sử tách current execution view. Worker reconcile pending requests sau crash/restart.
- Heartbeat reader/publisher retry có giới hạn khi Windows gặp sharing violation tạm thời; lỗi I/O kéo dài vẫn fail closed. Readiness có thêm replay metadata check. Capabilities xác minh nguồn/build có timeout riêng 60 giây để startup và readiness đồng thời không bị giới hạn 15 giây quá ngắn; read thường giữ 15 giây, replay 120 giây và accept 60 giây.

## Kết quả kiểm chứng

| Hạng mục | Kết quả |
| --- | --- |
| Bộ kiểm thử cuối | **281 passed**, 0 failures/errors/skips; 45.32 giây |
| Case mới | **79** event/replay/heartbeat; 202 case cũ tiếp tục đạt |
| Native S2 | `PARTIAL/PARTIAL → PARTIAL/PARTIAL`; O009 thêm một lần; replay/replan/retry/history/reset/restart PASS |
| Native S3 | `PARTIAL/PARTIAL → PARTIAL/PARTIAL`; V1 UNAVAILABLE, field physical giữ nguyên; held cargo: O001; không chuyển owner khi replan |
| Native S4 | `FEASIBLE/FEASIBLE → PARTIAL/PARTIAL`; WHAT-IF overlay đúng; replay start+1µs, end−1µs, exact end, end+1µs PASS |
| Guard HTTP | Event sớm, vượt barrier và advance sau event trước reaccept trả đúng 409, state không đổi |
| Persistence | Retry giữ receipt/audit một lần; reset giữ phiên gốc; API/worker restart giữ exact state/history |
| Native readiness | API và worker thực đạt 200; restart kiểm heartbeat của worker mới |
| Frozen M2 | TEAM_HANDOFF_BYTES_VERIFIED, 149 entries/141 pins; build giữ nguyên |

Test mới bao phủ idempotency/concurrency/CAS, stale head, owner/role, timestamp fractions/default cap, same-time NOOP, source-bound event, malformed receipt (503 trước audit), uncertain SDK commit, SQLite audit INSERT rollback, reset uncertain bootstrap, worker reconcile và heartbeat transient/permanent I/O. Native giữ full job views, frames và hashes trong receipt directory.

Unit receipt: `D:\MLAI4\.local\m3-step7\receipts\m3_step6_20261005_172936`. Native receipt: `D:\MLAI4\.local\m3-step7\receipts\m3_step6_continue_20261005_173111`. Native dùng compute budget server **120 giây** cho test S2/S3/S4; production mặc định **60 giây** giữ nguyên. Bảng giữ business/internal status trước → sau event của witness thực tế; chứng nhận witness không đồng nghĩa phục vụ toàn bộ order universe. Giữ nguyên unserved/coverage diagnostics, không đổi PARTIAL hoặc RETURN_ONLY thành full coverage/infeasible. Capabilities xác minh đo tuần tự 8,703/8,485 giây; hai lời gọi đồng thời 8,500/15,922 giây (timeout chẩn đoán 120 giây), nên giới hạn 15 giây trước đó không đủ cho một lời gọi đồng thời. Thời gian kiểm thử không chứng nhận SLA. S4 không yêu cầu WET exposure dương hoặc overlay hash tự biến mất sau end; scope thời gian do SDK xử lý.

Các kịch bản đã đạt được đối chiếu frame hashes, source/build, exact current state, receipt và history từ các đợt native trước trong bước này, rồi kiểm restart lại cùng nhau. S2 có hai solve ở đợt đầu; S3/S4 có hai solve ở đợt tiếp theo. Hai lượt startup/restart trước đó worker thoát vì capabilities bridge vượt timeout 15 giây; lỗi được giữ trong receipt/log gốc và startup fail closed. Đã tăng riêng capabilities timeout lên 60 giây, giữ source/build verification và các timeout mutation/read khác. Sau thay đổi này, bộ unit cuối và native startup/restart được chạy lại; mã event/replay không đổi. Lượt restart cuối phải thực đạt heartbeat mới và readiness 200 mới được chốt PASS.

[Báo cáo máy đọc](M3_STEP6_ACCEPTANCE_20261005.json), [receipt native](M3_STEP6_NATIVE_REPLAY_20261005.json), [API event/replay cho M4](M3_EVENT_REPLAY_API_HANDOFF.md), [OpenAPI](M3_OPENAPI_20261005.json), [lệnh khởi chạy](M3_API_HANDOFF.md).

## Phần việc tiếp theo

M3-06 và **G2 replay core** đã đạt. Bước tiếp theo **M3-07: outbox/dedup/ack, recovery và audit/artifacts**; full G2 còn chờ bước này. P1 comparison/autoplay, M3-08 full E2E/offline/operations và benchmark còn lại. Helper API/worker native đã dừng; private sessions/receipts được giữ để đối chiếu.

Các giới hạn nguồn giữ nguyên: `GENERAL_M1_NOT_VALIDATED`, `E4_NOT_RUN`, `PRODUCTION_CALIBRATION_UNCONFIGURED`, performance `NOT_MET`, `SIMULATED_REPLAY_NOT_GPS`; S7 cold SEARCH_LIMIT chưa chứng minh infeasible. Leader deployment review còn pending. Có warning deprecation Starlette TestClient/httpx; dependency lock không đổi.
