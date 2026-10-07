"""Read-only certified job forecasts, separate from accepted execution.

The portable checker verifies wire semantics, not raw-source feasibility.
The producer requires a Store-authenticated job and its retained certificate.
No solver, acceptance, replay or recovery is performed by this projection.
"""
from collections.abc import Mapping

from .contracts import validate_job_view
from .job_view import job_view
from .protocol import PROFILES, RuntimeError, basis, copy, digest, identifier, number, require, sha, tree, wire_exact
from .trajectory_contract import trajectory

VERSION = 'task02-m2-job-forecast/1'
UNITS = {'distance': 'm', 'duration': 's', 'action_time': 'us', 'cost': 'VND',
         'mass': 'kg', 'geometry_crs': 'WGS84',
         'geometry_order': 'longitude_latitude', 'exposure': 'PROXY'}
FIELDS = {'schema_version', 'session_id', 'job_id', 'profile', 'input_basis',
          'build_sha256', 'job_view', 'trajectory', 'metrics', 'units',
          'metric_scope', 'execution_mode', 'real_world_observation'}


def _raise_issues(issues):
    if issues:
        issue = issues[0]
        raise RuntimeError(issue['code'], issue['path'], issue['message'])


def _route_orders(value):
    orders = []
    for i, route in enumerate(value['vehicle_routes']):
        service = [action['order_id'] for action in route['actions'] if action['kind'] == 'SERVICE']
        require(service == route['order_sequence'], 'COVERAGE',
                f'trajectory.vehicle_routes[{i}].order_sequence',
                'ordered service actions must match route coverage')
        orders.extend(route['order_sequence'])
    return orders


def validate_job_forecast(value):
    """Return diagnostic issues, without source or persistence authentication.

    Certified routes describe the future suffix; job-view served orders may
    also contain prior delivered orders. Their private anchor is checked by
    the producer, while this checker enforces suffix inclusion and services.
    """
    issues = []
    try:
        require(isinstance(value, Mapping), 'INVALID_DATA', '$', 'forecast object required')
        tree(value)
        require(set(value) == FIELDS, 'INVALID_DATA', '$', 'exact forecast fields required')
        require(value['schema_version'] == VERSION, 'VERSION_MISMATCH', 'schema_version', 'job-forecast/1 required')
        identifier(value['session_id'], 'session_id')
        identifier(value['job_id'], 'job_id')
        require(isinstance(value['profile'], str) and value['profile'] in PROFILES,
                'INVALID_DATA', 'profile', 'locked profile required')
        basis(value['input_basis'])
        digest(value['build_sha256'], 'build_sha256')
        require(value['session_id'] == value['input_basis']['session_id'],
                'FORECAST_BINDING', 'session_id', 'forecast session differs from input basis')
        require(value['build_sha256'] == value['input_basis']['build_sha256'],
                'FORECAST_BINDING', 'build_sha256', 'forecast build differs from input basis')
        require(value['units'] == UNITS, 'INVALID_DATA', 'units', 'locked native units required')
        require(value['metric_scope'] == 'FORECAST_ONLY', 'INVALID_DATA', 'metric_scope', 'forecast metric scope required')
        require(value['execution_mode'] == 'SIMULATED_REPLAY' and value['real_world_observation'] is False,
                'INVALID_DATA', 'execution_mode', 'simulation labels required')
        view = value['job_view']
        _raise_issues(validate_job_view(view))
        require(view['job_id'] == value['job_id'] and view['input_basis'] == value['input_basis'],
                'FORECAST_BINDING', 'job_view', 'job and full input basis must match')
        if not view['plan_available']:
            require(value['trajectory'] is None and value['metrics'] is None,
                    'WITNESS_REQUIRED', 'trajectory', 'no-witness trajectory and metrics must be null')
        else:
            require(isinstance(value['trajectory'], Mapping), 'WITNESS_REQUIRED', 'trajectory', 'certified trajectory required')
            trajectory(value['trajectory'], 'trajectory')
            require(value['trajectory']['job_id'] == value['job_id'] and value['trajectory']['profile'] == value['profile'],
                    'FORECAST_BINDING', 'trajectory', 'trajectory job/profile differs')
            orders = _route_orders(value['trajectory'])
            require(set(orders) <= set(view['served_orders']), 'COVERAGE', 'trajectory.vehicle_routes',
                    'future route coverage must belong to certified served orders')
            metrics = value['metrics']
            require(isinstance(metrics, Mapping) and bool(metrics), 'INVALID_DATA', 'metrics', 'native forecast metrics required')
            for key, metric in metrics.items():
                number(metric, 'metrics.' + key)
    except RuntimeError as error:
        issues.append(error.diagnostic())
    return issues


