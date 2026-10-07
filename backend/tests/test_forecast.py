"""Owner-scoped public forecast reads preserve submission and physical state."""
import asyncio
from copy import deepcopy
from dataclasses import replace
import json
import hashlib
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

from backend.api.errors import ApiError
from backend.api.main import create_app
from backend.services.runtime_gateway import RuntimeGateway
from backend.tests.test_jobs import JobGateway, optimize, submitted
from backend.tests.test_sessions import code, headers, load, setup
from backend.tests.test_runtime_gateway import gateway


UNITS = {"distance": "m", "duration": "s", "action_time": "us", "cost": "VND",
         "mass": "kg", "geometry_crs": "WGS84", "geometry_order": "longitude_latitude"}


def projection(session_id, job_id, profile, view):
    return {"schema_version": "task02-m2-job-forecast/1", "session_id": session_id,
            "job_id": job_id, "profile": profile, "input_basis": deepcopy(view["input_basis"]),
            "build_sha256": view["input_basis"]["build_sha256"], "job_view": deepcopy(view),
            "trajectory": None, "metrics": None, "units": {**UNITS, "exposure": "PROXY"},
            "metric_scope": "FORECAST_ONLY", "execution_mode": "SIMULATED_REPLAY",
            "real_world_observation": False}


def certified_projection(session_id, job_id, view):
    value = projection(session_id, job_id, "BALANCED", view)
    value["job_view"].update(job_status="COMPLETED", internal_status="FEASIBLE", business_status="FEASIBLE",
        plan_available=True, coverage_evaluated=True, served_orders=["order-1"],
        validation={"status": "VALIDATED", "valid": True, "validator_version": "raw-validator/3"})
    value["metrics"] = {"total_distance_m": 10.25, "total_travel_time_s": 0.00001,
                        "total_cost_vnd": 12345, "total_exposure": 2.5, "total_soft_lateness_s": 0}
    value["trajectory"] = {"job_id": job_id, "profile": "BALANCED", "forecast": True,
        "domain_sha256": "e" * 64, "vehicle_routes": [{"vehicle_id": "vehicle-1", "order_sequence": ["order-1"],
        "start_us": "9007199254740992", "return_us": "9007199254741012", "start_node": 1, "end_node": 2,
        "actions": [{"kind": "EDGE", "start_us": "9007199254740992", "end_us": "9007199254741002",
                     "edge_id": "edge-1", "from_node": 1, "to_node": 2, "incoming_edge": "edge-0",
                     "fraction_start": 1 / 3, "fraction_start_exact": "1/3", "fraction_end": 1,
                     "geometry": [[106.75, 10.75], [106.751, 10.751]],
                     "feature_payload": {"source_exact": {"numerator": "1", "denominator": "3"}},
                     "distance_m": 10.25, "exposure": 2.5},
                    {"kind": "SERVICE", "start_us": "9007199254741002", "end_us": "9007199254741012",
                     "node_id": 2, "order_id": "order-1", "load_after_kg": 0}]}]}
    return value


class ForecastGateway(JobGateway):
    def __init__(self, build):
        super().__init__(build)
        self.forecasts = {}
        self.forecast_reads = []

    async def job_forecast(self, session_id, job_id):
        self.forecast_reads.append((session_id, job_id))
        if (session_id, job_id) in self.forecasts:
            return deepcopy(self.forecasts[(session_id, job_id)])
        view = self.jobs[(session_id, job_id)]
        profile = next(args[3] for args in self.submissions
                       if self.submit_receipts[(args[0], args[1])]["job_id"] == job_id)
        return projection(session_id, job_id, profile, view)


@pytest.fixture
def forecast_setup(setup):
    settings, original = setup
    return settings, ForecastGateway(original.build)


@pytest.fixture
def forecast_client(forecast_setup):
    settings, runtime = forecast_setup
    with TestClient(create_app(settings, gateway=runtime), raise_server_exceptions=False) as client:
        yield client


def read(client, session_id, job_id, actor="alice"):
    return client.get(f"/api/sessions/{session_id}/jobs/{job_id}/forecast", headers=headers(actor))


