import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { FONT_RESOURCES, EXTRA_FONTS } from '../content/font-resources.js';
import { FONTS, PRESETS } from '../content/library.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('字体目录只公开已有基础字库和已接收的 Google Fonts 候选', () => {
  assert.equal(EXTRA_FONTS.length, 10);
  assert.equal(new Set(EXTRA_FONTS.map(font => font.id)).size, EXTRA_FONTS.length);
  assert.ok(EXTRA_FONTS.every(font => font.id.startsWith('gf-') && FONTS.en.some(item => item.family === font.family)));
  assert.ok(!Object.keys(FONT_RESOURCES).some(id => /^(fz-|yegenyou-|adobe-|hanyi-|chen-)/u.test(id)));
});
test('新字体和原始许可证保持固定来源、真实 SHA-256 和未核验元数据状态', async () => {
  for (const font of EXTRA_FONTS) {
    const resource = FONT_RESOURCES[font.family];
    assert.equal(resource.sourceRepository, 'google/fonts');
    assert.match(resource.sourceCommit, /^[a-f0-9]{40}$/u);
    assert.match(resource.file, /^fonts\/gf-[a-z0-9-]+\.ttf$/u);
    assert.equal(resource.verificationStatus, 'unverified');
    const binary = await readFile(resolve(root, 'public', resource.file));
    assert.equal(createHash('sha256').update(binary).digest('hex'), resource.sha256);
    const license = await readFile(resolve(root, 'public', resource.licenseFiles[0]));
    assert.equal(createHash('sha256').update(license).digest('hex'), resource.licenseSha256);
    assert.match(license.toString('utf8'), /SIL OPEN FONT LICENSE/u);
  }
});
test('新增字体覆盖完整英文作品、大小写字母和常用标点，嵌入标志无受限位', async () => {
  const context = {};
  vm.runInNewContext(await readFile(resolve(root, 'public/vendor/fontkit.js'), 'utf8'), context);
  const corpus = PRESETS.filter(item => item.lang === 'en').map(item => item.text).join('') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.;:!? “words” — it’s progress…';
  for (const font of EXTRA_FONTS) {
    const binary = await readFile(resolve(root, 'public', FONT_RESOURCES[font.family].file));
    const parsed = context.fontkit.create(new Uint8Array(binary));
    const missing = [...new Set(Array.from(corpus).filter(char => !/\s/u.test(char) && !parsed.hasGlyphForCodePoint(char.codePointAt(0))))];
    assert.deepEqual(missing, [], font.name);
    for (let index = 0; index < binary.readUInt16BE(4); index++) {
      const offset = 12 + index * 16;
      if (binary.toString('ascii', offset, offset + 4) === 'OS/2') {
        assert.equal(binary.readUInt16BE(binary.readUInt32BE(offset + 8) + 8), 0, font.name);
      }
    }
  }
});
test('所有站内字体具有显式格式和路径，英文用途完整，原五套字库仍在', () => {
  for (const family of ['inkkai', 'inksong', 'inkcomic', 'inkz003', 'inklobster']) assert.equal(FONT_RESOURCES[family].originalEmbedded, true);
  for (const font of [...FONTS.zh, ...FONTS.en].filter(item => item.kind !== '联网')) {
    assert.ok(FONT_RESOURCES[font.family]?.format, font.family);
    assert.ok(FONT_RESOURCES[font.family]?.licenseFiles.length, font.family);
  }
  assert.deepEqual([...new Set(EXTRA_FONTS.map(font => font.group))].sort(), ['art', 'daily', 'natural']);
});
