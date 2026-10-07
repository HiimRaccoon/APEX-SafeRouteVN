"""Package a verified forecast runtime and backend as a code-only supplement."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile


DATE = (2026, 10, 7, 0, 0, 0)
EXCLUDED_PARTS = {"tests", "__pycache__", ".pytest_cache", "state", "venv", ".venv", "backend-venv"}
SENSITIVE = re.compile(rb"(?i)(?:[A-Za-z]:[\\/]+Users[\\/]+|/Users/[A-Za-z]|/home/[A-Za-z]|"
                       rb"\.forecast-private[/\\]|Bearer[ \t]+[A-Za-z0-9_-]{24,})")


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf8")


def pin(payload):
    return {"bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def relative(name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name or str(path) != name:
        raise ValueError("Canonical relative release path required")
    return path


def package_extension(runtime_root, source_root, output, expected_build):
    runtime_root, source_root = Path(runtime_root).resolve(strict=True), Path(source_root).resolve(strict=True)
    output = Path(output)
    if output.exists() or output.with_suffix(".json").exists():
        raise FileExistsError("A new supplemental release destination is required")
    inventory = json.loads((runtime_root / "production_inventory.json").read_bytes())
    body = {key: value for key, value in inventory.items() if key != "build_sha256"}
    if inventory.get("build_sha256") != expected_build or hashlib.sha256(canonical(body)).hexdigest() != expected_build:
        raise ValueError("Externally pinned extension build differs")
    if not {"requirements-runtime.lock.txt", "optimization/runtime/sdk.py", "optimization/runtime/forecast.py"} <= set(inventory["files"]):
        raise ValueError("Complete forecast production inventory required")
    payloads = {}

    def add(root, name, archive_name):
        relative(name)
        relative(archive_name)
        path = root / name
        if path.is_symlink() or not path.resolve(strict=True).is_relative_to(root):
            raise ValueError("Release file escaped its source root")
        value = path.read_bytes()
        if SENSITIVE.search(value):
            raise ValueError("Private path or credential in release payload: " + archive_name)
        payloads[archive_name] = value
        return value

    for name, expected in sorted(inventory["files"].items()):
        payload = add(runtime_root, name, "runtime/" + name)
        if pin(payload) != expected:
            raise ValueError("Sealed runtime file changed: " + name)
    extension = json.loads((runtime_root / "extension_manifest.json").read_bytes())
    if (extension.get("schema_version") != "saferoute-m3-forecast-extension-release/1"
            or extension.get("status") != "SEALED_DEVELOPMENT_EXTENSION"
            or extension.get("build_sha256") != expected_build or extension.get("app_version") != "0.9.0"
            or extension.get("production_files") != len(inventory["files"])
            or set(extension.get("changed_production_files", [])) != {
                "optimization/runtime/sdk.py", "optimization/runtime/forecast.py"}):
        raise ValueError("Extension seal metadata differs")
    for name in ("production_inventory.json", "extension_manifest.json"):
        add(runtime_root, name, "runtime/" + name)
    for path in sorted((source_root / "backend").rglob("*")):
        name = path.relative_to(source_root).as_posix()
        if not path.is_file() or EXCLUDED_PARTS.intersection(path.relative_to(source_root).parts):
            continue
        mock_fixture = path.parent == source_root / "backend/mock/fixtures" and path.suffix == ".json"
        if path.suffix in (".py", ".ps1") or path.name == "requirements-backend.lock.txt" or mock_fixture:
            add(source_root, name, name)
    doc = "docs/M3_FORECAST_EXTENSION_RELEASE_20261007.md"
    add(source_root, doc, doc)
    manifest = {"schema_version": "saferoute-m3-forecast-supplement/1", "app_version": "0.9.0",
                "release_date": "2026-10-07", "artifact_kind": "CODE_ONLY_SUPPLEMENT", "standalone": False,
                "baseline_build_sha256": extension["baseline_build_sha256"], "runtime_build_sha256": expected_build,
                "runtime_production_files": len(inventory["files"]),
                "prerequisites": ["Original verified M1 handoff and frozen snapshots", "Original verified M2 Step 7 runtime handoff",
                                  "Pinned Windows CPython 3.12 x64 runtime and backend dependencies",
                                  "Fresh private extension-bound authority, configuration and genuine preflight"],
                "excluded": ["Credentials", "Installation configuration and paths", "Authority and metadata state",
                             "M1 databases", "Native wheelhouse", "Python executables and virtual environments", "Tests and caches"],
                "files": [{"path": name, **pin(payload)} for name, payload in sorted(payloads.items())]}
    payloads["release_manifest.json"] = canonical(manifest) + b"\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, payload in sorted(payloads.items()):
            item = zipfile.ZipInfo(name, date_time=DATE)
            item.create_system = 3
            item.external_attr = 0o100644 << 16
            item.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(item, payload, compresslevel=9)
    result = {**manifest, "artifact": {"file": output.name, **pin(output.read_bytes())}}
    output.with_suffix(".json").write_bytes(canonical(result) + b"\n")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-root", required=True, type=Path)
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--expected-build", required=True)
    args = parser.parse_args()
    result = package_extension(args.runtime_root, args.source_root, args.output, args.expected_build)
    print(json.dumps({"artifact": result["artifact"], "runtime_build_sha256": result["runtime_build_sha256"],
                      "files": len(result["files"])}))


if __name__ == "__main__":
    main()
