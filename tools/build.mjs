import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { FONTS, PRESETS } from '../content/library.js';
import { FONT_RESOURCES } from '../content/font-resources.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const packageData = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
function moduleBytes(source) {
  return Buffer.from(source.replace(/((?:from\s+|import\s*\(\s*)['"])(\.\/[a-z0-9-]+\.js)(['"])/gu,
    (_, prefix, path, quote) => `${prefix}${path}?v=${packageData.version}${quote}`));
}
const files = new Map();
files.set('index.html', Buffer.from((await readFile(resolve(root, 'src/index.html'), 'utf8')).replaceAll('__APP_VERSION__', packageData.version)));
for (const name of await readdir(resolve(root, 'src'))) {
  if (/\.(js|css)$/u.test(name)) {
    const source = await readFile(resolve(root, 'src', name));
    files.set('assets/' + name, name.endsWith('.js') ? moduleBytes(source.toString()) : source);
  }
}
files.set('assets/library.js', moduleBytes(await readFile(resolve(root, 'content/library.js'), 'utf8')));
files.set('assets/font-resources.js', moduleBytes(await readFile(resolve(root, 'content/font-resources.js'), 'utf8')));
const escapeHTML = value => String(value).replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const localFonts = [...FONTS.zh, ...FONTS.en].filter(font => FONT_RESOURCES[font.family]);
const licenseRows = localFonts.map(font => {
  const resource = FONT_RESOURCES[font.family];
  const links = resource.licenseFiles.map(file => `<a href="../${escapeHTML(file)}">原始许可</a>`).join(' · ');
  const source = resource.sourceRepository ? ` · <a href="https://github.com/google/fonts/blob/${resource.sourceCommit}/${encodeURI(resource.sourcePath)}" rel="noopener">官方来源</a>` : '';
  return `<li><strong>${escapeHTML(font.name)}</strong><p>${escapeHTML(resource.fontVersion || '原始内嵌字体')} · ${links}${source}</p></li>`;
}).join('\n');
files.set('licenses/index.html', Buffer.from(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>清松 · 字体来源与授权</title><style>body{font:16px/1.7 system-ui,sans-serif;max-width:850px;margin:32px auto;padding:0 20px;background:#f7f8f3;color:#214b3c}a{color:#236b50}li{padding:12px 0;border-bottom:1px solid #dbe5dd}p{margin:6px 0}small{color:#60796c}</style><a href="../">返回清松</a><h1>字体来源与授权</h1><p>清松提供 ${localFonts.length} 套站内字体。原始字体文件、内部名称、版权和许可证均予以保留。字体采用各自的原始许可，不属于清松新创作的字库。</p><p>联网候选仅在主动选择时请求外部服务；本地导入文件只在当前页面使用。站内提供字体不等于网站已具备断网冷启动能力。</p><ul>${licenseRows}</ul><small>应用版本 ${packageData.version}</small></html>\n`));
for (const [path, data] of files) {
  const target = resolve(root, 'public', path);
  if (check) {
    if (!(await readFile(target)).equals(data)) throw new Error(`构建产物过期：${path}，请运行 npm run build`);
  } else { await mkdir(dirname(target), { recursive: true }); await writeFile(target, data); }
}
if (PRESETS.length !== 8 || !PRESETS.some(preset => preset.text.endsWith('使我不得开心颜。'))) throw new Error('原始诗文缺失');
const provenance = JSON.parse(await readFile(resolve(root, 'docs/SOURCE_PROVENANCE.json'), 'utf8'));
for (const font of [...FONTS.zh, ...FONTS.en].filter(font => font.kind !== '联网')) {
  const resource = FONT_RESOURCES[font.family];
  if (!resource || !/^fonts\/[a-z0-9-]+\.(woff2|ttf)$/u.test(resource.file)) throw new Error('无效字体资源路径：' + font.family);
  const bytes = await readFile(resolve(root, 'public', resource.file));
  const signature = bytes.toString('hex', 0, 4);
  if (!['774f4632', '00010000', '4f54544f'].includes(signature)) throw new Error('字体格式错误：' + font.family);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== resource.sha256) throw new Error('字体被意外修改：' + font.family);
  if (resource.originalEmbedded && digest !== provenance.extractedFonts[font.family]?.sha256) throw new Error('原始字体来源不符：' + font.family);
  for (const license of resource.licenseFiles) {
    const data = await readFile(resolve(root, 'public', license));
    if (resource.licenseSha256 && createHash('sha256').update(data).digest('hex') !== resource.licenseSha256) throw new Error('原始许可被修改：' + font.family);
  }
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
console.log(`${check ? '构建一致性与资源检查通过' : '构建完成'}：${files.size} 个生成文件，${Object.keys(FONT_RESOURCES).length} 个站内字体（含 5 个原始字体），${PRESETS.length} 个作品模板。`);
