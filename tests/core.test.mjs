import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeState, importProject, documentEntries, wrapText, paginate, SIZES, MAX_TEXT_LENGTH } from '../src/core.js';

const base = { lang: 'zh', font: 'inkkai', preset: 'customzh', docTitle: '标题', docAuthor: '', docText: '甲乙\n丙丁', layoutMode: 'poem', paperSize: 'a4p', repeatMode: 'line', repeatCount: 2, ruling: 'none', fontSize: 6, lineSize: 13, traceOpacity: 36, letterSpace: .5, showTitle: true, boldFirst: false };
const measure = text => Array.from(text).length * 20;

test('逐行与整篇重复保留顺序和深色首遍标记', () => {
  assert.deepEqual(documentEntries(base), [{ text: '甲乙', index: 0 }, { text: '甲乙', index: 1 }, { text: '丙丁', index: 0 }, { text: '丙丁', index: 1 }]);
  assert.deepEqual(documentEntries({ ...base, repeatMode: 'whole' }).map(row => row.text), ['甲乙', '丙丁', '甲乙', '丙丁']);
});
test('所有五种纸张完整分页、保持字符数量与页容量', () => {
  for (const paperSize of Object.keys(SIZES)) {
    const state = { ...base, paperSize, docText: '长诗末句。\n'.repeat(90), repeatCount: 5 };
    for (const layoutMode of ['poem', 'vertical']) {
      const result = paginate({ ...state, layoutMode }, measure);
      const text = result.pages.flat().map(row => row.text).join('').replace(/\s/gu, '');
      assert.equal(text, '长诗末句。'.repeat(450));
      assert.ok(result.pages.length > 1);
      const count = result.pages[0].length;
      assert.ok(result.pages.every(page => page.length <= count));
    }
  }
});
test('英文优先按单词换行，首个超长单词也会分割', () => {
  assert.deepEqual(wrapText('Hello world again', 70, text => text.length * 10, true), ['Hello', 'world', 'again']);
  const token = 'abcdefghijklmnopqrstuvwxy';
  const lines = wrapText(token, 50, text => text.length * 10, true);
  assert.equal(lines.join(''), token);
  assert.ok(lines.every(line => line.length <= 5));
});
test('中文与非 BMP 字符断行不丢字、不切开代理对', () => {
  const input = '春江🌙花月𠮷夜';
  const lines = wrapText(input, 40, measure, false);
  assert.equal(lines.join(''), input);
  assert.ok(lines.every(line => Array.from(line).length <= 2));
});
test('恶意或异常 JSON 不能注入任意设置或破坏数值计算', () => {
  const value = sanitizeState({ ...base, fontSize: -100, lineSize: Infinity, traceOpacity: 10000, repeatCount: 3.6, lang: 'unknown', paperSize: '__proto__', layoutMode: 'oops', showTitle: 'false', docText: '<img src=x onerror=alert(1)>', unexpected: 'ignored' }, base);
  assert.equal(value.fontSize, 3.5);
  assert.equal(value.lineSize, 13);
  assert.equal(value.traceOpacity, 85);
  assert.equal(value.repeatCount, 4);
  assert.equal(value.lang, 'zh');
  assert.equal(value.paperSize, 'a4p');
  assert.equal(value.showTitle, true);
  assert.equal(value.docText, '<img src=x onerror=alert(1)>');
  assert.equal(value.unexpected, undefined);
});
test('拒绝无法识别的项目及超长正文，不污染默认配置', () => {
  for (const value of [null, [], {}, { version: '99' }, { version: 4, state: [] }]) assert.throws(() => importProject(value, base));
  assert.throws(() => sanitizeState({ docText: '字'.repeat(MAX_TEXT_LENGTH + 1) }, base), /正文最多/);
  assert.equal(base.docText, '甲乙\n丙丁');
});
test('INKFLOW 4.3 方案往返保留已知配置', () => {
  assert.deepEqual(importProject({ version: '4.3', ...base }, base), { state: base, migrated: false });
});
test('旧 V4 中英文内容和纸张迁移，重复次数合法化', () => {
  const imported = importProject({ version: 4, state: { lang: 'en', title: 'Old', contentEn: 'Keep learning.', paper: 'land', trace: 99, opacity: '22' } }, base);
  assert.equal(imported.migrated, true);
  assert.equal(imported.state.docText, 'Keep learning.');
  assert.equal(imported.state.font, 'inkcomic');
  assert.equal(imported.state.repeatCount, 5);
  assert.equal(imported.state.paperSize, 'a4l');
  assert.equal(imported.state.traceOpacity, 22);
});
test('隐藏页头后使用释放的空间，空内容仍保留一张纸', () => {
  const content = { ...base, docText: '一行\n'.repeat(80) };
  assert.ok(paginate({ ...content, showTitle: false }, measure).pages.length < paginate(content, measure).pages.length);
  assert.deepEqual(paginate({ ...base, docText: '' }, measure).pages, [[]]);
});
test('极端页数明确拒绝，不能默默截断内容', () => {
  assert.throws(() => paginate({ ...base, docText: '字\n'.repeat(10000), repeatCount: 5, paperSize: 'a5p', lineSize: 22 }, measure), /超过 500 页/);
});
