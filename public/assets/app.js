import { FONTS, PRESETS } from './library.js';
import { sanitizeState, importProject, paginate, mmToPx } from './core.js';

const $ = id => document.getElementById(id);
const STORE_KEY = 'qingsong_project';
const defaults = {
  lang: 'zh', font: 'inkkai', preset: 'spring', docTitle: '春江花月夜', docAuthor: '张若虚 · 唐',
  docText: PRESETS[0].text, layoutMode: 'poem', paperSize: 'a4p', repeatMode: 'line', repeatCount: 2,
  ruling: 'none', fontSize: 6, lineSize: 13, traceOpacity: 36, letterSpace: .5, showTitle: true, boldFirst: false,
};
const textFields = ['docTitle', 'docAuthor', 'docText', 'preset', 'layoutMode', 'paperSize', 'repeatMode', 'ruling'];
const numberFields = ['repeatCount', 'fontSize', 'lineSize', 'traceOpacity', 'letterSpace'];
let state = { ...defaults };
let customFont = null;
let renderTimer;
let fontRequest = 0;
let customRequest = 0;
let view = 'controls';
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
const readyFonts = new Set();
const family = () => `"${state.font}"`;
const status = message => { $('saveStatus').textContent = message; };
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function syncLabels() {
  for (const key of ['fontSize', 'lineSize', 'traceOpacity', 'letterSpace']) $(key + 'Label').textContent = state[key] + (key === 'traceOpacity' ? '%' : 'mm');
}
function syncUI() {
  for (const key of [...textFields, ...numberFields]) $(key).value = state[key];
  for (const key of ['showTitle', 'boldFirst']) $(key).checked = state[key];
  for (const button of document.querySelectorAll('[data-lang]')) {
    const active = button.dataset.lang === state.lang;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  syncLabels();
  renderFontCards();
}
function readControls() {
  const next = { ...state };
  for (const key of textFields) next[key] = $(key).value;
  for (const key of numberFields) next[key] = Number($(key).value);
  for (const key of ['showTitle', 'boldFirst']) next[key] = $(key).checked;
  state = sanitizeState(next, defaults);
  syncLabels();
}
function showView(next) {
  view = next;
  document.querySelector('.layout').dataset.view = next;
  for (const [id, value] of [['settingsTab', 'controls'], ['previewTab', 'preview']]) {
    $(id).classList.toggle('active', next === value);
    $(id).setAttribute('aria-pressed', String(next === value));
  }
  if (next === 'preview') requestAnimationFrame(fitPreview);
}
function renderFontCards() {
  const host = $('fontcards');
  host.replaceChildren();
  for (const font of FONTS[state.lang]) {
    const button = element('button', 'fontcard' + (state.font === font.family ? ' selected' : ''));
    button.type = 'button';
    button.dataset.font = font.family;
    button.setAttribute('aria-pressed', String(state.font === font.family));
    const loaded = font.kind !== '联网' || readyFonts.has(font.family);
    const sample = element('span', 'fontsample', loaded ? font.sample : '联网字体 · 点击加载');
    if (loaded) sample.style.fontFamily = `"${font.family}"`;
    else sample.style.fontSize = '16px';
    const name = element('span', 'fontname', font.name);
    name.append(element('span', 'flag', font.kind === '内嵌' ? '离线' : font.kind));
    button.append(sample, name, element('span', 'fontdesc', font.desc));
    button.addEventListener('click', () => chooseFont(font));
    host.append(button);
  }
  if (state.font === 'InkCustom') host.prepend(element('div', 'notice', '当前本地字体：' + customFont.name));
}
async function ensureFont(fontFamily = state.font) {
  if (fontFamily === 'InkCustom') return;
  const font = [...FONTS.zh, ...FONTS.en].find(item => item.family === fontFamily);
  const loaded = await document.fonts.load(`24px "${fontFamily}"`, font?.sample || '清松 Practice');
  if (!loaded.length || !loaded.every(face => face.status === 'loaded')) throw new Error('字体未成功加载，请刷新重试或选择其他字体');
  readyFonts.add(fontFamily);
}
async function loadOnlineFont(font) {
  if (readyFonts.has(font.family)) return;
  const link = element('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(font.family).replaceAll('%20', '+') + '&display=swap';
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        link.onload = () => ensureFont(font.family).then(resolve, reject);
        link.onerror = () => reject(new Error('字体网络请求失败'));
        document.head.append(link);
      }),
      new Promise((_, reject) => { link._timeout = setTimeout(() => reject(new Error('字体加载超时')), 8000); }),
    ]);
  } catch (error) {
    link.remove();
    readyFonts.delete(font.family);
    throw error;
  } finally { clearTimeout(link._timeout); }
}
async function chooseFont(font) {
  const request = ++fontRequest;
  const language = state.lang;
  status(font.kind === '联网' ? '正在加载联网字体…' : '正在应用字体…');
  try {
    if (font.kind === '联网') await loadOnlineFont(font);
    else await ensureFont(font.family);
    if (request !== fontRequest || language !== state.lang) return;
    state.font = font.family;
    renderFontCards();
    renderPages();
    status('已应用：' + font.name);
  } catch (error) {
    if (request === fontRequest) status(error.message + '；保留原字体');
  }
}
function selectPreset(id) {
  const preset = PRESETS.find(item => item.id === id);
  if (!preset) return;
  ++fontRequest;
  const changedLanguage = state.lang !== preset.lang;
  state = { ...state, lang: preset.lang, preset: preset.id, docTitle: preset.title, docAuthor: preset.author, docText: preset.text, layoutMode: preset.mode };
  if (changedLanguage || !FONTS[state.lang].some(font => font.family === state.font)) {
    state.font = state.lang === 'en' ? 'inkcomic' : 'inkkai';
  }
  if (changedLanguage) Object.assign(state, state.lang === 'en' ? { fontSize: 5.2, lineSize: 12.5, ruling: 'none' } : { fontSize: 6, lineSize: 13, ruling: 'none' });
  syncUI();
  renderPages();
  ensureFont().then(renderPages).catch(error => status(error.message));
}
function paperShell(index, total, size) {
  const paper = element('div', 'paper' + (state.showTitle ? '' : ' no-title'));
  paper.style.width = size[0] + 'mm';
  paper.style.height = size[1] + 'mm';
  const inner = element('div', 'paper-inner');
  const head = element('div', 'paper-head');
  const heading = element('div');
  heading.append(element('h3', '', state.docTitle || '未命名作品'), element('p', '', state.docAuthor || 'HANDWRITING PRACTICE'));
  const info = element('div', 'pageinfo', '清松 / QINGSONG');
  info.append(element('br'), element('span', 'pageno', `${index + 1} / ${total}`));
  head.append(heading, info);
  const content = element('div', 'page-content');
  const foot = element('div', 'page-foot');
  foot.append(element('span', '', '全文描红 · WRITE OVER THE LETTERS'), element('span', '', state.layoutMode === 'vertical' ? 'VERTICAL' : 'FULL TEXT'));
  inner.append(head, content, foot);
  paper.append(inner);
  return paper;
}
function renderPages() {
  try {
    context.font = `${mmToPx(state.fontSize)}px ${family()}`;
    const gap = mmToPx(state.letterSpace);
    const measure = text => context.measureText(text).width + Math.max(0, Array.from(text).length - 1) * gap;
    const result = paginate(state, measure);
    const fragment = document.createDocumentFragment();
    result.pages.forEach((entries, index) => {
      const frame = element('div', 'paper-frame');
      const paper = paperShell(index, result.pages.length, result.size);
      const content = paper.querySelector('.page-content');
      const vertical = state.layoutMode === 'vertical';
      content.classList.toggle('vertical', vertical);
      for (const entry of entries) {
        const item = element('div', vertical ? 'vertical-col' : 'trace-line' + (state.ruling === 'line' ? ' guide' : state.ruling === 'four' ? ' four' : ''));
        const text = vertical ? item : element('span', 'trace-word');
        text.textContent = entry.text || '\u00a0';
        text.style.fontFamily = family();
        text.style.fontSize = state.fontSize + 'mm';
        text.style.letterSpacing = state.letterSpace + 'mm';
        text.style.color = entry.index === 0 && state.boldFirst ? '#4c6256' : `rgba(36,49,42,${state.traceOpacity / 100})`;
        if (vertical) {
          item.style.width = result.columnPitch + 'mm';
          item.style.flex = '0 0 ' + result.columnPitch + 'mm';
        } else {
          item.style.height = result.rowHeight + 'mm';
          item.style.justifyContent = state.layoutMode === 'poem' ? 'center' : 'flex-start';
          item.append(text);
        }
        content.append(item);
      }
      frame.append(paper);
      fragment.append(frame);
    });
    $('papers').replaceChildren(fragment);
    $('pagesize').textContent = `@page{size:${result.size[0]}mm ${result.size[1]}mm;margin:0}`;
    $('status').textContent = `${state.lang === 'zh' ? '中文' : 'English'} · ${result.pages.length} 页 · ${result.entryCount} 行（含重复）`;
    $('pageCount').textContent = `· ${result.pages.length} 页`;
    $('printBtn').disabled = false;
    $('papers').dataset.valid = 'true';
    fitPreview();
  } catch (error) {
    status(error.message);
    $('status').textContent = '排版未完成，请调整设置';
    $('printBtn').disabled = true;
    $('papers').dataset.valid = 'false';
    throw error;
  }
}
function fitPreview() {
  const host = $('papers');
  if (!host.clientWidth) return;
  for (const frame of host.children) {
    const paper = frame.firstElementChild;
    const scale = Math.min(1, (host.clientWidth - 2) / paper.offsetWidth);
    frame.style.width = paper.offsetWidth * scale + 'px';
    frame.style.height = paper.offsetHeight * scale + 'px';
    paper.style.transform = `scale(${scale})`;
  }
}
function refresh() {
  clearTimeout(renderTimer);
  try { readControls(); renderPages(); }
  catch (error) { status(error.message); $('printBtn').disabled = true; $('papers').dataset.valid = 'false'; }
}
function reconcileFont(next) {
  const known = FONTS[next.lang].find(font => font.family === next.font);
  if (!known || (known.kind === '联网' && !readyFonts.has(known.family))) {
    next.font = next.lang === 'en' ? 'inkcomic' : 'inkkai';
    return '；原字体需重新选择或导入，已使用基础字体';
  }
  return '';
}
async function applyProject(project) {
  const imported = importProject(project, defaults);
  const note = reconcileFont(imported.state);
  if (!PRESETS.some(preset => preset.id === imported.state.preset)) imported.state.preset = imported.state.lang === 'en' ? 'customen' : 'customzh';
  await ensureFont(imported.state.font);
  ++fontRequest;
  state = imported.state;
  syncUI();
  renderPages();
  status((imported.migrated ? '旧项目文字与基本设置已迁移' : '项目已载入') + note);
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function preparePrint() {
  refresh();
  if ($('papers').dataset.valid !== 'true') throw new Error('请先修正内容或排版设置');
  await ensureFont();
  await document.fonts.ready;
  renderPages();
}
function bind() {
  $('settingsTab').addEventListener('click', () => showView('controls'));
  $('previewTab').addEventListener('click', () => showView('preview'));
  for (const button of document.querySelectorAll('[data-lang]')) button.addEventListener('click', () => {
    if (button.dataset.lang !== state.lang) selectPreset(button.dataset.lang === 'en' ? 'enquote' : 'spring');
  });
  $('preset').addEventListener('change', event => selectPreset(event.target.value));
  for (const key of ['docTitle', 'docAuthor', 'docText']) $(key).addEventListener('input', () => {
    state.preset = state.lang === 'en' ? 'customen' : 'customzh';
    $('preset').value = state.preset;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(refresh, 120);
  });
  for (const key of ['layoutMode', 'paperSize', 'repeatMode', ...numberFields, 'ruling', 'showTitle', 'boldFirst']) $(key).addEventListener('input', refresh);
  $('fontUpload').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const request = ++customRequest;
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('字体文件超过 30 MB');
      const face = new FontFace('InkCustom', await file.arrayBuffer());
      await face.load();
      if (request !== customRequest) return;
      if (customFont) document.fonts.delete(customFont.face);
      document.fonts.add(face);
      customFont = { face, name: file.name };
      ++fontRequest;
      state.font = 'InkCustom';
      renderFontCards();
      renderPages();
      status('本地字体已加载；换设备或刷新后需重新导入');
    } catch (error) { status('字体导入失败：' + error.message); }
    event.target.value = '';
  });
  $('saveBtn').addEventListener('click', () => {
    try {
      readControls();
      localStorage.setItem(STORE_KEY, JSON.stringify({ version: '4.3', application: 'qingsong', ...state }));
      status('已保存到当前浏览器' + (state.font === 'InkCustom' ? '；本地字体需重新导入' : ''));
    } catch (error) { status('保存失败：' + error.message + '；请导出项目 JSON 备份'); }
  });
  $('importBtn').addEventListener('click', () => $('projectUpload').click());
  $('projectUpload').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('项目文件超过 2 MB');
      await applyProject(JSON.parse(await file.text()));
    } catch (error) { status('项目导入失败：' + error.message); }
    event.target.value = '';
  });
  $('exportBtn').addEventListener('click', () => {
    try {
      readControls();
      const project = { version: '4.3', application: 'qingsong', ...state };
      downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `清松_项目_${new Date().toISOString().slice(0, 10)}.json`);
      status('项目已导出；字体文件需另外保留');
    } catch (error) { status('导出失败：' + error.message); }
  });
  $('printBtn').addEventListener('click', async () => {
    try {
      $('printBtn').disabled = true;
      status('正在准备 PDF…');
      await preparePrint();
      status('请选择另存为 PDF；平板也可通过浏览器菜单 → 分享 → 打印');
      window.print();
    } catch (error) { status('无法打印：' + error.message); }
    finally { $('printBtn').disabled = $('papers').dataset.valid !== 'true'; }
  });
  window.addEventListener('beforeprint', refresh);
  window.addEventListener('afterprint', fitPreview);
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); $('saveBtn').click(); }
  });
  new ResizeObserver(fitPreview).observe($('papers'));
  document.fonts.addEventListener('loadingdone', () => { try { renderPages(); } catch {} });
}

