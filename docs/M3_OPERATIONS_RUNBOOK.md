# Vận hành backend M3 — phiên bản 0.8.0

App HTTP `0.8.0`, operations revision `M3-COMPLETE/1`. Runtime build `80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41`. Đây là gói backend để tiếp nhận trên team tree đã có source M1/M2; trạng thái nghiệm thu xem [báo cáo hoàn tất](M3_COMPLETION_ACCEPTANCE_20261006.md), không suy ra từ tên gói. [API bổ sung](M3_COMPLETION_API_HANDOFF.md) mô tả comparison, autoplay, narrative và mock riêng.

Installer tạo token mock riêng tại `<local-root>/backend/mock_token.txt`; đặt `SAFEROUTE_MOCK_TOKEN_FILE` bằng đường dẫn này khi chủ động chạy demo. Không ghi token vào source hoặc frontend. Worker shutdown/restart fence autoplay; muốn chạy tiếp phải start lại với revision hiện hành. Pause chỉ hoàn tất khi `fully_paused=true`.

Các tài liệu bằng chứng sau được giao kèm tại `docs/` của team tree, ngoài ZIP backend. Khi đọc handoff trong thư mục giải nén gói, mở các liên kết này từ team tree đã tiếp nhận:

- `M3_BACKEND_IMPLEMENTATION_PLAN_20261005.md` — liên kết trong `backend/README.md`.
- `M3_STEP4_ACCEPTANCE_20261005.md` — liên kết trong `M3_JOB_API_HANDOFF.md`.
- `M3_STEP5_ACCEPTANCE_20261005.md` — liên kết trong `M3_ACCEPT_API_HANDOFF.md`.
- `M3_STEP6_ACCEPTANCE_20261005.md` — liên kết trong `M3_EVENT_REPLAY_API_HANDOFF.md`.
- `M3_OPENAPI_20261005.json` — contract lịch sử được `M3_SESSION_API_HANDOFF.md` tham chiếu; contract hiện hành `M3_OPENAPI_20261006.json` có trong gói.
- `M3_COMPLETION_ACCEPTANCE_20261006.md` — báo cáo hoàn tất được liên kết ở đầu runbook, cùng receipt JSON giao kèm sau khi đóng gói.

Báo cáo hoàn tất chứa SHA-256 của ZIP và manifest cuối, nên nằm ngoài ZIP để tránh vòng hash. Dùng báo cáo giao nhận qua kênh tin cậy để đối chiếu các digest; tên gói hoặc nội dung handoff không thay kết quả nghiệm thu.

## Điều kiện cài đặt

- Windows CPython 3.12 x64 đã được nhóm tiếp nhận. Python executable không nằm trong gói.
- Team tree có đủ M2 upload map và snapshot M1 đã pin, với G0 `COMPLETE_VERIFIED` đúng project root. Không đổi simulation epoch theo ngày thực.
- Một private local root **mới**, nằm ngoài project và ngoài thư mục gói. Authority/metadata/auth/venv của lần cài trước được giữ nguyên.
- Đối chiếu SHA-256 ZIP và `release_manifest.json` với báo cáo giao nhận qua kênh tin cậy. Manifest là kiểm tra bytes, không phải chữ ký số hay phê duyệt triển khai của Leader.

Giải nén gói vào thư mục mới sau khi kiểm tra ZIP hash. Installer kiểm đủ file/hash, hai ZIP M2 và wheel metadata/version trước khi dùng. Backend trong team tree phải khớp gói đã tiếp nhận; installer báo lỗi khi khác bytes, không tự ghi đè source. Gói không chứa M1 DB, bearer, authority, metadata, installation config hoặc venv.

```powershell
$M3Python = 'C:\Users\ADMIN\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$M3Team = 'D:\MLAI4\Apex-SafeRouteVN\SafeRouteVN_Project_Structure_PLAN'
$M3Kit = 'D:\MLAI4\releases\<release-directory>'
$M3Local = 'D:\MLAI4\.local\<new-installation-directory>'
& $M3Python -B "$M3Kit\backend\scripts\install_backend_offline.py" --release-dir $M3Kit --expected-manifest-sha256 '<SHA từ báo cáo>' --project-root $M3Team --local-root $M3Local --base-python $M3Python --preflight-receipt '<G0 private preflight.json đúng source>'
```

