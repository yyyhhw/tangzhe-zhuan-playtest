#!/usr/bin/env python3
"""Verify exact pinned baseline bytes, then apply this patch only in a temporary copy."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, required=True, help='Checkout at the manifest baseline commit')
    args = parser.parse_args()
    package = Path(__file__).resolve().parent
    manifest = json.loads((package / 'manifest.json').read_text())
    for rel, expected in manifest['baseline_blobs'].items():
        path = args.base / rel
        if not path.is_file():
            raise SystemExit('Missing baseline file: ' + rel)
        actual = blob(path.read_bytes())
        if actual != expected:
            raise SystemExit('Baseline blob mismatch: ' + rel + '\nExpected ' + expected + '\nActual   ' + actual + '\nDo not append newlines or use fuzz; use the exact pinned baseline.')
    for rel, metadata in manifest['changed_files'].items():
        if metadata['before_git_blob_sha'] is None and (args.base / rel).exists():
            raise SystemExit('New file already exists in baseline: ' + rel)
    patch = package / 'pet2-next-preview.patch'
    if hashlib.sha256(patch.read_bytes()).hexdigest() != manifest['patch_sha256']:
        raise SystemExit('Patch SHA256 mismatch')
    with tempfile.TemporaryDirectory(prefix='pet2-r3-check-') as tmp:
        work = Path(tmp)
        for rel, metadata in manifest['changed_files'].items():
            if metadata['before_git_blob_sha'] is not None:
                target = work / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(args.base / rel, target)
        # git apply rejects context mismatches; no fuzz/whitespace-ignore options.
        subprocess.run(['git', 'apply', '--check', str(patch)], cwd=work, check=True)
        subprocess.run(['git', 'apply', str(patch)], cwd=work, check=True)
        for rel, metadata in manifest['changed_files'].items():
            actual = hashlib.sha256((work / rel).read_bytes()).hexdigest()
            if actual != metadata['after_sha256']:
                raise SystemExit('Applied result hash mismatch: ' + rel)
    print('PASS: exact baseline Git blobs; git apply --check; every applied file SHA256.')
    print('The supplied checkout was not modified.')


if __name__ == '__main__':
    main()