async function start() {
  for (const preset of PRESETS) {
    const option = element('option', '', preset.label);
    option.value = preset.id;
    $('preset').append(option);
  }
  let restoreMessage = '';
  try {
    const saved = localStorage.getItem(STORE_KEY) || localStorage.getItem('inkflow043_project');
    if (saved) {
      state = importProject(JSON.parse(saved), defaults).state;
      restoreMessage = '已恢复本机保存的设置' + reconcileFont(state);
      if (!PRESETS.some(preset => preset.id === state.preset)) state.preset = state.lang === 'en' ? 'customen' : 'customzh';
    }
  } catch { restoreMessage = '本机设置无法恢复，可通过项目 JSON 导入'; }
  syncUI();
  bind();
  await Promise.all([...FONTS.zh, ...FONTS.en].filter(font => font.kind === '内嵌').map(font => ensureFont(font.family)));
  await document.fonts.ready;
  renderPages();
  status(restoreMessage || '清松已就绪 · 文字与设置仅保存在本机');
  document.documentElement.dataset.ready = 'true';
}
window.QINGSONG = { getState: () => structuredClone(state), getPages: () => document.querySelectorAll('.paper').length, choosePreset: selectPreset, render: renderPages, preparePrint, importProject: applyProject };
window.INKFLOW = window.QINGSONG;
start().catch(error => { status('初始化失败：' + error.message + '；请刷新或检查字体文件'); console.error(error); });
