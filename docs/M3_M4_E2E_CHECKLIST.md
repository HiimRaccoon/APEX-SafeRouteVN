# M3–M4: checklist tích hợp và biên bản E2E

**Trạng thái frontend: PENDING_M4_SOURCE.** `frontend/` hiện chỉ có README, chưa có UI/API client/browser harness. Backend HTTP/native/reference-consumer không chứng nhận thao tác hoặc hình ảnh trên UI. M4 ghi từng kết quả và frame/screenshot thực tế khi code sẵn sàng.

Backend 0.8.0 đã bổ sung API để kiểm comparison FASTEST/BALANCED/SAFER, no-witness/NON_COMPARABLE, start/speed/pause/restart fencing và narrative. Dùng [handoff bổ sung](M3_COMPLETION_API_HANDOFF.md); bundle mới có 12 file, bundle /1 cũ có 11 file. M4 kiểm thêm `in_flight`/`fully_paused`, dừng event barrier, và text khớp scope/units/null của narrative.

| Luồng cần kiểm | Dữ liệu/semantics bắt buộc | Kết quả UI |
| --- | --- | --- |
| Catalog/load S2/S3/S4 | Fixture/build pin; session thuộc actor; load retry giữ session | PENDING |
| Optimize/poll/cancel | HTTP 202; loading/backoff; COMPLETED/FAILED/no-witness; cancel race; compute giữ physical head | PENDING |
| Comparison và trade-off | Ba profile; new/existing jobs; SDK COMPARABLE/NON_COMPARABLE; no-witness giữ null; historical basis/domain; cancel/retry | PENDING |
| Accept | Full basis server; 409 stale/conflict; gen tăng một; forecast chưa tăng delivered | PENDING |
| Event barrier và replay | Event không áp dụng sớm; STEP không vượt barrier; apply/retry đúng một; reaccept sau event | PENDING |
| S2 urgent order | O009 thêm đúng một; observed prefix giữ nguyên | PENDING |
| S3 unavailable custody | V1 giữ cargo ONBOARD; không gán qua xe khác; hiển thị reason/unserved đúng | PENDING |
| S4 synthetic rain | WHAT-IF/overlay và simulation timestamps; không diễn giải là dự báo thực | PENDING |
| Metrics và counters | Integer strings giữ exactness; null giữ null; scope OBSERVED/FORECAST tách rõ | PENDING |
| Geometry | Typed execution-view/2; AT_NODE/AT_EDGE/progress; reload/return-only/continuation; forecast/observed khác lớp | PENDING |
| Pause/reset/history | Pause receipt; reset session mới, không rewind phiên cũ; retry không nhân history | PENDING |
| Autoplay/speed/restart | Speed 1/2/4/8 đổi cadence; in_flight/fully_paused; exact event barrier/final return; restart không tự resume | PENDING |
| Narrative | Số liệu/units/null khớp JSON; observed và forecast riêng; comparison historical chỉ có bảng khi SDK COMPARABLE | PENDING |
| Mock adapter | Process/token riêng; nhãn MOCK_DEMO và pinned fixture hash; không dùng mock làm fallback cho lỗi native | PENDING |
| Notifications/artifacts | Canonical string cursor; summaries/ack status; manifest /1 11 file hoặc /2 12 file UTF-8/hash; owner 401/403 | PENDING |
| Offline/restart | Chạy cùng backend offline đã cài; UI refresh/reload giữ head/receipt; mọi asset phải local | PENDING |

Routes/payloads/status/error envelope hiện hành nằm trong [M3_OPENAPI_20261006.json](M3_OPENAPI_20261006.json) và các handoff API. App 0.8.0 thêm comparison/autoplay/narrative; HTTP envelope `/1` và các public SDK contracts Step 7 vẫn giữ version đã pin. Artifact manifest/bundle mới dùng `/2`; bundle `/1` lịch sử vẫn đọc nguyên byte. Browser không gửi path/build/source/budget/raw state. Token lấy từ người vận hành của installation demo, không hard-code vào bundle UI. Giữ explicit CORS origin và `Cache-Control: no-store` semantics.

M4 giải nén đầy đủ 182 file của Integration ZIP và chạy portable/corpus checks theo crosswalk M2; dùng canonical SDK/job-view/1 và execution-view/2 supplemental. Frozen API v1 không tự có generic dynamic plan; `public_api_v1_dynamic_plan_available=false` phải được hiển thị đúng. Reference consumers/portable corpus tách khỏi E2E browser.

Biên bản M4 cần: commit/source hash UI, backend release/SDK build, installation/environment receipt, scenario/session, thời điểm chạy, case result, lỗi và screenshot/frame tương ứng. Mọi trường PENDING ở bảng trên chỉ được đổi khi có UI thật. Comparison/autoplay/narrative đã triển khai trong backend 0.8.0; nghiệm thu backend xem báo cáo và receipt riêng. Browser/UI E2E, full G3 toàn nhóm và Leader production deployment approval vẫn chờ; E4/calibration/performance giữ giới hạn đã công bố.
