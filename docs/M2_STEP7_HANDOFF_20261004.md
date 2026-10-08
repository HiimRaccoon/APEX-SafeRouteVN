# M2 Step 7 — bàn giao theo cấu trúc Drive của nhóm, 04/10/2026

Bản này thay hướng dẫn bố trí `optimization/releases/...` trước đó. Mã nguồn được phân phối vào các thư mục sở hữu hiện có của nhóm. Runtime/Integration ZIP, code production và receipt đã review vẫn nguyên byte; đây là đổi cách tổ chức upload, không phải sửa solver hoặc tạo nghiệm thu Windows mới.

Tôi chỉ đọc Drive và chuẩn bị gói này. Không có upload, tạo thư mục, xóa hoặc thay file nào trên Drive. Leader tự kiểm tra rồi upload.

## 1. Chọn đúng gói và đúng root

Giải nén `M2_Step7_Upload_Theo_CauTruc_Team_20261004.zip`. Bên trong có `UPLOAD_TO_TEAM/` và `README_UPLOAD_FIRST.md`. **UPLOAD_TO_TEAM chỉ là thư mục chọn file trên máy, không phải thư mục cần tạo trên Drive.** Đích luôn là root **SafeRouteVN_Project_Structure_PLAN**, ID `1PBymK3QP8x_MNor4bTEhM_lpD6VaBaWI`.

Các đường dẫn bên trong `UPLOAD_TO_TEAM/` chính là đích tương đối trên Drive. Ví dụ `UPLOAD_TO_TEAM/optimization/matrix/matrix_builder.py` → `SafeRouteVN_Project_Structure_PLAN/optimization/matrix/matrix_builder.py`.

ZIP bạn đính kèm `M2_Step7_Drive_Upload_Ready_20261004(1).zip` đúng SHA-256 `4004c3f0eae0a7e2762966da1c4adfcd3330f3013b2b41e9298e741851e59b9d`; `(1)` chỉ là tên bản tải. Bảng cuối cũng chỉ ra source tương ứng trong bản ZIP cũ, nên bạn có thể thao tác từ bản cũ nếu cần. Hướng dẫn root `M2_STEP7_HANDOFF_20261004.md` cũ và các wrapper README/map/checker cũ không áp dụng cho bố trí mới; dùng tài liệu này.

## 2. Những gì đã đọc trên Drive

Drive hiện có các thư mục optimization/solver, matrix, candidate_paths, profiles, integration và tests. Solver/matrix/candidate_paths/profiles đang chỉ có placeholder; integration có `member1_api_contract_projection.py`, tests có `test_member1_api_contract.py`. Chưa có models, rolling_horizon, runtime hoặc solver/objective tại thời điểm đọc.

configs có README, chưa có ba JSON bàn giao. shared/examples và shared/schemas có placeholder. docs có runbook M1 và tài liệu API v1; chưa có tài liệu Step 7. Đây chỉ là trạng thái Drive đã quan sát, không kết luận các thành viên chưa làm việc trên máy riêng.

Bốn file trùng với Runtime đã được fetch raw lại và đối chiếu từng byte: projection và ba file `shared/contracts`. Chúng đúng phiên bản frozen, **giữ nguyên và không upload bản trùng**. Audit frozen API trước đó trong cùng phiên đã đối chiếu 34/34 file; bản upload mới không động tới các file đó.

## 3. Tạo đúng bốn thư mục còn thiếu

Chỉ tạo: `optimization/models`, `optimization/rolling_horizon`, `optimization/runtime`, `optimization/solver/objective`. Chúng là các đường dẫn module/import và asset thật của build, không phải thư mục tạm hay một namespace releases mới. `models` phải ở dưới optimization và dùng số nhiều. Các thư mục còn lại sử dụng thư mục hiện có.

