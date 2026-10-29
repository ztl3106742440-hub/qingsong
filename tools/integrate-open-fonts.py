"""Map the audited immutable intake to the app's hosted font catalog."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'references/font-candidates-20261029/collected'
report = json.loads((FOLDER / 'collection-report.json').read_text(encoding='utf-8'))
audit = {item['id']: item for item in json.loads((ROOT / 'artifacts/fonts/binary-audit.json').read_text(encoding='utf-8'))}
provenance = json.loads((ROOT / 'docs/SOURCE_PROVENANCE.json').read_text(encoding='utf-8'))
resources = {}
for family, original in provenance['extractedFonts'].items():
    resources[family] = {'file': 'fonts/' + family + '.woff2', 'format': 'woff2', 'sha256': original['sha256'],
                         'licenseFiles': ['licenses/FONT-NOTICES.txt'], 'originalEmbedded': True}
names = {
 'gf-edunswactfoundation': ('Edu NSW ACT Foundation', 'daily', '清楚的学校手写，适合日常句子；默认字重 400'),
 'gf-allura': ('Allura', 'natural', '流畅连笔，适合短句和英文摘抄'),
 'gf-sacramento': ('Sacramento', 'natural', '轻细自然的连笔，浅灰较淡时可提高深浅'),
 'gf-parisienne': ('Parisienne', 'natural', '带装饰笔意的连笔，长文建议先预览'),
 'gf-italianno': ('Italianno', 'natural', '舒展细笔，建议适当放大字形'),
 'gf-greatvibes': ('Great Vibes', 'art', '较多装饰笔势，适合艺术短句'),
 'gf-pinyonscript': ('Pinyon Script', 'art', '古典花体，上下伸出较长，注意行距'),
 'gf-tangerine': ('Tangerine', 'art', '细笔古典花体，建议放大字形并提高深浅'),
 'gf-petitformalscript': ('Petit Formal Script', 'art', '精细书法风格，适合较大字形短句'),
 'gf-arizonia': ('Arizonia', 'art', '个性连笔与签名笔势，长文建议先预览'),
}
extra = []
order = ['gf-edunswactfoundation', 'gf-allura', 'gf-sacramento', 'gf-parisienne', 'gf-italianno', 'gf-greatvibes', 'gf-pinyonscript', 'gf-tangerine', 'gf-petitformalscript', 'gf-arizonia']
records = {item['id']: item for item in report['fonts']}
for fid in order:
    item = records[fid]
    assert item['status'] == 'collected' and not audit[fid]['missing'] and item['fsType'] == 0
    name, group, description = names[fid]
    data = (FOLDER / item['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == item['sha256']
    target = ROOT / 'public/fonts' / item['file']
    target.write_bytes(data)
    license_path = 'licenses/google-fonts/' + fid + '-OFL.txt'
    license_target = ROOT / 'public' / license_path
    license_target.parent.mkdir(parents=True, exist_ok=True)
    license_target.write_bytes((FOLDER / (fid + '-OFL.txt')).read_bytes())
    resources[fid] = {'file': 'fonts/' + item['file'], 'format': 'truetype', 'sha256': item['sha256'],
        'licenseFiles': [license_path], 'licenseSha256': item['licenseSha256'], 'originalEmbedded': False,
        'sourceRepository': 'google/fonts', 'sourceCommit': item['sourceCommit'], 'sourcePath': item['sourcePath'],
        'sourceBlobSha1': item['sourceBlobSha1'], 'licenseBlobSha1': item['licenseBlobSha1'], 'spdx': 'OFL-1.1',
        'internalName': audit[fid]['postscriptName'], 'fontVersion': audit[fid]['version'],
        'publicationStatus': 'ready', 'verificationStatus': 'unverified'}
    extra.append({'id': fid, 'name': name, 'family': fid, 'kind': '站内', 'group': group, 'desc': description,
                  'sample': 'Practice makes progress.', 'defaultWeight': 400})
text = '// Canonical hosted font resources; original files and internal font names are preserved.\n'
text += 'export const FONT_RESOURCES = ' + json.dumps(resources, ensure_ascii=False, indent=2) + ';\n'
text += 'export const EXTRA_FONTS = ' + json.dumps(extra, ensure_ascii=False, indent=2) + ';\n'
(ROOT / 'content/font-resources.js').write_bytes(text.encode('utf-8'))
print('Prepared', len(extra), 'new fonts;', len(resources), 'hosted resources in total.')
