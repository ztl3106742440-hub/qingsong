"""Publish this project's reviewed static release using the local Git credential helper.

Secrets stay in memory. This tool only targets the owner's qingsong repository.
"""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OWNER = 'ztl3106742440-hub'
REPOSITORY = 'qingsong'
SITE = f'https://{OWNER}.github.io/{REPOSITORY}/'
ENV = {**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GCM_INTERACTIVE': 'Never'}

def credential():
    process = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n', text=True, capture_output=True, timeout=25, env=ENV)
    values = dict(line.split('=', 1) for line in process.stdout.splitlines() if '=' in line)
    if not values.get('password'):
        raise RuntimeError('GitHub credential unavailable; authenticate with the local Git credential helper.')
    return values['password']

def api(method, path, data=None, allowed=()):
    request = urllib.request.Request('https://api.github.com' + path, method=method,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Authorization': 'Bearer ' + TOKEN, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Qingsong-Release', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        if error.code in allowed: return {'http_status': error.code}
        try: message = json.loads(error.read()).get('message', error.reason)
        except Exception: message = str(error.reason)
        raise RuntimeError(f'GitHub API {method} {path}: {error.code} {message}') from None

def git(*args):
    process = subprocess.run(['git', '-c', 'safe.directory=' + ROOT.as_posix(), '-C', str(ROOT), *args], capture_output=True, text=True, env=ENV)
    if process.returncode: raise RuntimeError(process.stderr.strip())
    return process.stdout.strip()

def verify_release():
    manifest = json.loads((ROOT / 'public/version.json').read_text(encoding='utf-8'))
    for name, expected in manifest['files'].items():
        assert hashlib.sha256((ROOT / 'public' / name).read_bytes()).hexdigest() == expected, name
    staged = git('ls-files', '-z').split('\0')
    forbidden = ['references/', 'artifacts/', 'node_modules/', '.env']
    for name in filter(None, staged):
        if any(name.startswith(prefix) for prefix in forbidden): raise RuntimeError('Private or generated QA file tracked: ' + name)
        if name.endswith('.json') and 'project' in Path(name).name.lower(): raise RuntimeError('Review possible personal project file: ' + name)
    if git('status', '--porcelain'): raise RuntimeError('Working tree must be committed and clean before publication')
    return manifest

if len(sys.argv) != 2 or sys.argv[1] not in ['publish', 'status', 'enable-pages', 'verify-site']:
    raise SystemExit('Usage: python tools/github-release.py publish|status|enable-pages|verify-site')
TOKEN = credential()
account = api('GET', '/user')
if account['login'] != OWNER: raise RuntimeError('Authenticated GitHub account does not match project owner')
command = sys.argv[1]
repo_path = f'/repos/{OWNER}/{REPOSITORY}'
if command == 'publish':
    manifest = verify_release()
    repo = api('GET', repo_path, allowed=(404,))
    if repo.get('http_status') == 404:
        repo = api('POST', '/user/repos', {'name': REPOSITORY, 'description': '清松：诗文与英文全文临摹字帖工作室，平板排版与 PDF 导出。', 'private': False, 'auto_init': False, 'homepage': SITE})
        print('Created repository:', repo['html_url'])
    elif repo.get('size', 0) != 0:
        raise RuntimeError('Repository already contains data; inspect it before publishing a new initial history')
    if repo.get('private'):
        raise RuntimeError('Existing repository is private; refusing to change visibility automatically')
    remotes = git('remote').splitlines()
    url = f'https://github.com/{OWNER}/{REPOSITORY}.git'
    if 'origin' not in remotes: git('remote', 'add', 'origin', url)
    elif git('remote', 'get-url', 'origin') != url: raise RuntimeError('Unexpected Git origin')
    print(git('push', '-u', 'origin', 'main'))
    print('Pushed reviewed release:', git('rev-parse', 'HEAD'), manifest['version'])
elif command == 'enable-pages':
    pages = api('GET', repo_path + '/pages', allowed=(404,))
    if pages.get('http_status') == 404: pages = api('POST', repo_path + '/pages', {'build_type': 'workflow'})
    elif pages.get('build_type') != 'workflow': raise RuntimeError('Existing Pages uses a different publishing configuration')
    api('POST', repo_path + '/actions/workflows/deploy.yml/dispatches', {'ref': 'main'})
    print(json.dumps({'site': pages.get('html_url', SITE), 'build_type': pages.get('build_type'), 'workflowDispatched': True}))
elif command == 'status':
    repo = api('GET', repo_path)
    pages = api('GET', repo_path + '/pages', allowed=(404,))
    runs = api('GET', repo_path + '/actions/runs?per_page=5')
    print(json.dumps({'repository': repo['html_url'], 'pages': {k: pages.get(k) for k in ['html_url', 'status', 'build_type', 'https_enforced']},
        'runs': [{k: run.get(k) for k in ['id', 'head_sha', 'status', 'conclusion', 'html_url']} for run in runs.get('workflow_runs', [])]}, ensure_ascii=False, indent=2))
elif command == 'verify-site':
    manifest = json.loads((ROOT / 'public/version.json').read_text(encoding='utf-8'))
    checked = []
    for name, expected in {**manifest['files'], 'version.json': hashlib.sha256((ROOT / 'public/version.json').read_bytes()).hexdigest()}.items():
        request = urllib.request.Request(SITE + name, headers={'User-Agent': 'Qingsong-Release-Verification', 'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=30) as response: data = response.read()
        if hashlib.sha256(data).hexdigest() != expected: raise RuntimeError('Published file does not match local release: ' + name)
        checked.append(name)
    result = {'site': SITE, 'matchingFiles': checked, 'passed': True, 'version': manifest['version']}
    (ROOT / 'artifacts/qa/public-hashes.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))
