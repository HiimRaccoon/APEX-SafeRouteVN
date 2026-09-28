"""Snapshot installation must preserve code and work independently of cwd."""

import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import zipfile

import requests

from geo_data import download_snapshot as snapshot


class SnapshotDownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "different parent" / "renamed project"
        self.root.mkdir(parents=True)
        self.config = {"repoId": "owner/data", "revision": "main", "filename": "snapshot.zip",
                       "suiteId": "suite-v1", "suiteVersion": "pinned-version",
                       "sourceRun": "cached_context/hcmc/run-v1"}
        self.data = {
            "scenarios/cached_context/hcmc/run-v1/weather/raw/one.json": b'{"rain": 1}',
            "scenarios/fixtures/suite-v1/S0.json": b'{"scenarioId": "S0"}',
            "scenarios/manifests/suite-v1.json": b'{"complete": true}',
            "geo_data/cli.py": b"old bundled code",
            "docs/member1_runbook.md": b"old bundled runbook",
            "README.md": b"bundled README",
        }
        self.archive = self.base / "snapshot.zip"
        self.make_archive()
        self.result = {"verified": True, "scenarios": 9}

    def make_archive(self):
        entries = [{"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                   for name, data in self.data.items()]
        with zipfile.ZipFile(self.archive, "w") as bundle:
            for name, data in self.data.items():
                bundle.writestr(name, data)
            bundle.writestr("handoff_inventory.json", json.dumps({"suiteId": "suite-v1", "files": entries}))
        self.config["sha256"] = snapshot.file_hash(self.archive)

    def test_install_from_different_cwd_repairs_data_and_preserves_code(self):
        for name in ("README.md", "geo_data/cli.py", "docs/member1_runbook.md"):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"KEEP MY CURRENT FILE\r\n")
        stale = self.root / "scenarios/fixtures/suite-v1/S0.json"
        stale.parent.mkdir(parents=True, exist_ok=True)
        stale.write_bytes(b"partial old download")
        with patch.object(snapshot, "verify_snapshot", side_effect=[ValueError("incomplete"), self.result, self.result]), \
                patch.object(snapshot, "download") as network:
            original_cwd = Path.cwd()
            try:
                os.chdir(self.base)
                self.assertEqual(snapshot.install_snapshot(self.root, self.config, archive=self.archive,
                                                           progress=lambda _: None), self.result)
            finally:
                os.chdir(original_cwd)
            network.assert_not_called()
        for name, data in self.data.items():
            expected = data if name.startswith("scenarios/") else b"KEEP MY CURRENT FILE\r\n"
            self.assertEqual((self.root / name).read_bytes(), expected)
        self.assertEqual(list((self.root / "scenarios/cached_context").glob(".snapshot-*")), [])

    def test_complete_install_does_not_download(self):
        with patch.object(snapshot, "verify_snapshot", return_value=self.result), \
                patch.object(snapshot, "download") as network:
            self.assertEqual(snapshot.install_snapshot(self.root, self.config, progress=lambda _: None), self.result)
            network.assert_not_called()
        self.assertFalse((self.root / "scenarios").exists())

    def test_corrupt_archive_does_not_replace_existing_files(self):
        existing = self.root / "scenarios/fixtures/suite-v1/S0.json"
        existing.parent.mkdir(parents=True)
        existing.write_bytes(b"preserve")
        self.archive.write_bytes(b"interrupted download")
        with patch.object(snapshot, "verify_snapshot", side_effect=ValueError("incomplete")):
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                snapshot.install_snapshot(self.root, self.config, archive=self.archive, progress=lambda _: None)
        self.assertEqual(existing.read_bytes(), b"preserve")

    def test_rejects_zip_path_traversal(self):
        self.data["scenarios/fixtures/suite-v1/../../outside.txt"] = b"escape"
        self.make_archive()
        with self.assertRaisesRegex(ValueError, "Unsafe archive path"):
            snapshot.extract_snapshot(self.archive, self.base / "staging", self.config)
        self.assertFalse((self.base / "outside.txt").exists())

    def test_failed_staged_verification_leaves_project_untouched(self):
        with patch.object(snapshot, "verify_snapshot", side_effect=[ValueError("incomplete"), ValueError("bad QA")]):
            with self.assertRaisesRegex(ValueError, "bad QA"):
                snapshot.install_snapshot(self.root, self.config, archive=self.archive, progress=lambda _: None)
        self.assertFalse((self.root / "scenarios/manifests").exists())

    def test_resolves_project_from_script_not_cwd(self):
        fake_script = self.root / "geo_data/download_snapshot.py"
        with patch.object(snapshot, "__file__", str(fake_script)):
            self.assertEqual(snapshot.project_root(), self.root)

    def test_hf_url_and_transient_download_retry(self):
        self.config["revision"] = "refs/pr/1"
        self.assertEqual(snapshot.download_url(self.config),
                         "https://huggingface.co/datasets/owner/data/resolve/refs%2Fpr%2F1/snapshot.zip")
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.iter_content.return_value = [b"abc", b"def"]
        with patch.object(snapshot.requests, "get", side_effect=[requests.ConnectionError("lost"), response]), \
                patch.object(snapshot.time, "sleep"):
            snapshot.download("https://huggingface.co/test", self.base / "download.zip", lambda _: None)
        self.assertEqual((self.base / "download.zip").read_bytes(), b"abcdef")

    def test_wrong_pinned_suite_is_rejected(self):
        catalog = Mock()
        catalog.manifest = {"version": "other-version", "sourceRun": self.config["sourceRun"]}
        with patch.object(snapshot, "ScenarioCatalog", return_value=catalog):
            with self.assertRaisesRegex(ValueError, "pinned snapshot"):
                snapshot.verify_snapshot(self.root, self.config)


if __name__ == "__main__":
    unittest.main()
