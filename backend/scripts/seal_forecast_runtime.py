"""Seal an additive development runtime from a verified received installation.

Never overwrites the received inventory, authority, ZIPs or historical receipts.
The resulting build is a new development release, not M2's original attestation.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys


OVERLAYS = ('optimization/runtime/forecast.py', 'optimization/runtime/sdk.py',
            'optimization/runtime/handoff.py', 'optimization/runtime/build.py')
LOCK = 'optimization/runtime/HANDOFF_CONTRACT_LOCK.json'
CROSSWALK = 'docs/step7_INTEGRATION_CROSSWALK.md'
CHANGES = set(OVERLAYS) | {LOCK, CROSSWALK}


def verify_sealed_contract(runtime, build_digest, lock_digest):
    """Run the shipped verifier only after its production bytes are verified."""
    code = '''import hashlib,json,runpy,sys
from pathlib import Path
root=Path(sys.argv[1]); build=sys.argv[2]; digest=sys.argv[3]
runpy.run_path(str(root/'runtime_entry.py'))['verify_install'](root,root/'production_inventory.json',build)
sys.path.insert(0,str(root))
from optimization.runtime.handoff import verify_lock
lock=verify_lock(root,digest)
print(json.dumps({'schema_version':lock['schema_version'],'forecast_view_version':lock['forecast_view_version']}))
'''
    result = subprocess.run([sys.executable, '-I', '-B', '-c', code, str(runtime), build_digest, lock_digest],
                            capture_output=True, text=True, timeout=60,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise ValueError('CONTRACT_CHANGED: shipped verify_lock rejected sealed runtime')
    return json.loads(result.stdout)


def seal_runtime(original_runtime: Path, source: Path, destination: Path, expected_baseline: str):
    original_runtime, source, destination = (p.resolve() for p in (original_runtime, source, destination))
    if destination.exists():
        raise FileExistsError('A fresh destination is required')
    if destination.is_relative_to(original_runtime) or original_runtime.is_relative_to(destination):
        raise ValueError('Separate runtime trees required')
    old = json.loads((original_runtime / 'production_inventory.json').read_bytes())
    body = {k: v for k, v in old.items() if k != 'build_sha256'}
    raw = json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
    if old.get('build_sha256') != expected_baseline or hashlib.sha256(raw).hexdigest() != expected_baseline:
        raise ValueError('BUILD_BINDING: received inventory differs from external baseline')
    if not isinstance(old.get('files'), dict) or 'requirements-runtime.lock.txt' not in old['files']:
        raise ValueError('BUILD_CLOSURE: sealed dependency lock required')
    for name, pin in old['files'].items():
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or ':' in name or '\\' in name:
            raise ValueError('BUILD_PATH: relative production path required')
        file = original_runtime / name
        if file.stat().st_size != pin['bytes'] or hashlib.sha256(file.read_bytes()).hexdigest() != pin['sha256']:
            raise ValueError('BUILD_CHANGED: received production bytes differ')
    for name in OVERLAYS:
        if not (source / name).is_file():
            raise ValueError('Missing forecast extension source: ' + name)
    if LOCK not in old['files']:
        raise ValueError('CONTRACT_CHANGED: externally pinned baseline public lock required')
    baseline_lock = json.loads((original_runtime / LOCK).read_bytes())
    if baseline_lock.get('schema_version') != 'task02-m2-runtime-handoff-contract-lock/1' or not baseline_lock.get('files'):
        raise ValueError('CONTRACT_CHANGED: original handoff lock required')
    for name, pin in baseline_lock['files'].items():
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or ':' in name or '\\' in name:
            raise ValueError('CONTRACT_CHANGED: relative public path required')
        file = original_runtime / name
        if not file.is_file() or file.stat().st_size != pin['bytes'] or hashlib.sha256(file.read_bytes()).hexdigest() != pin['sha256']:
            raise ValueError('CONTRACT_CHANGED: baseline public bytes differ')
    destination.mkdir(parents=True, exist_ok=False)
    for name in set(old['files']) | set(baseline_lock['files']):
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original_runtime / name, target)
    for name in OVERLAYS:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, target)
    from optimization.runtime.handoff import record as contract_record, verify_lock
    lock_bytes = (json.dumps(contract_record(destination), indent=2) + '\n').encode('utf8')
    (destination / LOCK).write_bytes(lock_bytes)
    lock_digest = hashlib.sha256(lock_bytes).hexdigest()
    verify_lock(destination, lock_digest)
    from optimization.runtime.build import inventory
    record = inventory(destination)
    (destination / 'production_inventory.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf8')
    if record['build_sha256'] == expected_baseline:
        raise ValueError('Extension must have a new build identity')
    changed = sorted(name for name, pin in record['files'].items() if old['files'].get(name) != pin)
    if set(changed) != CHANGES or set(old['files']) - set(record['files']):
        raise ValueError('Unexpected production closure changes')
    verify_sealed_contract(destination, record['build_sha256'], lock_digest)
    result = {'schema_version': 'saferoute-m3-forecast-extension-release/2',
              'status': 'SEALED_DEVELOPMENT_EXTENSION', 'baseline_build_sha256': expected_baseline,
              'build_sha256': record['build_sha256'], 'changed_production_files': changed,
              'production_files': len(record['files']), 'app_version': '0.9.0',
              'handoff_contract_lock_sha256': lock_digest,
              'handoff_contract_lock_schema_version': 'task02-m2-runtime-handoff-contract-lock/2',
              'forecast_view_version': 'task02-m2-job-forecast/1',
              'native_acceptance': 'NOT_RUN', 'leader_production_approval': 'NOT_REQUESTED'}
    (destination / 'extension_manifest.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original-runtime', required=True, type=Path)
    parser.add_argument('--source-root', required=True, type=Path)
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--expected-baseline-build', required=True)
    args = parser.parse_args()
    print(json.dumps(seal_runtime(args.original_runtime, args.source_root, args.destination, args.expected_baseline_build)))


if __name__ == '__main__':
    raise SystemExit(main())