def metadata(settings):
    with sqlite3.connect(settings.metadata_path) as db:
        return "\n".join(db.iterdump())


def test_forecast_preserves_job_view_and_all_state_without_running_mutations(forecast_client, forecast_setup):
    sid, receipt = submitted(forecast_client)
    settings, runtime = forecast_setup
    before = deepcopy((runtime.views, runtime.jobs, runtime.commands, runtime.reads,
                       runtime.submissions, runtime.cancellations, runtime.computes))
    stored = metadata(settings)
    result = read(forecast_client, sid, receipt["job_id"])
    assert result.status_code == 200, result.text
    assert result.headers["cache-control"] == "no-store"
    expected = projection(sid, receipt["job_id"], "BALANCED", runtime.jobs[(sid, receipt["job_id"])])
    assert result.json()["data"] == expected
    assert metadata(settings) == stored
    assert (runtime.views, runtime.jobs, runtime.commands, runtime.reads,
            runtime.submissions, runtime.cancellations, runtime.computes) == before


def test_forecast_authentication_owner_and_job_namespace(forecast_client, forecast_setup):
    sid, receipt = submitted(forecast_client)
    runtime = forecast_setup[1]
    path = f"/api/sessions/{sid}/jobs/{receipt['job_id']}/forecast"
    code(forecast_client.get(path), 401, "UNAUTHORIZED")
    code(read(forecast_client, sid, receipt["job_id"], "bob"), 403, "FORBIDDEN")
    code(read(forecast_client, "missing", receipt["job_id"]), 404, "SESSION_NOT_FOUND")
    code(read(forecast_client, sid, "unknown-job"), 404, "JOB_NOT_FOUND")
    other = load(forecast_client, request_id="other-load").json()["data"]["session"]["session_id"]
    code(read(forecast_client, other, receipt["job_id"]), 404, "JOB_NOT_FOUND")
    assert runtime.forecast_reads == []


def test_viewer_can_read_owned_forecast(forecast_client, forecast_setup):
    sid, receipt = submitted(forecast_client)
    with sqlite3.connect(forecast_setup[0].metadata_path) as db:
        db.execute("UPDATE sessions SET owner_actor_id='viewer' WHERE session_id=?", (sid,))
    result = read(forecast_client, sid, receipt["job_id"], "viewer")
    assert result.status_code == 200, result.text
    assert result.json()["data"]["profile"] == "BALANCED"


@pytest.mark.parametrize("status", ["QUEUED", "RUNNING", "FAILED", "SEARCH_LIMIT", "TIME_LIMIT", "UNSUPPORTED", "INVALID_DATA"])
def test_lifecycle_without_witness_returns_null(forecast_client, forecast_setup, status):
    sid, receipt = submitted(forecast_client)
    view = forecast_setup[1].jobs[(sid, receipt["job_id"])]
    if status in ("QUEUED", "RUNNING", "FAILED"):
        view["job_status"] = status
    else:
        view.update(job_status="COMPLETED", business_status=status, internal_status=status)
    if status not in ("QUEUED", "RUNNING"):
        view["diagnostics"] = [{"severity": "ERROR", "code": status, "path": "job", "message": "No certified witness"}]
    result = read(forecast_client, sid, receipt["job_id"])
    assert result.status_code == 200, result.text
    assert result.json()["data"]["job_view"] == view
    assert result.json()["data"]["trajectory"] is None
    assert result.json()["data"]["metrics"] is None


def test_historical_basis_is_not_replaced_by_current_head(forecast_client, forecast_setup):
    sid, receipt = submitted(forecast_client)
    forecast_setup[1].views[sid]["basis"].update(head_version="2", head_sha256="f" * 64)
    result = read(forecast_client, sid, receipt["job_id"])
    assert result.status_code == 200, result.text
    assert result.json()["data"]["input_basis"] == receipt["input_basis"]


@pytest.mark.parametrize("field,value", [("session_id", "other"), ("root_sha256", "a" * 64),
    ("head_sha256", "b" * 64), ("head_version", "2"), ("generation", "1"),
    ("source_sha256", "c" * 64), ("context_version", "other"), ("overlay_sha256", "d" * 64),
    ("build_sha256", "e" * 64)])
