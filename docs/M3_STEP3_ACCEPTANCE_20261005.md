# Nghiệm thu M3-03 — Catalog, phiên và read API

**Ngày:** 05/10/2026, hoàn tất native test lúc 14:50:47 giờ Việt Nam.  
**Root:** `D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN`.  
**Kết quả:** `M3_STEP3_SESSION_READ_PASS`; đủ điều kiện kỹ thuật bắt đầu **M3-04 — optimize, durable queue và compute worker**.

## Phần đã thực hiện

- Catalog S0–S8 và metadata/version/seed/counts đọc từ source thật đã pin. Startup xác minh G0 binding, production inventory digest và trusted M1 receipt; kiểm SHA-256 catalog và chín fixtures. Catalog/fixture decode một lần, các API kiểm lại raw hash khi dùng.
- POST load tạo session server-owned, persist owner/scenario/install identity và request/command ID trước public SDK bootstrap. Retry cùng actor/request/scenario trả receipt cũ; đổi nội dung trả 409. Lease/fencing cho bootstrap, retry dùng cùng binding sau timeout/gián đoạn.
- Metadata SQLite M3 nâng schema cũ an toàn; lưu request receipt và ownership. Trạng thái vật lý hiện hành đọc bằng public RuntimeClient, không dùng receipt làm nguồn state.
- GET metadata/state/orders/vehicles/locations kiểm owner trước SDK. State giữ `execution-view/2`; orders/locations kết hợp static fixture đã pin với current view. Xe giữ custody/load/position từ SDK. Đơn gấp S2 chỉ xuất hiện trong projection khi ID đã có ở runtime view.
- Giữ exact strings/rational/null, tọa độ WGS84 `[lng,lat]`; đổi static fixture h/km sang s/m. View chưa observation giữ `observed_metrics=null`.
- Readiness thêm check catalog; OpenAPI bổ sung endpoint thật và LoadScenarioRequest. Các model mutation tiếp theo vẫn reserved.

## Kết quả kiểm tra

| Hạng mục | Kết quả |
| --- | --- |
| Toàn bộ backend pytest | **79 passed**, 6.68 giây, 0 failed/errors |
| HTTP/Uvicorn + SDK thật | **S0–S8: 9/9 load/state/orders PASS** |
| S0 phiên thứ hai cùng fixture | Session ID khác, view ban đầu độc lập |
| Retry cùng request ID | Cùng data receipt/session, không bootstrap lại |
| Request ID cùng actor nhưng đổi scenario | HTTP 409 |
| Actor khác đọc metadata/state/orders/vehicles/locations | Cả 5 route trả 403 |
| S0 vehicles/locations | 2 xe, 1 depot + 3 delivery points |
| Restart HTTP process | Owner/load receipt còn nguyên; SDK state đọc tiếp thành công |
| SDK view sau load | Đúng counts/build pin, active job null, observed metrics null |
| `/ready` | 503; G0/auth/metadata/runtime/catalog PASS, worker WORKER_NOT_CONFIGURED |
| Frozen M2 checker | TEAM_HANDOFF_BYTES_VERIFIED, 149/149 entries, 141 production pins, inventory matches |

22 test mới dùng fixture được gắn `TEST_ONLY` và FakeGateway để kiểm retry, lease hết hạn/fencing, owner, source thay byte, installation đổi, schema migration, unit conversion và status/custody. Test gián đoạn sau commit là kiểm mô phỏng ở unit layer; native restart kiểm process khởi động lại sau các request đã hoàn tất. Không coi chúng là nghiệm thu crash giữa compute hoặc event/replay.

Một deprecation warning từ Starlette TestClient/httpx còn như M3-02; không có lỗi test. Native smoke dùng socket Uvicorn thật, interpreter runtime riêng và public SDK.

## Bàn giao

- [HTTP handoff chung](M3_API_HANDOFF.md), [luồng load/read cho M4](M3_SESSION_API_HANDOFF.md), [OpenAPI hiện hành](M3_OPENAPI_20261005.json).
- [Acceptance JSON](M3_STEP3_ACCEPTANCE_20261005.json), [native sessions receipt](M3_STEP3_NATIVE_SESSIONS_20261005.json).
- [Scenario router](../backend/api/routers/scenarios.py), [session router](../backend/api/routers/sessions.py), [session service](../backend/services/session_service.py), [catalog](../backend/services/scenario_catalog.py).
- Receipt/log/JUnit gốc: `D:\MLAI4\.local\m3-step7\receipts\m3_step3_20261005_144849`.
- Private metadata và authority: `D:\MLAI4\.local\m3-step7\backend\metadata.sqlite`, `D:\MLAI4\.local\m3-step7\state\backend_authority.sqlite`.

Native smoke tạo 10 phiên private (S0–S8 và S0 thứ hai) và giữ chúng cùng receipts để truy vết. Server smoke đã dừng. Khởi chạy lại bằng launcher trong handoff khi cần dùng API.

## Phần tiếp theo và giới hạn

M3-04 sẽ thêm submit/poll/cancel, durable queue, compute worker và heartbeat thực tế. Chưa có G1 optimize, accepted plan, event/replay hoặc frontend E2E ở M3-03. Snapshot/build/runtime M2 giữ pin hiện hành; review deployment vẫn pending Leader theo receipt M3-01. Các giới hạn Step 7 về simulated replay, calibration, general M1, E4 và performance vẫn còn nguyên.
