"""Supplemental forecast projection and read-only verified Store behavior."""
from copy import deepcopy
from fractions import Fraction
from importlib import import_module, util
from types import SimpleNamespace
import sqlite3

import pytest

from optimization.runtime.protocol import RuntimeError, sha
from optimization.runtime.sdk import RuntimeClient
from optimization.runtime.store import Store


def forecast_module():
    assert util.find_spec('optimization.runtime.forecast') is not None, 'public forecast projection is missing'
    return import_module('optimization.runtime.forecast')


def job_fixture():
    basis = {'session_id': 'session-1', 'root_sha256': 'a' * 64,
             'head_sha256': 'b' * 64, 'head_version': '1', 'generation': '0',
             'source_sha256': sha({}), 'context_version': 'ctx-1',
             'overlay_sha256': None, 'build_sha256': 'd' * 64}
    start = 9007199254740992
    edge = {'kind': 'EDGE', 'start_us': start, 'end_us': start + 10,
            'edge_id': 'edge-1', 'from_node': 1, 'to_node': 2,
            'incoming_edge': 'edge-0', 'fraction_start': 1 / 3,
            'fraction_start_exact': '1/3', 'fraction_end': 1,
            'geometry': [[106.75, 10.75], [106.751, 10.751]],
            'feature_payload': {'source_exact': Fraction(1, 3)},
            'distance_m': 10.25, 'exposure': 2.5}
    route = {'vehicle_id': 'vehicle-1', 'order_sequence': ['order-1'],
             'actions': [edge, {'kind': 'SERVICE', 'start_us': start + 10,
                               'end_us': start + 20, 'node_id': 2,
                               'order_id': 'order-1', 'load_after_kg': 0}],
             'start_us': start, 'return_us': start + 20,
             'start_node': 1, 'end_node': 2}
    return {'id': 'job-1', 'session': 'session-1', 'basis': basis,
            'request': {'operation': 'submit', 'basis': deepcopy(basis),
                        'profile': 'BALANCED', 'budget_seconds': 30},
            'status': 'COMPLETED', 'failure': None,
            'validation': {'valid': True, 'validator_version': 'raw-validator/3', 'diagnostics': []},
            'result': {'status': 'FEASIBLE', 'profile': 'BALANCED', 'forecast': True,
                       'source_hashes': {}, 'domain_sha256': 'e' * 64,
                       'served_orders': ['order-1'], 'unserved_orders': [],
                       'vehicle_routes': [route], 'validation_anchor': None,
                       'metrics': {'total_distance_m': 10.25, 'total_travel_time_s': 0.00001,
                                   'total_exposure': 2.5, 'total_cost_vnd': 12345,
                                   'total_soft_lateness_s': 0}}}


def test_certified_forecast_preserves_exact_directed_geometry_without_mutation():
    module = forecast_module()
    job = job_fixture()
    before = deepcopy(job)
    result = module.project_job_forecast(job)
    assert module.validate_job_forecast(result) == []
    assert set(result) == {'schema_version', 'session_id', 'job_id', 'profile', 'input_basis',
                           'build_sha256', 'job_view', 'trajectory', 'metrics', 'units',
                           'metric_scope', 'execution_mode', 'real_world_observation'}
    assert result['schema_version'] == 'task02-m2-job-forecast/1'
    assert result['units'] == {'distance': 'm', 'duration': 's', 'action_time': 'us', 'cost': 'VND',
                               'mass': 'kg', 'geometry_crs': 'WGS84',
                               'geometry_order': 'longitude_latitude', 'exposure': 'PROXY'}
    edge = result['trajectory']['vehicle_routes'][0]['actions'][0]
    assert edge['start_us'] == '9007199254740992'
    assert edge['end_us'] == '9007199254741002'
    assert edge['fraction_start_exact'] == '1/3'
    assert edge['incoming_edge'] == 'edge-0'
    assert edge['geometry'] == [[106.75, 10.75], [106.751, 10.751]]
    assert edge['feature_payload'] == {'source_exact': {'numerator': '1', 'denominator': '3'}}
    assert result['metrics']['total_cost_vnd'] == 12345
    assert result['metric_scope'] == 'FORECAST_ONLY'
    assert result['execution_mode'] == 'SIMULATED_REPLAY'
    assert result['real_world_observation'] is False
    assert job == before
    result['input_basis']['head_sha256'] = 'f' * 64
    result['trajectory']['vehicle_routes'][0]['actions'][0]['geometry'][0][0] = 0
    assert job == before


@pytest.mark.parametrize('status', ['QUEUED', 'RUNNING', 'FAILED', 'NO_SERVICE', 'SEARCH_LIMIT',
                                    'TIME_LIMIT', 'UNSUPPORTED', 'INVALID_DATA'])
