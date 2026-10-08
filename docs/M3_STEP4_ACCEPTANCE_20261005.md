# Nghiệm thu M3-04 — Optimize bất đồng bộ, queue và worker

Ngày: 05/10/2026. Root: `D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN`.

**Kết quả: M3_STEP4_ASYNC_OPTIMIZE_PASS; G1 đạt.** Backend đã triển khai submit HTTP 202, durable queue, compute worker tách tiến trình, public typed polling và cancel. Native S0 tạo kết quả `COMPLETED / FEASIBLE`, witness `VALIDATED`, `plan_available=true`, `coverage_evaluated=true` với budget server 60 giây. Toàn bộ execution view giữ nguyên trước, trong và sau forecast: head/basis không đổi, active job vẫn null, delivered prefix rỗng, observed metrics null.

## Mã triển khai và bảo đảm

- Các endpoint mới: `POST /api/sessions/{session_id}/optimize`, `GET /api/sessions/{session_id}/jobs/{job_id}`, `POST /api/sessions/{session_id}/jobs/{job_id}/cancel`. Mutations yêu cầu owner + dispatcher; job thuộc đúng namespace phiên. Client không chọn source/build/path/budget hoặc state.
- SQLite metadata lưu actor/session/request digest, installation identity, full input basis, profile, budget và command ID trước public SDK submit. Receipt và enqueue lưu cùng transaction. Retry giữ command/binding/budget cũ, kể cả sau crash; nội dung đổi dưới cùng key trả 409.
- Worker gọi public SDK; API không compute/recover. Singleton dùng khóa hệ điều hành trước recovery. Compute và recovery đang chạy giữ khóa đến khi kết thúc khi dừng bình thường. Worker mới phục hồi các claim mồ côi và fence runtime RUNNING cũ; không tự chạy lại terminal FAILED.
- Heartbeat cập nhật mỗi 2 giây trong lúc solve. Readiness kiểm queue, build/installation binding và tuổi heartbeat tối đa 30 giây. Lỗi integrity/transport không xác định được outcome bị quarantine/DEGRADED; failure terminal của một job không tự làm cả worker mất READY.
- Job view giữ nguyên schema frozen và exact/null semantics. SEARCH_LIMIT không đồng nghĩa infeasible hoặc thành công có witness. Cancel QUEUED/RUNNING cho typed `FAILED / JOB_CANCELLED`; COMPLETED trả `COMPLETED_IMMUTABLE`. Forecast không kích hoạt kế hoạch; accept thuộc M3-05.

## Bằng chứng kiểm tra

| Hạng mục | Kết quả |
| --- | --- |
| Unit/HTTP/worker | **151 passed**, 0 failures/errors/skips; 18.98 giây |
| Phân nhóm | 79 foundation/session, 40 job API/persistence, 32 worker/recovery |
| Native submit | HTTP 202; default BALANCED; 4.7500 giây ở lần đo này |
| Native S0 | COMPLETED/FEASIBLE, validator raw-witness /3 xác nhận VALIDATED |
| Trong lúc RUNNING | Poll/state hoạt động, `/ready` 200 và heartbeat mới; execution view không đổi |
| Cancel | Queued + running pass; running không publish muộn sau khi native bridge thực sự kết thúc; retry receipt giữ nguyên |
| Restart | API + worker restart giữ mapping request/job, typed result, cancellation receipt và physical view |
| Singleton | Worker thứ hai thoát mã 3; không recovery hoặc mutation job của worker đang giữ khóa |
| Frozen M2 handoff | 149/149 entries, 141 inventory pins; TEAM_HANDOFF_BYTES_VERIFIED |

Test worker bổ sung cancellation tại startup recovery, recovery claim orphan và recovery sau timeout; dùng barrier xác nhận worker thứ hai bị chặn đến khi recovery hoàn tất. Test HTTP bao phủ owner/role/job namespace, request concurrent/retry/restart, stale revision, JSON injection, uncertain SDK response, witness/null và forecast-only.

Có một warning deprecation từ Starlette TestClient dùng httpx; test không lỗi và dependency lock đã giữ nguyên. Thời gian native là số đo của lần chạy, không chứng nhận SLA 30 giây hoặc xóa giới hạn performance NOT_MET.

Receipt private: `D:\MLAI4\.local\m3-step7\receipts\m3_step4_20261005_153117`; gồm `http_tests.xml`, `http_tests.txt`, `native_jobs.json`, log API/worker/singleton và OpenAPI. [Receipt native được bàn giao](M3_STEP4_NATIVE_JOBS_20261005.json), [báo cáo máy đọc](M3_STEP4_ACCEPTANCE_20261005.json), [OpenAPI hiện hành](M3_OPENAPI_20261005.json), [API job cho M4](M3_JOB_API_HANDOFF.md).

## Chạy và bước tiếp theo

Chạy `backend/scripts/start_backend.py` và `backend/scripts/start_worker.py` bằng backend venv trong hai terminal, theo [handoff HTTP](M3_API_HANDOFF.md). Helper API/worker của kiểm thử đã dừng; không có dịch vụ kiểm thử được để chạy nền. Khi kill worker, heartbeat READY cũ có thể tồn tại tối đa 30 giây trước khi readiness chuyển 503. Private sessions/results được giữ lại làm bằng chứng; credentials không nằm trong report.

Bước tiếp theo **M3-05: accept certified job**, kiểm latest basis, idempotency/audit và giữ delivered prefix khi kích hoạt. Profile comparability là phần P1 trong cùng bước; event/replay, outbox/artifacts và full E2E/offline thuộc các bước sau.

Các giới hạn Step 7 vẫn giữ: `GENERAL_M1_NOT_VALIDATED`, `E4_NOT_RUN`, `PRODUCTION_CALIBRATION_UNCONFIGURED`, performance `NOT_MET`, `SIMULATED_REPLAY_NOT_GPS`; S7 cold SEARCH_LIMIT chưa chứng minh infeasible. Leader deployment review còn pending. G1 này xác nhận local backend integration trên package/source đã pin, không tự chứng nhận toàn hệ thống hoặc deployment.
