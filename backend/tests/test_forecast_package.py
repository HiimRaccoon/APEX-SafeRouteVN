"""Supplemental release packaging preserves sealed bytes and excludes private files."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import zipfile
from optimization.runtime.handoff import PUBLIC_FILES, record as contract_record
from backend.scripts.seal_forecast_runtime import CHANGES

import pytest


def packager():
    path = Path(__file__).resolve().parents[1] / "scripts/package_forecast_extension.py"
    assert path.is_file(), "supplemental forecast packager is missing"
    spec = importlib.util.spec_from_file_location("forecast_packager_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.package_extension


@pytest.fixture
def inputs(tmp_path):
    runtime, source = tmp_path / "runtime", tmp_path / "source"
    runtime.mkdir()
    shutil.copyfile(Path(__file__).resolve().parents[2] / "runtime_entry.py", runtime / "runtime_entry.py")
    (runtime / "requirements-runtime.lock.txt").write_text("example==1.0\n")
    for name in ("sdk.py", "forecast.py"):
        path = runtime / "optimization/runtime" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"# sealed production\n")
    for name in PUBLIC_FILES:
        path = runtime / name
        path.parent.mkdir(parents=True,exist_ok=True)
        if not path.exists(): path.write_bytes(b'# public contract fixture\n')
    for name in ('protocol.py','handoff.py'):
        shutil.copyfile(Path(__file__).resolve().parents[2]/'optimization/runtime'/name, runtime/'optimization/runtime'/name)
    lock_bytes = (json.dumps(contract_record(runtime),indent=2)+'\n').encode('utf8')
    (runtime/'optimization/runtime/HANDOFF_CONTRACT_LOCK.json').write_bytes(lock_bytes)
    lock_digest = hashlib.sha256(lock_bytes).hexdigest()
    files = {path.relative_to(runtime).as_posix(): {"bytes": path.stat().st_size,
             "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in runtime.rglob("*") if path.is_file()}
    record = {"files": files}
    build = hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    (runtime / "production_inventory.json").write_text(json.dumps({**record, "build_sha256": build}))
    (runtime / "extension_manifest.json").write_text(json.dumps({"schema_version": "saferoute-m3-forecast-extension-release/2",
        "status": "SEALED_DEVELOPMENT_EXTENSION", "baseline_build_sha256": "8" * 64,
        "build_sha256": build, "production_files": len(files), "app_version": "0.9.0",
        "changed_production_files": sorted(CHANGES), 'handoff_contract_lock_sha256':lock_digest,
        'handoff_contract_lock_schema_version':'task02-m2-runtime-handoff-contract-lock/2',
        'forecast_view_version':'task02-m2-job-forecast/1'}))
    for name, content in {"backend/api/main.py": "# source\n", "backend/requirements-backend.lock.txt": "example==1.0\n",
                          "backend/scripts/start_backend.py": "# launcher\n", "backend/scripts/Run-M3Preflight.ps1": "# script\n",
                          "backend/mock/fixtures/manifest.json": "{}", "backend/tests/test_private.py": "# exclude\n",
                          "backend/__pycache__/cache.py": "# exclude\n", "backend/auth_tokens.json": "SECRET",
                          "backend/state/authority.sqlite": "STATE", "backend/.env": "TOKEN=SECRET",
                          "backend/README.md": "C:\\Users\\private\\installation",
                          "docs/M3_FORECAST_EXTENSION_RELEASE_20261007.md": "# Code supplement\n"}.items():
        target = source / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    (runtime / "unlisted-private.json").write_text("SECRET")
    return runtime, source, build


def test_supplement_is_complete_sealed_code_without_private_state(inputs, tmp_path):
    runtime, source, build = inputs
    output = tmp_path / "release.zip"
    result = packager()(runtime, source, output, build)
    with zipfile.ZipFile(output) as archive:
        names = set(archive.namelist())
        sealed = json.loads((runtime/'production_inventory.json').read_bytes())
        assert names == {'runtime/'+name for name in sealed['files']} | {
                         "runtime/production_inventory.json", "runtime/extension_manifest.json",
                         "backend/api/main.py", "backend/requirements-backend.lock.txt",
                         "backend/scripts/start_backend.py", "backend/scripts/Run-M3Preflight.ps1",
                         "backend/mock/fixtures/manifest.json", "docs/M3_FORECAST_EXTENSION_RELEASE_20261007.md",
                         "release_manifest.json"}
        assert archive.read("runtime/optimization/runtime/sdk.py") == b"# sealed production\n"
        manifest = json.loads(archive.read("release_manifest.json"))
        assert manifest["standalone"] is False
        assert manifest["runtime_build_sha256"] == build
        for item in manifest["files"]:
            payload = archive.read(item["path"])
            assert item["bytes"] == len(payload)
            assert item["sha256"] == hashlib.sha256(payload).hexdigest()
    assert result["artifact"]["sha256"] == hashlib.sha256(output.read_bytes()).hexdigest()
    assert json.loads(output.with_suffix(".json").read_bytes()) == result


def test_supplement_archive_bytes_are_reproducible(inputs, tmp_path):
    runtime, source, build = inputs
    package = packager()
    first, second = tmp_path / "one.zip", tmp_path / "two.zip"
    package(runtime, source, first, build)
    package(runtime, source, second, build)
    assert first.read_bytes() == second.read_bytes()


@pytest.mark.parametrize("change", ["runtime", "build", "private_path", "token"])
def test_supplement_rejects_changed_or_sensitive_payload_before_writing(inputs, tmp_path, change):
    runtime, source, build = inputs
    if change == "runtime":
        (runtime / "optimization/runtime/sdk.py").write_text("# changed\n")
    elif change == "build":
        build = "f" * 64
    elif change == "private_path":
        (source / "backend/api/main.py").write_text("C:\\Users\\private\\installation")
    else:
        (source / "backend/api/main.py").write_text("Bearer " + "x" * 36)
    output = tmp_path / "invalid.zip"
    with pytest.raises(ValueError):
        packager()(runtime, source, output, build)
    assert not output.exists()


def test_supplement_refuses_overwriting_release(inputs, tmp_path):
    runtime, source, build = inputs
    output = tmp_path / "release.zip"
    output.write_bytes(b"immutable release")
    with pytest.raises(FileExistsError):
        packager()(runtime, source, output, build)
    assert output.read_bytes() == b"immutable release"


def test_package_rejects_self_consistent_inventory_with_stale_public_lock(inputs,tmp_path):
    runtime, source, _ = inputs
    # Inventory alone can be rehashed after changing SDK; public lock must independently reject it.
    (runtime/'optimization/runtime/sdk.py').write_text('# new SDK without regenerating public lock\n')
    inv=json.loads((runtime/'production_inventory.json').read_bytes())
    sdk=(runtime/'optimization/runtime/sdk.py').read_bytes()
    inv['files']['optimization/runtime/sdk.py']={'bytes':len(sdk),'sha256':hashlib.sha256(sdk).hexdigest()}
    body={k:v for k,v in inv.items() if k!='build_sha256'}
    build=hashlib.sha256(json.dumps(body,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    inv['build_sha256']=build
    (runtime/'production_inventory.json').write_text(json.dumps(inv))
    seal=json.loads((runtime/'extension_manifest.json').read_bytes())
    seal['build_sha256']=build
    (runtime/'extension_manifest.json').write_text(json.dumps(seal))
    output=tmp_path/'stale-lock.zip'
    with pytest.raises(ValueError,match='CONTRACT_CHANGED'):
        packager()(runtime,source,output,build)
    assert not output.exists()