| Đích trên Drive | Phần cần thêm | Trạng thái |
|---|---|---|
| [optimization](https://drive.google.com/drive/folders/1foMEivDoYSsV8aE1eklV4bP9FpoPGVnt) | 3 file trực tiếp: __init__.py, config_loader.py, validation.py | Có sẵn |
| [optimization/candidate_paths](https://drive.google.com/drive/folders/1ORikbF_aI8MB0Yre4shvtUz77rMwRYC1) | 2 file | Có sẵn |
| [optimization/matrix](https://drive.google.com/drive/folders/12jH0zcPwO9psssqxihj4Jfz122d05o3b) | 2 file | Có sẵn |
| `optimization/models` | 10 file; đúng tên models, không đổi thành model | Tạo mới |
| [optimization/profiles](https://drive.google.com/drive/folders/1T86kI1x6EJCzCbFrkelsn6v2r2iOEllu) | 6 file | Có sẵn |
| [optimization/solver](https://drive.google.com/drive/folders/1HEyAtC_uVmOd5z1gOop_Yt7QRZ1r93X-) | 9 file trực tiếp; thêm objective/ bên dưới | Có sẵn |
| `optimization/solver/objective` | 9 file | Tạo mới |
| [optimization/integration](https://drive.google.com/drive/folders/12x6Yk8mcLZAPFxXaj5FPADTVxVVGaiBg) | 26 file mới; giữ file projection đã có | Có sẵn |
| `optimization/rolling_horizon` | 31 file | Tạo mới |
| `optimization/runtime` | 34 file Python/JS/schema/lock/vectors | Tạo mới |
| [optimization/tests](https://drive.google.com/drive/folders/1acdC2H9BSS4jXuDAkb2hGWlDo7tkx2Dm) | Chỉ runtime_m4_flow.mjs, không upload reviewer tests | Có sẵn |
| [configs](https://drive.google.com/drive/folders/1aD1LXPx1zW094ytGEVo-qyNOVzSNm3qO) | 3 JSON Step 3/5/6 đã pin | Có sẵn |
| [shared/examples](https://drive.google.com/drive/folders/1IU5usj_JzKYgFfUUqeVFAODP5rP4RAn8) | 3 execution views S2/S3/S4 | Có sẵn |
| [docs](https://drive.google.com/drive/folders/1bl8ncMJpOg-gL3VGh8wWruCYLpGxlndm) | Hướng dẫn, crosswalk, receipt, metadata và 2 ZIP release nguyên bản | Có sẵn |
| [gốc project](https://drive.google.com/drive/folders/1PBymK3QP8x_MNor4bTEhM_lpD6VaBaWI) | runtime_entry.py + requirements-runtime.lock.txt | Root hiện có |

## 4. Thứ tự upload thủ công

1. Mở đúng root project; tạo bốn thư mục mục 3. Khi upload vào folder đã có, **chọn các file nằm trong folder local tương ứng**, không upload thêm một folder cùng tên vào bên trong. Ví dụ mở `optimization/solver` rồi chọn chín file trực tiếp local; mở/tạo `objective` riêng để upload chín file của nó. Không tạo `solver/solver`.
2. Upload ba file trực tiếp của optimization; lần lượt điền candidate_paths, matrix, models, profiles, solver/objective, integration, rolling_horizon và runtime theo bảng. Với bốn folder vừa tạo, mở folder đó rồi chọn các file bên trong folder local để upload; làm tương tự với folder đã có. Không upload lại một folder cùng tên vào parent sau khi đã tạo nó.
3. Upload đúng ba file vào configs: `member1_profiles_step3.json`, `member1_dynamic_step5.json`, `member1_rain_step6.json`. Giữ README hiện có; không tự đổi weights/caps/reference hoặc thêm cấu hình khác vào bộ runtime đã pin.
4. Upload `S2_execution_view.json`, `S3_execution_view.json`, `S4_execution_view.json` vào **shared/examples hiện có**. Không tạo root examples trên Drive; khi cài runtime, checker/ZIP giữ lại đường dẫn examples gốc cho execution package.
5. Upload mọi file trong `UPLOAD_TO_TEAM/docs/` vào **docs hiện có**, gồm tài liệu này, crosswalk, receipt, inventory, hai ZIP release và checker. Upload `runtime_entry.py` và `requirements-runtime.lock.txt` vào root project. Hai file root này phục vụ launcher/dependency của package, không phải thay README root.
6. Thêm duy nhất `runtime_m4_flow.mjs` vào optimization/tests: đây là reference map/KPI/driver flow cho M4. Test API v1 đã có giữ nguyên. Không upload các test reviewer/RED/GREEN/debug của những vòng sửa trước.
7. Kiểm bằng bảng từng file và checker local bên dưới. Nếu Drive hiện đã xuất hiện file cùng tên sau thời điểm tôi đọc, đối chiếu hash trước; file khác byte cần được Leader kiểm tra, không tự chọn bản trùng `(1)` hoặc ghi đè công việc mới của thành viên.

## 5. Canonical path và các file shared

API v1 canonical vẫn tại shared/contracts và docs API v1 hiện có. Runtime dynamic bổ sung SDK/1, command/response/1, job-view/1 và execution-view/2; không đổi nhãn API v1 thành API v2.

`protocol.schema.json`, `response.schema.json`, `execution_view.schema.json`, `HANDOFF_CONTRACT_LOCK.json` và JS consumer giữ **canonical path tại optimization/runtime**: Python đọc schema bằng đường dẫn cạnh module, lock pin các đường dẫn này, JS scripts có import tương đối. M3/M4 cùng dùng các file đó. Không chép thêm một bản schema vào shared/schemas rồi sửa hai nơi; folder shared/schemas chưa cần thêm file cho release này. shared/constants cũng chưa có file phải thêm. Các ví dụ dynamic được đặt ở shared/examples đúng cấu trúc nhóm.

Không đưa code M2 vào backend/services hoặc frontend/src nguyên khối. M3 tự triển khai transport/auth/config/persistence/worker integration; M4 tự triển khai UI/adapter/map/KPI/driver từ public view. Source M2 ở optimization để ownership rõ ràng.

## 6. M3 chạy đúng build đã review

Bố trí Drive là **cây mã nguồn chung**, còn cài runtime cần một **root thực thi đã khóa inventory**. M3 nên tải `docs/SafeRouteVN_TASK02_Step7_Final_Release_Runtime_Windows_20261004.zip`, kiểm SHA rồi giải nén đủ 149 file vào một thư mục local riêng, ví dụ `C:\SafeRouteVN_Runtime\STEP7_80694f51`. Thư mục cài local này không phải folder cần tạo thêm trên Drive. Không cài dependency/store/venv trong Drive sync.

Production inventory pin 141 file, gồm parent initializers, config và dependency lock. Collector tính inventory từ các module/config có trong root; khi Step 8/9 thêm file hoặc đổi production code, cây chung có thể không còn là build Step 7. Cài từ ZIP được duyệt giúp M3 giữ nguyên integration đang chạy. Root launcher trong cây nguồn chỉ được dùng khi kiểm đủ production domain/hash; đừng lấy digest cũ để chạy cây đã thay đổi.

Ngoài cách giải nén ZIP, checker cung cấp assembly từ cây team đã tải đủ, với mapping metadata/examples ngược về các path gốc. Nó chỉ tạo một thư mục local MỚI bên ngoài cây team, không sửa code hoặc store. Chọn một trong hai cách cài; cả hai phải tạo đúng 149 file nguyên byte.

Sau khi tải cây team đầy đủ về `C:\SafeRouteVN_Team`, mở PowerShell:

```powershell
python "C:\SafeRouteVN_Team\docs\M2_STEP7_VERIFY_20261004.py" --project-root "C:\SafeRouteVN_Team"
# Tùy chọn: assemble vào thư mục mới, parent C:\SafeRouteVN_Runtime đã có.
python "C:\SafeRouteVN_Team\docs\M2_STEP7_VERIFY_20261004.py" --project-root "C:\SafeRouteVN_Team" --assemble-runtime "C:\SafeRouteVN_Runtime\STEP7_80694f51"
```

Kỳ vọng `TEAM_HANDOFF_BYTES_VERIFIED`, runtime_entries=149, inventory_pins=141. `team_root_production_inventory_matches=false` báo có thêm file trong phạm vi scanner: không phải nghiệm thu cho chạy trực tiếp cây team; cần cài ZIP/assembly cô lập. Checker không chạy solver, không attestation Windows, không chứng nhận source SQLite và không kết luận hệ thống production calibrated.

Nếu chỉ kiểm gói upload đã unzip trước khi upload (thiếu bốn file cố ý bỏ vì Drive đã có):

```powershell
python ".\UPLOAD_TO_TEAM\docs\M2_STEP7_VERIFY_20261004.py" --project-root ".\UPLOAD_TO_TEAM" --check-upload-kit
```

Kỳ vọng `UPLOAD_KIT_VERIFIED`, 145/149 runtime entries được kiểm ở gói; bốn file còn lại được nêu rõ. Đây không phải một runtime install đầy đủ. Sau upload/tải cây team, kiểm đủ 149 như lệnh phía trên.

Trong root runtime đã cài, dùng Windows Python 3.12 và đúng dependency lock/environment được phép. External build đã duyệt:

`80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41`

```powershell
Set-Location "C:\SafeRouteVN_Runtime\STEP7_80694f51"
# Python đã chọn là interpreter Windows được phép; dùng environment riêng/reuse đã attest đúng lock.
python -m pip install -r requirements-runtime.lock.txt
python runtime_entry.py --inventory production_inventory.json --expected-build-sha256 80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41 --snapshot-root "C:\Users\DOTHANHSON\Documents\Codex\Member1MappingAudit_20260928" --store "C:\SafeRouteVN_Runtime_State\team_authority.sqlite"
```

Launcher nhận command JSON trên stdin, không phải HTTP API đã làm sẵn. Đường dẫn store là ví dụ server-private; tạo parent phù hợp, dùng store mới cho lần bootstrap mới. Không nhận snapshot/store/build digest từ field do browser/user gửi. Khi tích hợp SDK, đọc RuntimeClient và crosswalk; server installation config do M3/Leader quản lý.

M1 snapshot là dữ liệu ngoài runtime: dùng chính suite thu-duc-binh-thanh-v1, `scenarios/cached_context/hcmc/member1-tdbt-v1`. network.sqlite pin `d4f2412884d7809cba79f86b65f6677c025ebf3e0ead357d3fc3f9cea553a204`, 378368000 bytes; features.sqlite pin `8870d537c4f3eb3dca07a177951c66abfe204fe61039852109b92f4751981469`, 1111019520 bytes. Drive đã có bản nguồn, không reupload từ M2; M3 kiểm actual local hashes. Tôi không tải/băm lại 1.49 GB DB trong lượt bố trí này. Không chọn nhầm context member1-run-v1/features. Source CLI M1 dùng `.venv\Scripts\python.exe` trong thư mục M1; interpreter cho runtime là environment riêng được attest, không mặc nhiên là `.venv` M1.

M3 cần flow: bootstrap → resolve/submit → compute worker → get_job → accept bằng latest basis → advance observed → apply_event đúng barrier → replan; đọc outbox/ack, phục hồi/fencing và upgrade theo SDK/crosswalk. Compute là forecast; accept chưa đồng nghĩa delivered. Dùng async polling và structured SEARCH_LIMIT/no-witness; mục tiêu 30 giây chưa đạt, không quảng bá realtime.

## 7. M4 đọc/chạy phần nào

M4 đọc tài liệu này và docs/step7_INTEGRATION_CROSSWALK.md; dùng `optimization/runtime/reference_consumer.mjs`, ba schema, contract lock, corpus/vectors và ba views ở shared/examples. `optimization/tests/runtime_m4_flow.mjs` là ví dụ đưa view vào geometry/KPI/driver, không phải frontend hoàn chỉnh.

Từ root cây team đã tải, có Node:

```text
node optimization/runtime/consumer_test.mjs
node optimization/runtime/consumer_golden.mjs shared/examples
node optimization/tests/runtime_m4_flow.mjs shared/examples/S2_execution_view.json
node optimization/tests/runtime_m4_flow.mjs shared/examples/S3_execution_view.json
node optimization/tests/runtime_m4_flow.mjs shared/examples/S4_execution_view.json
```

Kỳ vọng PORTABLE_JS_PASS 13, GOLDEN_PASS 60, ba M3_RUNTIME_M4_REFERENCE_FLOW_PASS. M4 không cần tải SQLite/OR-Tools để chạy Node consumer checks này. Đây là contract checks ổn định được bàn giao, không phải các test sửa lỗi riêng của M2.

Python parity/API portable: giải nén đủ **182 file** từ Integration ZIP ở docs vào root local riêng và chạy theo crosswalk nguyên bản. 12 outputs ở BÊN TRONG Integration ZIP là frozen API examples được manifest pin, cần giữ cho suite 46 tests. Không bung các outputs ấy ra outputs chung của Drive và không lẫn chúng với runtime authority của nhóm. Crosswalk nguyên bản dùng `examples`; lệnh chạy trực tiếp cây team dùng `shared/examples` như trên.

M4 hiển thị SIMULATED_REPLAY, không coi là GPS thật; exposure là proxy. Tách observed prefix, remaining forecast, projected whole. Không hard-code served count/tuyến theo ba example JSON; UI dùng schema_version/status/null/diagnostics thực tế từ M3. JS consumer không xác thực SQLite/VRP; M3 gọi runtime validator và giữ authority.

## 8. Giữ ổn định sau Step 8/9

API v1 frozen và supplemental contracts đã khóa. Step 8/9 có thể sửa implementation M2 rồi tạo build mới, nhưng deployment M3 đang dùng vẫn là package Step 7 đã pin. Internal fix tương thích: kiểm corpus Python/JS/API, raw current-context revalidation, upgrade/fence bằng admin flow, xuất build/receipt mới; giữ historical execution hashes. Đừng sửa file trực tiếp trong runtime đang chạy.

Nếu đổi public field/semantics/version, phải có adapter/migration và Leader review; không âm thầm đẩy chỉnh frontend/backend cho M3/M4. Cơ chế này giảm ảnh hưởng các sửa sau; không thể cam kết tuyệt đối sẽ không có bug hoặc thay đổi tích hợp trong tương lai. Chưa có kiểm Step 8/E4 trong lần bàn giao này.

Giữ giới hạn: GENERAL_M1_NOT_VALIDATED, E4_NOT_RUN, PRODUCTION_CALIBRATION_UNCONFIGURED; finite domain/global optimality chưa chứng minh; S7 cold SEARCH_LIMIT; performance NOT_MET; selected S4 witness 0 WET; S1 diversity chưa chứng minh. Đây không phải lý do loại production files khỏi bộ install. M3/M4 có thể hoàn thành phần tích hợp thuộc nhiệm vụ của họ dựa vào contracts/build hiện tại; kết quả E4/đánh giá toàn hệ thống thuộc các bước sau.

## 9. Những phần không đưa lên thêm

Không đưa lại Step 1–6 ZIP patch, reviewer tests, RED/GREEN logs, scratch backup, run thử, execution stores, dependency tree/venv hoặc Review ZIP 339 entry vào cây làm việc chung. Không có file mới cho backend, frontend, evaluation, geo_data hoặc scenarios trong gói này. outputs chung giữ nguyên; metadata cần đọc nằm trong docs, không trộn với output hoạt động.

Không upload m4_reference trùng 14 file rồi để hai source; chỉ một bản canonical. Không upload HANDOFF_README/HANDOFF_UPLOAD_MAP/VERIFY_HANDOFF wrapper cũ với release-folder policy cũ. Runtime helper `.py`, `portable_tests.py`, `consumer_test.mjs`, corpus/vectors và checkpoint/package modules vẫn phải có vì inventory/crosswalk pin chúng; chúng là production/reference đã khóa, không phải reviewer regressions tạm.

## 10. Checklist sau upload

- Đúng root và đúng bốn thư mục mới; không có models dưới root riêng, model thay models, solver/solver, hoặc hai folder cùng tên do upload folder chồng.
- 152 file MỚI theo gói; bốn file hiện có giữ nguyên. File chính thức không thêm suffix `(1)` trên Drive.
- Docs có M2_STEP7_HANDOFF_20261004.md, crosswalk, receipt và hai ZIP nguyên byte. Khi gửi thành viên, dẫn họ vào docs trước.
- Giữ nguyên README các owner, API v1, runbook M1, snapshot/datasets, code backend/frontend của thành viên khác.
- Sau tải cây team, checker kiểm đủ 149 runtime files + production pins; M4 chạy Node corpus/flow.
- M3 chọn Windows environment được phép và kiểm source actual hashes; không thay bằng kết quả checker Linux/byte-only. Lỗi Application Control ghi đúng BLOCKED của install đó.
- Chốt build/contract versions theo receipt; thực hiện admin deployment/upgrade riêng. Không upload private store vào Drive.

## 11. Mapping từng file chính xác

Trong bảng: đường dẫn nguồn là **trong ZIP cũ bạn gửi**; các source `runtime/...`, `m4_reference/...`, `packages/...` và `DELIVERY_RECEIPT.json` nằm dưới prefix `STEP7_20261004_80694f51/`. Đích là tương đối từ root Drive. Trong ZIP mới, mọi file cần upload nằm tại `UPLOAD_TO_TEAM/<đích>`. Các dòng KEEP không có bản trùng trong UPLOAD_TO_TEAM. Bảng máy-readable ở docs/M2_STEP7_UPLOAD_MAP_20261004.json có SHA-256/bytes/file IDs/folder URLs.


### root

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `requirements-runtime.lock.txt` | `runtime/requirements-runtime.lock.txt` | THÊM file mới |
| `runtime_entry.py` | `runtime/runtime_entry.py` | THÊM file mới |

### configs

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `member1_dynamic_step5.json` | `runtime/configs/member1_dynamic_step5.json` | THÊM file mới |
| `member1_profiles_step3.json` | `runtime/configs/member1_profiles_step3.json` | THÊM file mới |
| `member1_rain_step6.json` | `runtime/configs/member1_rain_step6.json` | THÊM file mới |

### shared/examples

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `S2_execution_view.json` | `runtime/examples/S2_execution_view.json` | THÊM file mới |
| `S3_execution_view.json` | `runtime/examples/S3_execution_view.json` | THÊM file mới |
| `S4_execution_view.json` | `runtime/examples/S4_execution_view.json` | THÊM file mới |

### shared/contracts

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/shared/contracts/__init__.py` | GIỮ file đã có |
| `task02_api_v1.py` | `runtime/shared/contracts/task02_api_v1.py` | GIỮ file đã có |
| `task02_api_v1.schema.json` | `runtime/shared/contracts/task02_api_v1.schema.json` | GIỮ file đã có |

### optimization

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/__init__.py` | THÊM file mới |
| `config_loader.py` | `runtime/optimization/config_loader.py` | THÊM file mới |
| `validation.py` | `runtime/optimization/validation.py` | THÊM file mới |

### optimization/candidate_paths

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/candidate_paths/__init__.py` | THÊM file mới |
| `generator.py` | `runtime/optimization/candidate_paths/generator.py` | THÊM file mới |

### optimization/matrix

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/matrix/__init__.py` | THÊM file mới |
| `matrix_builder.py` | `runtime/optimization/matrix/matrix_builder.py` | THÊM file mới |

### optimization/models

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/models/__init__.py` | THÊM file mới |
| `candidate_path.py` | `runtime/optimization/models/candidate_path.py` | THÊM file mới |
| `common.py` | `runtime/optimization/models/common.py` | THÊM file mới |
| `decision_result.py` | `runtime/optimization/models/decision_result.py` | THÊM file mới |
| `decision_state.py` | `runtime/optimization/models/decision_state.py` | THÊM file mới |
| `matrix_bundle.py` | `runtime/optimization/models/matrix_bundle.py` | THÊM file mới |
| `member1_dynamic_state.py` | `runtime/optimization/models/member1_dynamic_state.py` | THÊM file mới |
| `member1_dynamic_step5.schema.json` | `runtime/optimization/models/member1_dynamic_step5.schema.json` | THÊM file mới |
| `member1_rain.py` | `runtime/optimization/models/member1_rain.py` | THÊM file mới |
| `motion_state.py` | `runtime/optimization/models/motion_state.py` | THÊM file mới |

### optimization/profiles

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/profiles/__init__.py` | THÊM file mới |
| `config.py` | `runtime/optimization/profiles/config.py` | THÊM file mới |
| `engine.py` | `runtime/optimization/profiles/engine.py` | THÊM file mới |
| `explanation.py` | `runtime/optimization/profiles/explanation.py` | THÊM file mới |
| `normalization.py` | `runtime/optimization/profiles/normalization.py` | THÊM file mới |
| `objective.py` | `runtime/optimization/profiles/objective.py` | THÊM file mới |

### optimization/solver

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/solver/__init__.py` | THÊM file mới |
| `callbacks.py` | `runtime/optimization/solver/callbacks.py` | THÊM file mới |
| `constraints.py` | `runtime/optimization/solver/constraints.py` | THÊM file mới |
| `member1_dynamic_master.py` | `runtime/optimization/solver/member1_dynamic_master.py` | THÊM file mới |
| `member1_profile_master.py` | `runtime/optimization/solver/member1_profile_master.py` | THÊM file mới |
| `member1_static_cp_sat.py` | `runtime/optimization/solver/member1_static_cp_sat.py` | THÊM file mới |
| `solution_parser.py` | `runtime/optimization/solver/solution_parser.py` | THÊM file mới |
| `solution_validator.py` | `runtime/optimization/solver/solution_validator.py` | THÊM file mới |
| `vrptw_solver.py` | `runtime/optimization/solver/vrptw_solver.py` | THÊM file mới |

### optimization/solver/objective

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/solver/objective/__init__.py` | THÊM file mới |
| `adapter.py` | `runtime/optimization/solver/objective/adapter.py` | THÊM file mới |
| `cost_domain.py` | `runtime/optimization/solver/objective/cost_domain.py` | THÊM file mới |
| `cost_domain_analysis.py` | `runtime/optimization/solver/objective/cost_domain_analysis.py` | THÊM file mới |
| `explanation.py` | `runtime/optimization/solver/objective/explanation.py` | THÊM file mới |
| `fleet_validation.py` | `runtime/optimization/solver/objective/fleet_validation.py` | THÊM file mới |
| `fleet_validation_analysis.py` | `runtime/optimization/solver/objective/fleet_validation_analysis.py` | THÊM file mới |
| `profiles.py` | `runtime/optimization/solver/objective/profiles.py` | THÊM file mới |
| `scoring.py` | `runtime/optimization/solver/objective/scoring.py` | THÊM file mới |

### optimization/integration

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/integration/__init__.py` | THÊM file mới |
| `member1_api_contract_projection.py` | `runtime/optimization/integration/member1_api_contract_projection.py` | GIỮ file đã có |
| `member1_decision_state_adapter.py` | `runtime/optimization/integration/member1_decision_state_adapter.py` | THÊM file mới |
| `member1_mapping_audit.py` | `runtime/optimization/integration/member1_mapping_audit.py` | THÊM file mới |
| `member1_ortools_static.py` | `runtime/optimization/integration/member1_ortools_static.py` | THÊM file mới |
| `member1_ortools_static_runner.py` | `runtime/optimization/integration/member1_ortools_static_runner.py` | THÊM file mới |
| `member1_ortools_static_validation.py` | `runtime/optimization/integration/member1_ortools_static_validation.py` | THÊM file mới |
| `member1_path_foundation.py` | `runtime/optimization/integration/member1_path_foundation.py` | THÊM file mới |
| `member1_profile_checkpoint.py` | `runtime/optimization/integration/member1_profile_checkpoint.py` | THÊM file mới |
| `member1_profile_evidence.py` | `runtime/optimization/integration/member1_profile_evidence.py` | THÊM file mới |
| `member1_profile_package.py` | `runtime/optimization/integration/member1_profile_package.py` | THÊM file mới |
| `member1_profile_runner.py` | `runtime/optimization/integration/member1_profile_runner.py` | THÊM file mới |
| `member1_profile_validation.py` | `runtime/optimization/integration/member1_profile_validation.py` | THÊM file mới |
| `member1_profiles.py` | `runtime/optimization/integration/member1_profiles.py` | THÊM file mới |
| `member1_s0.py` | `runtime/optimization/integration/member1_s0.py` | THÊM file mới |
| `member1_s0_graph.py` | `runtime/optimization/integration/member1_s0_graph.py` | THÊM file mới |
| `member1_s0_runner.py` | `runtime/optimization/integration/member1_s0_runner.py` | THÊM file mới |
| `member1_s0_validation.py` | `runtime/optimization/integration/member1_s0_validation.py` | THÊM file mới |
| `member1_s1.py` | `runtime/optimization/integration/member1_s1.py` | THÊM file mới |
| `member1_s1_runner.py` | `runtime/optimization/integration/member1_s1_runner.py` | THÊM file mới |
| `member1_s1_validation.py` | `runtime/optimization/integration/member1_s1_validation.py` | THÊM file mới |
| `member1_static.py` | `runtime/optimization/integration/member1_static.py` | THÊM file mới |
| `member1_static_runner.py` | `runtime/optimization/integration/member1_static_runner.py` | THÊM file mới |
| `member1_static_validation.py` | `runtime/optimization/integration/member1_static_validation.py` | THÊM file mới |
| `member1_trusted_receipt.json` | `runtime/optimization/integration/member1_trusted_receipt.json` | THÊM file mới |
| `units.py` | `runtime/optimization/integration/units.py` | THÊM file mới |
| `validator.py` | `runtime/optimization/integration/validator.py` | THÊM file mới |

### optimization/rolling_horizon

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `__init__.py` | `runtime/optimization/rolling_horizon/__init__.py` | THÊM file mới |
| `member1_column_validation.py` | `runtime/optimization/rolling_horizon/member1_column_validation.py` | THÊM file mới |
| `member1_command_contract.py` | `runtime/optimization/rolling_horizon/member1_command_contract.py` | THÊM file mới |
| `member1_dynamic_check.py` | `runtime/optimization/rolling_horizon/member1_dynamic_check.py` | THÊM file mới |
| `member1_dynamic_checkpoint.py` | `runtime/optimization/rolling_horizon/member1_dynamic_checkpoint.py` | THÊM file mới |
| `member1_dynamic_evidence.py` | `runtime/optimization/rolling_horizon/member1_dynamic_evidence.py` | THÊM file mới |
| `member1_dynamic_package.py` | `runtime/optimization/rolling_horizon/member1_dynamic_package.py` | THÊM file mới |
| `member1_dynamic_planner.py` | `runtime/optimization/rolling_horizon/member1_dynamic_planner.py` | THÊM file mới |
| `member1_dynamic_runner.py` | `runtime/optimization/rolling_horizon/member1_dynamic_runner.py` | THÊM file mới |
| `member1_dynamic_transition.py` | `runtime/optimization/rolling_horizon/member1_dynamic_transition.py` | THÊM file mới |
| `member1_dynamic_validation.py` | `runtime/optimization/rolling_horizon/member1_dynamic_validation.py` | THÊM file mới |
| `member1_motion_acceptance.py` | `runtime/optimization/rolling_horizon/member1_motion_acceptance.py` | THÊM file mới |
| `member1_motion_checkpoint.py` | `runtime/optimization/rolling_horizon/member1_motion_checkpoint.py` | THÊM file mới |
| `member1_motion_command_evidence.py` | `runtime/optimization/rolling_horizon/member1_motion_command_evidence.py` | THÊM file mới |
| `member1_motion_package.py` | `runtime/optimization/rolling_horizon/member1_motion_package.py` | THÊM file mới |
| `member1_motion_replay.py` | `runtime/optimization/rolling_horizon/member1_motion_replay.py` | THÊM file mới |
| `member1_motion_runner.py` | `runtime/optimization/rolling_horizon/member1_motion_runner.py` | THÊM file mới |
| `member1_motion_validation.py` | `runtime/optimization/rolling_horizon/member1_motion_validation.py` | THÊM file mới |
| `member1_rain_check.py` | `runtime/optimization/rolling_horizon/member1_rain_check.py` | THÊM file mới |
| `member1_rain_checkpoint.py` | `runtime/optimization/rolling_horizon/member1_rain_checkpoint.py` | THÊM file mới |
| `member1_rain_guard_checkpoint.py` | `runtime/optimization/rolling_horizon/member1_rain_guard_checkpoint.py` | THÊM file mới |
| `member1_rain_guard_revalidation.py` | `runtime/optimization/rolling_horizon/member1_rain_guard_revalidation.py` | THÊM file mới |
| `member1_rain_legacy_revalidation.py` | `runtime/optimization/rolling_horizon/member1_rain_legacy_revalidation.py` | THÊM file mới |
| `member1_rain_package.py` | `runtime/optimization/rolling_horizon/member1_rain_package.py` | THÊM file mới |
| `member1_rain_planner.py` | `runtime/optimization/rolling_horizon/member1_rain_planner.py` | THÊM file mới |
| `member1_rain_replay.py` | `runtime/optimization/rolling_horizon/member1_rain_replay.py` | THÊM file mới |
| `member1_rain_runner.py` | `runtime/optimization/rolling_horizon/member1_rain_runner.py` | THÊM file mới |
| `member1_rain_source.py` | `runtime/optimization/rolling_horizon/member1_rain_source.py` | THÊM file mới |
| `member1_rain_temporal.py` | `runtime/optimization/rolling_horizon/member1_rain_temporal.py` | THÊM file mới |
| `member1_rain_transition.py` | `runtime/optimization/rolling_horizon/member1_rain_transition.py` | THÊM file mới |
| `member1_rain_validation.py` | `runtime/optimization/rolling_horizon/member1_rain_validation.py` | THÊM file mới |

### optimization/runtime

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `HANDOFF_CONTRACT_LOCK.json` | `runtime/optimization/runtime/HANDOFF_CONTRACT_LOCK.json` | THÊM file mới |
| `__init__.py` | `runtime/optimization/runtime/__init__.py` | THÊM file mới |
| `build.py` | `runtime/optimization/runtime/build.py` | THÊM file mới |
| `cli.py` | `runtime/optimization/runtime/cli.py` | THÊM file mới |
| `consumer_golden.mjs` | `runtime/optimization/runtime/consumer_golden.mjs` | THÊM file mới |
| `consumer_golden.py` | `runtime/optimization/runtime/consumer_golden.py` | THÊM file mới |
| `consumer_golden_corpus.json` | `runtime/optimization/runtime/consumer_golden_corpus.json` | THÊM file mới |
| `consumer_test.mjs` | `runtime/optimization/runtime/consumer_test.mjs` | THÊM file mới |
| `contracts.py` | `runtime/optimization/runtime/contracts.py` | THÊM file mới |
| `environment.py` | `runtime/optimization/runtime/environment.py` | THÊM file mới |
| `events.py` | `runtime/optimization/runtime/events.py` | THÊM file mới |
| `execution.py` | `runtime/optimization/runtime/execution.py` | THÊM file mới |
| `execution_validation.py` | `runtime/optimization/runtime/execution_validation.py` | THÊM file mới |
| `execution_view.schema.json` | `runtime/optimization/runtime/execution_view.schema.json` | THÊM file mới |
| `facade.py` | `runtime/optimization/runtime/facade.py` | THÊM file mới |
| `handoff.py` | `runtime/optimization/runtime/handoff.py` | THÊM file mới |
| `job_view.py` | `runtime/optimization/runtime/job_view.py` | THÊM file mới |
| `m3_reference.py` | `runtime/optimization/runtime/m3_reference.py` | THÊM file mới |
| `no_service.py` | `runtime/optimization/runtime/no_service.py` | THÊM file mới |
| `portable_tests.py` | `runtime/optimization/runtime/portable_tests.py` | THÊM file mới |
| `protocol.py` | `runtime/optimization/runtime/protocol.py` | THÊM file mới |
| `protocol.schema.json` | `runtime/optimization/runtime/protocol.schema.json` | THÊM file mới |
| `reference_consumer.mjs` | `runtime/optimization/runtime/reference_consumer.mjs` | THÊM file mới |
| `reference_flow.py` | `runtime/optimization/runtime/reference_flow.py` | THÊM file mới |
| `response.schema.json` | `runtime/optimization/runtime/response.schema.json` | THÊM file mới |
| `rolling_flow.py` | `runtime/optimization/runtime/rolling_flow.py` | THÊM file mới |
| `sdk.py` | `runtime/optimization/runtime/sdk.py` | THÊM file mới |
| `store.py` | `runtime/optimization/runtime/store.py` | THÊM file mới |
| `trajectory_contract.py` | `runtime/optimization/runtime/trajectory_contract.py` | THÊM file mới |
| `upgrade.py` | `runtime/optimization/runtime/upgrade.py` | THÊM file mới |
| `validation.py` | `runtime/optimization/runtime/validation.py` | THÊM file mới |
| `vectors.json` | `runtime/optimization/runtime/vectors.json` | THÊM file mới |
| `worker.py` | `runtime/optimization/runtime/worker.py` | THÊM file mới |
| `worker_v2.py` | `runtime/optimization/runtime/worker_v2.py` | THÊM file mới |

### optimization/tests

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `runtime_m4_flow.mjs` | `m4_reference/optimization/tests/runtime_m4_flow.mjs` | THÊM file mới |

### docs

| File đích | Nguồn ZIP cũ | Thao tác |
|---|---|---|
| `M2_STEP7_HANDOFF_20261004.md` | `New guide in new ZIP; supersedes old root guide` | THÊM file mới |
| `M2_STEP7_UPLOAD_MAP_20261004.json` | `New per-file mapping in new ZIP` | THÊM file mới |
| `M2_STEP7_VERIFY_20261004.py` | `New layout-only helper` | THÊM file mới |
| `RUNTIME_INSTALL_README.md` | `runtime/RUNTIME_INSTALL_README.md` | THÊM file mới |
| `STEP7_DELIVERY_RECEIPT_20261004.json` | `DELIVERY_RECEIPT.json` | THÊM file mới |
| `STEP7_DISTRIBUTION_MANIFEST_20261004.json` | `runtime/DISTRIBUTION_MANIFEST.json` | THÊM file mới |
| `STEP7_INSTALL_UPLOAD_ALLOWLIST_20261004.json` | `runtime/INSTALL_UPLOAD_ALLOWLIST.json` | THÊM file mới |
| `STEP7_PRODUCTION_INVENTORY_20261004.json` | `runtime/production_inventory.json` | THÊM file mới |
| `SafeRouteVN_TASK02_Step7_Final_Release_Integration_Windows_20261004.zip` | `packages/SafeRouteVN_TASK02_Step7_Final_Release_Integration_Windows_20261004.zip` | THÊM file mới |
| `SafeRouteVN_TASK02_Step7_Final_Release_Runtime_Windows_20261004.zip` | `packages/SafeRouteVN_TASK02_Step7_Final_Release_Runtime_Windows_20261004.zip` | THÊM file mới |
| `step7_INTEGRATION_CROSSWALK.md` | `runtime/docs/step7_INTEGRATION_CROSSWALK.md` | THÊM file mới |

Các file mới do bố trí này tạo: docs/M2_STEP7_HANDOFF_20261004.md (tài liệu này), docs/M2_STEP7_UPLOAD_MAP_20261004.json (mapping/hash), docs/M2_STEP7_VERIFY_20261004.py (checker). Hai file đầu không có source tương ứng nguyên byte trong ZIP cũ; lấy đúng từ ZIP mới. Checker mới là wrapper độc lập ngoài production inventory.

## 12. Hash các file release nguyên bản ở docs

| File | SHA-256 |
|---|---|
| `SafeRouteVN_TASK02_Step7_Final_Release_Runtime_Windows_20261004.zip` | `d5345e75db2b41914cf4d0ed96a83e50e9c251637065ae1264eb1f33f41cbe4e` |
| `SafeRouteVN_TASK02_Step7_Final_Release_Integration_Windows_20261004.zip` | `d59917dded655398a04f3856d1ae73c658cc3dec3002a3467fb24e8d4a45b5e7` |
| `STEP7_DELIVERY_RECEIPT_20261004.json` | `551fd7e12c6c99f540c81a6a9b0f206d23b0adda749bf0308973ad1695edf2e8` |

Contract lock tại optimization/runtime/HANDOFF_CONTRACT_LOCK.json có SHA-256 `c48234f5ba6b895d9cc4723c1b95b2105c48624b16b332bbe203111cd4b6184d`. Tên receipt/metadata đã đổi để dễ tìm trong docs nhưng byte gốc không thay đổi; assembly đặt metadata về tên gốc khi cài runtime.