def test_no_witness_does_not_publish_routes_or_zero_metrics(status):
    module = forecast_module()
    job = job_fixture()
    diagnostic = {'severity': 'ERROR', 'code': 'NO_WITNESS', 'path': 'job', 'message': 'No certified witness'}
    if status in ('QUEUED', 'RUNNING', 'FAILED'):
        job.update(status=status, result=None, validation=None,
                   failure=diagnostic if status == 'FAILED' else None)
    else:
        job['result'].update(status=status, diagnostics=[diagnostic])
        job['validation'] = {'valid': None}
    value = module.project_job_forecast(job)
    assert value['trajectory'] is None
    assert value['metrics'] is None
    assert value['job_view']['plan_available'] is False
    assert value['job_view']['internal_status'] == (None if status in ('QUEUED', 'RUNNING', 'FAILED') else status)
    assert module.validate_job_forecast(value) == []


@pytest.mark.parametrize('field', ['session', 'profile', 'request_basis', 'build', 'source', 'certification',
                                   'route_coverage', 'service_coverage', 'geometry', 'metrics'])
def test_producer_rejects_malformed_certified_binding_and_coverage(field):
    module = forecast_module()
    job = job_fixture()
    if field == 'session': job['session'] = 'session-2'
    elif field == 'profile': job['result']['profile'] = 'FASTEST'
    elif field == 'request_basis': job['request']['basis']['head_sha256'] = 'f' * 64
    elif field == 'build': job['request']['basis']['build_sha256'] = 'f' * 64
    elif field == 'source': job['result']['source_hashes'] = {'source': 'f' * 64}
    elif field == 'certification': job['validation']['valid'] = False
    elif field == 'route_coverage': job['result']['served_orders'] = ['order-2']
    elif field == 'service_coverage': job['result']['vehicle_routes'][0]['actions'][1]['order_id'] = 'order-2'
    elif field == 'geometry': job['result']['vehicle_routes'][0]['actions'][0]['geometry'][0][0] = 181
    elif field == 'metrics': job['result']['metrics']['total_distance_m'] = -1
    with pytest.raises(RuntimeError): module.project_job_forecast(job)


def test_return_only_preserves_partial_edge_and_unsupported_business_status():
    module = forecast_module()
    job = job_fixture()
    route = job['result']['vehicle_routes'][0]
    route.update(order_sequence=[], actions=route['actions'][:1], return_us=9007199254741002)
    job['result'].update(status='RETURN_ONLY', served_orders=[],
                         unserved_orders=[{'order_id': 'order-1', 'reason': 'CUSTODY_BLOCKED'}])
    value = module.project_job_forecast(job)
    assert value['trajectory']['vehicle_routes'][0]['actions'][0]['fraction_start_exact'] == '1/3'
    assert value['job_view']['internal_status'] == 'RETURN_ONLY'
    assert value['job_view']['business_status'] == 'UNSUPPORTED'
    assert module.validate_job_forecast(value) == []


def test_partial_forecast_retains_certified_unserved_reasons():
    module = forecast_module()
    job = job_fixture()
    job['result'].update(status='PARTIAL', unserved_orders=[
        {'order_id': 'order-2', 'reason': 'NOT_SERVED_BY_FOUND_WITNESS'},
    ])
    value = module.project_job_forecast(job)
    assert value['job_view']['business_status'] == 'PARTIAL'
    assert value['job_view']['served_orders'] == ['order-1']
    assert value['job_view']['unserved_orders'] == [
        {'order_id': 'order-2', 'reason': 'NOT_SERVED_BY_FOUND_WITNESS'},
    ]
    assert value['trajectory']['vehicle_routes'][0]['order_sequence'] == ['order-1']
    assert module.validate_job_forecast(value) == []


@pytest.mark.parametrize('field', ['session', 'job', 'profile', 'basis', 'build', 'scope', 'units',
                                   'unknown', 'missing_trajectory', 'missing_metrics', 'service', 'unsafe_time'])
def test_portable_validator_fails_closed(field):
    module = forecast_module()
    value = module.project_job_forecast(job_fixture())
    if field == 'session': value['session_id'] = 'session-2'
    elif field == 'job': value['trajectory']['job_id'] = 'job-2'
    elif field == 'profile': value['trajectory']['profile'] = 'FASTEST'
    elif field == 'basis': value['job_view']['input_basis']['head_sha256'] = 'f' * 64
    elif field == 'build': value['build_sha256'] = 'f' * 64
    elif field == 'scope': value['metric_scope'] = 'OBSERVED_PREFIX_ONLY'
    elif field == 'units': value['units']['distance'] = 'km'
    elif field == 'unknown': value['private_installation'] = 'hidden'
    elif field == 'missing_trajectory': value['trajectory'] = None
    elif field == 'missing_metrics': value['metrics'] = None
    elif field == 'service': value['trajectory']['vehicle_routes'][0]['actions'][1]['order_id'] = 'order-2'
    elif field == 'unsafe_time': value['trajectory']['vehicle_routes'][0]['start_us'] = 9007199254740992
    assert module.validate_job_forecast(value)


def test_portable_forecast_metrics_require_native_numbers():
    module = forecast_module()
    value = module.project_job_forecast(job_fixture())
    value['metrics']['total_cost_vnd'] = '12345'
    assert module.validate_job_forecast(value)


