/* Native vector PDF export. Only the shared paper layout is written, never the app UI. */
import { wrapText } from './core.js';
import { FONT_RESOURCES } from './font-resources.js';

const MM = 72 / 25.4;
const binaries = new Map();
let libraries;
const fontError = error => new Error('PDF 字体处理失败：' + error.message + '。可换基础字体，或使用备用打印。');

function loadScript(file, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../vendor/' + file, import.meta.url).href;
    script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error('PDF 引擎初始化失败'));
    script.onerror = () => { script.remove(); reject(new Error('PDF 引擎未加载，请检查网络后重试')); };
    document.head.append(script);
  });
}

async function loadBytes(url) {
  if (!binaries.has(url)) {
    binaries.set(url, fetch(url, { credentials: 'omit' }).then(async response => {
      if (!response.ok) throw new Error('字体文件无法读取');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 30 * 1024 * 1024) throw new Error('单个字体文件超过 30 MB');
      return bytes;
    }).catch(error => { binaries.delete(url); throw error; }));
  }
  return binaries.get(url);
}

function inRange(code, ranges) {
  if (!ranges) return true;
  return ranges.split(',').some(range => {
    const value = range.trim().replace(/^U\+/iu, '');
    if (value.includes('?')) return code >= parseInt(value.replaceAll('?', '0'), 16) && code <= parseInt(value.replaceAll('?', 'F'), 16);
    const [min, max = min] = value.split('-');
    return code >= parseInt(min, 16) && code <= parseInt(max, 16);
  });
}

