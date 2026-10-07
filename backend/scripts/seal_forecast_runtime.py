"""Seal an additive development runtime from a verified received installation.

Never overwrites the received inventory, authority, ZIPs or historical receipts.
The resulting build is a new development release, not M2's original attestation.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil


OVERLAYS = ('optimization/runtime/forecast.py', 'optimization/runtime/sdk.py')


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
    destination.mkdir(parents=True, exist_ok=False)
    for name in old['files']:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original_runtime / name, target)
    for name in OVERLAYS:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, target)
    from optimization.runtime.build import inventory
    record = inventory(destination)
    (destination / 'production_inventory.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf8')
    if record['build_sha256'] == expected_baseline:
        raise ValueError('Extension must have a new build identity')
    changed = sorted(name for name, pin in record['files'].items() if old['files'].get(name) != pin)
    if set(changed) != set(OVERLAYS) or set(old['files']) - set(record['files']):
        raise ValueError('Unexpected production closure changes')
    result = {'schema_version': 'saferoute-m3-forecast-extension-release/1',
              'status': 'SEALED_DEVELOPMENT_EXTENSION', 'baseline_build_sha256': expected_baseline,
              'build_sha256': record['build_sha256'], 'changed_production_files': changed,
              'production_files': len(record['files']), 'app_version': '0.9.0',
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
