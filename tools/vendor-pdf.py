"""Download pinned official npm bundles, verifying npm SHA-512 before extraction."""
import base64
import hashlib
import io
import json
import tarfile
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'public/vendor'
folder.mkdir(parents=True, exist_ok=True)
records = []
for name, version, bundle, target in [
    ('pdf-lib', '1.17.1', 'package/dist/pdf-lib.min.js', 'pdf-lib.js'),
    ('@pdf-lib/fontkit', '1.1.1', 'package/dist/fontkit.umd.min.js', 'fontkit.js'),
]:
    url = 'https://registry.npmjs.org/' + name + '/' + version
    with urllib.request.urlopen(url, timeout=40) as response:
        metadata = json.load(response)
    dist = metadata['dist']
    if not dist['tarball'].startswith('https://registry.npmjs.org/'):
        raise RuntimeError('Unexpected package host')
    with urllib.request.urlopen(dist['tarball'], timeout=60) as response:
        binary = response.read()
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(binary).digest()).decode('ascii')
    if integrity != dist['integrity']:
        raise RuntimeError('Package integrity mismatch: ' + name)
    with tarfile.open(fileobj=io.BytesIO(binary), mode='r:gz') as archive:
        data = archive.extractfile(bundle).read()
        license_names = [p for p in archive.getnames() if p.lower() in ['package/license', 'package/license.md', 'package/license.txt']]
        if license_names:
            license_data = archive.extractfile(license_names[0]).read()
            license_source = 'npm package'
        elif name == '@pdf-lib/fontkit':
            # This release supplies its MIT declaration in README/package.json,
            # rather than a separate LICENSE file. Preserve those declarations.
            license_source = 'npm package/README.md and package/package.json (MIT declaration)'
            readme = archive.extractfile('package/README.md').read()
            package_json = archive.extractfile('package/package.json').read()
            mit = (folder / 'pdf-lib.js.LICENSE.txt').read_bytes()
            terms = mit[mit.index(b'Permission is hereby granted'):]
            license_data = b'Original fontkit package metadata and README (including MIT declaration):\n\n' + package_json + b'\n\n' + readme + b'\n\nMIT license terms:\n\n' + terms
        else:
            raise RuntimeError('License missing: ' + name)
    (folder / target).write_bytes(data)
    (folder / (target + '.LICENSE.txt')).write_bytes(license_data)
    records.append({'package': name, 'version': version, 'registry': url, 'tarballIntegrity': integrity,
                    'file': target, 'sha256': hashlib.sha256(data).hexdigest(), 'license': metadata.get('license'), 'licenseSource': license_source})
(folder / 'VERSIONS.json').write_bytes((json.dumps(records, indent=2) + '\n').encode('utf-8'))
print(json.dumps(records, ensure_ascii=False, indent=2))
