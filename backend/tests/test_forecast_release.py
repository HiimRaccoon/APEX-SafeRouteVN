"""A forecast extension gets a new inventory; it cannot relabel original bytes."""
from pathlib import Path
import hashlib
import json

import pytest

from optimization.runtime.build import inventory
from backend.scripts.seal_forecast_runtime import seal_runtime
from optimization.runtime.handoff import PUBLIC_FILES, verify_lock


@pytest.fixture
def roots(tmp_path):
    original, source, destination = (tmp_path / n for n in ('original', 'source', 'derived'))
    (original / 'optimization/runtime').mkdir(parents=True)
    (original / 'requirements-runtime.lock.txt').write_text('# sealed test lock\n', encoding='utf8')
    (original / 'optimization/runtime/sdk.py').write_text('VERSION = 1\n', encoding='utf8')
    # Baseline public closure includes a crosswalk which older production inventory omitted.
    public = [name for name in PUBLIC_FILES if name != 'optimization/runtime/forecast.py']
    for name in public:
        file = original / name
        file.parent.mkdir(parents=True, exist_ok=True)
        if not file.exists(): file.write_text('# frozen baseline public file\n', encoding='utf8')
    project = Path(__file__).resolve().parents[2]
    (original/'optimization/runtime/protocol.py').write_bytes((project/'optimization/runtime/protocol.py').read_bytes())
    (original/'runtime_entry.py').write_bytes((project/'runtime_entry.py').read_bytes())
    lock = {'schema_version': 'task02-m2-runtime-handoff-contract-lock/1',
            'files': {name: {'bytes': (original/name).stat().st_size,
                            'sha256': hashlib.sha256((original/name).read_bytes()).hexdigest()} for name in public}}
    (original / 'optimization/runtime/HANDOFF_CONTRACT_LOCK.json').write_text(json.dumps(lock), encoding='utf8')
    record = inventory(original)
    record['files'].pop('docs/step7_INTEGRATION_CROSSWALK.md', None)
    from optimization.runtime.protocol import sha
    record['build_sha256'] = sha({k:v for k,v in record.items() if k!='build_sha256'})
    (original / 'production_inventory.json').write_text(json.dumps(record), encoding='utf8')
    (source / 'optimization/runtime').mkdir(parents=True)
    (source / 'optimization/runtime/sdk.py').write_text('from .forecast import forecast\n', encoding='utf8')
    (source / 'optimization/runtime/forecast.py').write_text('def forecast(): return None\n', encoding='utf8')
    for name in ('handoff.py', 'build.py'):
        (source / 'optimization/runtime' / name).write_bytes((Path(__file__).resolve().parents[2] / 'optimization/runtime' / name).read_bytes())
    return original, source, destination, record


def test_seals_new_build_and_preserves_original(roots):
    original, source, destination, old = roots
    before = {p.relative_to(original): p.read_bytes() for p in original.rglob('*') if p.is_file()}
    result = seal_runtime(original, source, destination, old['build_sha256'])
    new = json.loads((destination / 'production_inventory.json').read_bytes())
    assert new == inventory(destination)
    assert new['build_sha256'] != old['build_sha256']
    assert result['baseline_build_sha256'] == old['build_sha256']
    assert result['build_sha256'] == new['build_sha256']
    assert {'optimization/runtime/forecast.py', 'optimization/runtime/sdk.py'} <= set(result['changed_production_files'])
    assert before == {p.relative_to(original): p.read_bytes() for p in original.rglob('*') if p.is_file()}


def test_rejects_tampered_original_before_copy(roots):
    original, source, destination, old = roots
    (original / 'optimization/runtime/sdk.py').write_text('tampered\n')
    with pytest.raises(ValueError, match='BUILD_CHANGED'):
        seal_runtime(original, source, destination, old['build_sha256'])
    assert not destination.exists()


def test_rejects_wrong_external_digest(roots):
    original, source, destination, _ = roots
    with pytest.raises(ValueError, match='BUILD_BINDING'):
        seal_runtime(original, source, destination, '0' * 64)
    assert not destination.exists()


def test_does_not_overwrite_existing_destination(roots):
    original, source, destination, old = roots
    destination.mkdir()
    marker = destination / 'keep.txt'
    marker.write_text('keep')
    with pytest.raises(FileExistsError):
        seal_runtime(original, source, destination, old['build_sha256'])
    assert marker.read_text() == 'keep'


def test_sealed_runtime_public_lock_verifies_its_shipped_sdk_and_forecast(roots):
    original, source, destination, old = roots
    result = seal_runtime(original, source, destination, old['build_sha256'])
    lock_path = destination / 'optimization/runtime/HANDOFF_CONTRACT_LOCK.json'
    digest = hashlib.sha256(lock_path.read_bytes()).hexdigest()
    lock = verify_lock(destination, digest)
    assert lock['schema_version'] == 'task02-m2-runtime-handoff-contract-lock/2'
    assert 'job_forecast' in lock['public_methods']
    assert lock['forecast_view_version'] == 'task02-m2-job-forecast/1'
    assert 'optimization/runtime/forecast.py' in lock['files']
    assert lock['files']['optimization/runtime/sdk.py']['sha256'] == hashlib.sha256((destination/'optimization/runtime/sdk.py').read_bytes()).hexdigest()
    assert result['handoff_contract_lock_sha256'] == digest
    assert 'docs/step7_INTEGRATION_CROSSWALK.md' in inventory(destination)['files']


def test_seal_rejects_tampered_public_crosswalk_outside_old_inventory(roots):
    original, source, destination, old = roots
    (original/'docs/step7_INTEGRATION_CROSSWALK.md').write_text('tampered crosswalk')
    with pytest.raises(ValueError, match='CONTRACT_CHANGED'):
        seal_runtime(original, source, destination, old['build_sha256'])
    assert not destination.exists()
