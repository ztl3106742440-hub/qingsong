"""Validate browser-generated PDFs and render first/last pages for visual QA."""
from pathlib import Path
import json
import re
import sys
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
        for expected in sample.get('expectedRows', [])[index]:
            assert normalize(expected) in text, (path.name, index, expected, text[-200:])
    assert normalize(sample['tail']) in ''.join(texts), (path.name, 'missing tail')
    render = pdfium.PdfDocument(path)
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
    checks.append({'file': path.name, 'pages': len(pdf.pages), 'sizeMm': mm, 'completeRows': True, 'tailPresent': True})
    print('PASS', path.name, len(pdf.pages), 'pages', mm)
columns = 3
sheet = Image.new('RGB', (columns * 470, ((len(thumbnails) + columns - 1) // columns) * 610), 'white')
for index, thumbnail in enumerate(thumbnails):
    sheet.paste(thumbnail, ((index % columns) * 470, (index // columns) * 610))
sheet.save(output / 'pdf-contact-sheet.png')
(output / 'pdf-report.json').write_text(json.dumps({'passed': True, 'samples': checks}, indent=2) + '\n', encoding='utf-8')
print('PDF validation passed:', len(checks), 'samples;', sum(c['pages'] for c in checks), 'pages.')
