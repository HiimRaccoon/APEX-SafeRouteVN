"""Supplemental forecast compatibility has its own self-consistent lock."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest

from optimization.runtime.handoff import PUBLIC_FILES, record, verify_lock, compatible
from optimization.runtime.protocol import RuntimeError


def test_public_lock_matches_actual_sdk_and_forecast_versions():
    from optimization.runtime.sdk import VERSION_SDK
    from optimization.runtime.forecast import VERSION, UNITS
    value = record(Path(__file__).resolve().parents[2])
    assert value['sdk_version'] == VERSION_SDK
    assert value['forecast_view_version'] == VERSION
    assert value['forecast_units'] == UNITS


@pytest.fixture
def public_root(tmp_path):
    for name in PUBLIC_FILES:
        file = tmp_path/name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text('# public fixture\n', encoding='utf8')
    return tmp_path


def write_lock(root):
    value = record(root)
    file = root/'optimization/runtime/HANDOFF_CONTRACT_LOCK.json'
    file.write_text(json.dumps(value, indent=2)+'\n', encoding='utf8')
    return value, hashlib.sha256(file.read_bytes()).hexdigest()


def test_forecast_lock_versions_public_addition_without_changing_frozen_api(public_root):
    value, digest = write_lock(public_root)
    assert verify_lock(public_root,digest) == value
    assert value['schema_version'] == 'task02-m2-runtime-handoff-contract-lock/2'
    assert value['sdk_version'] == 'task02-m2-runtime-sdk/2'
    assert value['api_v1'] == 'FROZEN_EXTERNAL_CONTRACT_UNCHANGED'
    assert value['forecast_view_version'] == 'task02-m2-job-forecast/1'
    assert value['forecast_metric_scope'] == 'FORECAST_ONLY'
    assert 'job_forecast' in value['public_methods']
    assert 'optimization/runtime/forecast.py' in value['files']
    assert 'optimization/runtime/handoff.py' in value['files']


@pytest.mark.parametrize('name',['sdk.py','forecast.py'])
def test_lock_rejects_shipped_public_file_change(public_root,name):
    _, digest = write_lock(public_root)
    (public_root/'optimization/runtime'/name).write_text('tampered')
    with pytest.raises(RuntimeError) as failure:
        verify_lock(public_root,digest)
    assert failure.value.code == 'CONTRACT_CHANGED'


def test_new_forecast_contract_cannot_be_marked_baseline_compatible(public_root):
    current = record(public_root)
    old = deepcopy(current)
    old['schema_version'] = 'task02-m2-runtime-handoff-contract-lock/1'
    old['sdk_version'] = 'task02-m2-runtime-sdk/1'
    old['public_methods'] = [m for m in old['public_methods'] if m != 'job_forecast']
    with pytest.raises(RuntimeError) as failure:
        compatible(old,current)
    assert failure.value.code == 'CONTRACT_UPGRADE_REQUIRED'


def test_forecast_schema_change_requires_reviewed_migration(public_root):
    value = record(public_root)
    changed = deepcopy(value)
    changed['forecast_view_version'] = 'task02-m2-job-forecast/2'
    with pytest.raises(RuntimeError):
        compatible(value,changed)
