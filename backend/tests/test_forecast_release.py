"""A forecast extension gets a new inventory; it cannot relabel original bytes."""
from pathlib import Path
import json

import pytest

from optimization.runtime.build import inventory
from backend.scripts.seal_forecast_runtime import seal_runtime


@pytest.fixture
def roots(tmp_path):
    original, source, destination = (tmp_path / n for n in ('original', 'source', 'derived'))
    (original / 'optimization/runtime').mkdir(parents=True)
    (original / 'requirements-runtime.lock.txt').write_text('# sealed test lock\n', encoding='utf8')
    (original / 'optimization/runtime/sdk.py').write_text('VERSION = 1\n', encoding='utf8')
    record = inventory(original)
    (original / 'production_inventory.json').write_text(json.dumps(record), encoding='utf8')
    (source / 'optimization/runtime').mkdir(parents=True)
    (source / 'optimization/runtime/sdk.py').write_text('from .forecast import forecast\n', encoding='utf8')
    (source / 'optimization/runtime/forecast.py').write_text('def forecast(): return None\n', encoding='utf8')
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
    assert result['changed_production_files'] == ['optimization/runtime/forecast.py', 'optimization/runtime/sdk.py']
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
