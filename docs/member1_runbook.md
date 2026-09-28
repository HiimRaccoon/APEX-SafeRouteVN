# Member 1 — hướng dẫn triển khai và vận hành SafeRoute VN

## Bắt đầu tại đây: tải snapshot từ Hugging Face tự động

Code được chia sẻ qua GitHub; dữ liệu lớn lưu dưới dạng **file/thư mục, không cần ZIP**, trong Hugging Face Dataset `nguyenviet21/saferoutevn-snapshots`. Script dùng địa chỉ trong `geo_data/snapshot_source.json` và danh sách **94 file kèm SHA-256** trong `geo_data/snapshot_files.json`. **Member 1 cần hoàn thành bước upload bên dưới trước khi thành viên khác tải lần đầu.** Trang tài khoản `huggingface.co/nguyenviet21` tự nó chưa phải kho dataset.

### Member 2/3/4: cài môi trường rồi chạy một lệnh tải

Sau khi clone/tải code GitHub, mở terminal tại **thư mục chứa `geo_data/` và `docs/`**. Tên thư mục dự án, ổ đĩa và các thư mục cha có thể khác máy Member 1; không cần đổi tên hay chỉnh file cấu hình. Dùng Python 3.12:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r geo_data/requirements.lock.txt
.\.venv\Scripts\python.exe geo_data/download_snapshot.py
```

Trên Linux/macOS, dùng `python3.12 -m venv .venv`, sau đó thay `.\.venv\Scripts\python.exe` bằng `.venv/bin/python` trong hai lệnh còn lại.

Script lấy gốc dự án từ **vị trí của chính `geo_data/download_snapshot.py`**, không dùng đường dẫn cố định trên máy Member 1. Nếu gọi script bằng đường dẫn tuyệt đối từ terminal ở nơi khác, dữ liệu vẫn được đặt cạnh `geo_data/` của bản code đó. Không cần giải nén hoặc di chuyển dữ liệu thủ công. Kết quả:

```text
<thu-muc-chua-geo_data>/
  scenarios/
    manifests/thu-duc-binh-thanh-v1.json
    fixtures/thu-duc-binh-thanh-v1/
    cached_context/hcmc/member1-tdbt-v1/
      run-settings.json
      routing/
      travel/
      weather-plan/
      weather/           # gồm đủ 38 file raw
      features/
      scenarios/        # đủ S0–S8 và polygon/profile
      qa/
```

Script tải trực tiếp **94 file, tổng khoảng 2,65 GB** của bộ `thu-duc-binh-thanh-v1`; nên để trống khoảng **4 GB** khi cài mới. Chỉ lấy ba nhánh `scenarios/` trên, dù dataset có cả PBF, graph và các run cũ. Mỗi file được tải vào vùng tạm, kiểm kích thước/SHA-256 rồi mới thay file đích; các manifest và catalog được cài sau dữ liệu. Cuối cùng script xác minh toàn bộ suite. Code, tài liệu và README trong dự án không bị ghi đè.

Chạy lại sẽ kiểm checksum từng file, bỏ qua file đã đúng và chỉ tải file thiếu/hỏng. Nếu mạng gián đoạn, các file đã tải xong được giữ lại; chỉ file đang tải phải bắt đầu lại. Không có bước tải/giải nén ZIP trong luồng mặc định. Dừng solver/backend đang đọc snapshot trước khi sửa một bản cài hỏng; chỉ dùng snapshot sau khi có kết quả `verified=true`.

Kết quả thành công có **`verified=true`, `scenarios=9`** và đường dẫn `scenariosRoot` trên máy của người chạy. `integrated=false` vẫn có nghĩa là chưa chứng nhận tích hợp solver/backend. Tiếp tục phần [Member 2 chạy S0](#receiving) bên dưới. Muốn kiểm tra lại độc lập từ gốc dự án:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli verify-scenarios --scenarios-root scenarios --suite-id thu-duc-binh-thanh-v1
```

Tùy chọn tương thích với bản bàn giao cũ: nếu đã nhận ZIP qua Drive/USB, vẫn có thể cài offline bằng `--archive`. Đây không phải cách tải mặc định từ Hugging Face:

```powershell
.\.venv\Scripts\python.exe geo_data/download_snapshot.py --archive "duong-dan-den/SafeRouteVN-member1-tdbt-v1-replay.zip"
```

### Member 1: upload nguyên thư mục dữ liệu lên Hugging Face