def project_job_forecast(job):
    """Project a verified server-owned job without changing retained data."""
    require(isinstance(job, Mapping), 'INVALID_DATA', 'job', 'persisted job object required')
    # Preserve fractions and int64 before the strict JSON/job-view boundary.
    job = copy(wire_exact(job))
    identifier(job.get('session'), 'job.session')
    basis(job.get('basis'))
    require(job['session'] == job['basis']['session_id'], 'FORECAST_BINDING', 'job.session', 'job session differs from basis')
    request = job.get('request')
    require(isinstance(request, Mapping) and request.get('operation') == 'submit',
            'INVALID_DATA', 'job.request', 'persisted submit required')
    basis(request.get('basis'))
    require(request['basis'] == job['basis'], 'FORECAST_BINDING', 'job.request.basis', 'full submitted basis differs')
    profile = request.get('profile')
    require(isinstance(profile, str) and profile in PROFILES, 'INVALID_DATA', 'job.request.profile', 'locked profile required')
    view = job_view(job)
    _raise_issues(validate_job_view(view))
    result = job.get('result')
    if job['status'] == 'COMPLETED':
        require(result.get('profile') == profile, 'FORECAST_BINDING', 'job.result.profile', 'result differs from submitted profile')
        require(isinstance(result.get('source_hashes'), Mapping) and sha(result['source_hashes']) == job['basis']['source_sha256'],
                'FORECAST_BINDING', 'job.result.source_hashes', 'result source differs from input basis')
    projected = {'schema_version': VERSION, 'session_id': job['session'], 'job_id': job['id'],
                 'profile': profile, 'input_basis': job['basis'], 'build_sha256': job['basis']['build_sha256'],
                 'job_view': view, 'trajectory': None, 'metrics': None, 'units': dict(UNITS),
                 'metric_scope': 'FORECAST_ONLY', 'execution_mode': 'SIMULATED_REPLAY',
                 'real_world_observation': False}
    if view['plan_available']:
        require(result.get('forecast') is True, 'FORECAST_BINDING', 'job.result.forecast', 'native forecast required')
        digest(result.get('domain_sha256'), 'job.result.domain_sha256')
        if 'domain' in result:
            require(isinstance(result['domain'], Mapping) and result['domain'].get('content_sha256') == result['domain_sha256'],
                    'FORECAST_BINDING', 'job.result.domain', 'retained domain binding differs')
        projected['trajectory'] = {'job_id': job['id'], 'profile': profile, 'forecast': True,
                                   'domain_sha256': result['domain_sha256'], 'vehicle_routes': result.get('vehicle_routes')}
        projected['metrics'] = result.get('metrics')
        _raise_issues(validate_job_forecast(projected))
        suffix = _route_orders(projected['trajectory'])
        anchor = result.get('validation_anchor')
        delivered = []
        if anchor is not None:
            require(isinstance(anchor, Mapping) and isinstance(anchor.get('orders'), list),
                    'INVALID_DATA', 'job.result.validation_anchor', 'certified anchor orders required')
            for order in anchor['orders']:
                require(isinstance(order, Mapping), 'INVALID_DATA', 'job.result.validation_anchor.orders', 'anchor order object required')
                oid = identifier(order.get('order_id'), 'job.result.validation_anchor.orders.order_id')
                if order.get('status') == 'DELIVERED': delivered.append(oid)
        require(len(delivered + suffix) == len(set(delivered + suffix)) and set(delivered + suffix) == set(view['served_orders']),
                'COVERAGE', 'job.result.served_orders', 'certified delivered prefix and future suffix must exactly cover served orders')
    _raise_issues(validate_job_forecast(projected))
    return copy(projected)
