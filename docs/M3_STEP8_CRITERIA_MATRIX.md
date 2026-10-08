# Bảng 11 tiêu chí backend Member 3 — P0 và P1

**Kết quả:** 9 PASS, 2 PASS có phạm vi công bố; không có tiêu chí FAIL. Full frontend E2E/G3 toàn nhóm vẫn chờ M4.

| # | Tiêu chí | Kết quả | Bằng chứng/phạm vi |
| --- | --- | --- | --- |
| 1 | Completed prefix không đổi | PASS | Observed delivered ID prefix được giữ qua event/accept/replay; raw causal journal kiểm từng mutation. |
| 2 | Không phục vụ trùng | PASS | 31 partition certified delivered/planned/unserved đúng universe và không trùng ID; retry giữ receipt. |
| 3 | Capacity/load/cargo | PASS | 80 kiểm load theo capacity fixture và tổng demand ONBOARD; raw all-column validation đạt. |
| 4 | Time windows | PASS | Sáu fresh witness có VALIDATED; public bound-session validator kiểm lại raw selected/all columns từ source đã pin. |
| 5 | Ca làm việc/return/reload | PASS | Independent raw phase/route validator kiểm hành động và return/continuation của witness; không chỉ stop cuối. |
| 6 | Có thể tái lập | PASS_SCOPED | Hai job BALANCED cùng full basis: cold domain và certified warm reuse có cùng public coverage semantics; retry giữ job. Không cam kết cold optimum/timing/telemetry determinism tổng quát. |
| 7 | ONBOARD giữ owner | PASS | S3 owner V1 giữ O001, O004, O005; unavailable/replan/replay không chuyển custody. |
| 8 | Không teleport | PASS | Accept giữ nguyên physical vehicles; event giữ position/load/range/observed prefix; raw anchor/causal validator kiểm replan và replay. |
| 9 | Narrative khớp JSON | PASS_BACKEND | 0.8.0: narrative hai phiên native khớp public metrics/basis/null/units; trade-off chỉ theo SDK COMPARABLE, NON_COMPARABLE không có bảng; export /2 giữ đúng JSON. Text/layout trên UI thật còn chờ M4. |
| 10 | Safety là PROXY | PASS | Fresh S3 export giữ EXPOSURE_IS_PROXY, SIMULATED_REPLAY và lineage; không gọi exposure là xác suất tai nạn. |
| 11 | Offline | PASS_SCOPED | Fresh localhost HTTP/worker/SDK/native solver thực chạy dưới Python socket denial, mỗi process có bốn denial self-probes; không có external attempt ngoài probes. Không chứng nhận OS air-gap/security sandbox. |

Fresh native: S2/S3/S4, 6 certified witness, thêm 2 job S0 để kiểm cùng basis; 40 execution frame được đối chiếu, không dùng seed/witness lịch sử. SDK independent validation của cả ba phiên đạt. Native SHA-256 `e593f240653523c59a1512ce5ceae30105497ca67aa782861068d33bb2055568`. Regression: 555 cases đạt, không failure/error/skip, JUnit SHA `404b2c83318fb2f9d2b5f61691f5e1f212e9d5282d9a51f36ab0e5fbb726736e`.

Portable/reference consumer và frozen byte checker có 11 checks đạt; portable không thay thế native hoặc frontend. Receipt SHA `b123299ce0418c97829eb664723c7c116c861aa07daf480f46babf3a034a3fdf`.

No-witness/null/coverage chưa đánh giá không được gán infeasible. Giữ GENERAL_M1_NOT_VALIDATED, E4_NOT_RUN, PRODUCTION_CALIBRATION_UNCONFIGURED, PERFORMANCE_NOT_MET, SIMULATED_REPLAY_NOT_GPS, EXPOSURE_IS_PROXY, NOT_OPTIMALITY; S4 synthetic what-if, S7 cold SEARCH_LIMIT chưa chứng minh infeasible. P1 comparison/autoplay/narrative/mock đã hoàn tất ở 0.8.0. Bằng chứng P0 bên trên giữ mốc 0.7.0; bổ sung hiện hành: 815 tests và 5 native SDK child/job, xem báo cáo hoàn tất. Xem runbook và M4 checklist; báo cáo nghiệm thu/release hash được giao riêng ngoài kit để không tạo vòng hash.
