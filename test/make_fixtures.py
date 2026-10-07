# fixtures: minimal pptx, pdf, docx, xlsx, pass-through
import io, os, zipfile
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), 'fixtures')
os.makedirs(OUT, exist_ok=True)

P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PR = 'http://schemas.openxmlformats.org/package/2006/relationships'

def rels(items):
    body = ''.join(f'<Relationship Id="{i}" Type="{RT}/{t}" Target="{tg}"/>' for i, t, tg in items)
    return f'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{PR}">{body}</Relationships>'

def sp(text_paras, ph=None):
    phx = f'<p:nvPr><p:ph type="{ph}"/></p:nvPr>' if ph else '<p:nvPr/>'
    paras = ''.join(f'<a:p><a:pPr lvl="{l}"/><a:r><a:t>{t}</a:t></a:r></a:p>' for l, t in text_paras)
    return f'<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/>{phx}</p:nvSpPr><p:txBody>{paras}</p:txBody></p:sp>'

def slide(inner, show=True):
    s = '' if show else ' show="0"'
    return f'<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}"{s}><p:cSld><p:spTree>{inner}</p:spTree></p:cSld></p:sld>'

def png_bytes(color, size=(120, 80)):
    b = io.BytesIO(); Image.new('RGB', size, color).save(b, 'PNG'); return b.getvalue()

# pptx
pic = f'<p:pic><p:nvPicPr><p:cNvPr id="4" name="pic" descr="Pizza cut into eighths"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic>'
tbl = ('<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="t"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
       '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>'
       '<a:tr><a:tc><a:txBody><a:p><a:r><a:t>Fraction</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Decimal</a:t></a:r></a:p></a:txBody></a:tc></a:tr>'
       '<a:tr><a:tc><a:txBody><a:p><a:r><a:t>1/2</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>0.5</a:t></a:r></a:p></a:txBody></a:tc></a:tr>'
       '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>')
s1 = slide(sp([(0, 'Fractions Intro')], 'title') + sp([(0, 'A fraction is part of a whole'), (1, 'numerator on top'), (1, 'denominator below')], 'body') + pic + tbl)
s2 = slide(sp([(0, 'Exit Ticket')], 'title') + sp([(0, 'Shade 3/8 of the pizza')], 'body'), show=False)
notes = f'<?xml version="1.0" encoding="UTF-8"?><p:notes xmlns:p="{P}" xmlns:a="{A}"><p:cSld><p:spTree>{sp([(0, "Ask who has eaten pizza this week")], "body")}</p:spTree></p:cSld></p:notes>'
pres = f'<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="{P}" xmlns:r="{R}"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst></p:presentation>'
with zipfile.ZipFile(os.path.join(OUT, 'unit1.pptx'), 'w') as z:
    z.writestr('ppt/presentation.xml', pres)
    z.writestr('ppt/_rels/presentation.xml.rels', rels([('rId2', 'slide', 'slides/slide1.xml'), ('rId3', 'slide', 'slides/slide2.xml')]))
    z.writestr('ppt/slides/slide1.xml', s1)
    z.writestr('ppt/slides/_rels/slide1.xml.rels', rels([('rId2', 'image', '../media/image1.png'), ('rId3', 'notesSlide', '../notesSlides/notesSlide1.xml')]))
    z.writestr('ppt/slides/slide2.xml', s2)
    z.writestr('ppt/notesSlides/notesSlide1.xml', notes)
    z.writestr('ppt/media/image1.png', png_bytes((251, 174, 45)))

# pdf: two letter pages with text, one poster page
def pdf(pages):
    objs = ['<< /Type /Catalog /Pages 2 0 R >>', None, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    kids = []
    for w, h, text in pages:
        stream = f'BT /F1 24 Tf 72 {h - 100} Td ({text}) Tj ET'.encode()
        objs.append(f'<< /Length {len(stream)} >>\nstream\n{stream.decode()}\nendstream')
        objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w} {h}] /Resources << /Font << /F1 3 0 R >> >> /Contents {len(objs)} 0 R >>')
        kids.append(f'{len(objs)} 0 R')
    objs[1] = f'<< /Type /Pages /Kids [{" ".join(kids)}] /Count {len(kids)} >>'
    out = b'%PDF-1.4\n'
    offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out)); out += f'{i} 0 obj\n{o}\nendobj\n'.encode()
    x = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode() + b''.join(f'{o:010d} 00000 n \n'.encode() for o in offs)
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n'.encode()
    return out
open(os.path.join(OUT, 'reading.pdf'), 'wb').write(pdf([(612, 792, 'Reading: Equivalent Fractions'), (612, 792, 'Page two questions'), (1224, 1584, 'Poster page')]))

# docx
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
doc = f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>Homework: Fractions</w:t></w:r></w:p><w:p><w:r><w:t>Write three fractions equal to one half.</w:t></w:r></w:p></w:body></w:document>'
with zipfile.ZipFile(os.path.join(OUT, 'homework.docx'), 'w') as z:
    z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr('_rels/.rels', rels([('rId1', 'officeDocument', 'word/document.xml')]))
    z.writestr('word/document.xml', doc)

# xlsx
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
sheet = f'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="{S}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Student</t></is></c><c r="B1" t="inlineStr"><is><t>Score</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>A</t></is></c><c r="B2"><v>9</v></c></row></sheetData></worksheet>'
with zipfile.ZipFile(os.path.join(OUT, 'grades.xlsx'), 'w') as z:
    z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
    z.writestr('_rels/.rels', rels([('rId1', 'officeDocument', 'xl/workbook.xml')]))
    z.writestr('xl/workbook.xml', f'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="{S}" xmlns:r="{R}"><sheets><sheet name="Quiz 1" sheetId="1" r:id="rId1"/></sheets></workbook>')
    z.writestr('xl/_rels/workbook.xml.rels', rels([('rId1', 'worksheet', 'worksheets/sheet1.xml')]))
    z.writestr('xl/worksheets/sheet1.xml', sheet)

# pass-through
open(os.path.join(OUT, 'poster.ai'), 'wb').write(os.urandom(2048))
print('\n'.join(sorted(os.listdir(OUT))))
