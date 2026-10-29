"""Collect the reviewed Google Fonts candidates from one immutable official commit.

Original intake stays in ignored references/. No commercial candidate is fetched.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
import struct
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
INTAKE = ROOT / 'references/font-candidates-20261029'
OUTPUT = ROOT / 'references/font-candidates-20261029/collected'

def api(path):
    request = urllib.request.Request('https://api.github.com/repos/google/fonts/' + path,
        headers={'User-Agent': 'Qingsong-Font-Collection', 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)

def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def read_file(path, commit):
    item = api('contents/' + urllib.parse.quote(path, safe='/') + '?ref=' + commit)
    if item.get('encoding') != 'base64':
        raise ValueError('Expected GitHub base64 contents: ' + path)
    data = base64.b64decode(item['content'])
    if blob(data) != item['sha']:
        raise ValueError('GitHub contents hash mismatch: ' + path)
    return data, item['sha']

def sfnt_flags(binary):
    for index in range(struct.unpack_from('>H', binary, 4)[0]):
        tag, _, offset, length = struct.unpack_from('>4sIII', binary, 12 + index * 16)
        if tag == b'OS/2' and length >= 10:
            return struct.unpack_from('>H', binary, offset + 8)[0]
    return None

manifest = json.loads((INTAKE / 'manifest.json').read_text(encoding='utf-8-sig'))
locks = json.loads((INTAKE / 'sources.lock.json').read_text(encoding='utf-8-sig'))['openFontSourceLocks']
commit = api('commits/main')['sha']
lookup = {font['id']: font for font in manifest['fonts']}
OUTPUT.mkdir(parents=True, exist_ok=True)
report = {'commit': commit, 'repository': 'google/fonts', 'fonts': [], 'deferred': [font['id'] for font in manifest['fonts'] if font['id'] not in {lock['id'] for lock in locks}]}
for lock in locks:
    record = {'id': lock['id'], 'status': 'failed'}
    try:
        assert re.fullmatch(r'gf-[a-z0-9]+(?:-[a-z0-9]+)*', lock['id']), 'Invalid candidate ID'
        assert lock['repository'] == 'google/fonts', 'Unexpected source repository'
        source_path = Path(lock['filePath'])
        assert '..' not in source_path.parts and source_path.parts[0] == 'ofl' and source_path.suffix == '.ttf', 'Invalid source path'
        assert lock['licensePath'] == str(source_path.parent / 'OFL.txt').replace('\\', '/'), 'License is not beside its font'
        assert re.fullmatch(r'[a-f0-9]{40}', lock['gitBlobSha1']), 'Invalid source fingerprint'
        font = lookup[lock['id']]
        assert font['language'] == 'en' and font['license']['spdx'] == 'OFL-1.1'
        data, sha = read_file(lock['filePath'], commit)
        if sha != lock['gitBlobSha1']:
            raise ValueError('Source blob differs from handoff; investigate before accepting')
        if data[:4] not in [b'\x00\x01\x00\x00', b'OTTO', b'true']:
            raise ValueError('Invalid SFNT file header')
        license_data, license_sha = read_file(lock['licensePath'], commit)
        text = license_data.decode('utf-8-sig')
        if 'SIL OPEN FONT LICENSE' not in text.upper() or 'copyright' not in text.lower():
            raise ValueError('Original copyright/OFL declaration missing')
        flags = sfnt_flags(data)
        if flags is not None and flags & (0x0002 | 0x0200):
            raise ValueError('Font embedding flags require review: ' + str(flags))
        filename = font['id'] + '.ttf'
        (OUTPUT / filename).write_bytes(data)
        (OUTPUT / (font['id'] + '-OFL.txt')).write_bytes(license_data)
        record.update(status='collected', file=filename, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
            sourcePath=lock['filePath'], sourceBlobSha1=sha, sourceCommit=commit, fsType=flags,
            licenseBlobSha1=license_sha, licenseSha256=hashlib.sha256(license_data).hexdigest(), licenseText=text)
        print('COLLECTED', font['id'], len(data), 'bytes', 'fsType', flags, flush=True)
    except Exception as error:
        record['error'] = str(error)
        print('FAILED', lock['id'], str(error), flush=True)
    report['fonts'].append(record)
(OUTPUT / 'collection-report.json').write_bytes((json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
print('PINNED_COMMIT', commit)
if any(font['status'] != 'collected' for font in report['fonts']):
    sys.exit(1)
