# M3-01 — Kiểm lại bản tải MLAI4

**Ngày:** 05/10/2026, UTC+07:00.  
**Kết quả kỹ thuật:** `G0_TECHNICAL_PASS`.  
**Độ đầy đủ đầu vào bước 1:** `COMPLETE_VERIFIED`.  
**Root dự án và snapshot đang dùng:** `D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN`.

## Kết quả

| Kiểm tra | Kết quả |
| --- | --- |
| Production inventory | PASS |
| Cây team: M2 official checker | PASS: TEAM_HANDOFF_BYTES_VERIFIED |
| Actual source DB/fixtures | PASS |
| M1 verify-scenarios | PASS |
| M2 source gate | PASS: DECISION_STATE_ADAPTER_READY |
| Exact environment | PASS |
| Native RECORD/import/CP-SAT smoke | PASS: ENVIRONMENT_READY |
| Python portable | PASS: PORTABLE_PYTHON_PASS / 28 |
| Python portable -O | PASS: PORTABLE_PYTHON_PASS / 28 |
| Python golden | PASS: GOLDEN_PASS / 60 |
| Python golden -O | PASS: GOLDEN_PASS / 60 |
| Node portable | PASS: PORTABLE_JS_PASS / 13 |
| Node golden | PASS: GOLDEN_PASS / 60 |
| API v1 portable | PASS |
| M4 reference S2 | PASS: M3_RUNTIME_M4_REFERENCE_FLOW_PASS |
| M4 reference S3 | PASS: M3_RUNTIME_M4_REFERENCE_FLOW_PASS |
| M4 reference S4 | PASS: M3_RUNTIME_M4_REFERENCE_FLOW_PASS |
| S0 bootstrap/resolve | PASS: G0_BOOTSTRAP_RESOLVE_PASS |
| Source sau native checks | PASS |
| Inventory sau native checks | PASS |

API v1: **46 passed in 8.94s**. Official M2 checker: 149 runtime entries, 141 production pins; `team_root_production_inventory_matches=True`.

## So với bản MLAI3

Bản MLAI4 có `travel/travel.sqlite` và `shared/examples/S2_execution_view.json`. Toàn bộ 155 file trong upload map được đối chiếu kích thước và SHA-256; kết quả `PASS`.

Không còn file thiếu/sai hash trong upload map đã kiểm.

Snapshot của lần kiểm này lấy trực tiếp từ MLAI4; không dùng source thay thế ở `D:\dev_MLAI`. CLI M1 dùng interpreter kiểm tra đã có ở đó; runtime Python, package và private store được tạo riêng trong MLAI4. Không sửa fixture, manifest, config M2 hoặc các SQLite để làm cho test đạt.

## Installation dùng cho backend tiếp theo

| Thành phần | Giá trị |
| --- | --- |
| Runtime root | `D:\MLAI4\.local\m3-step7\runtime_STEP7_80694f51` |
| Integration root | `D:\MLAI4\.local\m3-step7\integration_STEP7_80694f51` |
| Runtime Python | `D:\MLAI4\.local\m3-step7\venv\Scripts\python.exe` |
| Snapshot root | `D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN` |
| Private state parent | `D:\MLAI4\.local\m3-step7\state` |
| Server config | [installation.json](../../../.local/m3-step7/installation.json) |
| Receipt | `D:\MLAI4\.local\m3-step7\receipts\20261005_134757_301319` |
| Build | `80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41` |

## Bằng chứng và chạy lại

- [Preflight JSON](M3_STEP1_PREFLIGHT_20261005.json): lệnh, exit codes, pin/environment/source receipts và đường dẫn log.
- [Script Python](../backend/scripts/preflight_m3.py) và [wrapper PowerShell](../backend/scripts/Run-M3Preflight.ps1).
- Kế hoạch đã chép sang [docs của MLAI4](M3_BACKEND_IMPLEMENTATION_PLAN_20261005.md); bản gốc ở MLAI3 được giữ để truy lại lịch sử.

Từ root dự án MLAI4, dùng Python trực tiếp (PowerShell trên máy hiện chặn chạy file `.ps1`; không thay đổi execution policy):

```powershell
& 'D:\MLAI4\.local\m3-step7\venv\Scripts\python.exe' -B backend/scripts/preflight_m3.py `
  --team-root . --snapshot-root . --local-root 'D:\MLAI4\.local\m3-step7' --native `
  --m1-python 'D:\dev_MLAI\SafeRouteVN_Project_Structure_PLAN\.venv\Scripts\python.exe'
```

Mỗi native run tạo receipt và store S0 mới. Store smoke không phải authority store của backend vận hành. G0 kiểm môi trường/source/contract và bootstrap/resolve; chưa nghiệm thu optimize, accept, events, frontend E2E hay performance.

Review deployment/build/environment vẫn `PENDING_LEADER_REVIEW` theo handoff. Các giới hạn M2 như `GENERAL_M1_NOT_VALIDATED`, `E4_NOT_RUN`, `PRODUCTION_CALIBRATION_UNCONFIGURED` và performance `NOT_MET` được giữ nguyên. Backend trong bản tải mới vẫn cần triển khai từ M3-02.
