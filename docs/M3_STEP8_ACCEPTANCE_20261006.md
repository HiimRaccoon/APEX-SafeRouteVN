# Nghiệm thu phần backend M3-08 — 06/10/2026

**M3_STEP8_BACKEND_RELEASE_CANDIDATE_PASS / G3_BACKEND_RC_PASS.** Backend HTTP `0.7.0`, operations `M3-08/1`, SDK build đã pin `80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41`. Full G3 toàn nhóm và frontend/browser E2E chờ M4; frontend hiện chỉ có README.

- **555 tests đạt**, không failure/error/skip; thêm 52 tests offline/release integrity và SQLite contention. Có một Starlette/httpx deprecation warning đã tồn tại từ các bước trước.
- Fresh native S2/S3/S4 qua HTTP/worker thực: compute/accept, event barrier, pause/advance/retry/reset/replan và public SDK independent raw/causal validation đạt. Sáu witness mới và hai job S0 cold/warm cùng basis được kiểm; không dùng witness/seed lịch sử. PARTIAL/unserved và phạm vi finite domain được giữ đúng receipt.
- Có **2** transient BUSY poll retry được ghi nhận trong lần native cuối: retry có giới hạn, giữ job/basis/physical head; không bỏ qua STORE_INVALID hoặc lỗi dữ liệu.
- 11 tiêu chí: **8 PASS, 2 PASS có phạm vi công bố, 1 không áp dụng backend**. Tái lập chỉ khẳng định public certified coverage semantics cho cặp cùng basis đã chạy; narrative endpoint chưa có. [Matrix](M3_STEP8_CRITERIA_MATRIX.md).
- Offline policy có log denial self-test trong API, worker, SDK bridge và native solver child thực; localhost HTTP hoạt động, không ghi nhận external attempt ngoài probes. Đây là **Python socket policy**, không chứng nhận OS air-gap/security sandbox. SDK source giữ nguyên; M3 wrapper chỉ bảo vệ child do public SDK compute tạo, không tạo/validate solver result riêng.
- Distinct worker restart giữ full head của bốn phiên, replay receipts và exact artifact bytes. Fresh export S3 có 11 tài liệu và exposure PROXY. Owner/auth/no-admin-HTTP đạt; helper dừng sạch, không forced stop.
- **11 checks portable/reference/frozen byte đạt**, có Python thường/`-O`, JS, frozen API v1 và M4 reference S2/S3/S4. Reference consumer không phải browser E2E.
- Candidate và gói cuối đều cài thực tế vào hai venv mới bằng **no-index + required wheel hashes**, pip check, native CP-SAT smoke/source/inventory đạt. Launcher gói cuối đã READY qua HTTP rồi dừng cả hai child với exit 0, không forced stop.

Lần native đầu được giữ nguyên với trạng thái FAIL khi polling S0 nhận HTTP 503/STORE_INVALID. SQLite integrity vẫn `ok`, cả bảy job đã hoàn tất và bảy native child có log; bộ đếm sáu solve trong report lỗi chỉ tính các kịch bản đã kiểm xong. Real pinned SDK trên disposable store tái hiện SQLite contention bị bọc thành STORE_INVALID; nguyên nhân của lần lỗi được ghi là suy luận vì response gốc không có cause. Bridge M3 chỉ ánh xạ typed BUSY/LOCKED cause sang RUNTIME_BUSY, poll GET retry có giới hạn; lỗi hỏng dữ liệu vẫn bị chặn. Lần nghiệm thu cuối dùng installation mới và chạy lại toàn bộ. [Chẩn đoán và đường dẫn trial gốc](M3_STEP8_TRIAL01_DIAGNOSIS_20261006.json).

Gói: `D:\MLAI4\releases\M3_backend_RC_20261006_011614.zip` (56,404,074 bytes). ZIP SHA-256 `d685bb20e581ef36263a8bd59758eebaf7c3db3d4f37e4984d4444d2eac91b2a`. Manifest SHA-256 `7be0baad7b00358634fae8250a15526679e1c66c03e12c057e44c7894016f975`. Gói không có credentials/authority/metadata/installation/venvs/M1 DB/Python executable/frontend; cần approved CPython và team snapshot/G0 đã xác minh theo [runbook](M3_OPERATIONS_RUNBOOK.md).

Startup trên installation kiểm tra mới: **4.52s**, sau restart **341.00s**. Số này gắn với lịch sử của lần kiểm tra này, không phải SLA hoặc benchmark so sánh. Installation cũ 30 phiên ở M3-07 đã startup khoảng 19 phút; `PERFORMANCE_NOT_MET` vẫn giữ.

Giữ GENERAL_M1_NOT_VALIDATED, E4_NOT_RUN, PRODUCTION_CALIBRATION_UNCONFIGURED, SIMULATED_REPLAY_NOT_GPS, EXPOSURE_IS_PROXY, NOT_OPTIMALITY. S4 synthetic what-if; S7 cold SEARCH_LIMIT không chứng minh infeasible. P1 comparison/autoplay còn pending. [M4 checklist](M3_M4_E2E_CHECKLIST.md) ghi từng case UI PENDING để M4 tiếp nhận.

Bằng chứng: [acceptance JSON](M3_STEP8_ACCEPTANCE_20261006.json), [native offline](M3_STEP8_NATIVE_OFFLINE_20261006.json), [portable](M3_STEP8_PORTABLE_20261006.json), [HTTP handoff](M3_API_HANDOFF.md). Native receipt SHA `e593f240653523c59a1512ce5ceae30105497ca67aa782861068d33bb2055568`; JUnit SHA `404b2c83318fb2f9d2b5f61691f5e1f212e9d5282d9a51f36ab0e5fbb726736e`. Các source/manifest/frames/audit/installer/launcher hashes được đối chiếu trước publication.
