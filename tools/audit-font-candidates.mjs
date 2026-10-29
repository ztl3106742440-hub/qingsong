import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { PRESETS } from '../content/library.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = resolve(root, 'references/font-candidates-20261029/collected');
const report = JSON.parse(await readFile(resolve(folder, 'collection-report.json'), 'utf8'));
const context = {};
vm.runInNewContext(await readFile(resolve(root, 'public/vendor/fontkit.js'), 'utf8'), context);
const corpus = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.;:!?\'"()-' + PRESETS.filter(preset => preset.lang === 'en').map(preset => preset.text).join('\n');
const audit = [];
for (const record of report.fonts) {
  if (record.status !== 'collected') throw new Error(record.id + ' was not collected');
  const bytes = new Uint8Array(await readFile(resolve(folder, record.file)));
  const font = context.fontkit.create(bytes);
  const missing = [...new Set(Array.from(corpus).filter(char => !/\s/u.test(char) && !font.hasGlyphForCodePoint(char.codePointAt(0))))];
  const item = { id: record.id, postscriptName: font.postscriptName, familyName: font.familyName, version: font.version,
    glyphCount: font.numGlyphs, unicodeCount: font.characterSet.length, missing, variationAxes: font.variationAxes,
    extraPunctuationMissing: Array.from('“”‘’–—…').filter(char => !font.hasGlyphForCodePoint(char.codePointAt(0))),
    fsType: record.fsType, licensePreamble: record.licenseText.split('\n').slice(0, 12).join('\n') };
  audit.push(item);
  console.log(JSON.stringify(item));
}
await mkdir(resolve(root, 'artifacts/fonts'), { recursive: true });
await writeFile(resolve(root, 'artifacts/fonts/binary-audit.json'), JSON.stringify(audit, null, 2) + '\n');
if (audit.some(item => item.missing.length)) process.exitCode = 1;