def test_anchored_forecast_exposes_suffix_geometry_and_certified_total_coverage():
    module = forecast_module()
    job = job_fixture()
    job['result']['served_orders'] = ['order-0', 'order-1']
    job['result']['validation_anchor'] = {'orders': [
        {'order_id': 'order-0', 'status': 'DELIVERED'},
        {'order_id': 'order-1', 'status': 'PENDING'},
    ]}
    value = module.project_job_forecast(job)
    assert value['job_view']['served_orders'] == ['order-0', 'order-1']
    assert value['trajectory']['vehicle_routes'][0]['order_sequence'] == ['order-1']
    assert module.validate_job_forecast(value) == []


@pytest.mark.parametrize('field', ['unknown_served', 'outstanding_served', 'duplicate_prefix', 'duplicate_suffix'])
def test_anchor_cannot_explain_unknown_or_outstanding_served_orders(field):
    module = forecast_module()
    job = job_fixture()
    job['result']['validation_anchor'] = {'orders': [
        {'order_id': 'order-0', 'status': 'DELIVERED'},
        {'order_id': 'order-1', 'status': 'PENDING'},
        {'order_id': 'order-2', 'status': 'PENDING'},
    ]}
    job['result']['served_orders'] = ['order-0', 'order-1']
    if field == 'unknown_served': job['result']['served_orders'].append('order-unknown')
    elif field == 'outstanding_served': job['result']['served_orders'].append('order-2')
    elif field == 'duplicate_prefix': job['result']['validation_anchor']['orders'].append({'order_id': 'order-0', 'status': 'DELIVERED'})
    elif field == 'duplicate_suffix': job['result']['validation_anchor']['orders'][1]['status'] = 'DELIVERED'
    with pytest.raises(RuntimeError): module.project_job_forecast(job)


@pytest.mark.parametrize('field', ['session_id', 'root_sha256', 'head_sha256', 'head_version', 'generation',
                                   'source_sha256', 'context_version', 'overlay_sha256', 'build_sha256'])
def test_portable_full_basis_binding_includes_hashes_and_counters(field):
    module = forecast_module()
    value = module.project_job_forecast(job_fixture())
    basis = value['job_view']['input_basis']
    basis[field] = ('2' if field in ('head_version', 'generation') else
                    'changed-context' if field == 'context_version' else
                    'session-2' if field == 'session_id' else 'f' * 64)
    assert module.validate_job_forecast(value)


@pytest.mark.parametrize('value', [None, [], {}, {'schema_version': 'task02-m2-job-forecast/1'}])
def test_portable_malformed_root_returns_diagnostics(value):
    assert forecast_module().validate_job_forecast(value)


def table_snapshot(path):
    with sqlite3.connect(path) as db:
        return {table: db.execute('SELECT * FROM ' + table + ' ORDER BY rowid').fetchall()
                for table in ('metadata', 'sessions', 'jobs', 'receipts', 'journal', 'outbox')}


def synthetic_client(store):
    client = object.__new__(RuntimeClient)
    client._RuntimeClient__runtime = SimpleNamespace(store=store)
    return client


def test_sdk_reads_real_verified_store_without_head_journal_or_receipt_mutation(tmp_path):
    assert hasattr(RuntimeClient, 'job_forecast'), 'read-only SDK forecast is missing'
    module = forecast_module()
    store = Store(tmp_path / 'authority.sqlite', 'd' * 64)
    basis = store._bootstrap('session-1', {'source_hashes': {}},
                             {'context_version': 'ctx-1'}, 'bootstrap-1')['basis']
    job_id = store.submit('session-1', 'submit-1', basis, 'BALANCED', 30)['job_id']
    lease = store.claim('session-1', job_id)
    job = job_fixture()
    from optimization.runtime.protocol import wire_exact
    store._publish('session-1', job_id, lease, wire_exact(job['result']), job['validation'])
    assert store.verify() is True
    before = table_snapshot(store.path)
    result = synthetic_client(store).job_forecast('session-1', job_id)
    assert result['job_id'] == job_id
    assert result['input_basis'] == basis
    assert module.validate_job_forecast(result) == []
    assert table_snapshot(store.path) == before
    with pytest.raises(RuntimeError, match='unknown job'): synthetic_client(store).job_forecast('session-1', 'job-missing')
    assert table_snapshot(store.path) == before


def test_sdk_rejects_store_result_changed_outside_authenticated_journal(tmp_path):
    assert hasattr(RuntimeClient, 'job_forecast'), 'verified SDK forecast is missing'
    store = Store(tmp_path / 'authority.sqlite', 'd' * 64)
    basis = store._bootstrap('session-1', {'source_hashes': {}},
                             {'context_version': 'ctx-1'}, 'bootstrap-1')['basis']
    job_id = store.submit('session-1', 'submit-1', basis, 'BALANCED', 30)['job_id']
    with sqlite3.connect(store.path) as db:
        db.execute('UPDATE jobs SET status=? WHERE id=?', ('FAILED', job_id))
    before = table_snapshot(store.path)
    with pytest.raises(RuntimeError) as failure: synthetic_client(store).job_forecast('session-1', job_id)
    assert failure.value.code == 'JOURNAL_CORRUPT'
    assert table_snapshot(store.path) == before