def test_forecast_checks_every_persisted_basis_field(forecast_client, forecast_setup, field, value):
    sid, receipt = submitted(forecast_client)
    runtime = forecast_setup[1]
    projected = projection(sid, receipt["job_id"], "BALANCED", runtime.jobs[(sid, receipt["job_id"])])
    projected["input_basis"][field] = value
    projected["job_view"]["input_basis"][field] = value
    if field == "build_sha256":
        projected["build_sha256"] = value
    runtime.forecasts[(sid, receipt["job_id"])] = projected
    assert read(forecast_client, sid, receipt["job_id"]).status_code == 503


@pytest.mark.parametrize("field,value", [("profile", "SAFER"), ("job_id", "other"),
    ("session_id", "other"), ("build_sha256", "f" * 64), ("metric_scope", "OBSERVED_PREFIX_ONLY"),
    ("real_world_observation", True), ("execution_mode", "REAL"), ("units", {})])
def test_forecast_rejects_public_binding_changes(forecast_client, forecast_setup, field, value):
    sid, receipt = submitted(forecast_client)
    runtime = forecast_setup[1]
    projected = projection(sid, receipt["job_id"], "BALANCED", runtime.jobs[(sid, receipt["job_id"])])
    projected[field] = value
    runtime.forecasts[(sid, receipt["job_id"])] = projected
    assert read(forecast_client, sid, receipt["job_id"]).status_code == 503


def test_forecast_rejects_changed_submit_installation(forecast_client, forecast_setup):
    sid, receipt = submitted(forecast_client)
    with sqlite3.connect(forecast_setup[0].metadata_path) as db:
        db.execute("UPDATE compute_queue SET installation_sha256=? WHERE job_id=?", ("f" * 64, receipt["job_id"]))
    assert read(forecast_client, sid, receipt["job_id"]).status_code == 503
    assert forecast_setup[1].forecast_reads == []


def test_forecast_rejects_changed_server_installation(forecast_client, forecast_setup):
    sid, receipt = submitted(forecast_client)
    settings = forecast_setup[0]
    config = settings.installation()
    config["expected_build_sha256"] = "f" * 64
    settings.installation_path.write_text(json.dumps(config))
    assert read(forecast_client, sid, receipt["job_id"]).status_code == 503


def test_certified_forecast_keeps_exact_geometry_and_times(forecast_client, forecast_setup):
    sid, receipt = submitted(forecast_client)
    runtime = forecast_setup[1]
    value = certified_projection(sid, receipt["job_id"], runtime.jobs[(sid, receipt["job_id"])])
    runtime.forecasts[(sid, receipt["job_id"])] = value
    before = metadata(forecast_setup[0])
    result = read(forecast_client, sid, receipt["job_id"])
    assert result.status_code == 200, result.text
    assert result.json()["data"] == value
    assert metadata(forecast_setup[0]) == before


@pytest.mark.parametrize("key", ["trajectory", "metrics"])
def test_no_witness_forecast_cannot_smuggle_geometry_or_metrics(forecast_client, forecast_setup, key):
    sid, receipt = submitted(forecast_client)
    runtime = forecast_setup[1]
    value = projection(sid, receipt["job_id"], "BALANCED", runtime.jobs[(sid, receipt["job_id"])])
    value[key] = {}
    runtime.forecasts[(sid, receipt["job_id"])] = value
    assert read(forecast_client, sid, receipt["job_id"]).status_code == 503


@pytest.mark.parametrize("metrics", [{}, {"total_cost_vnd": "12345"}, {"total_cost_vnd": True},
                                     {"total_cost_vnd": -1}])
def test_forecast_rejects_non_native_metrics(forecast_client, forecast_setup, metrics):
    sid, receipt = submitted(forecast_client)
    runtime = forecast_setup[1]
    value = certified_projection(sid, receipt["job_id"], runtime.jobs[(sid, receipt["job_id"])])
    value["metrics"] = metrics
    runtime.forecasts[(sid, receipt["job_id"])] = value
    assert read(forecast_client, sid, receipt["job_id"]).status_code == 503