Đăng nhập tài khoản `nguyenviet21`, mở [Create dataset](https://huggingface.co/new-dataset), tạo dataset tên **`saferoutevn-snapshots`** nếu chưa có. Chọn Public nếu nhóm muốn tải không cần đăng nhập. Repo: <https://huggingface.co/datasets/nguyenviet21/saferoutevn-snapshots>.

Trên máy Member 1, dùng môi trường upload riêng, không đổi dependency của dự án. Bộ phiên bản dưới đây đã kiểm tra CLI; `hf-tools` hiện có trên máy Member 1 nên có thể bỏ qua bước tạo/cài nếu CLI đã chạy được:

```powershell
cd D:\Apex-SafeRouteVN
py -3.12 -m venv hf-tools
.\hf-tools\Scripts\python.exe -m pip install "huggingface_hub==1.16.1" "typer==0.20.0" "click==8.3.1" --timeout 120
.\hf-tools\Scripts\hf.exe auth login
.\hf-tools\Scripts\hf.exe upload nguyenviet21/saferoutevn-snapshots "D:\Apex-SafeRouteVN\SafeRouteVN\scenarios" scenarios --repo-type dataset
```

Lệnh cuối upload **toàn bộ `scenarios/` khoảng 10,6 GB**, gồm dữ liệu nguồn và các run cũ, giữ nguyên byte/cấu trúc. Dùng thư mục nguồn đầy đủ `SafeRouteVN/scenarios`, không dùng `github-upload/scenarios` vì bản Git không chứa cached context. Trên Hub phải có `scenarios/cached_context/hcmc/member1-tdbt-v1/`, `scenarios/fixtures/thu-duc-binh-thanh-v1/` và `scenarios/manifests/thu-duc-binh-thanh-v1.json` đúng như cây trên. Không cần upload ZIP, `SHA256SUMS.txt` của ZIP hay công cụ `hf-tools`.

Người nhận vẫn chỉ chạy downloader ở đầu tài liệu; repo ID và vị trí đích đã cấu hình sẵn. Hiện `revision` cố định tại commit **`e0ab1f32bd286318836f43912b8400708753bae8`**, đã kiểm tra có đủ 94 đường dẫn snapshot. Nếu chuyển repo hoặc phát hành snapshot mới, Member 1 cập nhật nguồn và các checksum/phiên bản tương ứng trước khi chia sẻ code. Không cần đổi revision chỉ vì upload thêm run khác lên `main`.

Đưa `geo_data/download_snapshot.py`, `geo_data/snapshot_source.json`, **`geo_data/snapshot_files.json`**, tests và runbook này lên GitHub. Giữ README nguyên bản. `.gitignore` hiện đã loại dữ liệu trong `scenarios/cached_context/`; không commit dữ liệu lớn hay `.venv` vào GitHub. Các trường `filename`/`sha256` của ZIP trong config chỉ phục vụ `--archive` offline, không được dùng để tải từ Hub.

Kiểm thử ngày 28/09/2026: **106 test đạt**, gồm 15 test downloader. Đã kiểm tra danh sách file trên Hugging Face và tải thật 3 file thiếu (khoảng 73 MB, gồm SQLite) vào một dự án đổi tên, gọi từ terminal ngoài dự án; 91 file đã đúng được dùng lại. Xác minh suite sau tải: `verified=true`, `scenarios=9`. README giữ nguyên.

Nếu dataset là Private hoặc gated, mỗi người cần được cấp quyền rồi đặt biến môi trường `HF_TOKEN` bằng token đọc Hugging Face của họ trước khi chạy script. Không ghi token vào code/runbook. Lỗi 401/403/404 cần kiểm tra quyền, trạng thái upload và tên repo/file. Lỗi checksum cần upload lại đúng file snapshot v1; không sửa checksum để bỏ qua lỗi.

Tài liệu Hugging Face: [tạo repository và upload file](https://huggingface.co/docs/hub/repositories-getting-started), [tải file từ Hub](https://huggingface.co/docs/huggingface_hub/guides/download).

---

Tài liệu chung cho Member 1: các mốc công việc, setup, dữ liệu OSM, graph/routing, weather, features, kịch bản, realtime, QA, bàn giao và data contract.

Phạm vi giao hàng hiện tại: **TP. Thủ Đức cũ và quận Bình Thạnh cũ**. Mạng đường vẫn bao phủ **TP.HCM hiện hành**, gồm khu vực Bình Dương và Bà Rịa–Vũng Tàu trước sáp nhập, giữ cả Côn Đảo, để cho phép tìm tuyến qua vùng lân cận. Mở PowerShell tại `D:\Apex-SafeRouteVN\SafeRouteVN`; các lệnh dùng `.venv\Scripts\python.exe`. Môi trường đã kiểm thử dùng Python 3.12.

**Bộ bàn giao hiện tại:** suite `thu-duc-binh-thanh-v1`, run `cached_context/hcmc/member1-tdbt-v1`, epoch `2026-09-27T21:00:00+07:00`. Đã ghi nhận catalog và đủ 7 manifest stage hoàn thành, QA `checksPassed=true`, `suiteReady=true`. Người nhận chạy `verify-scenarios` bên dưới để xác minh bản tải xuống. Bộ `hcmc-v1`/`member1-run-v1` là bản cũ; các phần triển khai phía sau còn giữ ví dụ và kết quả lịch sử của bản đó.

Trạng thái lịch sử đã ghi nhận: `member1-run-v1` có **800.406 cạnh routing/features, 38 vùng weather, đủ S0–S8**, `suiteReady=true`, QA `checksPassed=true`. Kiểm thử code gần nhất: **106 test đạt**. Review thành phố đã được tạo. Live đã công bố snapshot thời tiết 17:00 ngày 27/09/2026 lúc 17:08:12, `checksPassed=true`; kết quả này không khẳng định snapshot còn mới ở thời điểm đọc. Chưa ghi nhận gói handoff/consumer smoke trên dữ liệu thành phố tại lần kiểm tra gần nhất. Backend/solver và rà soát thực địa vẫn cần nghiệm thu; `integrated=false`.

## Mục lục

**Thành viên nhận code GitHub bắt đầu bằng phần tải Hugging Face ở đầu tài liệu. Nếu nhận dữ liệu thủ công qua Drive, xem [Hướng dẫn Member 2/3/4](#receiving).**

1. [Trạng thái các mốc và công việc còn lại](#milestones)
2. [Cài môi trường và kiểm thử](#setup)
3. [Boundary → PBF → graph](#ingestion)
4. [Pipeline cố định: routing → weather → features → S0–S8 → QA](#pipeline)
5. [Cập nhật weather qua API định kỳ](#realtime)
6. [Review, đóng gói và consumer](#handoff)
7. [Data contract, schema và đơn vị](#data-contract)
8. [Phụ lục: Overpass theo ô và kết quả lịch sử](#overpass)
9. [Xuất fixtures/manifests theo T1.6 trong XLSX](#scenario-catalog)
10. [Giao hàng Thủ Đức–Bình Thạnh, tìm đường trên graph rộng](#delivery-area)

Nếu đã có `member1-run-v1`, mở phần [realtime](#realtime) để cập nhật weather hoặc phần [bàn giao](#handoff) để tạo gói. Không cần chạy lại ingestion. Khi gặp `Only 0 reachable candidates`, xem [chẩn đoán depot](#depot-reachability).

Các số test 21/29/39/60 xuất hiện trong kết quả theo ngày hoặc bản vá là lịch sử; trạng thái kiểm thử hiện tại nằm ở phần đầu tài liệu.

<a id="receiving"></a>

## Hướng dẫn cho Member 2/3/4 nhận bàn giao

### Bộ dữ liệu và cấu trúc cần tải từ Drive

Dùng thống nhất **suite `thu-duc-binh-thanh-v1`**. Tải code `geo_data/`, tài liệu `docs/member1_runbook.md` và đủ ba nhánh dữ liệu dưới đây vào cây dự án chung. Giữ nguyên tên và quan hệ thư mục:

```text
<thu-muc-du-an>/
  geo_data/                         # toàn bộ code, profiles và requirements
  docs/member1_runbook.md
  scenarios/
    manifests/thu-duc-binh-thanh-v1.json
    fixtures/thu-duc-binh-thanh-v1/  # toàn bộ thư mục, gồm S0–S8 và delivery_area.geojson
    cached_context/hcmc/member1-tdbt-v1/
      run-settings.json
      routing/
      travel/
      weather-plan/
      weather/
      features/
      scenarios/
      qa/
```

Giữ toàn bộ file trong mỗi stage, gồm `manifest.json` và dữ liệu được manifest liệt kê. `fixtures/` là bộ kịch bản để consumer đọc; `manifests/` liên kết kịch bản với run nguồn; `cached_context/` chứa mạng đường và chi phí tương ứng. Chỉ tải fixtures và catalog là chưa đủ. Giữ cả `scenarios/` bên trong run vì QA và catalog đối chiếu bundle nguồn với bản xuất.

Để replay/tích hợp bộ này, không cần tải `.venv`, `__pycache__`, PBF/raw tiles, `graph-v1`, các run cũ hoặc snapshot live cũ. Những dữ liệu nguồn đó dành cho truy vết/tái dựng. Polygon cần cho replay đã nằm trong fixtures và bundle scenario; file đầu vào riêng ở `delivery-areas/` chỉ cần khi tạo run mới. Mỗi thành viên giữ phần code mình phụ trách trong cây dự án chung.

Depot/điểm giao của bộ mới nằm trong polygon Thủ Đức–Bình Thạnh. Solver phải dùng toàn bộ mạng routing được bàn giao: đường đi được phép qua quận/vùng khác, không cắt cạnh theo polygon giao hàng.

### A. Mở đúng thư mục và cài môi trường

Tải bản dự án từ Drive xuống máy. Theo cấu trúc ZIP của nhóm, thư mục làm việc là `Apex-SafeRouteVN/SafeRouteVN_Project_Structure_PLAN/`, nơi có `geo_data/`, `scenarios/`, `docs/`, `backend/` và `optimization/`. Trên máy Member 1, thư mục tương đương mang tên `SafeRouteVN/`. Tên thư mục gốc có thể khác; các lệnh dưới đây đều chạy từ thư mục chứa `geo_data/`.

Member 2/3 cần Python 3.12 và cài dependency của Member 1; Member 4 chỉ cần môi trường Python nếu tự kiểm tra dữ liệu thay vì nhận qua backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r geo_data/requirements.lock.txt
.\.venv\Scripts\python.exe -m geo_data.cli --help
```

Mỗi máy tạo `.venv` riêng. Thư mục làm việc cần có code và bộ dữ liệu `scenarios/cached_context/hcmc/member1-tdbt-v1/`. Bộ dữ liệu cố định này cho phép đọc/tìm tuyến offline sau khi cài dependency; không cần gọi lại Overpass, tải PBF hay tạo lại graph.

### B. Kiểm tra bản tải xuống trước khi tích hợp

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli verify-scenarios --scenarios-root scenarios --suite-id thu-duc-binh-thanh-v1
```

Lệnh chỉ đọc, kiểm tra cả fixtures/catalog và các bundle nguồn, xác nhận checksum, QA, phiên bản, polygon và epoch. Kết quả cần có `verified=true`, `scenarios=9`; `integrated=false` nghĩa là bộ dữ liệu chưa chứng nhận solver/backend đã tích hợp. Việc kiểm checksum có thể mất thời gian do phải đọc các file lớn. Nếu lỗi thiếu file/checksum, tải lại đúng phần từ Drive; không chỉnh manifest để bỏ qua lỗi. Sau khi sửa code, có thể chạy thêm `.\.venv\Scripts\python.exe -m unittest discover -s geo_data/tests -q` để kiểm tra bằng dữ liệu nhỏ/HTTP mock.

Đây là hướng dẫn cho **bản dự án theo cây thư mục của nhóm**. Nếu nhận riêng gói có `data/`, `sdk/`, `provenance/` thì dùng `verify-handoff` và `Member1Dataset` theo [phần gói bàn giao](#handoff); không truyền `member1-tdbt-v1` vào tham số `--package`.

### C. Các đầu vào cần đọc

Theo T1.6 trong XLSX, bộ kịch bản bàn giao được xuất vào `scenarios/fixtures/<suite-id>/` và catalog ở `scenarios/manifests/<suite-id>.json`. Bộ hiện tại dùng `<suite-id>` là `thu-duc-binh-thanh-v1`. Member 1 chạy [lệnh export](#scenario-catalog) trước khi chia sẻ; Member 2/3 nên dùng `ScenarioCatalog` để đọc đúng fixture/context bằng đường dẫn tương đối. Các đường dẫn trong bảng dưới đây vẫn là bản nguồn đã QA.

Đường dẫn trong bảng tính từ `scenarios/cached_context/hcmc/member1-tdbt-v1/`:

| Đầu vào | Người dùng chính | Cách dùng |
| --- | --- | --- |
| `routing/network.sqlite` | Member 2, Member 3 | Node/cạnh/geometry và hạn chế rẽ; đọc bằng `RoutingGraph` |
| `features/features.sqlite` | Member 2, Member 3 | Chi phí thời gian và exposure đã áp dụng weather; dùng cùng routing tương ứng |
| `scenarios/S0.json` … `S8.json` | Member 2, Member 3 | Bản nguồn của fixtures; đọc bản xuất qua `ScenarioCatalog.scenario()` |
| `scenarios/delivery_area.geojson` | Member 2/3/4 | Biên vùng giao hàng, cũng có trong fixtures; dùng để kiểm vị trí/vẽ phạm vi, không cắt tuyến |
| `weather/weather_context.json` | Member 3, qua backend tới Member 4 | Weather theo vùng, đơn vị, validAt/fetchedAt, flags và nguồn |
| `qa/qa_report.json`, các `manifest.json` | Member 2, Member 3 | Bằng chứng QA, checksum và phiên bản dữ liệu |
| `travel/profile.json`, `features/risk_model.json` | Member 2, Member 3 | Tra cứu giả định tốc độ/trọng số; không sửa file trong bundle |

`graph-v1` là graph nguồn phục vụ truy vết/tái xử lý. Solver dùng `member1-tdbt-v1/routing`, vì graph nguồn chưa áp dụng đầy đủ hạn chế rẽ của bước routing. Có thể đọc SQLite theo nhu cầu; tránh nạp toàn bộ JSONL thành một mảng lớn hoặc tạo ma trận mọi node của thành phố.

### D. Member 2: thử S0 rồi nối vào thuật toán

Chạy thử một chặng bằng CLI từ đúng điểm lấy hàng của đơn đầu tiên trong S0:

```powershell
$run = "scenarios/cached_context/hcmc/member1-tdbt-v1"
$s0 = Get-Content "scenarios/fixtures/thu-duc-binh-thanh-v1/S0.json" -Raw -Encoding utf8 | ConvertFrom-Json
$order = $s0.initialState.orders[0]
$pickup = $s0.initialState.locations | Where-Object { $_.id -eq $order.pickupLocationId }
.\.venv\Scripts\python.exe -m geo_data.cli route-check --routing "$run/routing" --features "$run/features" --from-node $pickup.graphNodeId --to-node $order.graphNodeId --weight time
```

Kết quả gồm `edgeIds`, `distanceKm`, `travelTimeHours`, `relativeExposure`. `weight=time` chọn tuyến theo thời gian, `weight=exposure` chọn theo exposure, `weight=distance` theo chiều dài. Đây là tìm đường đơn tham chiếu; các profile và solver VRP vẫn do Member 2 triển khai.

Ví dụ dùng trực tiếp trong Python của Member 2/3:

```python
from geo_data.scenario_catalog import ScenarioCatalog

catalog = ScenarioCatalog("scenarios", "thu-duc-binh-thanh-v1")
scenario = catalog.scenario("S0")
order = scenario["initialState"]["orders"][0]
pickup = next(p for p in scenario["initialState"]["locations"]
              if p["id"] == order["pickupLocationId"])

with catalog.open_graph() as graph:
    route = graph.path(pickup["graphNodeId"], order["graphNodeId"], weight="time")
    if route is None:
        print("No route under the current routing policy")
    else:
        print(route)
        incoming = route["edgeIds"][-1] if route["edgeIds"] else None
        return_route = graph.path(order["graphNodeId"], pickup["graphNodeId"],
                                  weight="time", incoming_edge=incoming)
        print(return_route)
```

Khởi tạo `ScenarioCatalog` một lần khi nạp suite vì bước này đọc checksum các file lớn; giữ graph mở khi tính các chặng. Catalog kiểm tra liên kết fixture/context/polygon.

Giữ incoming edge giữa các chặng để không bỏ qua cấm rẽ tại điểm giao. `None` nghĩa là không có tuyến theo policy hiện tại; `SearchLimitError` nghĩa là hết budget tìm kiếm, chưa kết luận được có tuyến hay không. Ma trận chi phí chỉ theo node có thể làm mất trạng thái rẽ khi nối chặng; solver cần kiểm tra edge sequence và incoming edge của tuyến ghép.

Trình tự tích hợp: S0 (3 đơn/2 xe) → các ca S1–S8 → ghi nghiệm/metric/diagnostics vào phần output của Member 2. S5/S6 có ràng buộc cố ý khó hoặc bất khả thi; không sửa dữ liệu để ép mọi ca đều giao hết. Giữ chung snapshot khi so sánh các profile.

### E. Member 3: nối dữ liệu vào backend

1. Khởi tạo `ScenarioCatalog("scenarios", "thu-duc-binh-thanh-v1")`, lấy scenario bằng `catalog.scenario("S0")` và đường dẫn context qua `catalog.paths`. Đọc `initialState` của scenario, giữ ID đơn/xe/location, tọa độ và `graphNodeId`. Trong replay, đồng hồ nghiệp vụ bắt đầu ở `initialState.currentTime`, không tự thay bằng giờ máy hiện tại.
2. Nhận nghiệm từ solver Member 2, kiểm tra phiên bản và chuỗi cạnh. Tra `edges.geometryJson` trong routing SQLite theo đúng thứ tự `edgeIds`; hình học đã có chiều đi. Gói portable có `Member1Dataset.describe_path` để kiểm tuyến và xuất GeoJSON; bản dự án có thể dùng `RoutingGraph.validate_path` rồi tra geometry.
3. Xử lý events S2/S3/S4 và trạng thái đơn/xe; không tự chuyển hàng ONBOARD sang xe khác. S4 là mưa giả lập cần tính lại chi phí theo context delta, khác với luồng lấy weather thật định kỳ.
4. Trả cho frontend geometry, metric, trạng thái, thời điểm dữ liệu và version. Đây là nội dung cần triển khai trong backend, chưa có sẵn HTTP endpoint của Member 1.

Lưu `suiteId`, `routingVersion`, `featuresVersion`, `contextVersion`, `deliveryAreaVersion` cùng kết quả tối ưu. Giữ `deliveryRegionId` của đơn hàng khi trao đổi giữa các module. Khi nhận đơn mới trong chế độ live, backend cần kiểm tra điểm giao theo polygon được chọn; fixtures chỉ đảm bảo các đơn được sinh sẵn nằm đúng vùng. Đơn vị giao tiếp: km, km/h, h, VND, kg; width và visibility là m; mưa mm kèm interval h; timestamp `+07:00`. Exposure là điểm tổng hợp theo chiều dài, không phải xác suất tai nạn.

### F. Member 4: hiển thị qua backend

Frontend nhận GeoJSON đúng tuyến solver chọn, vị trí đơn/xe/depot và metric từ Member 3. Hiển thị km, thời gian và chi phí với đơn vị rõ ràng; nếu chuyển giờ sang phút trên UI thì chỉ đổi ở lớp hiển thị. GeoJSON dùng thứ tự tọa độ `[longitude, latitude]`; một số thư viện bản đồ có API riêng nhận `[latitude, longitude]`, cần chuyển đúng tại chỗ gọi.

Hiển thị thêm polygon từ `fixtures/thu-duc-binh-thanh-v1/delivery_area.geojson` do backend cung cấp để phân biệt vùng giao hàng và tuyến đi vòng. Đây là vùng theo địa giới cũ được chọn cho demo.

Nền bản đồ/tile provider thuộc phần frontend. Dữ liệu đường hiện lấy từ OSM; code Member 1 chưa tích hợp Google Maps. Không thay geometry của nghiệm bằng tuyến do nhà cung cấp bản đồ khác tính. Weather cần hiển thị validAt và trạng thái thiếu/cũ nếu backend báo; tốc độ hiện là ước tính. Trong giai đoạn chưa có backend, có thể dùng `s0_routes.geojson` do `consumer-smoke` tạo làm dữ liệu giao diện mẫu; đó không phải nghiệm VRP đã tối ưu.

### G. Chuyển sang weather live trên máy nhận

Hoàn thành replay S0 với snapshot cố định trước. Khi thử vận hành theo giờ hiện tại, tạo thư mục live **mới trên máy nhận** để lưu đường dẫn nguồn đúng máy đó:

```powershell
$run = "scenarios/cached_context/hcmc/member1-tdbt-v1"
.\.venv\Scripts\python.exe -m geo_data.cli watch-live --routing "$run/routing" --plan "$run/weather-plan" --output scenarios/cached_context/hcmc/member1-tdbt-live-local --travel-profile "$run/travel/profile.json" --risk-profile "$run/features/risk_model.json" --user-agent "SafeRouteVN/0.1 team development" --interval-hours 0.5
```

Luồng live cập nhật weather Open-Meteo và tính lại chi phí trên graph OSM đã lưu; không tải lại mạng đường và không cung cấp giao thông trực tiếp. Việc giới hạn điểm giao trong hai vùng không thu nhỏ graph/weather-plan của run.

Lệnh cần kết nối Internet, chạy ngay rồi đợi 0.5 h sau mỗi chu kỳ; `Ctrl+C` dừng. Có thể thêm `--cycles 1` để thử một lần. Xem [phần realtime](#realtime) về độ mới, thời gian xử lý, dung lượng và lỗi API.

Member 3 dùng `load_latest("scenarios/cached_context/hcmc/member1-tdbt-live-local")` trước mỗi lần tối ưu; chuyển đường dẫn routing/features và phiên bản đã chọn cho Member 2. Giữ cùng phiên bản suốt lần tối ưu đó. Khi phiên bản đổi, backend quyết định yêu cầu tính lại theo trạng thái đơn/xe hiện tại. `load_latest` từ chối dữ liệu quá cũ; backend cần thể hiện lỗi/trạng thái này, không gắn nhãn dữ liệu cũ là realtime.

S0–S8 có deadline và version gắn với snapshot gốc. Không trộn nguyên scenario cũ với features live rồi coi là replay hợp lệ; chế độ live cần trạng thái nghiệp vụ và cửa sổ thời gian tương ứng. `run-settings.json`/`live-settings.json` cũ chứa đường dẫn máy Member 1: đọc bộ dữ liệu cố định không cần sửa chúng, còn tạo pipeline/live mới thì dùng output mới và đường dẫn nguồn ở máy nhận.

### H. Khi nào xác nhận tích hợp đạt?

| Thành viên | Bằng chứng bàn giao lại cho nhóm |
| --- | --- |
| Member 2 | Load đúng snapshot, chạy solver S0, kiểm tra capacity/time windows/cấm rẽ, trả edgeIds + metric + version; ghi nguyên nhân đơn không phục vụ |
| Member 3 | Load/replay trạng thái, xử lý events, trao đổi với solver; đọc live và xử lý dữ liệu quá cũ; trả geometry/metric/version cho frontend |
| Member 4 | Vẽ đúng nghiệm, đúng tọa độ/đơn vị; hiển thị trạng thái đơn/xe và thời điểm weather |

Lưu kết quả nghiệm thu ở output/báo cáo riêng. Không sửa file đã có checksum hoặc tự đổi `integrated` trong bundle của Member 1; chỉ xác nhận tích hợp khi các thành viên đã chạy kiểm tra thực tế.

<a id="milestones"></a>

## 1. Trạng thái các mốc và công việc còn lại

Cập nhật theo artifact của `scenarios/cached_context/hcmc/member1-run-v1` và các kiểm thử code. Bảng phân biệt code đã có, pipeline đã chạy và việc còn cần xác nhận.

| Mốc | Kết quả hiện có | Phần còn lại |
| --- | --- | --- |
| M1-00 Contract/đơn vị | Contract draft, km/kmh/h/VND/kg/m và timestamp Việt Nam; có adapter chuyển đổi/kiểm tra | Member 2/3 thống nhất schema trước đóng băng liên module |
| M1-01 Boundary/phân vùng | Polygon OSM hiện hành, 6 coverage probes, tile index giữ phần rời | Đối chiếu toàn bộ đường biên với nguồn hành chính; probes không phải xác minh pháp lý |
| M1-02 OSM ingestion | PBF tải/cache/checksum, lọc TP.HCM, giữ tags/restriction references | Chụp snapshot mới khi cần; không cần hoàn thành raw tiles cũ |
| M1-03 Graph nguồn | Graph preview đã chạy: 354.123 node, 801.003 cạnh có hướng, giữ geometry/cạnh song song | Kiểm tra các mẫu hình học và coverage tại vùng cần phục vụ |
| M1-04 Policy/routing | Routing đã chạy: 800.406 cạnh; có forbidden_turns và loại bảo thủ trường hợp chưa hỗ trợ | Rà soát access/barrier/exclusions thực tế; consumer phải dùng incoming-edge state |
| M1-05 Travel | 800.406 cạnh có speed km/h và time h, profile/version/flags | Hiệu chỉnh tốc độ và hệ số; dữ liệu hiện tại là ESTIMATED, không live traffic |
| M1-06 Weather | Snapshot cho 38 vùng, run hiện tại không dùng snapshot dự phòng | Rà soát grid theo nhu cầu và thời điểm nguồn; snapshot cố định không tự cập nhật; chế độ live ở phần realtime |
| M1-07 Features/proxy | 800.406 cạnh có factors/exposure, QA công thức/đơn vị đạt | Hiệu chỉnh giả định và weights; không coi proxy là xác suất tai nạn |
| M1-08 Scenarios | Đủ S0–S8; suiteReady, S7/S8 evidence đạt trong run hiện tại; depot chọn có kiểm tra kết nối | Member 2 chạy bài toán solver chung; Member 3 replay sự kiện/trạng thái |
| M1-09 QA/bàn giao | Full-run QA đã đạt. Đã bổ sung quality-review, build-handoff, verify-handoff, consumer-smoke và SDK ví dụ; đã kiểm thử fixture | Người dùng chạy các lệnh bàn giao trên dataset thành phố, kiểm tra báo cáo/mẫu đường; consumer xác nhận tích hợp |

`optimization/` và `backend/` hiện mới có khung thư mục/README nên chưa có solver/API để xác nhận tích hợp. Không triển khai thay phần sở hữu của Member 2/3 trong công việc Member 1.

Các module mới của M1-09 được kiểm bằng dữ liệu nhỏ và HTTP mock, gồm chuyển gói sang đường dẫn khác, chạy reader từ SDK đã copy, phát hiện sửa dữ liệu/SDK/policy, QA sai snapshot và đọc 6 chặng của S0. Chưa chạy các lệnh bàn giao mới trên dataset thành phố trong phiên phát triển này.

Bước người dùng thực hiện tiếp: [hướng dẫn M1-09](#handoff). Mẫu `acceptance_template.json` sẽ được tạo trong gói; ghi kết quả ký nhận và bằng chứng ở thư mục riêng. `integrated=false` cho tới khi solver/backend thật chạy đạt. Không có M1-10 trong kế hoạch hiện tại; công việc tiếp theo nằm ở nghiệm thu/tích hợp các mốc trên.

<a id="setup"></a>

## 2. Cài môi trường và kiểm thử

### Cài môi trường

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r geo_data/requirements.txt
.\.venv\Scripts\python.exe -m geo_data.cli --help
```

Shapely dùng để kiểm tra polygon, PyProj chia ô/buffer theo km qua UTM 48N, Requests gọi HTTP, tzdata cung cấp múi giờ trên Windows, Pyosmium đọc/lọc OSM PBF. Phiên bản đã chạy được ghi ở `geo_data/requirements.lock.txt`; dùng file đó thay requirements.txt để tái lập môi trường đã kiểm thử.

### Kiểm thử không cần mạng

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s geo_data/tests -v
.\.venv\Scripts\python.exe -m geo_data.cli plan --boundary geo_data/tests/fixtures/boundary.synthetic.geojson --scope test --region-id synthetic --tile-km 2 --output scenarios/cached_context/smoke/tiles.geojson
.\.venv\Scripts\python.exe -m geo_data.cli inspect-plan --plan scenarios/cached_context/smoke/tiles.geojson
```

Fixture là hai polygon tổng hợp để kiểm tra phần đất liền và phần rời; **không phải ranh giới TP.HCM**. Mọi HTTP trong unittest được mock. Fixture sẽ bị từ chối nếu cố dùng scope mặc định `hcmc-current`.

Kết quả kiểm thử gần nhất: **91 test đạt**, gồm 10 test live, 6 test catalog/fixtures và 9 test delivery polygon. Các bộ kiểm thử đều dùng graph nhỏ/HTTP mock; không thay thế đo hiệu năng toàn thành phố hoặc nghiệm thu thực địa.

Phạm vi kiểm thử pipeline gồm: cấm rẽ, only-turn, no-u-turn vẫn cho đi thẳng, conditional/via-way quarantine, ngoại lệ xe máy, cap mph, đơn vị giờ, factor thiếu dữ liệu, HTTP retry, tải tiếp từng vùng, cache offline, giới hạn fallback, snapshot khác nội dung có contextVersion khác, seed tái lập, trạng thái ONBOARD, S0 3/2, QA xuyên pipeline và runner giữ epoch khi chạy lại.

<a id="ingestion"></a>

## 3. Boundary, PBF và graph

### Lấy boundary candidate và kiểm tra phạm vi

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli boundary-fetch --osm-id R1973756 --output scenarios/cached_context/hcmc/boundary.candidate.geojson --user-agent "SafeRouteVN/0.1 Member1 development"
```

Relation ID này đã lấy được qua Overpass trong phiên triển khai: version 288, tag `admin_level=4`, `ISO3166-2=VN-SG`, tên Thành phố Hồ Chí Minh; đạt sáu coverage probes. Việc này chưa thay thế đối chiếu toàn bộ đường biên hành chính. Nominatim trên máy kiểm thử bị từ chối kết nối, nên ưu tiên lệnh Overpass bên dưới. Chạy lại dùng cache; `--refresh` mới lấy lại. Khi triển khai dùng một User-Agent nhận diện ứng dụng/đầu mối liên hệ phù hợp chính sách dịch vụ.

Nếu Nominatim không kết nối được, dùng Overpass để lấy geometry các outer/inner ways của relation:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli boundary-fetch --osm-id R1973756 --provider overpass --output scenarios/cached_context/hcmc/boundary.overpass.geojson --user-agent "SafeRouteVN/0.1 Member1 development"
```

Provider này ghép các vòng outer/inner, giữ lỗ và phần rời, từ chối geometry thiếu hoặc nested boundary relation chưa hỗ trợ. Nếu nhận HTTP 504, chờ dịch vụ hồi phục rồi chạy lại; không tạo boundary giả. Khi tạo plan, thay `--boundary` bằng đúng file provider đã lấy thành công. Không trộn hai provider vào cùng cache output.

Kiểm tra nguồn, tên, tags hành chính, toàn bộ phần rời và coverageChecks. Nếu thiếu Bình Dương/Bà Rịa–Vũng Tàu/Côn Sơn thì không dùng boundary đó cho toàn thành phố. Nếu nhà cung cấp lỗi mạng, có thể dùng GeoJSON được xác minh từ nguồn khác; không thay bằng bbox hoặc fixture rồi gọi là ranh giới thật.

Lệnh tạo plan từ candidate:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli plan --boundary scenarios/cached_context/hcmc/boundary.overpass.geojson --output scenarios/cached_context/hcmc/tiles.geojson --tile-km 5 --buffer-km 0.25
.\.venv\Scripts\python.exe -m geo_data.cli inspect-plan --plan scenarios/cached_context/hcmc/tiles.geojson
```

Với GeoJSON ngoài, bổ sung `--source "nguồn dữ liệu" --boundary-version "phiên bản"`. Chỉ dùng Polygon/MultiPolygon WGS84 hoặc Feature chứa geometry đó; FeatureCollection phải có đúng một feature. Không tự sửa polygon lỗi hay tự bỏ đảo. Output plan đã tồn tại với nội dung khác sẽ bị từ chối; chọn tên phiên bản mới.

Các coverage probes chỉ phát hiện thiếu vùng rõ ràng; vẫn phải đối chiếu nguồn hành chính để xác nhận toàn bộ đường biên. Kích thước 5 km là mặc định thử nghiệm có thể đổi, không phải kết luận tối ưu cho toàn thành phố.

Plan OSM đã tạo trong phiên triển khai có **1.627 ô**, do polygon hành chính chứa cả vùng biển đến khu vực Côn Đảo; đây không phải 1.627 ô có đường. Không suy ra diện tích đất liền từ diện tích polygon này. Với toàn thành phố, dùng luồng PBF ngay bên dưới để tránh tải lần lượt những ô biển rỗng. Không loại vùng biển/đảo chỉ bằng một bbox nhỏ quanh đất liền.

### Ưu tiên cho toàn TP.HCM: tải PBF một lần, lọc trên máy

Cập nhật 27/09/2026: dùng **Geofabrik Vietnam PBF** cho dữ liệu toàn thành phố. Lệnh Overpass theo ô bên dưới vẫn dùng được cho kiểm tra nhỏ, nhưng không còn là cách tải chính cho 1.627 ô. Không cần hoàn thành manifest `raw-v1` để sử dụng dataset PBF mới.

```powershell
.\.venv\Scripts\python.exe -m pip install -r geo_data/requirements.txt
.\.venv\Scripts\python.exe -m geo_data.cli bulk-download --output scenarios/cached_context/vietnam-extract --user-agent "SafeRouteVN/0.1 Member1 development"
.\.venv\Scripts\python.exe -m geo_data.cli extract-city --source scenarios/cached_context/vietnam-extract/source.osm.pbf --boundary scenarios/cached_context/hcmc/boundary.overpass.geojson --output scenarios/cached_context/hcmc/pbf-v1
```

- `bulk-download` tải file PBF có sẵn (khoảng 329 MB tại thời điểm kiểm tra), hiển thị MB/tổng MB, %, MB/s. Không yêu cầu máy chủ xử lý từng ô.
- Mất mạng: tự retry có giới hạn, dùng HTTP Range/If-Range để tiếp tục file `.part`. Chạy lại cùng lệnh nếu hết lượt retry. Nếu server bỏ qua Range, chương trình ghi lại từ đầu thay vì nối sai nội dung.
- Kiểm tra MD5 do nguồn cung cấp, kích thước và SHA-256 cục bộ trước khi đánh dấu hoàn thành. Khi nguồn thay đổi, không ghép byte của hai phiên bản.
- File hoàn thành được dùng lại sau kiểm tra checksum; URL `latest` không tự làm mới cache đã hoàn thành. Muốn snapshot mới, chọn output khác; có thể truyền `--url` là URL `.osm.pbf` có ngày và file `.md5` tương ứng.
- `extract-city` chạy hoàn toàn offline, chọn các highway ways giao với polygon TP.HCM + buffer 0,25 km; giữ nguyên cả way và tham chiếu ngoài biên cần thiết. Segment xuyên polygon vẫn được chọn kể cả khi các node đầu/cuối nằm ngoài.
- Giữ tags của nodes (bao gồm barrier/access), ways và restriction relations liên quan. Hoàn thiện backward references rồi kiểm tra thiếu node/way/relation trước khi công bố kết quả.
- Không cần chia 1.627 ô hoặc query các vùng biển không có đường. Các đảo có đường trong nguồn và nằm trong polygon vẫn được giữ.
- Không trộn cache Overpass khác thời điểm với snapshot PBF. Cache theo ô cũ được giữ nguyên tại `raw-v1`.
- Lọc cần bộ nhớ cho node-location index và vài lượt đọc file; nếu bị ngắt, chạy lại bước lọc từ đầu trên file PBF đã có, không tải lại mạng. Kết quả lọc đã hoàn thành có checksum thì được dùng lại.

Đầu ra:

```text
scenarios/cached_context/vietnam-extract/
  source.osm.pbf
  extract-manifest.json
  download-state.json
scenarios/cached_context/hcmc/pbf-v1/
  roads.osm.pbf
  manifest.json
```

`roads.osm.pbf` là dataset OSM thô đã lọc và kiểm tra tham chiếu, dùng làm đầu vào dựng graph. `routingReady=false`: chưa áp dụng policy xe máy, chưa tính speed/travel-time/risk. `complete=true` chỉ nói bộ lọc đã hoàn thành trên snapshot nguồn, không chứng nhận bản đồ thực tế đầy đủ. Thời điểm nguồn lấy từ PBF header; phạm vi phụ thuộc cả polygon TP.HCM và extract Việt Nam do nhà cung cấp cắt.

Nguồn: [Geofabrik Việt Nam](https://download.geofabrik.de/asia/vietnam.html), [quy trình extract](https://download.geofabrik.de/technical.html), [Pyosmium BackReferenceWriter](https://docs.osmcode.org/pyosmium/latest/reference/Data-Writers/).

#### Kết quả đã chạy ngày 27/09/2026

- Tải file Việt Nam 329,3 MB thành công; một lần timeout metadata được tự retry, MD5/SHA-256 đạt. Tốc độ đo trong lần truyền file thành công khoảng 8,5 MB/s; đây không phải cam kết tốc độ cho lần tải khác.
- Timestamp dữ liệu trong PBF: **2026-09-27T03:22:51+07:00**.
- Lọc và kiểm tra cục bộ mất `0.0182116667 h` (khoảng 66 giây trên máy hiện tại).
- Kết quả tại `scenarios/cached_context/hcmc/pbf-v1/roads.osm.pbf`: **12.638.774 byte**, **1.153.118 nodes**, **219.013 ways**, **1.644 relations**. Đây là OSM ways, chưa phải số cạnh graph sau xử lý xe máy.
- `manifest.json`: `complete=true`, `referenceComplete=true`, `routingReady=false`.
- Chạy lại hai lệnh dùng cache, kiểm tra SHA-256 thành công, không gọi mạng. **29 unittest đạt**, bao gồm trường hợp tải ngắt giữa chừng, HTTP Range sai, server bỏ qua Range, nguồn đổi phiên bản, MD5 sai, way xuyên biên và giữ node tags/restriction references.

Dataset này đã sẵn sàng làm đầu vào cho bước dựng graph. Không cần chạy nốt các ô Overpass cũ để sử dụng nó. Phạm vi/độ chính xác vẫn phụ thuộc boundary OSM và extract nguồn; kiểm tra tham chiếu không thay thế kiểm tra quyền đi xe máy hoặc chất lượng đường.

### Bước tiếp theo sau khi lọc PBF: dựng graph xe máy

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli build-graph --source scenarios/cached_context/hcmc/pbf-v1/roads.osm.pbf --output scenarios/cached_context/hcmc/graph-v1
```

Lệnh chạy hoàn toàn **offline**, dùng PBF đã tải. Có tiến độ 5 giai đoạn và số ways/cạnh trong giai đoạn dựng graph. Chạy lại cùng lệnh kiểm tra checksum và dùng cache hoàn chỉnh. Đổi source hoặc policy phải chọn output mới. Nếu bị ngắt trong khi dựng, có thể chạy lại để dựng từ đầu trên file cục bộ; nếu bị ngắt đúng lúc công bố artifact, chọn output mới khi CLI báo có artifact chưa công bố. Chỉ xử lý `.writer.lock` sau khi xác nhận tiến trình cũ đã dừng.

Đây là **M1-03 và bản đầu của M1-04**: graph có hướng, giữ cạnh song song, chiều dài km, chiều rộng m nếu đọc được từ nguồn. Gom các điểm hình học liên tiếp trong cùng OSM way thành một cạnh, nhưng giữ geometry đầy đủ và tách tại node giao nhau, node có tags và via-node của restriction. Không nối hai đường chỉ vì tọa độ hình học giao nhau; không tự nối đảo vào đất liền.

| File trong `graph-v1/` | Dùng để làm gì |
| --- | --- |
| `graph.sqlite` | Graph chuẩn để đọc cục bộ: bảng `nodes`, `edges`, `ways`, `metadata`; tags gốc của way nằm trong `ways.tagsJson` |
| `nodes.csv` | Node giao thông, tọa độ WGS84, ID component yếu và tags |
| `edges.csv` | Cạnh có hướng, ID duy nhất, chiều dài km, chiều rộng m, geometry và danh sách OSM node theo chiều cạnh |
| `components.csv` | Các phần graph không liên thông khi bỏ qua hướng, số node và bbox; giữ tất cả component |
| `policy_audit.csv` | Node/way bị loại hoặc chỉ giữ một hướng và lý do |
| `restrictions.json` | Toàn bộ restriction relations nguồn và trạng thái cần xử lý |
| `qa_report.json` | Số liệu graph, kiểm tra tham chiếu/chiều dài và giới hạn |
| `policy.json`, `manifest.json` | Policy đã dùng, provenance, phiên bản, đơn vị và checksum |

Policy ở [`geo_data/osm/policies/motorcycle_v1.json`](../geo_data/osm/policies/motorcycle_v1.json), tùy chọn `--policy <file.json>`. Đây là giả định kỹ thuật cho preview, cần rà soát theo thực địa/yêu cầu nghiệp vụ. Chưa thay đổi policy dùng chung trong `configs/`.

- Ưu tiên access theo loại xe: `motorcycle`, `motor_vehicle`, `vehicle`, `access`; áp dụng tag hướng trong cùng mức ưu tiên. Giữ các giá trị cho phép được cấu hình; `private`, `destination`, `delivery`, giá trị không hiểu và access/oneway có điều kiện liên quan tới xe máy bị loại trong bản này. Việc này có thể loại cả đường được phép giao hàng tới một địa chỉ cụ thể.
- Có `oneway=-1`, `oneway:motorcycle`, mặc định một chiều cho roundabout/motorway; giá trị hướng chưa hỗ trợ bị loại. Các highway đặc biệt như footway/motorway cần tag cho phép phương tiện phù hợp, không suy ra từ `access=yes` chung.
- Barrier cứng bị chặn; cổng/barrier chưa xác minh cần quyền phương tiện rõ ràng theo policy. Loại cả đoạn đã gom kề node bị chặn, vì vậy có thể mất cả khả năng tiếp cận cuối đường. Audit ghi node và lý do; đây là lựa chọn bảo thủ, không phải mô hình vận hành cổng theo giờ.
- Chiều dài cộng theo toàn bộ polyline WGS84, chuyển về km; không dùng khoảng cách thẳng giữa hai đầu. Chiều rộng không có/không đọc được để null (ô trống CSV), có missing flag; không điền 0. Tags thô như `maxspeed`, `surface`, `lanes` được giữ trong bảng `ways` cho bước features tiếp theo.

**`complete=true` và `graphReady=true` chỉ xác nhận đã dựng graph preview. `routingReady=false`: hạn chế rẽ được lưu nhưng chưa thực thi; chưa có profile tốc độ/thời gian. Không đưa `edges.csv` thẳng vào thuật toán tìm tuyến rồi coi đó là tuyến xe máy hợp lệ.** Thống kê component là kết nối yếu, không chứng minh có đường đi theo hướng và điều kiện rẽ. Graph không bao gồm mạng phà độc lập; không giả định có tuyến đường bộ tới Côn Đảo.

Bước tiếp theo sau graph là `prepare-routing` xử lý hạn chế rẽ và `build-travel` tạo `baseSpeedKph`, `baseTravelTimeHours` từ profile có phiên bản; các lệnh đã có trong [pipeline](#pipeline). Policy vẫn cần rà soát. Chỉ dùng mạng routing để sinh kịch bản/tìm tuyến sau kiểm tra khả năng tiếp cận tương ứng.

Tham chiếu cách đọc tags: [OSM access](https://wiki.openstreetmap.org/wiki/Key:access), [OSM oneway](https://wiki.openstreetmap.org/wiki/Key:oneway), [OSM turn restrictions](https://wiki.openstreetmap.org/wiki/Relation:restriction). Các lựa chọn loại đường/barrier nêu trên là policy của dự án.

#### Kết quả graph đã chạy ngày 27/09/2026

- Nguồn `pbf-v1`: 219.013 ways; policy chấp nhận ít nhất một hướng của **203.796 ways** trước khi loại đoạn kề barrier.
- Đầu ra **354.123 nodes**, **422.488 đoạn vật lý**, **801.003 cạnh có hướng**, không có cạnh chiều dài bằng 0. Có 3.084 cặp node theo hướng chứa nhiều hơn một cạnh, được giữ nguyên.
- **1.747 component yếu**, component lớn nhất chứa khoảng **81,13% số node**. Có 385 node trong bbox quanh Côn Sơn `[106.5, 8.6, 106.7, 8.8]`; phép đếm này chỉ kiểm tra còn dữ liệu đảo, không chứng nhận coverage đầy đủ.
- Policy chặn 4.531 node và bỏ 8.121 đoạn kề chúng. Cần xem `policy_audit.csv` khi rà soát các vùng bị chia cắt; không mặc nhiên coi mọi component rời là lỗi hoặc chỉ do barrier.
- **1.644 restriction records**: 218 pending via-node, 104 pending via-way, 94 pending conditional, 2 pending unrecognized, 1.224 được phân loại except-motorcycle và 2 other-mode-only. Tất cả vẫn `enforced=false`.
- **421.982/422.488 đoạn vật lý thiếu chiều rộng đọc được**. Không thể coi OSM hiện tại là nguồn width đầy đủ; bước features cần missing/fallback rõ ràng và không tự điền width=0.
- Thời lượng build đo được `0.01611556 h` (khoảng 58 giây trên máy hiện tại). SQLite khoảng 378,3 MB; edges CSV 265,4 MB; nodes CSV 17,9 MB. Đây là số đo một lần chạy, không phải cam kết hiệu năng.
- **39 unittest đạt**. Đã chạy lại CLI, xác minh checksum toàn bộ cache thành công, không gọi API. `complete=true`, `graphReady=true`, `routingReady=false`.

<a id="pipeline"></a>

## 4. Pipeline dữ liệu cố định

Run `member1-run-v1` đã hoàn thành 7 stage và QA trên dữ liệu thành phố. Các lệnh dưới đây dùng để kiểm tra/chạy tiếp cùng snapshot hoặc tạo snapshot mới; cùng output không tự lấy thời tiết mới. Chế độ tự cập nhật nằm ở [realtime](#realtime).

### Lệnh chạy nên dùng

<a id="depot-reachability"></a>

#### Sửa lỗi `Only 0 reachable candidates` ở depot tự động

Trên run `member1-run-v1`, bản cũ chọn node `7498869318` gần anchor nhất nhưng node này thuộc cụm chỉ có 3 node. Cụm đó không đi ra được các điểm giao hàng trong khoảng cách yêu cầu. Tăng candidateLimit không giải quyết nguyên nhân này.

Generator `connected-depot/2` xếp các node gần anchor theo khoảng cách geodesic và sàng lọc khả năng đi ra các điểm giao hàng, có tuân thủ cấm rẽ. Bỏ qua các depot không đạt, ghi node/khoảng cách/lý do. Trên graph hiện có, kiểm tra chỉ đọc chọn node `7501051053` cách anchor khoảng 0,076 km, tìm thấy 8 điểm outbound; kiểm tra đi–về đầy đủ vẫn chạy trong bước candidate sau đó. Không dựa vào componentId cũ và không tự nối thêm cạnh.

Tại lần vá depot, 60 test đã đạt, gồm hồi quy cụm service road rời, probe hết budget, depot chỉ định không bị tự dời và tiếp tục attempt cũ. **Chạy lại đúng lệnh pipeline/output cũ**: bản vá chỉ nâng build-state của scenario chưa hoàn thành nếu mọi input khác giữ nguyên; các bundle hoàn chỉnh vẫn bất biến. Không cần đổi profile hoặc làm lại routing/travel/weather/features. Nếu scenario cũ đã hoàn thành, chọn output scenario mới qua lệnh riêng để dùng generator mới.

`scenarios/diagnostics.json` được ghi trong lúc chạy và khi thất bại: depot đã chọn, các depot bị bỏ qua, số điểm đi–về đạt, lỗi outbound/return hoặc hết search budget ở phase nào. Log mỗi candidate có trạng thái và `reachable X/8`. Các trường tùy chọn `depotCandidateLimit` (mặc định 32) và `depotProbeMaxStates` (mặc định 5.000, còn giới hạn bởi searchMaxStates) có thể thêm vào scenario profile. Hết probe budget không chứng minh node bị cô lập. Depot do người dùng truyền `--depot-node` được giữ nguyên, không tự đổi sang nơi khác.

Mở PowerShell tại `D:\Apex-SafeRouteVN\SafeRouteVN`. Đầu vào là `scenarios/cached_context/hcmc/graph-v1` đã có từ bước trước. Không thêm dependency so với môi trường hiện tại.

Chạy **routing + travel** trước để kiểm tra hai bước đầu:

```powershell
.\.venv\Scripts\python.exe -m geo_data.pipeline --output scenarios/cached_context/hcmc/member1-run-v1 --stop-after travel
```

Sau đó chạy tiếp tới hết QA:

```powershell
.\.venv\Scripts\python.exe -m geo_data.pipeline --output scenarios/cached_context/hcmc/member1-run-v1
```

Bạn cũng có thể chạy ngay lệnh thứ hai. Pipeline chạy tuần tự, dừng khi có lỗi, và in `[1/7]`…`[7/7]` kèm tiến độ cạnh/vùng/candidate. Lệnh này gọi Open-Meteo tại bước `weather`; các bước còn lại chạy cục bộ. Bước scenario có nhiều lần tìm đường nên số candidate và giới hạn tìm kiếm là tham số, không dựng ma trận toàn bộ node thành phố.

Lần đầu, pipeline lấy giờ Việt Nam hiện tại, làm tròn xuống đầu giờ và lưu vào `run-settings.json`. **Chạy lại cùng output giữ nguyên mốc giờ, seed và input**, xác minh checksum rồi bỏ qua bước đã hoàn thành. Nhờ vậy không trộn travel lúc 09:00 với weather lúc 10:00. Chạy lại cũng không tự cập nhật dự báo đã hoàn thành.

- Muốn snapshot mới: đổi `--output` thành `member1-run-v2` hoặc tên khác. Có thể truyền `--at "2026-09-27T09:00:00+07:00"`; đây chỉ là ví dụ định dạng, khi gọi Forecast API phải chọn thời điểm nguồn hỗ trợ.
- Có thể dừng tại `--stop-after routing`, `travel`, `weather-plan`, `weather`, `features`, `scenarios`, `qa`.
- Chạy replay không mạng: thêm `--offline-weather`. Cache weather thiếu sẽ báo lỗi; không tự tạo thời tiết đẹp.
- Thay profile/seed/grid/depot hoặc input sau khi đã có artifact: dùng output mới. Không sửa manifest để vượt kiểm tra phiên bản. Có thể dùng lại các stage tương thích qua lệnh riêng bên dưới.
- Khi tải weather bị ngắt, chạy lại cùng lệnh sẽ dùng raw cache của các vùng đã hợp lệ. Nếu khởi động lại máy làm còn `.writer.lock`, chỉ bỏ lock sau khi kiểm tra không còn tiến trình ghi dữ liệu; không xóa lock của tiến trình đang chạy.
- Snapshot quá cũ và chưa đủ raw weather có thể nằm ngoài phạm vi Forecast API. Chọn snapshot mới, hoặc dùng fallback đã lưu được chỉ định rõ qua lệnh riêng; không đổi timestamp của dữ liệu cũ thành hiện tại.

### Mỗi bước làm gì và tạo gì?

| Bước | Code chính | Đầu ra trong `member1-run-v1/` |
| --- | --- | --- |
| 1. `prepare-routing` | `geo_data/osm/process_graph.py` | `routing/network.sqlite`, `restriction_report.json`, manifest |
| 2. `build-travel` | `geo_data/features/travel_time.py` | `travel/travel.sqlite`, `travel_edges.csv`, `profile.json`, manifest |
| 3. `weather-plan` | `geo_data/weather/context_builder.py` | `weather-plan/mapping.sqlite`, `regions.json`, manifest |
| 4. `fetch-weather` | `geo_data/weather/open_meteo_client.py` | `weather/weather_context.json`, `raw/` theo vùng, manifest |
| 5. `build-features` | `geo_data/features/edge_features.py`, `risk_proxy.py` | `features/features.sqlite`, `edge_features.jsonl`, `risk_model.json`, manifest |
| 6. `generate-scenarios` | `geo_data/scenario_generator.py` | `scenarios/S0.json`…`S8.json`, `qa_report.json`, profile và manifest |
| 7. `qa` | `geo_data/qa.py` | `qa/qa_report.json`, manifest |

Các file SQLite/CSV/JSONL có thể lớn vì có một bản ghi cho mỗi cạnh. JSONL lưu một object JSON trên mỗi dòng để đọc tuần tự; không nạp toàn bộ như một mảng JSON. Manifest chứa checksum và phiên bản; gói nguồn OSM vẫn cần attribution/ODbL khi chia sẻ.

#### Routing và hạn chế rẽ

Thực thi các restriction tĩnh qua một via-node, gồm cấm rẽ, chỉ được rẽ và cấm quay đầu. `no_u_turn` trên cùng way chỉ cấm cạnh quay ngược lại, không cấm tiếp tục đi thẳng trên way đó.

Restriction theo điều kiện/thời gian, qua via-way, cấu trúc không hiểu hoặc tag mâu thuẫn: loại toàn bộ cạnh của from-way theo cả hai chiều. Nếu relation thiếu from-way thì dùng các way/node tham chiếu còn lại làm vùng loại; không có anchor dùng được thì dừng để rà soát. Báo cáo có relation ID, lý do và số cạnh bị loại. Cách này bảo thủ và có thể loại cả đường đi vốn hợp lệ.

`routingReady=true` chỉ áp dụng **với reader tuân thủ bảng `forbidden_turns` và mạng đã loại cạnh**. Không dùng `edges.csv` từ graph preview hoặc chạy Dijkstra chỉ theo node rồi bỏ bảng cấm rẽ. Reader tham chiếu ở `geo_data/osm/routing.py`: state gồm node và incoming edge. Khi nối các chặng, truyền incoming edge cuối chặng trước; dừng giao hàng không tự xóa hạn chế rẽ. `componentId` trong bản copy là thông tin từ graph preview, không được dùng để khẳng định kết nối sau loại cạnh.

Policy access/barrier từ bước trước vẫn là giả định kỹ thuật cần rà soát. Bộ biên dịch không bổ sung phà, không nối các đảo và không chứng nhận mọi quyền đi đường thực tế.

#### Travel, thời tiết và safety proxy

- Travel: tốc độ nền theo highway, điều chỉnh mặt đường và chặn trên bởi maxspeed số đọc được; có hỗ trợ mph và tag hướng. Thiếu hoặc không đọc được maxspeed có missing flag. `maxspeed:*:conditional` chưa được đánh giá và có cờ riêng. **Tốc độ ước lượng không phải tốc độ thực đo hoặc bằng chứng tuân thủ giới hạn tốc độ pháp lý.**
- `baseTravelTimeHours = lengthKm / baseSpeedKph`. Hệ số khung giờ và thời tiết nhân vào **thời gian**, không nhân ngược vào tốc độ. `baseSpeedKph` và `baseTravelTimeHours` giữ giá trị nền; `travelTimeHours` là giá trị đã điều chỉnh.
- Khung giờ cố định theo decision epoch, không phải mô hình ETA cập nhật khi xe đi qua nhiều khung giờ. Travel/traffic đều `ESTIMATED`; chưa có live traffic. Cùng snapshot dùng chung cho các profile tối ưu của Member 2.
- Weather grid mặc định 20 km trong UTM 48N; mỗi cạnh gán theo trung điểm polyline đã chiếu. Giữ các vùng có cạnh trên đảo. Lấy mẫu ở tâm ô; đây là phép xấp xỉ theo vùng, không phải độ phân giải nguồn hay quan trắc từng đường.
- API lấy các biến hourly, kiểm tra đơn vị. Gió km/h, tầm nhìn m, precipitation mm của **1 giờ trước `validAt`**. Timestamp Unix được đổi sang `+07:00`. Giá trị null giữ missing flag; không đổi null thành 0. `sourceTimestamp/model` để null nếu nguồn không cung cấp, không dùng `fetchedAt` thay timestamp mô hình.
- Forecast snapshot có thể được tải sau decision epoch; dùng để replay snapshot đó, không coi là thí nghiệm backtest chỉ dùng thông tin sẵn có tại thời điểm lịch sử.
- Safety: kết hợp road/time/weather/traffic thành điểm `[0,1]`; `relativeExposure = lengthKm × edgeProxy`. Width thiếu dùng **factor fallback**, không tạo chiều rộng mét giả. Gắn `PROXY`; các trọng số/ngưỡng chưa được hiệu chỉnh theo dữ liệu tai nạn.

Nguồn tham chiếu adapter: [Open-Meteo Forecast API](https://open-meteo.com/en/docs), [OSM turn restrictions](https://wiki.openstreetmap.org/wiki/Relation:restriction), [OSM access](https://wiki.openstreetmap.org/wiki/Key:access). Các giá trị tốc độ, factor và trọng số mặc định do dự án đặt để thử nghiệm.

#### S0–S8 và điều kiện nghiệm thu

| Scenario | Nội dung |
| --- | --- |
| S0 | 3 đơn, 2 xe, điểm trên graph có kiểm tra tuyến đi và về |
| S1 | Ngày giao hàng tổng hợp; mặc định 8 đơn/2 xe |
| S2 | Thêm đơn gấp qua event sau 0,25 h |
| S3 | Xe V1 đang giữ một đơn ONBOARD rồi unavailable; tải khớp demand và cấm tự chuyển hàng sang xe khác |
| S4 | Polygon mưa `SYNTHETIC WHAT-IF`; liệt kê cạnh giao polygon, thời gian hiệu lực và context delta; consumer phải tính lại features |
| S5 | Deadline của một đơn ngắn hơn cận thời gian tuyến nhanh nhất + phục vụ tại điểm giao |
| S6 | Một đơn nặng hơn capacity của mọi xe, giả định không chia đơn |
| S7 | Tìm cặp tuyến cho đánh đổi time/exposure đạt ngưỡng cấu hình; lưu edge sequence và số liệu làm bằng chứng |
| S8 | Tìm cặp tuyến ít đánh đổi theo ngưỡng cấu hình, có bằng chứng tương tự |

Graph/weather vẫn bao phủ toàn bộ mạng TP.HCM đã giữ; scenario mặc định chọn một nhóm điểm quanh depot trung tâm trong bán kính 10 km để bắt đầu tích hợp. Muốn thử Bình Dương/Vũng Tàu/Côn Đảo, đổi anchor/profile hoặc `--depot-node`; không thay boundary hoặc thu nhỏ graph.

`suiteReady=false` nếu chưa tìm được bằng chứng S7 hoặc S8 trong giới hạn candidate/search. Các file vẫn được xuất nhưng S7/S8 **chưa nghiệm thu benchmark**. Xem `scenarios/qa_report.json`, tăng `candidateLimit/searchMaxStates`, đổi anchor/radius hoặc điều chỉnh profile qua output mới. Giới hạn tìm kiếm bị chạm được ghi là **chưa xác định**, không bị báo nhầm thành “không có đường”.

Kiểm tra từng chuyến đi/về không chứng minh đồng thời mọi đơn thỏa deadline, capacity, range và lịch xe. Solver của Member 2 cần đánh giá bài toán chung; không mặc định S1 luôn khả thi. Reader này chỉ là adapter/QA đường đi, không triển khai VRP, backend event handler hoặc ma trận của Member 2.

`checksPassed=true` là kiểm tra dữ liệu/phiên bản/công thức/đường đi đã đạt. `integrated=false` cho đến khi Member 2/3 load/test schema. Không báo DONE=INTEGRATED.

### Cấu hình được phép điều chỉnh trong module Member 1

| File | Tham số |
| --- | --- |
| `geo_data/features/profiles/travel_v1.json` | Tốc độ theo loại đường, mặt đường, khung giờ và travel multiplier |
| `geo_data/features/profiles/risk_v1.json` | Trọng số factors, factor fallback, ngưỡng mưa/gió/tầm nhìn/chiều rộng, hệ số thời tiết |
| `geo_data/scenario_profile.json` | Anchor, radius, số đơn/xe, kg, VND/km, range km, thời gian h, ngưỡng S7/S8, giới hạn tìm kiếm |

Pipeline có `--travel-profile`, `--risk-profile`, `--scenario-profile`, `--seed`, `--grid-km`, `--depot-node`. Đây là config cục bộ phục vụ draft; chưa sửa `configs/` hoặc `shared/`. Các schema/model cần phối hợp consumer trước khi đóng băng.

### Chạy từng lệnh riêng

Khởi tạo biến ở cùng cửa sổ PowerShell. Nếu pipeline đã tạo run-settings, lấy lại chính epoch đã lưu:

```powershell
$run = "scenarios/cached_context/hcmc/member1-run-v1"
$at = (Get-Content "$run/run-settings.json" -Raw | ConvertFrom-Json).at
```

Nếu chưa dùng pipeline, chọn output mới và một timestamp ISO có timezone cho `$at` trước khi chạy. Giữ cùng `$at` suốt chuỗi.

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli prepare-routing --graph scenarios/cached_context/hcmc/graph-v1 --output "$run/routing"
.\.venv\Scripts\python.exe -m geo_data.cli build-travel --routing "$run/routing" --output "$run/travel" --at $at
.\.venv\Scripts\python.exe -m geo_data.cli weather-plan --routing "$run/routing" --output "$run/weather-plan" --grid-km 20
.\.venv\Scripts\python.exe -m geo_data.cli fetch-weather --plan "$run/weather-plan" --output "$run/weather" --at $at --user-agent "SafeRouteVN/0.1 Member1 development"
.\.venv\Scripts\python.exe -m geo_data.cli build-features --routing "$run/routing" --travel "$run/travel" --plan "$run/weather-plan" --weather "$run/weather" --output "$run/features"
.\.venv\Scripts\python.exe -m geo_data.cli generate-scenarios --routing "$run/routing" --features "$run/features" --output "$run/scenarios" --seed 42
.\.venv\Scripts\python.exe -m geo_data.cli qa --routing "$run/routing" --travel "$run/travel" --plan "$run/weather-plan" --weather "$run/weather" --features "$run/features" --scenarios "$run/scenarios" --output "$run/qa"
```

Chạy từng lệnh và kiểm tra exit code trước lệnh sau; dùng pipeline nếu muốn tự dừng chuỗi khi lỗi.

Fallback weather tùy chọn: truyền `--fallback-context <thư-mục-weather-cũ> --max-stale-hours 6` cho `fetch-weather`, với **output mới** và weather plan giống bản cũ. Khi API lỗi hoặc dùng `--offline`, chỉ nhận region cũ có `validAt` không nằm trong tương lai và tuổi dữ liệu không vượt giới hạn. Giữ `validAt/fetchedAt`, ghi `fallbackUsed`, `staleAgeHours`, contextVersion gốc; không tự đổi thành snapshot mới. Dữ liệu hiện tại có các trường null vẫn giữ null và sử dụng factor fallback được gắn nhãn ở bước features.

Kiểm tra tuyến theo hai node thực trong S0:

```powershell
$s0 = Get-Content "$run/scenarios/S0.json" -Raw | ConvertFrom-Json
$fromNode = $s0.initialState.locations[0].graphNodeId
$toNode = $s0.initialState.orders[0].graphNodeId
.\.venv\Scripts\python.exe -m geo_data.cli route-check --routing "$run/routing" --features "$run/features" --from-node $fromNode --to-node $toNode --weight time
```

Đổi `--weight exposure` để kiểm tra tuyến có tổng proxy thấp nhất; chưa phải cả profile SAFER của solver. Nếu nối tiếp một tuyến đã đi, thêm `--incoming-edge <edgeId-cuối-chặng-trước>`. Kết quả không có đường trả exit code 2; hết search budget là lỗi riêng, không kết luận unreachable.

<a id="realtime"></a>

## 5. Cập nhật weather qua API định kỳ

Chế độ live gọi lại Open-Meteo Forecast theo chu kỳ, lấy thời tiết cho giờ hiện tại ở Việt Nam rồi tính lại thời gian/rủi ro các cạnh. Chế độ pipeline cố định và các gói bàn giao cũ vẫn dùng được cho kiểm thử.

Đây là **polling API dự báo**, không phải luồng cảm biến từng giây. Bản này dùng các biến hourly: precipitation, wind_speed_10m, visibility, weather_code. Lượng mưa có khoảng tích lũy 1 giờ; gọi lại sau 0.5 giờ không biến lượng mưa thành dữ liệu đo 0.5 giờ. Nhà cung cấp có thể trả lại cùng giá trị giữa hai lần gọi. Xem [tài liệu Open-Meteo](https://open-meteo.com/en/docs).

Mạng đường dùng lại routing OSM đã dựng; tốc độ/giao thông vẫn là ESTIMATED. Chưa cập nhật bản đồ tự động, tích hợp traffic API, hoặc tự gọi solver/backend.

### Chạy tại SafeRouteVN

Mở PowerShell tại `D:\Apex-SafeRouteVN\SafeRouteVN` và đặt các biến:

```powershell
$run = "scenarios/cached_context/hcmc/member1-run-v1"
$live = "scenarios/cached_context/hcmc/member1-live-v1"
```

Lấy API mới **một lần**, dùng profile đã lưu trong lần chạy hiện có:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli refresh-live --routing "$run/routing" --plan "$run/weather-plan" --output $live --travel-profile "$run/travel/profile.json" --risk-profile "$run/features/risk_model.json" --user-agent "SafeRouteVN/0.1 Member1 development"
```

Khi lần đầu thành công, chạy cập nhật tự động:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli watch-live --routing "$run/routing" --plan "$run/weather-plan" --output $live --travel-profile "$run/travel/profile.json" --risk-profile "$run/features/risk_model.json" --user-agent "SafeRouteVN/0.1 Member1 development" --interval-hours 0.5
```

Lệnh watch lấy mới ngay khi khởi động. Sau khi một chu kỳ hoàn tất hoặc thất bại, đợi 0.5 giờ rồi thử tiếp; các chu kỳ chạy tuần tự. Đây không phải cam kết công bố bản mới đúng mỗi 0.5 giờ. Có thể dùng `--cycles 2` để chạy tối đa hai chu kỳ. `Ctrl+C` dừng; cửa sổ lệnh phải mở để tiếp tục chạy. Chưa cài Windows service hay tác vụ nền tự khởi động.

Kiểm tra trong PowerShell khác, đặt lại `$live` nếu cần:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli live-status --output scenarios/cached_context/hcmc/member1-live-v1
```

- Mã thoát 0: latest có checksum hợp lệ, đúng phiên bản, còn mới.
- Mã thoát 2: chưa có latest hoặc đã quá cũ; xem `lastAttempt` để biết lần cập nhật gần nhất.
- Mã thoát 1: lỗi đọc/kiểm tra, chẳng hạn checksum sai.
- Watch hữu hạn trả 1 nếu chu kỳ cuối thất bại; các lỗi từng chu kỳ vẫn được in ra. Dừng bằng Ctrl+C trả 130.

`--max-age-hours 2` là mặc định: cả tuổi của giờ dữ liệu (`validAt`) lẫn thời điểm tải cũ nhất (`fetchedAt`) phải không quá 2 giờ. Đây là ngưỡng kỹ thuật có thể cấu hình, chưa phải cam kết chất lượng dự báo. Không có timestamp phát hành mô hình thì không suy ra tuổi mô hình từ fetchedAt. Giờ hệ thống phải đúng. Đổi routing/grid/profile/ngưỡng độ cũ thì dùng output mới; user-agent, số lần retry và khoảng chờ có thể đổi khi chạy lại.

### Chu kỳ xử lý và lỗi

1. Chọn giờ hiện tại theo `Asia/Ho_Chi_Minh`, tạo thư mục snapshot mới, kể cả khi vẫn trong cùng giờ.
2. Gọi API cho tất cả vùng; mỗi vùng có retry khi timeout/HTTP 429/5xx. Không dùng cache thời tiết của chu kỳ trước cho bản công bố mới.
3. Tính travel theo khung giờ và features theo thời tiết mới; dùng lại routing và lưới vùng.
4. Kiểm tra checksum, phiên bản, độ phủ vùng/cạnh, chi phí hữu hạn, độ mới sau khi tính xong.
5. Ghi snapshot hoàn chỉnh rồi thay `latest.json` nguyên tử. Consumer đọc được trọn bản cũ hoặc trọn bản mới.

Nếu một vùng tải thất bại, dữ liệu không hợp lệ, hoặc tính toán chưa xong: ghi `status.json`, giữ latest thành công trước đó. Watch đợi rồi thử một bản mới; refresh một lần trả lỗi. Consumer vẫn có thể dùng bản trước khi còn trong ngưỡng độ mới, nhưng phải tự kiểm tra qua `load_latest`. Khi bản cũ hết hạn, hàm đọc mặc định từ chối. Không tự trộn thời tiết cũ vào bản mới rồi coi là dữ liệu mới.

Lỗi dừng cưỡng bức có thể để lại `.writer.lock`; chỉ xử lý lock sau khi xác nhận tiến trình đã dừng. `status.json` mô tả lần thử cuối, không phải heartbeat; `state=ready` không chứng minh dữ liệu còn mới sau nhiều giờ. Dùng `live-status` hoặc `load_latest` để đánh giá tại thời điểm đọc.

### File đầu ra

```text
member1-live-v1/
  live-settings.json
  latest.json
  status.json
  snapshots/
    <thoi-gian>-<id>/
      weather/          # raw API và weather_context.json
      travel/           # chi phí ước tính theo giờ
      features/         # chi phí/rủi ro đã áp dụng weather
      snapshot.json     # chỉ xuất hiện sau kiểm tra đạt
```

Graph và lưới không bị sao chép mỗi chu kỳ. Tuy nhiên travel SQLite/CSV và features SQLite/JSONL được tạo lại đầy đủ cho khoảng 800.000 cạnh; quá trình này tốn thời gian và dung lượng. Bản đầu chưa tối ưu cập nhật từng vùng thay đổi, chưa tự xóa lịch sử. Theo dõi dung lượng, chọn chu kỳ phù hợp và dừng watch khi không sử dụng. Chỉ xóa snapshot cũ sau khi biết nó không còn là latest và không còn consumer nào đang đọc. Snapshot thất bại được giữ để chẩn đoán; lần sau tạo mới, không tiếp tục dữ liệu thời tiết dở dang đã cũ.

### Member 2/3 đọc bản mới

```python
from geo_data.realtime import load_latest
from geo_data.osm.routing import RoutingGraph

live = "scenarios/cached_context/hcmc/member1-live-v1"
snapshot = load_latest(live)  # xác minh checksum + độ mới, lỗi nếu quá cũ
version = snapshot["versions"]["features"]

with RoutingGraph(snapshot["routing"], features=snapshot["features"]) as graph:
    # start_node_id, end_node_id do backend/solver cung cấp.
    path = graph.path(start_node_id, end_node_id, weight="time")
```

Mỗi lần tối ưu cần giữ nguyên `snapshot` cho toàn bộ lần đó để tránh trộn các phiên bản. Trước lần tối ưu tiếp theo, đọc lại latest; khi version đổi, backend có thể yêu cầu solver tính lại. `load_latest` kiểm tra các file lớn nên có chi phí I/O; không gọi cho từng cạnh. Backend/solver vẫn cần được Member 2/3 nối vào, giữ trạng thái đơn/xe và các cạnh vào nút khi kiểm tra hạn chế rẽ. Chế độ live không sinh lại S0–S8, không gọi `qa` của bộ kịch bản cố định, không chứng nhận khả thi VRP. `checksPassed` chỉ cho kiểm tra bản dữ liệu live; `integrated=false`.

Các đường dẫn nguồn routing/plan trong live-settings là đường dẫn tuyệt đối trên máy chạy. Thư mục live chưa phải gói portable; gói `build-handoff` hiện dành cho pipeline kiểm thử cố định.

### Kiểm chứng

Ở lần triển khai live, **76 test đạt**, gồm 10 test live mới dùng graph nhỏ và HTTP giả lập: lấy mới trong cùng giờ, đổi giờ/ngày, API lỗi rồi hồi phục, lỗi giữa lúc build, dữ liệu hết hạn/đồng hồ lùi, xử lý quá lâu, checksum/path sai, đổi nguồn và watcher retry. Chưa chạy API thật hay tạo lại toàn bộ dữ liệu thành phố trong lần sửa này; người dùng chạy các lệnh trên.

<a id="handoff"></a>

## 6. Review, đóng gói và consumer

M1-00–M1-08 đã có pipeline. Run `member1-run-v1` đã ghi nhận QA đạt, 800.406 cạnh, 38 vùng weather, đủ S0–S8 và bằng chứng S7/S8. Phần bổ sung này hoàn thiện công cụ bàn giao M1-09. Các lệnh dưới đây do bạn chạy trên dataset thành phố; phát triển code chỉ dùng fixture nhỏ.

### Chạy lần lượt

PowerShell tại `D:\Apex-SafeRouteVN\SafeRouteVN`:

```powershell
$run = "scenarios/cached_context/hcmc/member1-run-v1"
$review = "scenarios/cached_context/hcmc/member1-review-v1"
$package = "scenarios/cached_context/hcmc/member1-handoff-v1"
$smoke = "scenarios/cached_context/hcmc/member1-consumer-v1"
```

Tạo thống kê và mẫu đường để rà soát:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli quality-review --run $run --output $review
```

Đóng gói bằng bản sao thực sự, có thể chuyển sang máy khác:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli build-handoff --run $run --review $review --output $package
```

Kiểm tra gói và đọc S0 bằng adapter tham chiếu:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli verify-handoff --package $package
.\.venv\Scripts\python.exe -m geo_data.cli consumer-smoke --package $package --output $smoke
```

Chạy từng lệnh khi lệnh trước đã thành công. Không tải API, không thay đổi run gốc hoặc chạy lại pipeline thu thập. Package sao chép SQLite, CSV/JSONL và raw weather đã liệt kê trong manifest, nên cần thêm dung lượng tương ứng; log ghi từng file đã copy/cache. Chạy lại dùng checksum để giữ các file đã copy xong; file `.part` đang dở được copy lại từ đầu.

Output review/package/smoke phải tách khỏi thư mục input và không là thư mục cha của input. Đổi code SDK, docs, profile hay dữ liệu sẽ đổi identity của package; dùng `handoff-v2` cho lần đóng gói mới. Không sửa trực tiếp package đã có manifest. Không có bước upload/gửi cho người khác tự động.

Nếu run được tạo bằng các lệnh riêng, không có `run-settings.json`, thêm `--graph scenarios/cached_context/hcmc/graph-v1` cho `build-handoff` để lấy đúng policy nguồn. Policy được kiểm checksum theo routing manifest; không lấy policy hiện tại trong code thay cho policy đã dùng để tạo graph.

### Đọc kết quả review

| File | Nội dung |
| --- | --- |
| `quality_report.md` | Bảng cạnh theo highway, tổng km có hướng, số cạnh thiếu width, số cạnh mang từng missing/fallback flag |
| `quality_report.json` | Thống kê chi tiết, số cạnh bị loại, cặp rẽ bị cấm, miền giá trị proxy và kết quả tìm mẫu quanh 6 điểm địa lý |
| `regional_samples.geojson` | Tọa độ tham chiếu và vài cạnh quanh node gần nhất tại trung tâm HCMC, Thủ Dầu Một, Dầu Tiếng, Vũng Tàu, Xuyên Mộc, Côn Sơn |

Mỗi hướng là một cạnh: tổng `directedLengthKm` đếm hai lần nếu đoạn đường có cả hai hướng. Một cạnh có thể mang nhiều missing flags nên không cộng các dòng flag để tính số cạnh bị ảnh hưởng.

GeoJSON mẫu giúp kiểm tra hình học/quyền đi đường trên bản đồ hoặc với nguồn thực địa. Có mẫu gần điểm tham chiếu không chứng minh toàn vùng đã đủ dữ liệu, đúng boundary hoặc tuyến hợp lệ ngoài thực tế. `manualReviewComplete=false` cho tới khi có người rà soát và lưu bằng chứng riêng. Công cụ không tự điền width, điều chỉnh weights hay xác nhận an toàn dựa trên thống kê.

### Gói bàn giao có gì?

```text
member1-handoff-v1/
  manifest.json
  README.md
  acceptance_template.json
  data/
    routing/ travel/ weather-plan/ weather/ features/ scenarios/ qa/
  provenance/
    graph-manifest.json
    graph-policy.json
    graph-qa_report.json
  sdk/geo_data/
    consumer.py
    osm/routing.py
    examples/read_handoff.py
    requirements.txt
    requirements.lock.txt
    ... các module/config cần cho SDK
  docs/
  review/                         # nếu truyền --review
```

`provenance/graph-manifest.json` là metadata của graph nguồn, không phải một graph bundle đầy đủ. Gói không copy country PBF, raw tile cache hoặc graph preview lớn; reader dùng `data/routing/network.sqlite`. Đường dẫn tuyệt đối cũ trong provenance chỉ là thông tin truy vết, reader dùng đường dẫn tương đối trong package.

Manifest package bảo vệ cả manifest con, dữ liệu và SDK bằng SHA-256. Trước đóng gói, chương trình kiểm QA trỏ đúng version/files của từng stage, checksPassed, suiteReady và bằng chứng S7/S8. `verify-handoff` kiểm lại sau khi copy/chuyển máy. Checksum kiểm tính toàn vẹn, không thay thế nguồn gửi đáng tin cậy hay xác nhận thực địa.

Giữ attribution OpenStreetMap/ODbL và Open-Meteo/CC BY 4.0 khi chia sẻ. Package chứa mã nguồn reader của dự án; các dependency Python cài riêng, không kèm venv của máy tạo.

### Member 2/3 đọc dữ liệu như thế nào?

Trên máy nhận dùng Python 3.12, mở PowerShell trong `member1-handoff-v1/sdk`:

```powershell
python -m pip install -r geo_data/requirements.lock.txt
python -m geo_data.cli verify-handoff --package ..
python -m geo_data.examples.read_handoff --package ..
python -m geo_data.cli consumer-smoke --package .. --output ../../member1-consumer-check
```

Cài dependency cần mạng hoặc kho wheel có sẵn; các bước đọc/kiểm gói sau đó chạy offline.

Ví dụ Python khi `geo_data` có trong đường dẫn import:

```python
from geo_data.consumer import Member1Dataset

with Member1Dataset(package_path) as data:
    s0 = data.scenario("S0")
    depot = s0["initialState"]["locations"][0]["graphNodeId"]
    destination = s0["initialState"]["orders"][0]["graphNodeId"]
    route = data.graph.path(depot, destination, weight="time")
    if route is not None:
        checked = data.describe_path(depot, route["edgeIds"])
        # checked chứa distanceKm, travelTimeHours, relativeExposure và geojson.
        # Nếu đi tiếp, giữ route["edgeIds"][-1] làm incoming_edge cho chặng sau.
```

- **Member 2:** đọc routing/features, giữ incoming-edge state và forbidden_turns; tra cost/geometry trên chính edge sequence được chọn. `weight=time/exposure` chỉ là đường đi đơn trong reader tham chiếu, chưa phải ba profile hoặc VRP của Member 2. Cost thời tiết/traffic đóng băng theo epoch.
- **Member 3:** đọc scenario/versions/trạng thái và cung cấp dữ liệu cho API; thực thi S2/S3/S4 trong state manager. Không chuyển ONBOARD sang xe khác ngầm định; context delta S4 cần tái tính features/matrices.
- **Member 4:** dùng GeoJSON của đường đi được solver chọn để vẽ, không gọi một routing provider khác rồi vẽ geometry thay thế. `s0_routes.geojson` chỉ là artifact kiểm thử của Member 1.

### Consumer smoke chứng minh gì?

`consumer_report.json` kiểm S0 có 3 đơn/2 xe, tọa độ khớp graphNodeId, đúng version và đọc được các cạnh/features. Tái kiểm tra ba tuyến đi và ba tuyến về đã lưu: cạnh liên tục, tuân thủ cấm rẽ kể cả chỗ nối outbound→return, endpoints đúng, tổng km/h/exposure khớp evidence. Xuất đúng geometry từng cạnh theo chiều đi vào `s0_routes.geojson`.

Đây là kiểm tra adapter/dữ liệu đã đóng gói. Nó không chạy solver, không chứng minh tối ưu/khả thi chung của các đơn, không replay backend và không tự đặt `integrated=true`.

### Các mốc còn cần người dùng/consumer xác nhận

| Mốc | Bằng chứng cần có |
| --- | --- |
| M1-01 / rà soát boundary | Đối chiếu polygon với nguồn hành chính; probes không đủ để nghiệm thu toàn đường biên |
| M1-04 / rà soát access | Kiểm mẫu quyền đi xe máy, barrier và các đường bị loại bảo thủ có ảnh hưởng các tuyến cần phục vụ |
| M1-05 / M1-07 / hiệu chỉnh | Chốt các tốc độ, hệ số và weights với nhóm; không gọi proxy là xác suất tai nạn |
| M1-08 / solver S0–S8 | Member 2 chạy solver với các ràng buộc, ghi metric và diagnostics, gồm S5/S6 có ca cố ý khó/bất khả thi |
| M1-09 / backend và bàn giao | Member 3 đọc đúng schema, replay event; lưu run ID/version/test report và reviewer cho từng kết quả |

Dùng `acceptance_template.json` làm mẫu nhưng lưu bản đánh giá và bằng chứng ở thư mục riêng. Các cờ pending không yêu cầu xin phép để tạo gói nội bộ; chúng phản ánh phần chưa được kiểm chứng. `DONE != INTEGRATED`.

<a id="data-contract"></a>

## 7. Data contract, schema và đơn vị

Trạng thái: contract nội bộ/draft cho pipeline Member 1 đến QA; cần phối hợp Member 2/3 trước khi đóng băng schema liên module. Chưa thay đổi `shared/` hoặc `configs/`. Code các stage sau graph đã qua test nhỏ/HTTP mock; dataset thành phố do người dùng chạy. `integrated=false` cho tới kiểm tra consumer.

### Phạm vi và đơn vị

Phạm vi đích là TP.HCM hiện hành, gồm địa bàn Bình Dương và Bà Rịa–Vũng Tàu trước sáp nhập. Boundary phải là Polygon/MultiPolygon WGS84; giữ mọi phần rời. Không coi bbox trung tâm hoặc fixture kiểm thử là ranh giới thành phố.

| Đại lượng | Quy ước |
| --- | --- |
| Quãng đường | km; trường `lengthKm` |
| Tốc độ | km/h; trường `baseSpeedKph` |
| Thời lượng | h; trường `baseTravelTimeHours`, `travelTimeHours`; giữ số thập phân |
| Khối lượng | kg cho demand/capacity/currentLoad |
| Tiền | VND; đơn giá VND/km |
| Chiều rộng, tầm nhìn, độ chính xác GPS | m |
| Lượng giáng thủy | mm, khoảng tích lũy tính bằng h |
| Thời điểm | ISO 8601 có `+07:00`, `Asia/Ho_Chi_Minh` |
| Tọa độ | WGS84, GeoJSON `[longitude, latitude]` |

`geo_data/units.py` từ chối số âm, NaN/Infinity, đơn vị không hỗ trợ, timestamp thiếu múi giờ và tốc độ bằng 0 khi tính travel-time. Các giá trị từ OSM raw giữ nguyên để audit; adapter mới chuyển đổi sang đơn vị trên. HTTP timeout/rate limit dùng giây theo API thư viện và có tên `*_sec`/`--interval-seconds`; đây không phải thời lượng nghiệp vụ. Phép chiếu UTM dùng mét nội bộ để chia ô, tham số giao tiếp vẫn là km.

### Artifact hiện đã triển khai

#### M1-09 — review và gói bàn giao

- `member1-quality-review/1`: `quality_report.json/.md` và `regional_samples.geojson`, identity gắn toàn bộ manifest của run. Thống kê theo cạnh có hướng, missing flags có thể chồng lấp; `computedReviewReady=true` không đồng nghĩa `manualReviewComplete=true`.
- `member1-handoff/1`: bản sao đầy đủ các file được manifest 7 stage liệt kê, metadata/policy/QA graph nguồn, SDK Python và tài liệu. Manifest ngoài checksum cả manifests con và SDK; runtime lấy đường dẫn tương đối trong package. Identity gắn byte nguồn và byte SDK/doc để tránh dùng cache khi mã đọc dữ liệu đã thay đổi.
- `member1-consumer-smoke/1`: `consumer_report.json` và `s0_routes.geojson`. Kiểm adapter đọc S0, version, node/coordinate, cạnh/rẽ của 3 tuyến đi và 3 tuyến về, cùng tổng km/h/exposure. Dùng các path đã lưu trong scenario QA; không tìm lại tuyến hoặc giải VRP. `consumerSmokePassed` không cập nhật `integrated`.
- Reader `geo_data.consumer.Member1Dataset`: context manager, `scenario("S0")`, `edge(edgeId)`, `describe_path(start, edgeIds, incoming_edge=...)`, và `graph.path(...)` cho tìm đường tham chiếu. Geometry lấy trực tiếp từ cạnh; không dựng đường khác để hiển thị. Cấm reset incoming-edge khi nối chặng mà chưa xét hạn chế rẽ.
- `acceptance_template.json` là mẫu trạng thái pending; lưu bằng chứng review/integration ở ngoài package bất biến. Gói nguồn thiếu raw OSM PBF có chủ đích: đủ cho consumer đọc/routing, không phải gói tái chạy ingestion từ đầu. Chi tiết tại [handoff](#handoff).

#### Các stage sau graph — schema pipeline đã triển khai

Lệnh và giới hạn chi tiết ở [pipeline](#pipeline). Mỗi output là bundle có `manifest.json`, identity, version, complete, createdAt `+07:00` và checksum files. `complete` chỉ nói stage đã tạo đủ artifact theo policy, không chứng nhận bản đồ hay benchmark đã nghiệm thu. Artifact không được sửa trực tiếp; thay input/profile dùng output mới. Runner giữ epoch trong `run-settings.json`.

| Stage / schema | Artifact và contract |
| --- | --- |
| `member1-routing/1` | `network.sqlite` copy graph rồi loại các cạnh quarantine; thêm `forbidden_turns(inEdgeId,outEdgeId,relationId)` và `excluded_edges(edgeId,relationId,reason)`. `restriction_report.json` ghi quyết định từng relation. `routingReady=true` chỉ với reader có incoming-edge state, `requiresTurnAwareReader=true`; chỉ hỗ trợ turn tĩnh via-node, loại bảo thủ loại chưa hỗ trợ. `graphVersion` giữ nguồn, `version` là routingVersion mới. |
| `member1-travel/1` | `travel.sqlite` bảng `travel`, `travel_edges.csv`, `profile.json`. Một row/cạnh gồm edgeId, baseSpeedKph, baseTravelTimeHours, travelTimeHours, travelMultiplier, timeBucket, timeFactor, trafficFactor, sourceType=ESTIMATED, missingFlagsJson. Travel multiplier nhân thời gian. at cố định; temporalModel=frozen-decision-epoch. |
| `member1-weather-plan/1` | `mapping.sqlite` bảng `edge_regions(edgeId,regionId)`, `regions.json` giữ tọa độ lấy mẫu và edgeCount. Gán theo trung điểm polyline trong UTM 48N, ô gridKm. Không coi kích thước ô là độ phân giải mô hình weather. |
| `member1-weather-context/1` | `weather_context.json` giữ at, planVersion và regions; raw response/checksum trong raw/. Mỗi record có precipitationMm, precipitationIntervalHours=1, windSpeedKph, visibilityM, weatherCode, validAt, fetchedAt, sourceTimestamp/model khi nguồn có, missingFlags, fallbackUsed. Rain là tổng giờ trước validAt. Fallback giữ timestamp gốc, ghi staleAgeHours, fallbackContextVersion và lý do. `version=contextVersion` phụ thuộc nội dung snapshot, không chỉ thời điểm request. |
| `member1-edge-features/1` | `features.sqlite` bảng features, `edge_features.jsonl` một object/cạnh, `risk_model.json`. Có speed/travel h, factors [0,1], edgeProxy, relativeExposure km×proxy, weatherRegionId/weatherValidAt, flags/provenance. `sourceType=PROXY`, `travelSourceType=ESTIMATED`; final travelTimeHours nhân cả traffic và weather multiplier, base fields vẫn giữ nguyên. |
| `member1-scenarios/1` | Bundle S0…S8, profile, QA và seed. Mỗi scenario schema `member1-scenario-draft/1`, initialState, events, executionUpdates, expectedInvariants và versions. S0 3 đơn/2 xe. S7/S8 cần tradeoffEvidence; suiteReady=false nếu chưa tìm được. Không tuyên bố khả thi chung chỉ vì có tuyến đi/về từng điểm. |
| `member1-qa/1` | Kiểm checksum, lineage, cùng epoch, đủ cạnh/vùng, công thức km/kmh/h, factors, turn references và đường đi ghi trong scenario. checksPassed khác suiteReady và integrated. Không chạy solver/backend. |

Các stage travel/grid/context/features/scenarios phải cùng `routingVersion`; features giữ `travelVersion/contextVersion`, scenario giữ `featuresVersion/contextVersion`. Mismatch bị từ chối. Reader ở `geo_data/osm/routing.py` có `path(start,end,weight,incoming_edge,max_states)` và `validate_path`; hết budget là trạng thái chưa biết, khác với duyệt hết mà không có đường. Consumer nối chặng phải giữ incoming edge hoặc kiểm tra toàn bộ edge sequence, không tự reset tại mỗi điểm giao.

Trong scenario, mass dùng `demandKg/capacityKg/currentLoadKg`, duration dùng `serviceTimeHours`, tiền dùng `costPerKmVnd`, range dùng km. Deadline/earliest/workingStart/event timestamps có `+07:00`. Vị trí lấy trực tiếp từ graph nodes (graphNodeId), không tạo GPS accuracy giả. `currentLoadKg` bằng tổng demand của onboardOrderIds và mỗi ONBOARD order chỉ thuộc một xe. Pickup reference là DEPOT; schema consumer chưa đóng băng.

S4 là context delta tổng hợp có polygon và danh sách cạnh giao polygon, `requiresFeatureRecompute=true`; chưa có backend thực thi sự kiện trong module Member 1. S2/S3 và cập nhật epoch cần consumer xây lại DecisionState/matrices trước solve. S7/S8 evidence là hai tuyến đơn trên snapshot hiện tại, không phải kết quả so sánh ba profile VRP.

#### Graph preview từ PBF

Schema `member1-road-graph-preview/1`; lệnh `build-graph`. SQLite chuẩn và CSV xuất cùng nội dung; không cần nạp toàn bộ graph vào NetworkX khi tạo artifact.

- `nodes`: `nodeId` là OSM node ID, tọa độ `longitude/latitude`, `componentId` là ID node nhỏ nhất trong component yếu, `tagsJson` giữ tags nguồn. Không chứa các điểm hình học đã gom vào cạnh.
- `edges`: `edgeId=edgeKey=w<osmWayId>:<startIndex>-<endIndex>:<forward|backward>`, chỉ số 0-based trên danh sách node way gốc. Giữ hai way khác ID dù trùng hai đầu; cả hai hướng dùng ID riêng. Không gộp qua ranh giới OSM way.
- Trường cạnh gồm `fromNodeId`, `toNodeId`, `osmWayId`, `startIndex`, `endIndex`, `direction`, `lengthKm>0`, `widthM` hoặc null, `highway`, `geometryJson`, `osmNodeIdsJson`, `missingFlagsJson`. Geometry và danh sách node theo chiều di chuyển; chỉ số start/end vẫn theo way gốc kể cả cạnh backward. CSV dùng JSON trong ô được escape theo CSV; null width là ô trống.
- Độ dài là tổng geodesic WGS84 của polyline; geometry GeoJSON `[lon,lat]`. Node chung theo ID tạo kết nối; giao hình học khác ID không tạo kết nối. Node có tags hoặc tham gia restriction được giữ làm điểm tách.
- `ways`: `osmWayId`, `osmVersion`, `tagsJson`; tra bảng này bằng `edges.osmWayId` để đọc `maxspeed`, `surface`, `lanes` và tags gốc. Các tag có đơn vị gốc chưa phải feature chuẩn hóa. Node/way nguồn bị loại có lý do trong `policy_audit.csv`.
- `restrictions.json` schema `member1-restriction-audit/1` giữ ID, version, toàn bộ members/tags, phân loại `pending-via-node`, `pending-via-way`, `pending-conditional`, `pending-unrecognized`, `except-motorcycle`, `other-mode-only`. `enforced=false` cho mọi record: phân loại chỉ phục vụ audit, chưa phải xác nhận consumer có thể bỏ restriction.
- `graphVersion` hash identity: source SHA-256, provenance, policy hash, scope và builder version. `policyVersion` mô tả policy; đổi nội dung vẫn làm đổi graphVersion ngay cả khi người sửa quên tăng nhãn. Manifest chứa checksum toàn bộ artifact, timestamp Việt Nam, thời lượng xử lý giờ, scope, attribution và provenance nguồn.
- `complete=true` = build/export đạt kiểm tra; `graphReady=true` = graph preview đọc được; **`routingReady=false` = consumer chưa được coi cạnh là mạng routing đã tuân thủ hạn chế rẽ**. Chưa có `baseSpeedKph/baseTravelTimeHours`; không suy diễn chúng bằng 0. Những field đó trong ví dụ bên dưới là mục tiêu cho bước features.
- QA kiểm tra tham chiếu nguồn/graph, SQLite integrity, length dương; báo component yếu và policy exclusions. Không chứng minh liên thông có hướng, tính hợp lệ của tuyến hoặc ranh giới hành chính. Giữ mọi component, kể cả đảo; không thêm cạnh phà giả.

#### Bulk extract và dataset PBF TP.HCM (ưu tiên từ 27/09/2026)

- `bulk-download`: `source.osm.pbf` + `extract-manifest.json`, schema `member1-extract/1`. Manifest ghi URL nguồn, URL sau redirect, kích thước, MD5 nhà cung cấp, SHA-256 cục bộ, validator HTTP, fetchedAt và attribution.
- HTTP Last-Modified/ETag chỉ phục vụ resume; không được xem là thời điểm dữ liệu OSM. Timestamp nguồn lấy từ `osmosis_replication_timestamp` trong header khi lọc; thiếu thì ghi null/missingFlags.
- `extract-city`: `roads.osm.pbf` + manifest schema `member1-filtered-pbf/1`. Identity gồm sourceSha256, boundarySha256, bufferKm, scope và extractorVersion. Metadata ghi nguồn/phiên bản boundary, số highway được chọn, số restriction, số object sau hoàn thiện references, duration theo giờ và checksum đầu ra.
- Chọn nguyên highway ways có geometry giao polygon được buffer, sau đó lấy restriction relations có member way thuộc tập đã chọn. Backward references giữ tags, hoàn thiện nested relations tối đa 10 cấp; nếu vẫn thiếu references thì thất bại rõ ràng.
- Bộ lọc không thêm parent relation tổ tiên tùy ý nếu chúng không trực tiếp tham chiếu một highway đã chọn. Ferry ways không có highway không được chọn độc lập; đây là giới hạn của road-only ingestion, cần policy mở rộng khi dựng graph.
- Không cắt way tại biên, không thay đổi ID/tags/đơn vị thô. Các referenced objects có thể ở ngoài vùng phục vụ. Không nối lẫn nhiều snapshot Overpass vào dataset PBF.
- `complete=true` + `referenceComplete=true` biểu thị xử lý đủ các highway giao vùng trong file nguồn và kiểm tra tham chiếu đạt. Chất lượng/coverage thực tế phụ thuộc nguồn; `routingReady=false` cho đến bước policy/graph.
- PBF là artifact đầu vào thay thế raw_tiles cho quy mô toàn thành phố. Consumer phải chọn đúng adapter theo schemaVersion, không đọc PBF như JSON hoặc dùng trạng thái manifest raw-v1 để đánh giá PBF.

#### Boundary candidate

GeoJSON Feature, một Polygon hoặc MultiPolygon. Metadata: `osmId`, `source`, `fetchedAt`, `boundaryVersion`, `displayName`, tags/address do nguồn trả và `coverageChecks`.

- Nominatim lookup theo relation ID do người chạy chỉ định; ID gợi ý không tự bảo đảm đó là địa giới hiện hành.
- Provider Overpass tùy chọn lấy relation geometry và ghép outer/inner rings; từ chối vòng hở, lỗ không có outer duy nhất và nested boundary relation chưa hỗ trợ. Metadata giữ OSM version/timestamp khi nguồn trả.
- `verification=candidate`: chưa xác nhận pháp lý/đầy đủ địa giới. Các điểm kiểm tra HCMC/Bình Dương/Vũng Tàu/Côn Sơn chỉ giúp loại polygon sai rõ ràng; không thay thế đối chiếu đường biên hành chính.
- Không tự điền sourceTimestamp nếu nhà cung cấp không trả.
- Có thể nhập GeoJSON từ nguồn khác bằng lệnh `plan --boundary`, khai báo nguồn và phiên bản.

#### Tile plan

GeoJSON FeatureCollection có `schemaVersion=member1-ingestion/1`, `planVersion`, `regionId`, `scope`, boundary đầy đủ, `boundarySource`, `boundaryVersion`, `boundarySha256`, `tileKm`, `bufferKm`, `gridCrs`, `units` và danh sách ô.

Mỗi ô có `tileId` và `bboxSWNE=[south,west,north,east]`. Geometry ô dùng lon/lat. `planVersion` là SHA-256 của nội dung ngoại trừ createdAt và chính planVersion. Thay đổi boundary/ô/buffer/metadata sẽ đổi planVersion. Ô theo lưới UTM 48N, có thể chồng lấn ở bbox tải; đây không phải ranh giới hạn chế routing.

`scope=test` dành riêng fixture/khu vực kiểm thử, luôn hiện trong manifest. `scope=hcmc-current` yêu cầu đạt tất cả coverage probes. `boundaryVerification=coverage-probes-only` không đồng nghĩa ranh giới được cơ quan hành chính xác nhận.

#### Raw OSM và download manifest

```text
<output>/
  manifest.json
  raw_tiles/<tileId>/
    query.overpassql
    record.json
    <sha256>.json
```

- Query lấy highway ways, restriction relations liên quan, các thành phần con và marker đếm cuối bằng `out count`.
- Node/way/relation giữ tags, version và metadata nguồn. Đây là dữ liệu thô: `routingReady=false`, chưa có policy xe máy, graph routing hoặc chiều dài chuẩn hóa.
- Kiểm tra số lượng marker, timestamp nguồn, tọa độ, duplicate IDs, way thiếu node và relation thiếu member. Không coi response có `remark` là thành công, kể cả HTTP 200.
- Response rỗng nhưng có count marker hợp lệ được chấp nhận: ô biển hoặc vùng không có highway có thể không có đường.
- Cache ghi raw theo checksum trước, record sau. `record.json` chứa requestKey, sha256, số byte, fetchedAt, sourceTimestamp và bbox. Đọc lại phải đúng checksum.
- Cache không tự hết hạn. Dùng output/version mới để chụp dataset mới; `--refresh` là thao tác tải lại rõ ràng. Refresh thất bại không tự quay về cache cũ.
- Manifest có identity gồm planVersion, endpoint và osmDate; output khác identity bị từ chối để tránh trộn dataset.
- Trạng thái ô: pending, in_progress, complete, failed. `complete=true` chỉ biểu thị tất cả ô trong plan đã thu thập; không chứng nhận routing hay graph toàn thành phố đã ghép.
- `sourceTimestamp` từ `osm3s.timestamp_osm_base` là thời điểm cơ sở dữ liệu nguồn. Khi dùng `--osm-date`, ngày snapshot yêu cầu được ghi riêng trong `osmDate`.
- Mặc định các ô có thể được lấy ở thời điểm khác nhau. Không gọi đây là snapshot OSM đồng thời; bước merge phải phát hiện xung đột version.
- SourceType REAL-derived; attribution © OpenStreetMap contributors, ODbL 1.0.

### Ví dụ tối thiểu về các trường feature

Ví dụ dưới đây là SYNTHETIC để thống nhất tên trường, không phải cạnh đường thật:

```json
{
  "edgeId": "synthetic-way-10:segment-0:forward",
  "fromNodeId": "1",
  "toNodeId": "2",
  "edgeKey": "synthetic-way-10:segment-0:forward",
  "lengthKm": 0.5,
  "baseSpeedKph": 25.0,
  "baseTravelTimeHours": 0.02,
  "widthM": null,
  "missingFlags": ["width"],
  "sourceType": "SYNTHETIC",
  "graphVersion": "synthetic-example-v1",
  "travelProfileVersion": "synthetic-profile-v1"
}
```

Giá trị thiếu không được tự đổi thành 0. Policy, travel profile, risk weights và schema Scenario/WeatherContext đã có bản draft cục bộ; cần chốt với consumer trước tích hợp. Exposure theo chiều dài dùng `Σ(lengthKm × edgeProxy)`; không đổi về phần trăm tai nạn.
### Bổ sung: dữ liệu live từ API

`geo_data.realtime` bổ sung `member1-live-settings/1`, `member1-live-pointer/1`, `member1-live-snapshot/1`, `member1-live-status/1`. `latest.json` trỏ đến bản weather/travel/features hoàn chỉnh; kiểm tra qua `load_latest` trước mỗi lần tối ưu. Hàm này giữ một phiên bản cố định trong lần đọc, xác minh checksum/lineage và từ chối dữ liệu quá cũ. `checksPassed` của snapshot không thay thế QA kịch bản hoặc nghiệm thu tích hợp. Chi tiết đơn vị, độ mới, xử lý lỗi và ví dụ ở [realtime](#realtime).

<a id="overpass"></a>

## 8. Phụ lục: Overpass theo ô và kết quả lịch sử

Luồng Overpass dưới đây giữ lại để kiểm tra một số ô nhỏ và đọc cache cũ. Toàn TP.HCM dùng PBF ở [phần chuẩn bị dữ liệu](#ingestion); không cần tải hết 1.627 ô trước khi tiếp tục pipeline. Số liệu ngày 26/09/2026 là lịch sử kiểm chứng, không phải trạng thái hiện tại.

### Tải theo đợt và tiếp tục

Sau khi có plan đúng:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli download --plan scenarios/cached_context/hcmc/tiles.geojson --output scenarios/cached_context/hcmc/raw-v1 --max-tiles 2 --user-agent "SafeRouteVN/0.1 Member1 development"
```

Chạy lại cùng lệnh để đi tiếp: cache đã hợp lệ không tính vào giới hạn 2 lần tải mới. `--tile-id <id>` có thể lặp để chọn các ô cụ thể, ví dụ các ô liền nhau cho kiểm thử đường xuyên biên. Không chọn theo vị trí mảng vì thứ tự tile ID không biểu thị ưu tiên vùng trung tâm.

Log hiển thị vị trí ô trong toàn bộ plan và tổng tiến độ. Ví dụ minh họa:

```text
Plan: 1627 tiles | selected: 1627 | completed: 16/1627 (1.0%)
[tile 15/1627] c123_r186: downloading... | completed: 16/1627 (1.0%)
[tile 15/1627] c123_r186: complete (cache=False) | completed: 17/1627 (1.0%)
```

`tile i/N` là số thứ tự ô trong plan, giữ nguyên khi chọn bằng `--tile-id`. `completed` là tổng số ô có trạng thái complete trong manifest, gồm cả các lần chạy trước; khi kiểm tra cache phát hiện lỗi thì số này được cập nhật giảm tương ứng. Hai số có thể khác nhau vì một số ô phía sau đã được tải trước. Log `downloading...` xuất hiện ngay trước khi gọi API; log hoàn thành cho biết dữ liệu đến từ cache hay vừa tải mới. `--max-tiles` chỉ giới hạn số lần tải mới trong đợt, không đổi mẫu số N của toàn plan.

Request được gửi tuần tự, có khoảng nghỉ; 429/5xx và lỗi mạng được retry có giới hạn. Khi một ô thất bại sau retry, đợt chạy dừng và lưu trạng thái để chạy tiếp. Với dữ liệu toàn thành phố, dùng `bulk-download` + `extract-city` ở phần chuẩn bị dữ liệu thay vì chạy hết các ô trên Overpass công cộng.

Overpass chọn way theo node trong bbox và giữ nguyên geometry nguồn, không clip tại biên ô. Một segment rất dài đi xuyên bbox nhưng không có node bên trong có thể không được truy vấn đó chọn; buffer giảm vấn đề biên nhưng không chứng minh coverage tuyệt đối. Bước ghép/QA cần đối chiếu các kết nối biên và đánh giá extract nguồn lớn hơn nếu cần.

- `--endpoint`: đổi nguồn Overpass; dùng output mới khi đổi endpoint.
- `--osm-date "2026-09-26T00:00:00+07:00"`: tùy chọn snapshot lịch sử nếu nguồn hỗ trợ; phải giữ cùng giá trị khi resume/offline.
- `--attempts 1`: tắt retry.
- `--interval-seconds 2`: pacing HTTP, không liên quan đơn vị thời gian nghiệp vụ.
- `--refresh`: tải lại rõ ràng; nếu muốn refresh một vài ô, chỉ định tile-id. Giới hạn batch khi refresh không tự bỏ qua các ô vừa refresh ở lần trước; dùng version output mới cho một đợt cập nhật toàn bộ.

### Kiểm tra cache offline

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli download --plan scenarios/cached_context/hcmc/tiles.geojson --output scenarios/cached_context/hcmc/raw-v1 --offline
```

Lệnh không gọi HTTP, kiểm tra checksum và cấu trúc OSM. Cache thiếu/hỏng trả mã lỗi. Nếu mới tải một phần, dùng `--tile-id` để kiểm tra các ô đã có; kiểm tra cả plan sẽ báo thiếu.

Không chạy hai writer trên cùng output. File `.writer.lock` chặn chạy đồng thời; nếu tiến trình bị kill, kiểm tra chắc chắn không còn writer trước khi tự xóa lock cũ. Ghi manifest là thao tác cuối sau mỗi ô; `complete=false` phải được consumer tôn trọng.

### Đọc kết quả và phần tiếp theo

`raw-v1/manifest.json` ghi summary, phạm vi test/hcmc-current, trạng thái mỗi ô, timestamps và checksum. `complete=true` chỉ là thu thập đủ ô, **chưa phải graph routing**. `routingReady=false` cho đến khi ghép và xử lý policy ở M1-03/M1-04.

Đối với toàn thành phố, dùng PBF cùng snapshot và lệnh `build-graph` ở phần chuẩn bị dữ liệu. Nếu dùng lại luồng nhiều tile thì vẫn cần dedupe theo ID/version và xử lý xung đột snapshots trước khi dựng graph; chưa có adapter ghép tile sang graph trong bản này. Không dùng raw way order để khẳng định chiều xe được phép đi.

### Kết quả kiểm chứng ngày 26/09/2026

- **21 unittest đạt**, bao gồm chuyển đổi đơn vị, múi giờ, MultiPolygon/holes, coverage, checksum, thiếu node/member, retry, resume, offline và refresh thất bại.
- Lấy boundary qua Overpass thành công sau một lần lỗi 504; Nominatim bị từ chối kết nối trên máy kiểm thử.
- Boundary OSM relation R1973756 version 288: sáu coverage probes đạt. Plan 5 km/buffer 0,25 km tạo 1.627 ô; union các query bbox bao phủ polygon nguồn.
- Tải thử hai ô liền kề trong plan thật, sau đó đọc lại offline thành công. Manifest `scenarios/cached_context/hcmc/raw-v1/manifest.json`: 2 ô complete, 1.625 pending, `complete=false`, `routingReady=false`.

| Tile | Nodes | Ways | Relations | Dung lượng raw JSON (byte) |
| --- | --- | --- | --- | --- |
| `c137_r238` | 35.778 | 9.298 | 336 | 14.242.621 |
| `c138_r238` | 18.043 | 4.165 | 38 | 6.562.764 |

Các số trên là theo từng ô, có thể trùng đối tượng ở phần chồng lấn hoặc relation kéo dài; không cộng thành số đối tượng duy nhất của thành phố. Bước merge sẽ xử lý trùng lặp/xung đột. Đây là kiểm chứng thu thập dữ liệu, chưa phải đánh giá chất lượng routing.

Lệnh kiểm tra lại đúng hai ô đã có, không cần mạng:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli download --plan scenarios/cached_context/hcmc/tiles.geojson --output scenarios/cached_context/hcmc/raw-v1 --offline --tile-id c137_r238 --tile-id c138_r238
```

Nguồn kỹ thuật: [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL), [Overpass usage](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), [Nominatim lookup](https://nominatim.org/release-docs/latest/api/Lookup/), [Nominatim usage](https://operations.osmfoundation.org/policies/nominatim/).

<a id="scenario-catalog"></a>

## 9. Xuất fixtures và manifests theo T1.6 trong XLSX

Sheet `02_WORK_PACKAGE_DETAIL`, dòng T1.6 yêu cầu Scenario JSON + manifests ở `scenarios/fixtures/` và `scenarios/manifests/`. Sheet `03_TEAM_GUIDE_STRUCTURE` giao cả ba nhánh fixtures/manifests/cached_context cho Member 1 + Leader. Generator đã sinh S0–S8 trong bundle của pipeline; bước export sau đây đưa các kịch bản vào cấu trúc bàn giao, giữ nguyên dữ liệu và checksum gốc.

### Member 1 chạy sau khi QA đạt

Từ thư mục gốc dự án chứa `geo_data/` và `scenarios/`:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli export-scenarios --run scenarios/cached_context/hcmc/member1-tdbt-v1 --scenarios-root scenarios --suite-id thu-duc-binh-thanh-v1
.\.venv\Scripts\python.exe -m geo_data.cli verify-scenarios --scenarios-root scenarios --suite-id thu-duc-binh-thanh-v1
```

Chạy lệnh sau khi lệnh trước thành công. Export chạy offline: đọc checksum của các bundle lớn nhưng chỉ sao chép bundle scenario nhỏ, không tải API, tìm tuyến lại hay sao chép toàn bộ graph/features. Run nguồn phải nằm dưới `scenarios-root/cached_context/` và đạt QA, suiteReady, S7/S8 evidence.

```text
scenarios/
  fixtures/
    thu-duc-binh-thanh-v1/
      S0.json ... S8.json
      delivery_area.geojson
      scenario_profile.json
      diagnostics.json
      qa_report.json
      manifest.json
      export-state.json
  manifests/
    thu-duc-binh-thanh-v1.json
  cached_context/
    hcmc/member1-tdbt-v1/
      routing/ travel/ weather-plan/ weather/ features/ scenarios/ qa/
```

- `fixtures/thu-duc-binh-thanh-v1/`: bản sao nguyên byte của các file thuộc bundle scenario; `manifest.json` tại đây là manifest bundle nguồn. `export-state.json` chỉ giữ identity để tiếp tục nếu copy bị ngắt.
- `manifests/thu-duc-binh-thanh-v1.json`: catalog schema `member1-scenario-catalog/1`, gồm suiteId, seed, epoch, phiên bản và hash manifest từng stage, đường dẫn/chữ ký SHA-256 của S0–S8, số đơn/xe/event và đơn vị.
- `sourceRun` và các đường dẫn file tính từ `scenarios-root`, dùng dấu `/`, không ghi đường dẫn ổ đĩa vào catalog. Đổi tên thư mục dự án hoặc chuyển máy vẫn đọc được nếu giữ cấu trúc bên trong `scenarios/`.
- Catalog được ghi nguyên tử sau khi copy và kiểm tra đủ. Chưa có catalog thì consumer không nhận suite dở dang. Chạy lại cùng lệnh giữ bản đã hoàn thành hoặc tiếp tục file còn thiếu; khác input phải đổi `--suite-id thu-duc-binh-thanh-v2`. Dữ liệu đã có nhưng sai checksum bị từ chối, không tự ghi đè.

Không di chuyển/xóa S0–S8 khỏi run gốc. QA gốc tham chiếu chúng, và adapter sẽ đối chiếu bundle gốc với bản export. Đây là một bản xuất cho cây dự án, không thay thế định dạng package `build-handoff` ở phần 6.

### Member 2/3 kiểm tra và đọc trên máy nhận

Sau khi tải code và cả ba thư mục `fixtures/`, `manifests/`, `cached_context/` từ Drive:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli verify-scenarios --scenarios-root scenarios --suite-id thu-duc-binh-thanh-v1
```

Lệnh kiểm tra đủ S0–S8, checksum, QA, version/seed/epoch, liên kết tới context và các invariants của scenario. `verified=true` xác nhận dữ liệu bàn giao, không chứng minh solver/backend đã tích hợp.

```python
from geo_data.scenario_catalog import ScenarioCatalog

catalog = ScenarioCatalog("scenarios", "thu-duc-binh-thanh-v1")
scenario = catalog.scenario("S0")
state = scenario["initialState"]
order = state["orders"][0]
pickup = next(p for p in state["locations"] if p["id"] == order["pickupLocationId"])

print(catalog.manifest["versions"])
print(catalog.paths["weather"])   # thư mục context trên máy nhận
print(catalog.paths["features"])
with catalog.open_graph() as graph:
    route = graph.path(pickup["graphNodeId"], order["graphNodeId"], weight="time")
    print(route)
```

Khởi tạo catalog một lần khi load suite, không cho từng cạnh: constructor đọc checksum các dữ liệu lớn. Mỗi `scenario()` trả một object mới để backend có thể tạo trạng thái runtime mà không ghi lại fixture. `open_graph()` là context manager, giữ các kiểm tra cấm rẽ của `RoutingGraph`; xem phần nhận bàn giao về incoming-edge state giữa các chặng.

Các timestamp trong fixture vẫn thuộc epoch gốc. Replay dùng đồng hồ của scenario; không tự trộn fixture này với context live mới. Catalog giữ `integrated=false`; Member 2/3 ghi kết quả tích hợp ở artifact riêng.

### Trạng thái kiểm chứng bước export

Toàn bộ **82 test đạt**, gồm 6 test mới cho catalog/fixtures; CLI help, cú pháp ví dụ Python và các liên kết nội bộ trong hướng dẫn đã được kiểm tra.

Đã kiểm thử trên pipeline nhỏ có QA thật và HTTP mock: sao chép nguyên byte, chuyển toàn bộ thư mục sang đường dẫn khác, đọc fixture/mở routing, copy gián đoạn rồi tiếp tục, thiếu context, đổi dữ liệu/manifest và đường dẫn thoát khỏi scenarios-root. Lệnh xuất dữ liệu thành phố do người dùng chạy theo hướng dẫn trên.

<a id="delivery-area"></a>

## 10. Giao hàng Thủ Đức–Bình Thạnh, tìm đường trên graph rộng

Phạm vi giao hàng mới là **TP. Thủ Đức cũ và quận Bình Thạnh cũ**. Polygon chỉ lọc depot và điểm giao; mạng đường vẫn dùng toàn bộ graph TP.HCM đã có. Đường đi có thể vượt ra ngoài hai polygon, tuân thủ cùng policy xe máy và hạn chế rẽ. Bước này không cắt nhỏ graph, không giảm số cạnh được tính features/weather và không thêm dữ liệu Google Maps.

### Lấy polygon OSM cho hai vùng

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli delivery-area-fetch --output scenarios/cached_context/hcmc/delivery-areas/thu-duc-binh-thanh.geojson --user-agent "SafeRouteVN/0.1 Member1 development"
```

Lệnh mặc định dùng `geo_data/areas/thu_duc_binh_thanh.json`: truy vấn relation hành chính theo tên/aliases, admin_level=6 và bbox khu vực tại snapshot OSM **2025-01-01T00:00:00Z**. Đây là mốc dữ liệu lịch sử để lấy các khu vực cũ, không phải xác nhận địa giới hành chính hiện hành. Mạng đường vẫn là snapshot graph đã dựng; hai thời điểm phục vụ hai mục đích khác nhau.

Nguồn được ghi trong GeoJSON: query, endpoint, ngày snapshot, thời điểm lấy, ID/version/tags relation và hash raw response. Raw lưu bên cạnh dưới tên `thu-duc-binh-thanh.raw.json`. Chạy lại dùng cache có kiểm tra nguồn/geometry; đổi cấu hình hoặc endpoint cần output mới. Query lịch sử dùng cơ chế [Overpass date](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#Date).

Lệnh yêu cầu đúng một relation cho mỗi khu vực, geometry đóng hợp lệ và bao phủ điểm tham chiếu. Không đủ/mơ hồ/thiếu vòng biên thì dừng; không tự dùng bbox thay polygon. Xem file GeoJSON bằng công cụ bản đồ để rà soát phạm vi trước khi dùng. Các điểm tham chiếu chỉ là kiểm tra nhanh, không xác minh toàn bộ biên; kết quả vẫn ghi `candidate-needs-boundary-review`.

Nếu Overpass không hỗ trợ/trả được dữ liệu lịch sử, có thể truyền `--config <lookup.json>` đã hiệu chỉnh hoặc chuẩn bị GeoJSON từ nguồn đã kiểm tra. File đầu vào của generator phải là FeatureCollection WGS84, có `properties.areaId`, `properties.source`; mỗi feature có Polygon/MultiPolygon và `properties.regionId`/`properties.name` duy nhất. Giữ lỗ/phần rời, không tự vẽ vùng gần đúng rồi gắn nhãn ranh giới OSM. Profile mặc định yêu cầu areaId `thu-duc-binh-thanh-historical`.

### Chạy một pipeline riêng cho vùng giao hàng mới

Sau khi lấy polygon thành công:

```powershell
.\.venv\Scripts\python.exe -m geo_data.pipeline --graph scenarios/cached_context/hcmc/graph-v1 --output scenarios/cached_context/hcmc/member1-tdbt-v1 --delivery-area scenarios/cached_context/hcmc/delivery-areas/thu-duc-binh-thanh.geojson --scenario-profile geo_data/areas/thu_duc_binh_thanh_profile.json
```

Lệnh dùng graph nguồn sẵn có, tạo routing/travel/weather/features/scenarios/QA trong run mới. Nó không tải lại PBF; vẫn xử lý dữ liệu toàn graph và gọi weather cho run mới, nên thời gian/dung lượng tương đương một pipeline đầy đủ. Không sửa run cũ, fixtures hcmc-v1 hay live đang chạy. Chạy lại giữ epoch/input và tiếp tục các stage hợp lệ. Có thể kiểm tra từng bước bằng `--stop-after` như pipeline thông thường.

Profile mới đặt anchor thử nghiệm `(106.716, 10.802)`, giới hạn snap depot 5 km, 8 đơn/2 xe, candidateLimit=80 và searchMaxStates=500000. Đây là cấu hình kỹ thuật khởi đầu, không phải tọa độ kho đã được xác nhận. Depot tự chọn phải nằm trong polygon và qua kiểm tra kết nối. `--depot-node` chỉ định ngoài polygon sẽ bị từ chối, không tự dời depot.

Khi có `--delivery-area`:

- Polygon thay điều kiện bán kính cho điểm giao; `radiusKm` trong profile chỉ dùng ở chế độ không polygon. `minDistanceKm` vẫn được áp dụng so với depot.
- Candidate được trộn luân phiên theo vùng có seed. Bộ đơn nền có ít nhất một điểm đi–về đạt ở mỗi vùng; với hai vùng này, S0 cũng có điểm ở cả hai. Thiếu vùng đạt thì báo lỗi để xem diagnostics hoặc tăng budget, không tự bỏ vùng.
- Đơn gấp S2 và điểm đơn S7/S8 cũng nằm trong polygon. S7/S8 mỗi ca có thể chỉ có một điểm theo bằng chứng trade-off, không yêu cầu mỗi ca phủ cả hai vùng.
- Bộ lọc không chặn traversal ngoài polygon hoặc ngoài bán kính. Không tự thêm cạnh/cầu/phà; khả năng đi vòng vẫn phụ thuộc dữ liệu và policy của graph nguồn.
- S4 vẫn là polygon mưa giả lập; ảnh hưởng tới mọi cạnh giao với vùng mưa, không bị ép cắt theo biên giao hàng.

Kết quả có `delivery_area.geojson` bên trong bundle scenario, `deliveryAreaVersion` gắn vào scenario/manifest và `deliveryRegionId` ở đơn hàng. QA kiểm lại vị trí depot/xe/đơn, đơn gấp và điểm bằng chứng tuyến. Đổi polygon/provenance làm đổi version, cần output mới. Profile Thủ Đức–Bình Thạnh từ chối chạy nếu thiếu hoặc sai areaId của `--delivery-area`.

### Xuất bộ fixtures mới để bàn giao

Sau khi pipeline QA và S7/S8 đều đạt:

```powershell
.\.venv\Scripts\python.exe -m geo_data.cli export-scenarios --run scenarios/cached_context/hcmc/member1-tdbt-v1 --scenarios-root scenarios --suite-id thu-duc-binh-thanh-v1
.\.venv\Scripts\python.exe -m geo_data.cli verify-scenarios --scenarios-root scenarios --suite-id thu-duc-binh-thanh-v1
```

Member 2/3 đọc `ScenarioCatalog("scenarios", "thu-duc-binh-thanh-v1")`. Polygon cũng được sao chép vào fixtures và được kiểm cùng phiên bản; không cần file polygon tại đường dẫn trên máy Member 1 để replay trên máy nhận. Khi upload Drive, mang theo fixtures/manifests mới và `cached_context/hcmc/member1-tdbt-v1/` được catalog tham chiếu.

Chế độ không truyền `--delivery-area` vẫn giữ cách chọn bán kính cũ và đọc lại được snapshot cũ. Toàn bộ **91 test đạt**, gồm 9 test polygon/provenance/route đi ngoài vùng/QA/catalog và yêu cầu profile. Kiểm thử code sử dụng geometry/graph tổng hợp và HTTP mock. Cập nhật sau khi người dùng chạy: đã có polygon, run `member1-tdbt-v1` đủ 7 stage với QA/suiteReady đạt theo manifest và catalog `thu-duc-binh-thanh-v1` đã xuất. Mỗi bản tải về vẫn cần chạy `verify-scenarios`; các artifact này chưa thay thế rà soát biên trên bản đồ hay nghiệm thu solver/backend.
