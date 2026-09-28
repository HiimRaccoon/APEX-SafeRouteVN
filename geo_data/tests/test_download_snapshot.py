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
        patcher = patch.object(snapshot, "__file__", str(self.root / "geo_data/download_snapshot.py"))
        patcher.start()
        self.addCleanup(patcher.stop)

    def make_archive(self):
        entries = [{"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                   for name, data in self.data.items()]
        with zipfile.ZipFile(self.archive, "w") as bundle:
            for name, data in self.data.items():
                bundle.writestr(name, data)
            bundle.writestr("handoff_inventory.json", json.dumps({"suiteId": "suite-v1", "files": entries}))
        self.config["sha256"] = snapshot.file_hash(self.archive)
        self.write_inventory([item for item in entries if item["path"].startswith("scenarios/")])

    def write_inventory(self, entries):
        inventory = {"schemaVersion": "snapshot-file-inventory/1", "suiteId": self.config["suiteId"],
                     "suiteVersion": self.config["suiteVersion"], "files": entries}
        encoded = (json.dumps(inventory, indent=2) + "\n").encode()
        path = self.root / "geo_data/snapshot_files.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encoded)
        self.config["filesInventorySha256"] = hashlib.sha256(encoded).hexdigest()

    def fake_download(self, url, target, progress):
        name = url.split("/resolve/main/", 1)[1]
        Path(target).write_bytes(self.data[name])

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
        for name, data in self.data.items():
            if name.startswith("scenarios/"):
                path = self.root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
        with patch.object(snapshot, "verify_snapshot", return_value=self.result), \
                patch.object(snapshot, "download") as network:
            self.assertEqual(snapshot.install_snapshot(self.root, self.config, progress=lambda _: None), self.result)
            network.assert_not_called()

    def test_raw_download_uses_repo_paths_and_does_not_install_code(self):
        with patch.object(snapshot, "verify_snapshot", return_value=self.result), \
                patch.object(snapshot, "download", side_effect=self.fake_download) as network:
            snapshot.install_snapshot(self.root, self.config, progress=lambda _: None)
        self.assertEqual(network.call_count, 3)
        for call in network.call_args_list:
            self.assertTrue(call.args[0].startswith("https://huggingface.co/datasets/owner/data/resolve/main/scenarios/"))
            self.assertFalse(call.args[0].endswith(".zip"))
        self.assertTrue(network.call_args_list[-1].args[0].endswith("scenarios/manifests/suite-v1.json"))
        for name, data in self.data.items():
            if name.startswith("scenarios/"):
                self.assertEqual((self.root / name).read_bytes(), data)
            else:
                self.assertFalse((self.root / name).exists())

    def test_raw_download_only_repairs_missing_or_corrupt_files(self):
        good = self.root / "scenarios/fixtures/suite-v1/S0.json"
        good.parent.mkdir(parents=True)
        good.write_bytes(self.data[good.relative_to(self.root).as_posix()])
        broken = self.root / "scenarios/cached_context/hcmc/run-v1/weather/raw/one.json"
        broken.parent.mkdir(parents=True)
        broken.write_bytes(b"damaged")
        with patch.object(snapshot, "verify_snapshot", return_value=self.result), \
                patch.object(snapshot, "download", side_effect=self.fake_download) as network:
            snapshot.install_snapshot(self.root, self.config, progress=lambda _: None)
        self.assertEqual(network.call_count, 2)
        self.assertFalse(any(call.args[0].endswith("S0.json") for call in network.call_args_list))
        self.assertEqual(broken.read_bytes(), self.data[broken.relative_to(self.root).as_posix()])

    def test_raw_checksum_failure_preserves_existing_file(self):
        target = self.root / "scenarios/cached_context/hcmc/run-v1/weather/raw/one.json"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"previous content")
        def wrong_download(url, path, progress):
            Path(path).write_bytes(b"wrong remote version")
        with patch.object(snapshot, "download", side_effect=wrong_download), \
                patch.object(snapshot, "verify_snapshot") as verify:
            with self.assertRaisesRegex(ValueError, "checksum/size mismatch"):
                snapshot.install_snapshot(self.root, self.config, progress=lambda _: None)
            verify.assert_not_called()
        self.assertEqual(target.read_bytes(), b"previous content")
        self.assertFalse((self.root / "scenarios/manifests/suite-v1.json").exists())

    def test_raw_rerun_keeps_completed_files_after_network_interruption(self):
        count = 0
        def interrupted(url, path, progress):
            nonlocal count
            count += 1
            if count == 2:
                Path(path).write_bytes(b"partial")
                raise requests.ConnectionError("interrupted")
            self.fake_download(url, path, progress)
        with patch.object(snapshot, "download", side_effect=interrupted):
            with self.assertRaises(requests.ConnectionError):
                snapshot.install_snapshot(self.root, self.config, progress=lambda _: None)
        with patch.object(snapshot, "download", side_effect=self.fake_download) as network, \
                patch.object(snapshot, "verify_snapshot", return_value=self.result):
            snapshot.install_snapshot(self.root, self.config, progress=lambda _: None)
            self.assertEqual(network.call_count, 2)

    def test_inventory_checksum_rejects_modified_download_list(self):
        (self.root / "geo_data/snapshot_files.json").write_text("{}")
        with patch.object(snapshot, "download") as network:
            with self.assertRaisesRegex(ValueError, "inventory checksum"):
                snapshot.install_snapshot(self.root, self.config, progress=lambda _: None)
            network.assert_not_called()

    def test_inventory_supports_git_crlf_conversion(self):
        path = self.root / "geo_data/snapshot_files.json"
        path.write_bytes(path.read_bytes().replace(b"\n", b"\r\n"))
        self.assertEqual(len(snapshot.snapshot_entries(self.config)), 3)

    def test_inventory_rejects_paths_outside_snapshot(self):
        self.write_inventory([{"path": "README.md", "bytes": 0, "sha256": "a" * 64}])
        with self.assertRaisesRegex(ValueError, "Invalid snapshot inventory entry"):
            snapshot.snapshot_entries(self.config)

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
