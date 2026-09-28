"""Install the pinned replay snapshot relative to this project's code, not cwd."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tempfile
import time
from urllib.parse import quote
import zipfile

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests

from geo_data.common import exclusive_lock
from geo_data.scenario_catalog import ScenarioCatalog


def project_root():
    return Path(__file__).resolve().parents[1]


def file_hash(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verify_snapshot(root, config):
    catalog = ScenarioCatalog(Path(root) / "scenarios", config["suiteId"])
    if (catalog.manifest["version"] != config["suiteVersion"]
            or catalog.manifest["sourceRun"] != config["sourceRun"]):
        raise ValueError("Installed suite differs from the pinned snapshot version")
    count = len(catalog.manifest["scenarios"])
    if count != 9:
        raise ValueError("Expected all nine scenarios S0-S8")
    return {"verified": True, "suiteId": config["suiteId"], "scenarios": count,
            "integrated": catalog.manifest["integrated"],
            "scenariosRoot": str((Path(root) / "scenarios").resolve())}


def download_url(config, repo=None):
    repo = repo or config.get("repoId")
    if not repo:
        raise ValueError("Hugging Face dataset is not configured yet. The maintainer must set "
                         "repoId in geo_data/snapshot_source.json, or use --repo OWNER/DATASET.")
    if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", repo):
        raise ValueError("Expected a Hugging Face dataset ID: OWNER/DATASET")
    return (f"https://huggingface.co/datasets/{repo}/resolve/"
            f"{quote(config['revision'], safe='')}/{quote(config['filename'], safe='')}")


def download(url, target, progress=print):
    headers = {"User-Agent": "SafeRouteVN/snapshot-download"}
    if os.environ.get("HF_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["HF_TOKEN"]
    for attempt in range(3):
        try:
            # requests removes Authorization on redirects to other hosts (e.g. HF CDN).
            with requests.get(url, headers=headers, stream=True, timeout=(30, 120)) as response:
                response.raise_for_status()
                downloaded, reported = 0, 0
                with Path(target).open("wb") as stream:
                    for chunk in response.iter_content(chunk_size=4 * 1024 * 1024):
                        stream.write(chunk)
                        downloaded += len(chunk)
                        if downloaded - reported >= 32 * 1024 * 1024:
                            progress(f"Downloaded {downloaded / 1024**2:.0f} MiB...")
                            reported = downloaded
            return
        except requests.RequestException as exc:
            if (isinstance(exc, requests.HTTPError) and exc.response is not None
                    and 400 <= exc.response.status_code < 500
                    and exc.response.status_code not in (408, 429)):
                raise
            if attempt == 2:
                raise
            progress("Download interrupted; restarting download...")
            time.sleep(attempt + 1)


def data_path(name, config):
    """Only allow the three snapshot branches; never install bundled code/docs."""
    if (not isinstance(name, str) or "\\" in name or ":" in name
            or any(p in ("", ".", "..") for p in name.split("/"))):
        raise ValueError(f"Unsafe archive path: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute():
        raise ValueError(f"Absolute archive path: {name!r}")
    run = PurePosixPath("scenarios") / config["sourceRun"]
    fixtures = PurePosixPath("scenarios/fixtures") / config["suiteId"]
    catalog = PurePosixPath("scenarios/manifests") / (config["suiteId"] + ".json")
    return path == catalog or run in path.parents or fixtures in path.parents


def extract_snapshot(archive, stage, config):
    if file_hash(archive) != config["sha256"]:
        raise ValueError("Archive SHA-256 mismatch; no project data has been replaced")
    with zipfile.ZipFile(archive) as bundle:
        inventory = json.loads(bundle.read("handoff_inventory.json"))
        if inventory["suiteId"] != config["suiteId"]:
            raise ValueError("Archive contains a different suite")
        entries = [item for item in inventory["files"] if data_path(item["path"], config)]
        names = [item["path"] for item in entries]
        if not entries or len(set(names)) != len(names):
            raise ValueError("Missing or duplicate snapshot inventory entries")
        archive_names = bundle.namelist()
        for item in entries:
            name = item["path"]
            if archive_names.count(name) != 1:
                raise ValueError(f"Missing or duplicate archive member: {name}")
            info = bundle.getinfo(name)
            if info.file_size != item["bytes"]:
                raise ValueError(f"Archive size mismatch: {name}")
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(info) as src, target.open("wb") as dst:
                shutil.copyfileobj(src, dst, length=4 * 1024 * 1024)
            if file_hash(target) != item["sha256"]:
                raise ValueError(f"Archive member checksum mismatch: {name}")
    return entries


def install_snapshot(root, config, *, repo=None, archive=None, progress=print):
    root = Path(root).resolve()
    progress(f"Project: {root}")
    try:
        result = verify_snapshot(root, config)
    except (OSError, ValueError, KeyError):
        pass
    else:
        progress("Pinned snapshot is already complete; no download needed.")
        return result
    # Resolve source before creating any temporary directories.
    url = download_url(config, repo) if archive is None else None
    cache = root / "scenarios/cached_context"
    if not cache.resolve().is_relative_to(root):
        raise ValueError("Snapshot directory resolves outside the project")
    with exclusive_lock(cache):
        with tempfile.TemporaryDirectory(prefix=".snapshot-", dir=cache) as temporary:
            stage = Path(temporary)
            if archive is None:
                archive = stage / "download.zip"
                progress("Downloading the pinned Hugging Face snapshot...")
                download(url, archive, progress)
            progress("Checking SHA-256 and extracting snapshot data...")
            entries = extract_snapshot(Path(archive), stage, config)
            progress("Verifying all nine scenarios before installing...")
            verify_snapshot(stage, config)
            # Check all destinations before replacing the first file.
            for item in entries:
                target = root / item["path"]
                if not target.resolve().is_relative_to(root) or target.is_symlink():
                    raise ValueError(f"Snapshot destination escapes project or is a symlink: {target}")
            catalog = f"scenarios/manifests/{config['suiteId']}.json"
            entries.sort(key=lambda item: (item["path"] == catalog,
                                          item["path"].endswith("/manifest.json"), item["path"]))
            for item in entries:
                target = root / item["path"]
                target.parent.mkdir(parents=True, exist_ok=True)
                if (target.is_file() and target.stat().st_size == item["bytes"]
                        and file_hash(target) == item["sha256"]):
                    continue
                # Same filesystem; replace each file atomically. A rerun repairs interrupted installs.
                os.replace(stage / item["path"], target)
            progress("Verifying installed snapshot...")
            return verify_snapshot(root, config)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", help="Override configured Hugging Face dataset: OWNER/DATASET")
    parser.add_argument("--archive", type=Path, help="Use an already downloaded pinned ZIP (offline)")
    args = parser.parse_args(argv)
    config = json.loads((Path(__file__).with_name("snapshot_source.json")).read_text(encoding="utf-8"))
    try:
        result = install_snapshot(project_root(), config, repo=args.repo, archive=args.archive)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, requests.RequestException) as exc:
        print(f"Snapshot installation failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
