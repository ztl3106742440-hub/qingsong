import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { FONTS, PRESETS } from '../content/library.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const packageData = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const files = new Map();
files.set('index.html', Buffer.from((await readFile(resolve(root, 'src/index.html'), 'utf8')).replaceAll('__APP_VERSION__', packageData.version)));
for (const name of await readdir(resolve(root, 'src'))) {
  if (/\.(js|css)$/u.test(name)) files.set('assets/' + name, await readFile(resolve(root, 'src', name)));
}
files.set('assets/library.js', await readFile(resolve(root, 'content/library.js')));
for (const [path, data] of files) {
  const target = resolve(root, 'public', path);
  if (check) {
    if (!(await readFile(target)).equals(data)) throw new Error(`构建产物过期：${path}，请运行 npm run build`);
  } else { await mkdir(dirname(target), { recursive: true }); await writeFile(target, data); }
}
if (PRESETS.length !== 8 || !PRESETS.some(preset => preset.text.endsWith('使我不得开心颜。'))) throw new Error('原始诗文缺失');
const provenance = JSON.parse(await readFile(resolve(root, 'docs/SOURCE_PROVENANCE.json'), 'utf8'));
for (const font of [...FONTS.zh, ...FONTS.en].filter(font => font.kind === '内嵌')) {
  const bytes = await readFile(resolve(root, 'public/fonts', font.family + '.woff2'));
  if (bytes.toString('ascii', 0, 4) !== 'wOF2') throw new Error('字体格式错误：' + font.family);
  if (createHash('sha256').update(bytes).digest('hex') !== provenance.extractedFonts[font.family].sha256) throw new Error('字体被意外修改：' + font.family);
}
const html = files.get('index.html').toString();
if (/https?:\/\//u.test(html)) throw new Error('页面不应自动依赖外部资源');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/gu)) await readFile(resolve(root, 'public', match[1].split('?')[0]));
for (const file of ['licenses/FONT-NOTICES.txt', 'licenses/ARPHICPL.TXT', '.nojekyll']) await readFile(resolve(root, 'public', file));
const vendors = JSON.parse(await readFile(resolve(root, 'public/vendor/VERSIONS.json'), 'utf8'));
for (const vendor of vendors) {
  const bytes = await readFile(resolve(root, 'public/vendor', vendor.file));
  if (createHash('sha256').update(bytes).digest('hex') !== vendor.sha256) throw new Error('PDF 引擎哈希不符：' + vendor.file);
  await readFile(resolve(root, 'public/vendor', vendor.file + '.LICENSE.txt'));
}
async function publicFiles(folder, prefix = '') {
  const output = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) output.push(...await publicFiles(resolve(folder, entry.name), name + '/'));
    else if (name !== 'version.json') output.push(name);
  }
  return output.sort();
}
const hashes = {};
for (const file of await publicFiles(resolve(root, 'public'))) {
  const bytes = await readFile(resolve(root, 'public', file));
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
}
const version = Buffer.from(JSON.stringify({ application: 'qingsong', version: packageData.version, files: hashes }, null, 2) + '\n');
if (check) {
  if (!(await readFile(resolve(root, 'public/version.json'))).equals(version)) throw new Error('发布资源清单过期，请运行 npm run build');
} else await writeFile(resolve(root, 'public/version.json'), version);
console.log(`${check ? '构建一致性与资源检查通过' : '构建完成'}：${files.size} 个生成文件，5 个原始字体，8 个作品模板。`);
