"""One-time extraction of the user's portable INKFLOW HTML. Original stays unchanged."""
from pathlib import Path
import base64
import hashlib
import json
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python tools/extract-original.py <original-html-path>')
SOURCE = Path(sys.argv[1]).resolve()
text = SOURCE.read_text(encoding="utf-8-sig")
def write_lf(path, content):
    path.write_bytes(content.replace('\r\n', '\n').encode('utf-8'))
for folder in ["src", "public/fonts", "public/licenses", "content", "references", "docs", "tests", ".github/workflows"]:
    (ROOT / folder).mkdir(parents=True, exist_ok=True)
shutil.copy2(SOURCE, ROOT / "references" / SOURCE.name)
shutil.copy2(SOURCE.with_name("INKFLOW04.3_项目完整说明.md"), ROOT / "references" / "ORIGINAL_SPEC.md")
css = re.search(r"<style>(.*?)</style>", text, re.S).group(1)
font_pattern = r'@font-face\{font-family:"([^"]+)";src:url\(data:font/woff2;base64,([A-Za-z0-9+/=]+)\) format\("woff2"\);font-display:swap\}'
font_css = []
font_hashes = {}
for family, data in re.findall(font_pattern, css):
    binary = base64.b64decode(data)
    (ROOT / "public/fonts" / (family + ".woff2")).write_bytes(binary)
    font_hashes[family] = {"bytes": len(binary), "sha256": hashlib.sha256(binary).hexdigest()}
    font_css.append('@font-face{font-family:"' + family + '";src:url("../fonts/' + family + '.woff2") format("woff2");font-display:swap}')
write_lf(ROOT / "src/fonts.css", "\n".join(font_css) + "\n")
write_lf(ROOT / "src/base.css", re.sub(font_pattern, "", css).strip() + "\n")
notice = re.search(r"<!--\s*(Embedded-font attribution.*?)-->", text, re.S).group(1)
write_lf(ROOT / "public/licenses/FONT-NOTICES.txt", notice)
# Keep the complete original notice. Also provide Arphic's unchanged license as a named file.
start = notice.index("ARPHIC PUBLIC LICENSE")
end = notice.find("\n========================================================================", start)
if end > start:
    write_lf(ROOT / "public/licenses/ARPHICPL.TXT", notice[start:end] + "\n")
script = re.search(r"<script>(.*?)</script>", text, re.S).group(1)
fonts = script[script.index("const fonts="):script.index("const spring=")].replace("const fonts=", "export const FONTS=", 1)
presets = script[script.index("const spring="):script.index("const defaults=")].replace("const PRESETS=", "export const PRESETS=", 1)
write_lf(ROOT / "content/library.js", fonts + "\n" + presets)
body = re.search(r"<body>(.*?)<script>", text, re.S).group(1)
body = body.replace("INKFLOW 04.3 · 排版专注版", "清松 · 诗文临摹工作室")
body = body.replace("INKFLOW <small>04.3</small>", "清松 <small>QINGSONG</small>")
body = body.replace('<div class="symbol">I</div>', '<div class="symbol" aria-hidden="true">松</div>')
body = body.replace('id="saveStatus">离线版本', 'id="saveStatus" role="status" aria-live="polite">正在加载字体…')
body = body.replace('<aside class="controls">', '<aside class="controls" id="controls" aria-label="字帖设置">')
body = body.replace('<main class="workspace">', '<main class="workspace" id="workspace" aria-label="字帖预览">')
body = body.replace('<div class="layout">', '<nav class="view-tabs" aria-label="工作区"><button class="pill active" id="settingsTab" aria-pressed="true">字体与排版</button><button class="pill" id="previewTab" aria-pressed="false">整页预览 <span id="pageCount"></span></button></nav><div class="layout" data-view="controls">')
body = body.replace('min="3.5" max="10" step="0.2"', 'min="3.5" max="10" step="0.1"')
body = body.replace('font/*', '')
body = body.replace('<div class="label">自选字体（TTF / OTF / WOFF / WOFF2）</div>', '<label class="label" for="fontUpload">自选字体（TTF / OTF / WOFF / WOFF2）</label>')
body = body.replace('右侧即时重新分页', '预览即时重新分页')
body = body.replace('本机离线制作｜浏览器打印生成 PDF', '文字与设置仅保存在本机｜浏览器生成 PDF<br><a href="./licenses/FONT-NOTICES.txt" target="_blank" rel="noopener">字体授权说明</a>')
body = body.replace('字体卡片就是预览，不再重复做一个字体对比区。点击只改变纸张字体，页面不会乱跳。', '选择喜欢的字形，制作整篇浅灰临摹字帖。基础字体随网站提供；联网字体需加载成功后使用。')
body = body.replace('<div class="preview-help">', '<div class="preview-help"><p>Android 平板：浏览器菜单 → 分享 → 打印 → 另存为 PDF。若顶部导出按钮无法唤起打印，请使用此入口。</p>')
body = body.replace('项目文件不会把外部字体偷偷打包进去。', '项目文件不包含字体文件，换设备后需重新导入。')
body = body.replace('重复次数不会偷偷缩水。', '重复次数按设置完整生成。')
head = '<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#184b40"><meta name="description" content="清松：诗文与英文全文临摹字帖，选择字体、排版并导出 PDF。"><title>清松 · 诗文临摹工作室</title><link rel="icon" href="./icon.svg" type="image/svg+xml"><link rel="stylesheet" href="./assets/fonts.css"><link rel="stylesheet" href="./assets/base.css"><link rel="stylesheet" href="./assets/app.css"><style id="pagesize">@page{size:210mm 297mm;margin:0}</style></head>\n<body>\n'
write_lf(ROOT / "src/index.html", head + body + '\n<script type="module" src="./assets/app.js"></script>\n</body></html>\n')
write_lf(ROOT / "docs/SOURCE_PROVENANCE.json", json.dumps({"sourceFile": SOURCE.name, "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "extractedFonts": font_hashes, "notice": "Fonts extracted byte-for-byte; no outlines or font names changed in this migration."}, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"fonts": font_hashes, "sourceUnchanged": True}, ensure_ascii=False))
