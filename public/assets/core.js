export const SIZES = Object.freeze({
  a4p: [210, 297], a4l: [297, 210], a5p: [148, 210],
  padp: [204, 272], padl: [272, 204],
});
export const MAX_TEXT_LENGTH = 50000;
export const MAX_PAGES = 500;
export const mmToPx = mm => mm * 96 / 25.4;

const ranges = {
  repeatCount: [1, 5], fontSize: [3.5, 10], lineSize: [8, 22],
  traceOpacity: [12, 85], letterSpace: [0, 2.5],
};
const choices = {
  lang: ['zh', 'en'], layoutMode: ['poem', 'vertical', 'prose', 'quotes', 'essay'],
  paperSize: Object.keys(SIZES), repeatMode: ['line', 'whole'], ruling: ['none', 'line', 'four'],
};

export function sanitizeState(input, defaults) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('项目数据必须是对象');
  const result = { ...defaults };
  for (const [key, allowed] of Object.entries(choices)) {
    if (allowed.includes(input[key])) result[key] = input[key];
  }
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) {
      result[key] = Math.max(min, Math.min(max, input[key]));
    }
  }
  result.repeatCount = Math.round(result.repeatCount);
  for (const key of ['showTitle', 'boldFirst']) if (typeof input[key] === 'boolean') result[key] = input[key];
  for (const key of ['docTitle', 'docAuthor', 'docText', 'preset', 'font']) {
    if (typeof input[key] === 'string') result[key] = input[key];
  }
  if (result.docText.length > MAX_TEXT_LENGTH) throw new Error(`正文最多支持 ${MAX_TEXT_LENGTH.toLocaleString()} 个字符，请分篇制作`);
  result.docTitle = result.docTitle.slice(0, 160);
  result.docAuthor = result.docAuthor.slice(0, 160);
  result.preset = result.preset.slice(0, 80);
  result.font = result.font.slice(0, 100);
  return result;
}

export function importProject(project, defaults) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('项目格式不正确');
  if (project.version === '4.3') return { state: sanitizeState(project, defaults), migrated: false };
  if (project.version !== 4) throw new Error('不支持的项目版本；支持 INKFLOW 4.3 与 V4');
  const old = project.state || project.settings || project;
  if (!old || typeof old !== 'object' || Array.isArray(old)) throw new Error('旧项目缺少设置');
  const lang = old.lang === 'en' ? 'en' : 'zh';
  return { migrated: true, state: sanitizeState({
    ...defaults, lang, font: lang === 'en' ? 'inkcomic' : 'inkkai',
    preset: lang === 'en' ? 'customen' : 'customzh',
    docTitle: String(old.title || '旧项目临摹'), docAuthor: '导入自 INKFLOW V4',
    docText: String((lang === 'en' ? old.contentEn : old.contentZh) || old.contentZh || old.contentEn || old.content || ''),
    layoutMode: lang === 'en' ? 'essay' : 'prose',
    paperSize: ({ a4: 'a4p', land: 'a4l', tab: 'padp', tablet: 'padp' })[old.paper] || 'a4p',
    ...(old.opacity != null ? { traceOpacity: Number(old.opacity) } : {}),
    ...(old.trace != null ? { repeatCount: Number(old.trace) } : {}),
    ruling: old.grid === 'line' ? 'line' : 'none',
  }, defaults) };
}

export function documentEntries(state) {
  const lines = state.docText.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  const entries = [];
  if (state.repeatMode === 'whole') {
    for (let index = 0; index < state.repeatCount; index++) for (const text of lines) entries.push({ text, index });
  } else {
    for (const text of lines) for (let index = 0; index < state.repeatCount; index++) entries.push({ text, index });
  }
  return entries;
}

export function wrapText(text, maxWidth, measure, english) {
  const tokens = english ? (text.match(/\S+\s*/gu) || [text]) : Array.from(text);
  const output = [];
  let line = '';
  for (let token of tokens) {
    if (line && measure(line + token) > maxWidth) {
      output.push(line.trimEnd());
      line = '';
      token = token.trimStart();
    }
    if (measure(token) > maxWidth) {
      for (const char of Array.from(token)) {
        if (line && measure(line + char) > maxWidth) {
          output.push(line.trimEnd());
          line = '';
        }
        line += char;
      }
    } else line += token;
  }
  if (line) output.push(line.trimEnd());
  return output.length ? output : [''];
}

export function paginate(state, measure) {
  const [width, height] = SIZES[state.paperSize];
  const innerWidth = width - 26;
  const innerHeight = height - 25 - (state.showTitle ? 23 : 0) - 10;
  const entries = documentEntries(state);
  const rowHeight = Math.max(state.lineSize, state.fontSize * 1.4 + 1.5);
  const columnPitch = Math.max(9, state.fontSize + 5.4);
  const rows = [];
  let capacity;
  if (state.layoutMode === 'vertical') {
    capacity = Math.max(1, Math.floor(innerWidth / columnPitch));
    const charsPerColumn = Math.max(1, Math.floor((innerHeight - 5) / (state.fontSize + state.letterSpace + 1)));
    let pending = [];
    let pendingIndex = 0;
    const flush = () => {
      while (pending.length) rows.push({ text: pending.splice(0, charsPerColumn).join(''), index: pendingIndex });
    };
    for (const entry of entries) {
      if (state.boldFirst && pendingIndex !== entry.index) flush();
      pendingIndex = entry.index;
      pending.push(...Array.from(entry.text + '　'));
      while (pending.length >= charsPerColumn) rows.push({ text: pending.splice(0, charsPerColumn).join(''), index: pendingIndex });
    }
    flush();
  } else {
    capacity = Math.max(1, Math.floor(innerHeight / rowHeight));
    for (const entry of entries) {
      for (const text of wrapText(entry.text, mmToPx(innerWidth - 2), measure, state.lang === 'en')) rows.push({ text, index: entry.index });
    }
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / capacity));
  if (pageCount > MAX_PAGES) throw new Error(`当前排版超过 ${MAX_PAGES} 页，请减少重复次数或分篇制作`);
  const pages = [];
  for (let index = 0; index < rows.length; index += capacity) pages.push(rows.slice(index, index + capacity));
  if (!pages.length) pages.push([]);
  return { pages, rowHeight, columnPitch, entryCount: entries.length, size: [width, height] };
}