Installer tạo hai venv riêng, cài wheel bằng `--no-index --no-deps --require-hashes`, chạy `pip check`, native NumPy/pandas/CP-SAT smoke, kiểm lại source DB/fixtures và production inventory. G0 source receipt được tái sử dụng có SHA; các kiểm tra environment/source mới có receipt riêng. `deployment_approved=false` được giữ. Lỗi giữ lại installation/receipt `INCOMPLETE/FAIL`; chọn directory mới để thử lại, không xóa dữ liệu để che lỗi.

Credentials demo được sinh mới và chỉ ghi trong `$M3Local\backend\dev_access.json`; auth dùng SHA-256 riêng. Người vận hành cấp token theo môi trường demo cho M4 qua kênh phù hợp. Không đưa token/file này vào repo, gói release, log, screenshot hoặc frontend assets.

## Chạy và dừng

```powershell
& $M3Python -B "$M3Team\backend\scripts\run_backend.py" --local-root $M3Local --port 8000 --offline
```

Launcher không cài package hoặc mở browser; nó chạy API và một worker trong venv backend, dùng localhost và đợi `/ready`. `/health` chỉ báo liveness; `/ready` chỉ đạt sau source/build/auth/worker/gates đã đối soát. CORS nhận origin tường minh; không dùng `*`. `SAFEROUTE_COMPUTE_BUDGET_SECONDS` là cấu hình server trong `(0,600]`, mặc định 60; diễn tập fresh witness ghi riêng budget 120. Replay STEP mặc định 60 simulation seconds, không phải nhịp đồng hồ thực hay autoplay.

Ctrl+C yêu cầu cả hai helper dừng qua control file riêng. Worker chờ các SDK task/receipt đang sở hữu hoàn tất trước khi thả singleton; API drain request. Launcher ghi exit codes và `forced_stop` trong private launch receipt. Nếu vượt shutdown bound, launcher dừng đúng process tree đã tạo và ghi forced stop; lần sau phải đi qua recovery, không sửa/reset authority. `--stop-file <new-absolute-private-path>` hỗ trợ kiểm tra/vận hành bằng trigger riêng, không có HTTP shutdown route.

SDK call thường có bound 60 giây, replay/admin và inspection một phiên 120 giây; compute có budget riêng. Recovery inspection ghép tối đa hai phiên trong một bridge, với bound 120 giây cho mỗi phiên; từng phiên vẫn được recover, validate, resolve và kiểm notifications riêng theo thứ tự. Outbox polling xoay vòng một phiên/lượt, nghỉ 10 giây sau lượt hoàn tất. Installation lịch sử 30 phiên của bản 0.7.0 đã quan sát startup khoảng 19 phút; đây không phải phép đo hiệu năng của bản 0.8.0. `--startup-timeout` là thời hạn người vận hành chờ, không đổi timeout SDK hoặc tạo SLA. Nếu DEGRADED/503, giữ receipt/log và xử lý mã lỗi, không tăng bound để che integrity failure.

## Chế độ offline và kiểm chứng

`--offline` bật `SAFEROUTE_OFFLINE_MODE=loopback-only` và log audit riêng cho API, worker, SDK bridge và native compute child. Mỗi process tự kiểm chặn TCP IPv4/IPv6, UDP và DNS ngoài trước application/SDK import. Localhost HTTP được phép. SDK native worker đi qua M3 entry, kiểm lại package pin rồi chạy module M2 nguyên bytes; lệnh child khác bị từ chối trong SDK bridge offline. Wrapper nhận nguyên argv từ subprocess mà public SDK compute đã tạo; M3 không tự tạo solver input, chạy planner riêng hoặc chứng nhận output. SDK parent vẫn kiểm raw witness và commit theo lease/basis của mình.

