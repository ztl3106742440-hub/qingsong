"""Validate browser-generated PDFs and render first/last pages for visual QA."""
from pathlib import Path
import json
import re
import sys
from collections import Counter
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
output = root / 'artifacts' / 'qa'
report = json.loads((output / 'browser-report.json').read_text(encoding='utf-8'))
sizes = {'a4p': (210, 297), 'a4l': (297, 210), 'a5p': (148, 210), 'padp': (204, 272), 'padl': (272, 204)}
normalize = lambda text: re.sub(r'\s+', '', text)
checks = []
thumbnails = []
for sample in report['pdfs']:
    path = output / sample['file']
    pdf = PdfReader(path)
    assert len(pdf.pages) == sample['expectedPages'], (path.name, len(pdf.pages), sample['expectedPages'])
    mm = sizes[sample['paperSize']]
    texts = []
    for index, page in enumerate(pdf.pages):
        measured = (float(page.mediabox.width) * 25.4 / 72, float(page.mediabox.height) * 25.4 / 72)
        assert all(abs(a - b) < .6 for a, b in zip(measured, mm)), (path.name, index, measured, mm)
        text = normalize(page.extract_text() or '')
        texts.append(text)
        expected_rows = Counter(normalize(row) for row in sample['expectedRows'][index])
        for expected, count in expected_rows.items():
            assert text.count(expected) >= count, (path.name, index, expected, count, text[-200:])
    # PDF extractors may enumerate vertical columns left-to-right. After proving
    # every actual PDF row (and its repetition count) exists, use the visual DOM
    # order to verify a tail that spans two columns or pages.
    verified_content = ''.join(normalize(row) for rows in sample['expectedRows'] for row in rows)
    assert normalize(sample['tail']) in verified_content, (path.name, 'missing tail')
    render = pdfium.PdfDocument(path)
    if sample.get('exporter') == 'native-vector':
        assert path.stat().st_size < 2_000_000, (path.name, 'unexpected oversized font embedding')
        for index in range(len(pdf.pages)):
            assert len(list(pdf.pages[index].images)) == 0, (path.name, 'unexpected page screenshot')
            image = render[index].render(scale=.65).to_pil().convert('RGB')
            factor = image.width / mm[0]
            content = image.crop((int(13 * factor), int(36 * factor), int((mm[0] - 13) * factor), int((mm[1] - 22) * factor)))
            pixels = content.get_flattened_data() if hasattr(content, 'get_flattened_data') else content.getdata()
            dark = sum(1 for color in pixels if max(color) < 210)
            assert dark > 30, (path.name, index, 'text extracted but visible glyphs missing', dark)
    for index in sorted({0, len(pdf.pages) - 1}):
        bitmap = render[index].render(scale=1.25)
        image = bitmap.to_pil().convert('RGB')
        name = path.stem + '-page-' + str(index + 1) + '.png'
        image.save(output / name)
        image.thumbnail((440, 570))
        thumb = Image.new('RGB', (470, 610), '#e8ece7')
        thumb.paste(image, ((470 - image.width) // 2, 32))
        ImageDraw.Draw(thumb).text((10, 8), path.stem + ' / ' + str(index + 1), fill='#184b40')
        thumbnails.append(thumb)
    render.close()
    checks.append({'file': path.name, 'pages': len(pdf.pages), 'bytes': path.stat().st_size, 'sizeMm': mm, 'completeRows': True, 'tailPresent': True, 'visibleVectorGlyphs': sample.get('exporter') == 'native-vector'})
    print('PASS', path.name, len(pdf.pages), 'pages', mm)
columns = 3
sheet = Image.new('RGB', (columns * 470, ((len(thumbnails) + columns - 1) // columns) * 610), 'white')
for index, thumbnail in enumerate(thumbnails):
    sheet.paste(thumbnail, ((index % columns) * 470, (index // columns) * 610))
sheet.save(output / 'pdf-contact-sheet.png')
(output / 'pdf-report.json').write_text(json.dumps({'passed': True, 'samples': checks}, indent=2) + '\n', encoding='utf-8')
print('PDF validation passed:', len(checks), 'samples;', sum(c['pages'] for c in checks), 'pages.')
