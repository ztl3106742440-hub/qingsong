import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createServer } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch {
  const bundled = resolve(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  playwright = require(process.env.PLAYWRIGHT_MODULE || bundled);
}
const output = resolve(root, 'artifacts/qa');
await mkdir(output, { recursive: true });
const server = createServer();
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const localURL = `http://127.0.0.1:${server.address().port}/qingsong/`;
const baseURL = process.env.QA_URL || localURL;
const executablePath = process.env.CHROME_PATH || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await playwright.chromium.launch({ executablePath, headless: true });
const results = [];
const runtimeErrors = [];
const missing = [];
const report = { baseURL, generatedAt: new Date().toISOString(), environment: 'Desktop Chromium; tablet/phone CSS viewport and touch emulation; not real-device printing.', checks: results, pdfs: [], screenshots: [], runtimeErrors, missing };
async function check(name, run) { await run(); results.push({ name, passed: true }); console.log('PASS', name); }
async function ready(page) { await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 20000 }); }
async function set(page, id, value) {
  await page.locator('#' + id).evaluate((node, next) => { if (node.type === 'checkbox') node.checked = next; else node.value = next; node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  await page.waitForTimeout(160);
}
function observe(page) {
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(baseURL)) missing.push(response.url()); });
}
async function noOverflow(page) {
  const value = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  assert.ok(value.scroll <= value.width + 1, JSON.stringify(value));
}
async function noClippedRows(page) {
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.trace-line, .vertical-col')].flatMap(node => {
    if (node.offsetParent === null) return [];
    const child = node.querySelector('.trace-word') || node;
    const content = node.closest('.page-content');
    const a = node.getBoundingClientRect();
    const b = content.getBoundingClientRect();
    if (node.classList.contains('vertical-col')) return node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1 ? [node.textContent] : [];
    return child.scrollWidth > node.clientWidth + 1 || a.bottom > b.bottom + 1 ? [node.textContent] : [];
  }));
  assert.deepEqual(clipped, []);
}
async function savePDF(page, name, tail) {
  await page.evaluate(() => window.QINGSONG.preparePrint());
  const expectedPages = await page.locator('.paper').count();
  const state = await page.evaluate(() => window.QINGSONG.getState());
  const expectedRows = await page.locator('.paper').evaluateAll(papers => papers.map(paper => [...paper.querySelectorAll('.trace-word, .vertical-col')].map(node => node.textContent)));
  await page.pdf({ path: resolve(output, name + '.pdf'), preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  report.pdfs.push({ file: name + '.pdf', expectedPages, paperSize: state.paperSize, tail, expectedRows });
}

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  observe(page);
  await page.goto(baseURL);
  await ready(page);
  await check('子目录启动、5 套本地字体、长诗末句与重复完整', async () => {
    assert.match(await page.title(), /清松/);
    const fonts = await page.evaluate(() => [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family));
    assert.equal(new Set(fonts).size, 5);
    const text = (await page.locator('.page-content').allTextContents()).join('');
    assert.equal((text.match(/落月摇情满江树/g) || []).length, 2);
    await noOverflow(page);
    await noClippedRows(page);
  });
  await savePDF(page, 'spring-a4-portrait', '落月摇情满江树');
  await check('离线字体切换不改变控制栏滚动位置', async () => {
    await page.locator('.controls').evaluate(node => { node.scrollTop = 80; });
    const before = await page.locator('.controls').evaluate(node => node.scrollTop);
    await page.locator('[data-font="inksong"]').evaluate(node => node.click());
    await page.waitForFunction(() => window.QINGSONG.getState().font === 'inksong');
    assert.equal(await page.locator('.controls').evaluate(node => node.scrollTop), before);
  });
  await check('逐行/整篇重复顺序与深浅正确', async () => {
    await page.evaluate(() => window.QINGSONG.choosePreset('customzh'));
    await set(page, 'docText', '第一句\n第二句');
    await set(page, 'repeatCount', '3');
    let lines = await page.locator('.trace-word').allTextContents();
    assert.deepEqual(lines, ['第一句', '第一句', '第一句', '第二句', '第二句', '第二句']);
    await set(page, 'repeatMode', 'whole');
    assert.deepEqual(await page.locator('.trace-word').allTextContents(), ['第一句', '第二句', '第一句', '第二句', '第一句', '第二句']);
    await set(page, 'boldFirst', true);
    const colors = await page.locator('.trace-word').evaluateAll(nodes => nodes.map(node => node.style.color));
    assert.equal(colors[0], colors[1]);
    assert.notEqual(colors[1], colors[2]);
  });
  await check('JSON 导出、导入和刷新恢复本机设置', async () => {
    await set(page, 'docTitle', 'QA 本机方案');
    const downloaded = page.waitForEvent('download');
    await page.locator('#exportBtn').click();
    const file = await downloaded;
    const path = await file.path();
    const data = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(data.version, '4.3');
    assert.equal(data.docTitle, 'QA 本机方案');
    await set(page, 'docTitle', '临时标题');
    await page.locator('#projectUpload').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await page.waitForFunction(() => document.querySelector('#docTitle').value === 'QA 本机方案');
    await page.locator('#saveBtn').click();
    await page.reload();
    await ready(page);
    assert.equal(await page.locator('#docTitle').inputValue(), 'QA 本机方案');
  });
  await check('旧 V4 导入与非法 JSON 拒绝不会替换当前作品', async () => {
    await page.locator('#projectUpload').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 4, state: { lang: 'en', title: 'Legacy', contentEn: 'Legacy migration is complete.', paper: 'land' } })) });
    await page.waitForFunction(() => window.QINGSONG.getState().docTitle === 'Legacy');
    assert.equal(await page.locator('#paperSize').inputValue(), 'a4l');
    await page.locator('#projectUpload').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') });
    await page.waitForFunction(() => document.querySelector('#saveStatus').textContent.includes('导入失败'));
    assert.equal(await page.locator('#docTitle').inputValue(), 'Legacy');
  });
  await check('本地字体导入、取消/损坏字体不会替换当前字体', async () => {
    await page.locator('#fontUpload').setInputFiles(resolve(root, 'public/fonts/inkcomic.woff2'));
    await page.waitForFunction(() => window.QINGSONG.getState().font === 'InkCustom');
    await page.locator('#fontUpload').setInputFiles({ name: 'broken.woff2', mimeType: 'font/woff2', buffer: Buffer.from('broken') });
    await page.waitForFunction(() => document.querySelector('#saveStatus').textContent.includes('字体导入失败'));
    assert.equal(await page.evaluate(() => window.QINGSONG.getState().font), 'InkCustom');
  });
  await check('HTML 内容按文字显示，无法执行脚本', async () => {
    await set(page, 'docText', '<img src=x onerror="window.qaInjected=1">');
    assert.equal(await page.locator('.page-content img').count(), 0);
    assert.equal(await page.evaluate(() => window.qaInjected), undefined);
  });
  await check('联网字体失败时保留原字体并给出提示', async () => {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.evaluate(() => window.QINGSONG.choosePreset('enquote'));
    const previous = await page.evaluate(() => window.QINGSONG.getState().font);
    await page.locator('[data-font="Caveat"]').evaluate(node => node.click());
    await page.waitForFunction(() => document.querySelector('#saveStatus').textContent.includes('保留原字体'));
    assert.equal(await page.evaluate(() => window.QINGSONG.getState().font), previous);
  });
  await page.evaluate(() => window.QINGSONG.choosePreset('meng'));
  await set(page, 'paperSize', 'a4l');
  await set(page, 'repeatCount', '1');
  await noClippedRows(page);
  await savePDF(page, 'meng-a4-landscape', '使我不得开心颜');
  await page.evaluate(() => window.QINGSONG.choosePreset('spring'));
  await set(page, 'layoutMode', 'vertical');
  await set(page, 'paperSize', 'padp');
  await noClippedRows(page);
  await savePDF(page, 'spring-tablet-vertical', '落月摇情满江树');
  await page.evaluate(() => window.QINGSONG.choosePreset('enquote'));
  await set(page, 'paperSize', 'a5p');
  await noClippedRows(page);
  await savePDF(page, 'english-quotes-a5', 'give it your attention');
  await page.evaluate(() => window.QINGSONG.choosePreset('enessay'));
  await set(page, 'paperSize', 'padl');
  await noClippedRows(page);
  await savePDF(page, 'english-essay-tablet-landscape', 'act responsibly');
  await check('英文首个超长单词不会横向裁切', async () => {
    await set(page, 'docText', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(12));
    await noClippedRows(page);
    assert.equal((await page.locator('.trace-word').allTextContents()).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(12));
  });
  await check('关闭标题会隐藏标题和页码', async () => {
    await set(page, 'showTitle', false);
    assert.equal(await page.locator('.paper-head').first().isVisible(), false);
  });
  await context.close();

  for (const [name, width, height] of [['tablet-portrait', 768, 1024], ['tablet-landscape', 1180, 820], ['phone', 360, 800]]) {
    const device = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 901 });
    const screen = await device.newPage();
    observe(screen);
    await screen.goto(baseURL);
    await ready(screen);
    await check(`${name}：设置与预览无横向溢出，触控目标至少 44px`, async () => {
      await noOverflow(screen);
      const tiny = await screen.locator('button:visible, select:visible, input[type="range"]:visible').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height < 43.5).map(node => node.id || node.className));
      assert.deepEqual(tiny, []);
      if (width < 901) {
        await screen.screenshot({ path: resolve(output, name + '-settings.png'), fullPage: true });
        report.screenshots.push(name + '-settings.png');
        await screen.locator('#previewTab').click();
      }
      await noOverflow(screen);
      await noClippedRows(screen);
      await screen.screenshot({ path: resolve(output, name + '-preview.png'), fullPage: true });
      report.screenshots.push(name + '-preview.png');
    });
    if (name === 'tablet-portrait') {
      await screen.locator('#settingsTab').click();
      await savePDF(screen, 'tablet-settings-print', '落月摇情满江树');
    }
    await device.close();
  }
  if (!process.env.QA_URL) {
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
    const blockedPage = await blocked.newPage();
    observe(blockedPage);
    await blockedPage.goto(baseURL);
    await ready(blockedPage);
    await check('禁止本地存储时仍能制作字帖，并提示 JSON 备份', async () => {
      await blockedPage.locator('#saveBtn').click();
      assert.match(await blockedPage.locator('#saveStatus').textContent(), /JSON/);
      assert.ok(await blockedPage.locator('.paper').count() > 0);
    });
    await blocked.close();
  }
  assert.deepEqual(runtimeErrors, []);
  assert.deepEqual(missing, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
console.log(`浏览器验证通过：${results.length} 组交互与布局检查，${report.pdfs.length} 个实际 PDF。`);