@pytest.fixture
def installed_bridge(tmp_path):
    """Test-only SDK transports a fixture through the real inventory verifier/checker."""
    if not os.environ.get("M3_TEST_RUNTIME_PYTHON"):
        from importlib.util import find_spec
        if find_spec("jsonschema") is None:
            pytest.skip("Bridge tests require M3_TEST_RUNTIME_PYTHON with the runtime's pinned dependencies")
    root = tmp_path / "installation"
    module_dir = root / "optimization/runtime"
    module_dir.mkdir(parents=True)
    source = Path(__file__).resolve().parents[2]
    for name in ("protocol", "contracts", "trajectory_contract", "job_view", "forecast"):
        shutil.copyfile(source / f"optimization/runtime/{name}.py", module_dir / f"{name}.py")
    (root / "optimization/__init__.py").write_text("")
    (module_dir / "__init__.py").write_text("")
    (root / "requirements-runtime.lock.txt").write_text("# isolated test fixture\n")
    shutil.copyfile(source / "runtime_entry.py", root / "runtime_entry.py")
    (module_dir / "sdk.py").write_text(
        "import json\nfrom pathlib import Path\n"
        "class RuntimeClient:\n"
        " def __init__(self, **kwargs): self.path=Path(kwargs['snapshot_root'])/'projection.json'\n"
        " def job_forecast(self, session_id, job_id):\n"
        "  value=json.loads(self.path.read_text())\n"
        "  assert value['session_id']==session_id and value['job_id']==job_id\n"
        "  return value\n"
        " def command(self, *args, **kwargs): raise AssertionError('read invoked mutation')\n")
    pins = {p.relative_to(root).as_posix(): {"bytes": p.stat().st_size,
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in root.rglob("*") if p.is_file()}
    body = {"files": pins}
    build = hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    (root / "production_inventory.json").write_text(json.dumps({**body, "build_sha256": build}))
    state = tmp_path / "state"
    state.mkdir()
    (state / "backend_authority.sqlite").write_bytes(b"read-only fixture authority")
    config = tmp_path / "installation.json"
    config.write_text(json.dumps({"schema_version": "saferoute-m3-server-installation/1", "runtime_root": str(root),
                                 "snapshot_root": str(tmp_path), "authority_store_parent": str(state),
                                 "expected_build_sha256": build}))
    basis = {"session_id": "session-1", "build_sha256": build, "head_version": "1", "generation": "0",
             "root_sha256": "1" * 64, "head_sha256": "2" * 64, "source_sha256": "3" * 64,
             "context_version": "test-context", "overlay_sha256": None}
    from backend.tests.test_jobs import public_job
    value = certified_projection("session-1", "job-1", public_job("job-1", basis))
    return root, config, tmp_path / "projection.json", value


def bridge_read(installed_bridge, value):
    root, config, projection_path, _ = installed_bridge
    projection_path.write_text(json.dumps(value))
    bridge = Path(__file__).resolve().parents[1] / "services/runtime_bridge.py"
    interpreter = os.environ.get("M3_TEST_RUNTIME_PYTHON", sys.executable)
    return subprocess.run([interpreter, "-I", "-B", str(bridge), "--installation", str(config),
                           "--operation", "job_forecast"], input=json.dumps({"session_id": "session-1",
                           "job_id": "job-1", "command_id": "read-1"}), text=True, capture_output=True,
                           encoding="utf-8", timeout=30, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def test_verified_bridge_preserves_public_forecast_and_authority(installed_bridge):
    root, config, _, value = installed_bridge
    authority = config.parent / "state/backend_authority.sqlite"
    before = authority.read_bytes()
    result = bridge_read(installed_bridge, value)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["value"] == value
    assert authority.read_bytes() == before


def test_verified_bridge_rejects_malformed_directed_geometry(installed_bridge):
    value = deepcopy(installed_bridge[3])
    value["trajectory"]["vehicle_routes"][0]["actions"][0]["geometry"] = [[106.75, 10.75]]
    result = bridge_read(installed_bridge, value)
    assert result.returncode == 0, result.stderr
    response = json.loads(result.stdout)
    assert response["status"] == "FAIL"
    assert response["value"] is None
    assert response["diagnostics"][0]["code"] == "WITNESS_INVALID"


def test_bridge_verifies_forecast_inventory_before_import(installed_bridge):
    root, _, _, value = installed_bridge
    marker = root / "untrusted-import"
    with (root / "optimization/runtime/forecast.py").open("a") as stream:
        stream.write(f"\nfrom pathlib import Path\nPath({str(marker)!r}).write_text('imported')\n")
    result = bridge_read(installed_bridge, value)
    assert result.returncode == 2
    assert json.loads(result.stdout)["code"] == "RUNTIME_VERIFICATION_FAILED"
    assert not marker.exists()


def test_bridge_rejects_uninventoried_forecast_validator(installed_bridge):
    root, config, _, value = installed_bridge
    inventory_path = root / "production_inventory.json"
    record = json.loads(inventory_path.read_text())
    del record["files"]["optimization/runtime/forecast.py"]
    del record["build_sha256"]
    build = hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    inventory_path.write_text(json.dumps({**record, "build_sha256": build}))
    settings = json.loads(config.read_text())
    settings["expected_build_sha256"] = build
    config.write_text(json.dumps(settings))
    value["build_sha256"] = value["input_basis"]["build_sha256"] = value["job_view"]["input_basis"]["build_sha256"] = build
    result = bridge_read(installed_bridge, value)
    assert result.returncode == 2
    assert json.loads(result.stdout)["code"] == "RUNTIME_VERIFICATION_FAILED"


@pytest.mark.parametrize("payload", ["query", "body"])
def test_forecast_rejects_client_supplied_authority(forecast_client, forecast_setup, payload):
    sid, receipt = submitted(forecast_client)
    path = f"/api/sessions/{sid}/jobs/{receipt['job_id']}/forecast"
    response = (forecast_client.get(path, params={"basis": "client-owned"}, headers=headers()) if payload == "query"
                else forecast_client.request("GET", path, json={"trajectory": {}}, headers=headers()))
    assert response.status_code == 422
    assert forecast_setup[1].forecast_reads == []


@pytest.mark.parametrize("runtime_code,status", [("JOB_NOT_FOUND", 404), ("WITNESS_REQUIRED", 503),
    ("WITNESS_INVALID", 503), ("BUILD_MISMATCH", 503), ("STORE_INVALID", 503)])
def test_gateway_forecast_failures_are_read_only(gateway, monkeypatch, runtime_code, status):
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0,
        stdout=json.dumps({"schema_version": "task02-m2-runtime-response/1", "status": "FAIL",
                           "diagnostics": [{"code": runtime_code}]})))
    with pytest.raises(ApiError) as caught:
        asyncio.run(gateway.job_forecast("session", "job"))
    assert caught.value.status_code == status
    assert caught.value.code == runtime_code
    assert not gateway.settings.metadata_path.exists()


def test_forecast_subprocess_timeout_cannot_exceed_configured_budget(gateway, monkeypatch):
    gateway.settings = replace(gateway.settings, runtime_timeout_seconds=240)
    monkeypatch.setattr("backend.services.runtime_gateway.monotonic", lambda: 4000.1)
    monkeypatch.setattr("backend.services.sdk_access_lock.monotonic", lambda: 4000.1)
    from backend.tests.test_runtime_read_timeout import basis
    from backend.tests.test_jobs import public_job
    value = projection("session-read-timeout", "job-read-timeout", "BALANCED", public_job("job-read-timeout", basis()))
    def run(*args, **kwargs):
        assert 0 < kwargs["timeout"] <= 240
        return SimpleNamespace(returncode=0, stdout=json.dumps({"schema_version": "task02-m2-runtime-response/1",
                                                              "status": "OK", "value": value}))
    monkeypatch.setattr(subprocess, "run", run)
    assert asyncio.run(gateway.job_forecast("session-read-timeout", "job-read-timeout")) == value
