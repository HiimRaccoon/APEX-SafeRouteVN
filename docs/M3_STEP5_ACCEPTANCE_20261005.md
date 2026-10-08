# Nghiệm thu M3-05 P0 — Accept certified job và audit

Ngày: 05/10/2026. Root: `D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN`.

**M3_STEP5_ACCEPTANCE_PASS.** API accept đã hoạt động trên public SDK Step 7 thật. Native S0 được compute thành certified witness, accept HTTP 200, generation `0` → `1`, job trở thành active. Physical head/head_version, thời gian, xe, delivered prefix và observed metrics giữ nguyên. Planned suffix và accepted trajectory là forecast; các đơn chưa được đánh dấu DELIVERED.

## Hành vi triển khai

- `POST /api/sessions/{session_id}/jobs/{job_id}/accept`: body `request_id` và `expected_revision` bắt buộc; owner + dispatcher. Server kiểm job thuộc phiên, full job basis bằng basis hiện hành và completed certified witness. SDK revalidate witness/source/build rồi CAS. `RETURN_ONLY` có witness hợp lệ vẫn được phép kích hoạt; SEARCH_LIMIT/no-witness không được accept.
- `GET /api/sessions/{session_id}/acceptances`: owner đọc tối đa 100 receipt accept thành công gần nhất. Actor/command ID và canonical request/basis được lưu trong metadata audit riêng; public response không lộ private SDK records hoặc credentials.
- Accept request lưu full basis, job, installation identity, request digest, command ID và acceptance ID trước SDK mutation. Receipt/audit lưu cùng một SQLite transaction; nếu ghi audit thất bại thì receipt update cũng rollback. Request lease 120 giây, bridge accept timeout 60 giây; đây là giới hạn server, không phải SLA.
- Request cũ replay đúng command/job/basis đã lưu trước mọi kiểm stale/witness mới. Response `receipt` là lịch sử ổn định; `execution_view` đọc mới sau khi receipt/audit đã durable. Retry sau mutation khác có thể trả receipt basis cũ và current view basis mới; không ghép hai basis thành cùng một thời điểm.
- Worker đối soát pending accept bằng command/basis cũ sau crash, không tạo accept mới. Accept một job tăng generation nên các job tính trên basis trước đó stale, kể cả khi physical head hash không đổi. Request cạnh tranh khác được SDK CAS quyết định, không tự gắn job cũ vào basis mới.

## Kết quả kiểm tra

| Hạng mục | Kết quả |
| --- | --- |
| Bộ test cuối | **202 passed**, 0 failures/errors/skips; 26.89 giây |
| Acceptance cases | 51 case mới; 151 case M3-02–04 tiếp tục đạt |
| Native S0 | COMPLETED/FEASIBLE, witness VALIDATED; accept 200, generation tăng đúng một |
| Physical state | Hash các field physical trước/sau trùng nhau; head/binding ngoài generation giữ nguyên |
| Retry/audit | Cùng ID giữ receipt, không thêm generation; đúng một audit |
| Preconditions | Queued/FAILED no-witness, revision thiếu/sai, sai owner, old job basis bị từ chối |
| Restart | API + worker restart giữ active job, exact state, receipt và một audit |
| Frozen M2 | TEAM_HANDOFF_BYTES_VERIFIED; 149 entries/141 inventory pins, build giữ nguyên |

Kiểm thử bổ sung dùng SQLite trigger để lỗi audit INSERT xảy ra sau response UPDATE, xác nhận cả transaction rollback. Barrier test cho hai certified job cạnh tranh cùng basis chứng minh một activation và request còn lại `409 STALE_HEAD`. Test uncertain commit rồi head/context/generation thay đổi xác nhận retry giữ command/basis cũ, trả historical receipt và live view mới. Các case còn lại bao phủ strict JSON/revision, owner/role/namespace, RETURN_ONLY, witness/null, response binding, lỗi metadata/SDK/read và worker reconciliation.

Unit cuối ở `D:\MLAI4\.local\m3-step7\receipts\m3_step5_20261005_155023`. Native ở `D:\MLAI4\.local\m3-step7\receipts\m3_step5_20261005_154711`. Giữa native và bộ unit cuối chỉ bổ sung ba test; hash production đã được đối chiếu bằng manifest, không thay mã đã native-verify. Có một warning deprecation Starlette TestClient/httpx, không có test failure và dependency lock giữ nguyên.

[Báo cáo máy đọc](M3_STEP5_ACCEPTANCE_20261005.json), [receipt native](M3_STEP5_NATIVE_ACCEPT_20261005.json), [API accept cho M4](M3_ACCEPT_API_HANDOFF.md), [OpenAPI](M3_OPENAPI_20261005.json), [handoff HTTP và lệnh chạy](M3_API_HANDOFF.md).

## Phạm vi còn lại

Đã hoàn thành **M3-05 P0 accept**, chưa triển khai P1 so sánh profile. Bước tiếp theo **M3-06: event/replay**; G2 đầy đủ chưa chốt vì chưa có observed advance/apply_event qua HTTP. Outbox/artifacts, full E2E/offline và benchmark thuộc các bước sau. Helper native API/worker đã dừng; private session/result/accept audit giữ lại làm bằng chứng.

Các giới hạn Step 7 còn nguyên: `GENERAL_M1_NOT_VALIDATED`, `E4_NOT_RUN`, `PRODUCTION_CALIBRATION_UNCONFIGURED`, performance `NOT_MET`, `SIMULATED_REPLAY_NOT_GPS`; S7 cold SEARCH_LIMIT chưa chứng minh infeasible. Leader deployment review còn pending. Kết quả này xác nhận local backend accept trên package/source đã pin; số đo thời gian không chứng nhận SLA hoặc deployment.