Phạm vi bằng chứng: trusted Python processes và socket audit, gồm solver child thực. Không tuyên bố đã ngắt mạng hệ điều hành, chặn mọi native DLL/network stack hoặc tạo security sandbox. Audit hook có giới hạn được mô tả trong [Python documentation](https://docs.python.org/3.12/library/sys.html#sys.addaudithook); các [audit events](https://docs.python.org/3.12/library/audit_events.html) được kiểm bằng real socket tests. Khi nhóm cần chứng nhận air gap, bổ sung test OS/network tại máy demo và ghi receipt riêng.

```powershell
$env:SAFEROUTE_INSTALLATION_CONFIG = "$M3Local\installation.json"
$env:SAFEROUTE_AUTH_FILE = "$M3Local\backend\auth_tokens.json"
$env:SAFEROUTE_METADATA_DB = "$M3Local\backend\metadata.sqlite"
$env:SAFEROUTE_WORKER_HEARTBEAT = "$M3Local\backend\worker_heartbeat.json"
$env:SAFEROUTE_OFFLINE_MODE = 'loopback-only'
$env:SAFEROUTE_OFFLINE_AUDIT_DIR = "$M3Local\receipts\<new-run>\network-audit"
& "$M3Local\backend-venv\Scripts\python.exe" -B "$M3Team\backend\scripts\verify_step8.py" --output "$M3Local\receipts\<new-run>\native_offline.json" --budget-seconds 120
```

Dùng installation kiểm tra riêng mới: lệnh tạo phiên và solve thật, không chạy trên authority demo đang dùng. Kết quả native, unit, portable, frontend và performance được báo riêng. `verify_step8.py` kiểm luồng P0; để nghiệm thu comparison/autoplay/narrative của bản 0.8.0, dùng verifier bổ sung trên một installation kiểm tra mới khác với audit directory và output riêng:

```powershell
# Sau khi đặt bốn biến installation/auth/metadata/heartbeat cho installation kiểm tra mới.
$env:SAFEROUTE_OFFLINE_AUDIT_DIR = "$M3Local\receipts\<new-completion-run>\network-audit"
& "$M3Local\backend-venv\Scripts\python.exe" -B "$M3Team\backend\scripts\verify_completion.py" --output "$M3Local\receipts\<new-completion-run>\native.json"
```

## Reset, backup, recover và bàn giao

- Reset qua HTTP tạo phiên mới từ fixture đã xác minh, giữ nguyên phiên cũ và receipt idempotent. Không xóa SQLite để reset UI.
- Dừng API/worker trước `backup_backend.py --api-stopped`. CLI giữ worker lock, tạo target mới, backup authority toàn cục và metadata với manifest/hash riêng; `--api-stopped` là attestation của người vận hành, không tự dò mọi port.
- Startup gọi public SDK recover/validate, fence orphan, đối soát queue/outbox/request rồi mới mở gate. `STORE_MISSING/INVALID`, source/build/journal/receipt sai được giữ BLOCKED; không auto repair/restore.
- Riêng `STORE_INVALID` có explicit SQLite `SQLITE_BUSY/SQLITE_LOCKED` cause được bridge trả `RUNTIME_BUSY` (HTTP 503) để retry cùng request ID. Không phân loại theo message text. Poll GET retry có giới hạn; lỗi dữ liệu không có typed contention cause vẫn bị chặn.
- Restore/upgrade/rollback authority theo M2/Leader khi đã fence tất cả worker; backend chưa có CLI restore hoặc endpoint admin. Không thay file trong service đang chạy.
- M4 dùng [HTTP handoff](M3_API_HANDOFF.md), [outbox/artifacts](M3_OUTBOX_RECOVERY_ARTIFACT_API_HANDOFF.md) và [E2E checklist](M3_M4_E2E_CHECKLIST.md).

Khi backup installation mới, đặt đúng bốn biến `SAFEROUTE_INSTALLATION_CONFIG`, `SAFEROUTE_AUTH_FILE`, `SAFEROUTE_METADATA_DB`, `SAFEROUTE_WORKER_HEARTBEAT` như ở lệnh diễn tập, rồi dùng venv của cùng installation:

```powershell
& "$M3Local\backend-venv\Scripts\python.exe" -B "$M3Team\backend\scripts\backup_backend.py" --api-stopped
```

Launcher chỉ truyền cấu hình cho các child của nó; không đổi environment của PowerShell đang gọi. Chưa đặt các biến trên thì script riêng sẽ dùng installation mặc định, vì vậy phải kiểm đúng local root trước thao tác admin.

Giữ `SIMULATED_REPLAY_NOT_GPS`, relative exposure `PROXY`, `NOT_OPTIMALITY`, `GENERAL_M1_NOT_VALIDATED`, `E4_NOT_RUN`, `PRODUCTION_CALIBRATION_UNCONFIGURED`, `PERFORMANCE_NOT_MET`. S4 synthetic what-if; S7 cold SEARCH_LIMIT chưa chứng minh infeasible. Backend 0.8.0 đã triển khai comparison, autoplay/speed, narrative và mock riêng; kết quả nghiệm thu từng phần lấy từ báo cáo hoàn tất và receipt tương ứng. Browser/UI E2E, G3 toàn nhóm và Leader production deployment approval vẫn chờ xác nhận riêng.
