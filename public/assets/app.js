import { FONTS, PRESETS } from './library.js?v=0.3.0';
import { FONT_RESOURCES } from './font-resources.js?v=0.3.0';
import { sanitizeState, importProject, paginate, mmToPx } from './core.js?v=0.3.0';

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
const viewScrolls = { controls: 0, preview: 0 };
let pdfURL;
let exportInProgress = false;
let latestLayout;
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
const readyFonts = new Set();
const loadingFonts = new Map();
let previewObserver;
let fontGroup = 'all';
const groupNames = { daily: '日常清晰', natural: '自然连笔', art: '艺术花体', online: '联网候选' };
function groupFor(font) {
  if (font.kind === '联网') return 'online';
  return font.group || ({ inkcomic: 'daily', inkz003: 'natural', inklobster: 'art' })[font.family] || 'daily';
}
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
  if (exportInProgress) return;
  viewScrolls[view] = window.scrollY;
  view = next;
  document.querySelector('.layout').dataset.view = next;
  for (const [id, value] of [['settingsTab', 'controls'], ['previewTab', 'preview']]) {
    $(id).classList.toggle('active', next === value);
    $(id).setAttribute('aria-pressed', String(next === value));
  }
  requestAnimationFrame(() => {
    if (next === 'preview') fitPreview();
    if (getComputedStyle(document.querySelector('.view-tabs')).display !== 'none') window.scrollTo(0, viewScrolls[next]);
  });
}
function renderFontCards() {
  const host = $('fontcards');
  previewObserver?.disconnect();
  host.replaceChildren();
  let filters = $('fontFilters');
  if (!filters) {
    filters = element('div', 'row font-filters');
    filters.id = 'fontFilters';
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', '按用途筛选英文字体');
    host.before(filters);
  }
  filters.replaceChildren();
  filters.hidden = state.lang !== 'en';
  if (state.lang === 'en') {
    for (const [value, label] of Object.entries({ all: '全部', ...groupNames })) {
      const button = element('button', 'pill' + (fontGroup === value ? ' active' : ''), label);
      button.dataset.fontGroup = value;
      button.setAttribute('aria-pressed', String(fontGroup === value));
      button.addEventListener('click', () => { fontGroup = value; renderFontCards(); });
      filters.append(button);
    }
  }
  previewObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      previewObserver.unobserve(entry.target);
      const button = entry.target;
      const font = FONTS[state.lang].find(item => item.family === button.dataset.font);
      if (!font || !FONT_RESOURCES[font.family]) continue;
      ensureFont(font.family).then(() => {
        if (!button.isConnected) return;
        const sample = button.querySelector('.fontsample');
        sample.textContent = font.sample;
        sample.style.fontFamily = `"${font.family}"`;
        sample.style.fontSize = '';
      }).catch(() => {
        if (button.isConnected) button.querySelector('.fontsample').textContent = '预览未加载 · 点击重试';
      });
    }
  }, { rootMargin: '120px' });
  let visible = FONTS[state.lang].filter(font => state.lang !== 'en' || fontGroup === 'all' || groupFor(font) === fontGroup);
  if (state.lang === 'en') visible = visible.slice().sort((a, b) => Object.keys(groupNames).indexOf(groupFor(a)) - Object.keys(groupNames).indexOf(groupFor(b)));
  let previousGroup;
  for (const font of visible) {
    const group = groupFor(font);
    if (state.lang === 'en' && group !== previousGroup) {
      host.append(element('h3', 'fontgroup-title', groupNames[group]));
      previousGroup = group;
    }
    const button = element('button', 'fontcard' + (state.font === font.family ? ' selected' : ''));
    button.type = 'button';
    button.dataset.font = font.family;
    button.setAttribute('aria-pressed', String(state.font === font.family));
    const loaded = readyFonts.has(font.family);
    const sample = element('span', 'fontsample', loaded ? font.sample : font.kind === '联网' ? '联网字体 · 点击加载' : '字体预览加载中…');
    if (loaded) sample.style.fontFamily = `"${font.family}"`;
    else sample.style.fontSize = '16px';
    const name = element('span', 'fontname', font.name);
    name.append(element('span', 'flag', font.kind === '联网' ? '联网' : '站内'));
    button.append(sample, name, element('span', 'fontdesc', font.desc));
    button.addEventListener('click', () => chooseFont(font));
    host.append(button);
    if (!loaded && FONT_RESOURCES[font.family]) previewObserver.observe(button);
  }
  if (state.font === 'InkCustom') host.prepend(element('div', 'notice', '当前本地字体：' + customFont.name));
}
async function ensureFont(fontFamily = state.font) {
  if (fontFamily === 'InkCustom') return;
  if (readyFonts.has(fontFamily)) return;
  if (loadingFonts.has(fontFamily)) return loadingFonts.get(fontFamily);
  const font = [...FONTS.zh, ...FONTS.en].find(item => item.family === fontFamily);
  const task = (async () => {
    const resource = FONT_RESOURCES[fontFamily];
    const exists = [...document.fonts].some(face => face.family.replaceAll('"', '') === fontFamily);
    if (resource && !exists) {
      const url = new URL('../' + resource.file, import.meta.url).href;
      const face = new FontFace(fontFamily, `url("${url}") format("${resource.format}")`, { weight: '400' });
      await face.load();
      document.fonts.add(face);
    }
    const loaded = await document.fonts.load(`24px "${fontFamily}"`, font?.sample || '清松 Practice');
    if (!loaded.length || !loaded.every(face => face.status === 'loaded')) throw new Error('字体未成功加载，请刷新重试或选择其他字体');
    readyFonts.add(fontFamily);
  })().finally(() => loadingFonts.delete(fontFamily));
  loadingFonts.set(fontFamily, task);
  return task;
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
  if (changedLanguage) fontGroup = 'all';
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
    $('pdfDownload').hidden = true;
    context.font = `${mmToPx(state.fontSize)}px ${family()}`;
    const gap = mmToPx(state.letterSpace);
    const measure = text => {
      const metrics = context.measureText(text);
      const inkWidth = Math.max(metrics.width, metrics.actualBoundingBoxRight || 0) + Math.max(0, metrics.actualBoundingBoxLeft || 0);
      return inkWidth + Math.max(0, Array.from(text).length - 1) * gap;
    };
    const result = paginate(state, measure);
    latestLayout = result;
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
    $('printBtn').disabled = exportInProgress;
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
      const bytes = await file.arrayBuffer();
      const face = new FontFace('InkCustom', bytes);
      await face.load();
      if (request !== customRequest) return;
      if (customFont) document.fonts.delete(customFont.face);
      document.fonts.add(face);
      customFont = { face, name: file.name, bytes };
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
    if (exportInProgress) return;
    exportInProgress = true;
    document.documentElement.dataset.exporting = 'true';
    $('controls').inert = true;
    for (const id of ['printBtn', 'saveBtn', 'importBtn', 'exportBtn', 'settingsTab', 'previewTab']) $(id).disabled = true;
    try {
      status('正在准备 PDF…');
      await preparePrint();
      const { createPDF } = await import('./pdf-export.js?v=0.3.0');
      const bytes = await createPDF(structuredClone(state), latestLayout, { customFont, fonts: FONTS, onProgress: status });
      if (pdfURL) URL.revokeObjectURL(pdfURL);
      pdfURL = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const title = (state.docTitle || '临摹字帖').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_').slice(0, 80);
      const link = $('pdfDownloadLink');
      link.href = pdfURL;
      link.download = `清松_${title}.pdf`;
      link.textContent = `下载 PDF · ${latestLayout.pages.length} 页`;
      $('pdfDownload').hidden = false;
      link.click();
      status(`已生成 ${latestLayout.pages.length} 页 PDF；若未自动保存，请点“下载 PDF”`);
    } catch (error) { status('导出失败：' + error.message); }
    finally {
      exportInProgress = false;
      delete document.documentElement.dataset.exporting;
      $('controls').inert = false;
      for (const id of ['saveBtn', 'importBtn', 'exportBtn', 'settingsTab', 'previewTab']) $(id).disabled = false;
      $('printBtn').disabled = $('papers').dataset.valid !== 'true';
    }
  });
  $('browserPrintBtn').addEventListener('click', async () => {
    try { await preparePrint(); window.print(); }
    catch (error) { status('无法打印：' + error.message); }
  });
  window.addEventListener('beforeprint', refresh);
  window.addEventListener('afterprint', fitPreview);
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); $('saveBtn').click(); }
  });
  new ResizeObserver(fitPreview).observe($('papers'));
  document.fonts.addEventListener('loadingdone', event => {
    if (event.fontfaces.some(face => face.family.replaceAll('"', '') === state.font)) {
      try { renderPages(); } catch {}
    }
  });
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
  await ensureFont();
  await document.fonts.ready;
  renderFontCards();
  renderPages();
  status(restoreMessage || '清松已就绪 · 文字与设置仅保存在本机');
  document.documentElement.dataset.ready = 'true';
}
window.QINGSONG = { getState: () => structuredClone(state), getPages: () => document.querySelectorAll('.paper').length, choosePreset: selectPreset, render: renderPages, preparePrint, importProject: applyProject };
window.INKFLOW = window.QINGSONG;
start().catch(error => { status('初始化失败：' + error.message + '；请刷新或检查字体文件'); console.error(error); });