async function fontSources(state, customFont, fonts) {
  if (state.font === 'InkCustom') {
    if (!customFont?.bytes) throw new Error('请重新导入本地字体');
    return [new Uint8Array(customFont.bytes)];
  }
  const entry = fonts[state.lang].find(font => font.family === state.font);
  const resource = FONT_RESOURCES[state.font];
  if (resource) return [await loadBytes(new URL('../' + resource.file, import.meta.url).href)];
  if (entry?.kind !== '联网') throw new Error('未识别的字体');
  const cssURL = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(state.font).replaceAll('%20', '+') + '&display=swap';
  const response = await fetch(cssURL, { credentials: 'omit' });
  if (!response.ok) throw new Error('联网字体无法读取，请检查网络');
  const css = await response.text();
  const codes = [...new Set(Array.from(state.docText).filter(char => !/\s/u.test(char)).map(char => char.codePointAt(0)))];
  const urls = new Set();
  for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/gu)) {
    const body = match[1];
    const range = body.match(/unicode-range\s*:\s*([^;]+)/iu)?.[1];
    if (!codes.some(code => inRange(code, range))) continue;
    const url = body.match(/src\s*:[^;]*url\(['"]?([^)'"\s]+)/iu)?.[1];
    if (url && new URL(url).hostname === 'fonts.gstatic.com') urls.add(url);
  }
  if (!urls.size) throw new Error('联网字体没有可用的字形文件');
  // Sequential reads keep Chinese font subsets from causing a request/memory spike on tablets.
  const sources = [];
  for (const url of urls) sources.push(await loadBytes(url));
  return sources;
}

export async function createPDF(state, layout, { customFont, fonts, onProgress = () => {} }) {
  onProgress('正在加载内置 PDF 引擎…');
  if (!libraries) libraries = Promise.all([loadScript('pdf-lib.js', 'PDFLib'), loadScript('fontkit.js', 'fontkit')]).catch(error => { libraries = null; throw error; });
  const [pdf, fontkit] = await libraries;
  const document = await pdf.PDFDocument.create();
  document.setTitle(state.docTitle || '清松临摹字帖');
  document.setAuthor(state.docAuthor || '');
  document.setCreator('清松 · 内置 PDF 导出');
  onProgress('正在读取并嵌入字体…');
  let selected;
  let header;
  function face(bytes) {
    const parsed = fontkit.create(bytes);
    return { parsed, font: { widthOfTextAtSize: (text, size) => parsed.layout(text).glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0) * size / parsed.unitsPerEm } };
  }
  try {
    const sources = await fontSources(state, customFont, fonts);
    selected = [];
    for (const bytes of sources) {
      selected.push(face(bytes));
    }
    const headerBytes = await loadBytes(new URL('../' + FONT_RESOURCES.inkkai.file, import.meta.url).href);
    header = face(headerBytes);
  } catch (error) { throw fontError(error); }

  function faceFor(char, faces = selected) {
    const face = faces.find(item => item.parsed.hasGlyphForCodePoint(char.codePointAt(0)));
    if (!face) throw new Error(`当前字体缺少字符「${char}」，请更换字体或调整内容`);
    return face;
  }
  function segments(text, faces) {
    const output = [];
    for (const char of Array.from(text)) {
      const face = faceFor(char, faces);
      const last = output.at(-1);
      if (last?.face === face) last.text += char;
      else output.push({ face, text: char });
    }
    return output;
  }
  function width(text, size, gap = 0, faces = selected) {
    return segments(text, faces).reduce((sum, segment) => sum + segment.face.font.widthOfTextAtSize(segment.text, size), 0)
      + Math.max(0, Array.from(text).length - 1) * gap;
  }
  // Preflight before drawing so a missing glyph never produces a half-valid download.
  for (const char of new Set(Array.from(state.docText.replace(/\s/gu, '')))) faceFor(char);
  for (const char of new Set(Array.from((state.docTitle + state.docAuthor).replace(/\s/gu, '')))) faceFor(char, [header]);
  const bodyColor = pdf.rgb(36 / 255, 49 / 255, 42 / 255);
  const deepColor = pdf.rgb(76 / 255, 98 / 255, 86 / 255);
  const gray = pdf.rgb(.57, .63, .59);
  const light = pdf.rgb(.86, .9, .86);
  const paperColor = pdf.rgb(1, 254 / 255, 250 / 255);
  const [pageWidth, pageHeight] = layout.size.map(value => value * MM);
  const fontSize = state.fontSize * MM;
  const gap = state.letterSpace * MM;
  const outlines = new WeakMap();
  // An invisible CID text layer provides Unicode search/copy without embedding
  // the broken and very large fontkit subsets of transformed WOFF2 files.
  // Visible letters below are the selected font's actual vector outlines.
  const name = value => pdf.PDFName.of(value);
  const descriptor = document.context.register(document.context.obj({
    Type: 'FontDescriptor', FontName: 'QingsongText', Flags: 4,
    FontBBox: [0, -250, 1200, 1100], ItalicAngle: 0, Ascent: 900, Descent: -250, CapHeight: 700, StemV: 80,
  }));
  const descendant = document.context.obj({
    Type: 'Font', Subtype: 'CIDFontType2', BaseFont: 'QingsongText',
    CIDSystemInfo: { Registry: pdf.PDFString.of('Adobe'), Ordering: pdf.PDFString.of('Identity'), Supplement: 0 },
    FontDescriptor: descriptor, DW: 1000, CIDToGIDMap: 'Identity',
  });
  const descendantRef = document.context.register(descendant);
  const textFont = document.context.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: 'QingsongText', Encoding: 'Identity-H', DescendantFonts: [descendantRef] });
  const textFontRef = document.context.register(textFont);
  const characterMap = new Map();
  const pageFontKeys = new WeakMap();
  const hex = value => value.toString(16).padStart(4, '0').toUpperCase();
  function encode(text, face) {
    let output = '';
    for (const char of Array.from(text)) {
      const key = face.parsed.postscriptName + ':' + char;
      if (!characterMap.has(key)) {
        const unicode = Array.from({ length: char.length }, (_, index) => hex(char.charCodeAt(index))).join('');
        characterMap.set(key, { cid: characterMap.size + 1, unicode, width: Math.round(face.font.widthOfTextAtSize(char, 1000)) });
      }
      output += hex(characterMap.get(key).cid);
    }
    return pdf.PDFHexString.of(output);
  }
  function outline(glyph) {
    if (!outlines.has(glyph)) {
      const commands = { moveTo: 'M', lineTo: 'L', quadraticCurveTo: 'Q', bezierCurveTo: 'C', closePath: 'Z' };
      outlines.set(glyph, glyph.path.commands.map(item => commands[item.command] + item.args.map((number, index) => index % 2 ? -number : number).join(' ')).join(' '));
    }
    return outlines.get(glyph);
  }
  function line(page, text, x, baseline, size, { faces = selected, spacing = gap, opacity = 1, color = bodyColor } = {}) {
    for (const segment of segments(text, faces)) {
      // Preserve searchable text, and draw the actual outlines separately. Some
      // transformed WOFF2 fonts produce unusable subset outlines in fontkit;
      // visible vector paths avoid that renderer-dependent font failure.
      if (!pageFontKeys.has(page)) pageFontKeys.set(page, page.node.newFontDictionary('QingsongText', textFontRef));
      page.pushOperators(pdf.pushGraphicsState(), pdf.beginText(), pdf.setFontAndSize(pageFontKeys.get(page), size),
        pdf.setCharacterSpacing(spacing), pdf.setTextRenderingMode(3), pdf.moveText(x, baseline),
        pdf.showText(encode(segment.text, segment.face)), pdf.endText(), pdf.popGraphicsState());
      const run = segment.face.parsed.layout(segment.text);
      const factor = size / segment.face.parsed.unitsPerEm;
      let pen = x;
      for (let index = 0; index < run.glyphs.length; index++) {
        const glyph = run.glyphs[index];
        const position = run.positions[index];
        const path = outline(glyph);
        if (path) page.drawSvgPath(path, { x: pen + position.xOffset * factor, y: baseline + position.yOffset * factor, scale: factor, color, opacity });
        pen += position.xAdvance * factor + Math.max(1, glyph.codePoints.length) * spacing;
      }
      x += segment.face.font.widthOfTextAtSize(segment.text, size) + Array.from(segment.text).length * spacing;
    }
  }
  function headerLine(page, text, xMm, topMm, sizeMm, color = gray) {
    line(page, text, xMm * MM, pageHeight - topMm * MM, sizeMm * MM, { faces: [header], spacing: 0, color });
  }
  for (let index = 0; index < layout.pages.length; index++) {
    const page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paperColor });
    if (state.showTitle) {
      const titleLines = wrapText(state.docTitle || '未命名作品', (layout.size[0] - 69) * MM, text => width(text, 4.7 * MM, 0, [header]), false).slice(0, 2);
      titleLines.forEach((title, number) => headerLine(page, title, 13, 18 + number * 5.6, 4.7, pdf.rgb(.16, .29, .24)));
      const author = wrapText(state.docAuthor || 'HANDWRITING PRACTICE', (layout.size[0] - 69) * MM, text => width(text, 2.7 * MM, 0, [header]), false)[0];
      headerLine(page, author, 13, 22.8 + (titleLines.length - 1) * 5.6, 2.7);
      headerLine(page, '清松 / QINGSONG', layout.size[0] - 43, 17, 2.7);
      headerLine(page, `${index + 1} / ${layout.pages.length}`, layout.size[0] - 27, 21, 2.7);
      page.drawLine({ start: { x: 13 * MM, y: pageHeight - 34 * MM }, end: { x: pageWidth - 13 * MM, y: pageHeight - 34 * MM }, thickness: .5, color: light });
    }
    const bodyTop = (state.showTitle ? 36 : 13) * MM;
    const bottom = pageHeight - 22 * MM;
    for (let rowIndex = 0; rowIndex < layout.pages[index].length; rowIndex++) {
      const row = layout.pages[index][rowIndex];
      const opacity = row.index === 0 && state.boldFirst ? 1 : state.traceOpacity / 100;
      const color = row.index === 0 && state.boldFirst ? deepColor : bodyColor;
      if (state.layoutMode === 'vertical') {
        const right = pageWidth - (13 + rowIndex * layout.columnPitch) * MM;
        page.drawLine({ start: { x: right, y: pageHeight - bodyTop }, end: { x: right, y: pageHeight - bottom }, thickness: .35, color: pdf.rgb(.93, .95, .92) });
        let top = bodyTop + MM;
        for (const char of Array.from(row.text)) {
          if (/\s/u.test(char)) { top += fontSize + gap; continue; }
          const face = faceFor(char);
          const charWidth = face.font.widthOfTextAtSize(char, fontSize);
          const x = right - layout.columnPitch * MM / 2 - charWidth / 2;
          const ascent = face.parsed.ascent / face.parsed.unitsPerEm * fontSize;
          const descent = -face.parsed.descent / face.parsed.unitsPerEm * fontSize;
          const baseline = pageHeight - top - (fontSize - ascent - descent) / 2 - ascent;
          line(page, char, x, baseline, fontSize, { spacing: 0, opacity, color });
          top += fontSize + gap;
        }
      } else {
        const top = bodyTop + rowIndex * layout.rowHeight * MM;
        if (state.ruling === 'line' || state.ruling === 'four') {
          for (const fraction of state.ruling === 'line' ? [1] : [.25, .5, .75]) {
            const y = pageHeight - top - layout.rowHeight * MM * fraction;
            page.drawLine({ start: { x: 13 * MM, y }, end: { x: pageWidth - 13 * MM, y }, thickness: .35, color: light });
          }
        }
        const face = faceFor(Array.from(row.text)[0] || ' ');
        const ascent = face.parsed.ascent / face.parsed.unitsPerEm * fontSize;
        const descent = -face.parsed.descent / face.parsed.unitsPerEm * fontSize;
        const baseline = pageHeight - top - (layout.rowHeight * MM - ascent - descent) / 2 - ascent;
        const x = state.layoutMode === 'poem' ? (pageWidth - width(row.text, fontSize, gap)) / 2 : 13 * MM;
        line(page, row.text, x, baseline, fontSize, { opacity, color });
      }
    }
    page.drawLine({ start: { x: 13 * MM, y: 18 * MM }, end: { x: pageWidth - 13 * MM, y: 18 * MM }, thickness: .4, color: light });
    headerLine(page, '全文描红 · WRITE OVER THE LETTERS', 13, layout.size[1] - 12.5, 2.3);
    headerLine(page, state.layoutMode === 'vertical' ? 'VERTICAL' : 'FULL TEXT', layout.size[0] - 31, layout.size[1] - 12.5, 2.3);
    onProgress(`正在生成 PDF：${index + 1} / ${layout.pages.length} 页…`);
    // Yield between pages so tablets can paint progress and accept OS gestures.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const mappings = [...characterMap.values()];
  const chunks = [];
  for (let index = 0; index < mappings.length; index += 100) {
    const chunk = mappings.slice(index, index + 100);
    chunks.push(`${chunk.length} beginbfchar\n${chunk.map(item => `<${hex(item.cid)}> <${item.unicode}>`).join('\n')}\nendbfchar`);
  }
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /QingsongUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
  textFont.set(name('ToUnicode'), document.context.register(document.context.flateStream(cmap)));
  descendant.set(name('W'), document.context.obj(mappings.flatMap(item => [item.cid, [item.width]])));
  try { return await document.save(); }
  catch (error) { throw fontError(error); }
}
