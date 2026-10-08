# Nghiệm thu M3-02 — Khung FastAPI và contract HTTP

**Ngày:** 05/10/2026, 14:24 giờ Việt Nam.  
**Root:** `D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN`.  
**Kết quả:** `M3_STEP2_FOUNDATION_PASS`; đủ điều kiện kỹ thuật bắt đầu **M3-03 — catalog, phiên và read API**.

Đầu vào G0 của M3-01 đã đạt trên MLAI4. Bước này triển khai nền HTTP, xác thực, contract và bridge capabilities bằng SDK thật. Chưa nghiệm thu load/optimize/accept/event/replay hoặc frontend E2E.

## Phần đã thực hiện

- App FastAPI, factory/lifespan/router; `/health`, `/ready`, `/docs`, `/openapi.json` và endpoint bearer-protected `/api/runtime/capabilities`.
- HTTP models riêng, strict types, từ chối field lạ. Chuẩn bị request models cho load/optimize/accept/event/replay/cancel trong OpenAPI và ghi rõ reserved.
- JSON boundary kiểm byte trước FastAPI: duplicate keys, nonfinite/overflow, unsafe integer tokens, UTF-8, root object, nesting và giới hạn body 1 MiB.
- Envelope `saferoute-m3-http-response/1`; diagnostics code/path/message; request ID server, process time và audit lấy actor từ token server. Không log token hoặc body.
- Bearer token hash, role dispatcher/viewer, dependency kiểm owner phiên với SQLite metadata M3. Ownership được kiểm bằng route test; route phiên thực tế sẽ nối ở M3-03.
- CORS origin cụ thể và preflight frontend. Error/auth response cho origin được phép vẫn có CORS headers.
- Gateway subprocess riêng sử dụng interpreter runtime `-I -B`; xác minh production inventory trước import; gọi public `RuntimeClient`, kiểm build/schema/capability. Runtime lỗi trả 503, không trả mock.
- Venv backend và dependency lock riêng; launcher Python không cần thay ExecutionPolicy; credentials/state/receipt nằm ngoài cây project.

## Bằng chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Backend pytest | **57 passed**, 3.05 giây |
| `/health` qua Uvicorn socket thật | 200 |
| Capabilities không token | 401 |
| Capabilities token hợp lệ + SDK native | 200, schema `task02-m2-runtime-capabilities/1`, build pin khớp |
| `/ready` với dependency hiện tại | **503**, G0/auth/metadata/runtime PASS, worker `WORKER_NOT_CONFIGURED` |
| Preflight frontend qua socket thật | 200, origin `http://localhost:5173` |
| OpenAPI qua socket thật | 200, auth và request schemas xuất được |
| Checker M2 sau triển khai | `TEAM_HANDOFF_BYTES_VERIFIED`, 149/149 runtime entries, 141 production pins, team inventory matches |

57 test bao phủ JSON malformed/duplicate/nonfinite/unsafe/depth/body/MIME, client override, int64 string/revision/timezone, auth/revocation/role/owner, CORS, lỗi không lộ chi tiết, audit, readiness và ranh giới gateway. Kiểm giữ exact integer strings/rational/null sử dụng typed fixture chỉ trong test. Capabilities qua HTTP dùng runtime đã cài thật.

Test suite có một deprecation warning từ Starlette TestClient khi dùng httpx; không có lỗi test. Dependency này đã pin và smoke qua socket thật không phụ thuộc TestClient.

Readiness 200 đã được kiểm với heartbeat fixture trong test. **Chưa có compute worker thật hoặc heartbeat thật.** Readiness 503 là hành vi đúng của M3-02, không phải lỗi bị bỏ qua. Không tạo heartbeat để giả lập sẵn sàng trong môi trường chạy.

## File và môi trường bàn giao

- [App FastAPI](../backend/api/main.py), [HTTP models](../backend/models/http.py), [runtime gateway](../backend/services/runtime_gateway.py).
- [Bàn giao cho M4 và cách chạy](M3_API_HANDOFF.md).
- [Kết quả JSON](M3_STEP2_ACCEPTANCE_20261005.json), [native HTTP receipt](M3_STEP2_NATIVE_HTTP_20261005.json), [OpenAPI export](M3_OPENAPI_20261005.json).
- Pytest/JUnit/log gốc: `D:\MLAI4\.local\m3-step7\receipts\m3_step2_20261005_142409`.
- Backend interpreter: `D:\MLAI4\.local\m3-step7\backend-venv\Scripts\python.exe` — Windows CPython 3.12.14.
- Runtime interpreter giữ nguyên: `D:\MLAI4\.local\m3-step7\venv\Scripts\python.exe`.
- Backend metadata: `D:\MLAI4\.local\m3-step7\backend\metadata.sqlite`; authority SDK: `D:\MLAI4\.local\m3-step7\state\backend_authority.sqlite`.
- Token local: `D:\MLAI4\.local\m3-step7\backend\dev_access.json`; không chép token vào tài liệu/project.

Server smoke đã dừng sau kiểm thử; chưa để service chạy nền. Chạy launcher trong tài liệu M4 để mở API tại `http://127.0.0.1:8000`.

## Bước tiếp theo

M3-03 cần đọc catalog S0–S8 đã pin, tạo session/owner bền vững, bootstrap/resolve bằng SDK và expose read projection. Nối dependency owner trước các route phiên và giữ `observed_metrics=null` khi chưa có observation. M3-04 sẽ bổ sung durable queue, compute worker và heartbeat thực tế trước khi `/ready` chuyển 200.

Trạng thái review deployment ở receipt M3-01 vẫn pending Leader. Kết quả này là nghiệm thu phát triển local M3-02; không thay receipt phát hành M2 hoặc chứng nhận solver/E2E/production. Các giới hạn Step 7 còn nguyên: SIMULATED_REPLAY không phải GPS, calibration unconfigured, GENERAL_M1_NOT_VALIDATED, E4_NOT_RUN và performance NOT_MET.
