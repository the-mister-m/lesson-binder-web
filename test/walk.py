# walk: headless run of intake → labels → edges → export
import io, os, subprocess, sys, time, zipfile
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app')
FIX = os.path.join(HERE, 'fixtures')
PORT = 8765
WHISPER = '--whisper' in sys.argv

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(accept_downloads=True)
        pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.goto(f'http://localhost:{PORT}/#files')
        pg.wait_for_selector('.intake')

        names = ['lesson.m4a'] if WHISPER else ['unit1.pptx', 'reading.pdf', 'homework.docx', 'grades.xlsx', 'poster.ai', 'unit1.pptx']
        if not WHISPER:
            pg.locator('label:has-text("Transcribe audio") input').uncheck()
        with pg.expect_file_chooser() as fc:
            pg.click('.box.drop')
        fc.value.set_files([os.path.join(FIX, n) for n in names])

        limit = 600 if WHISPER else 60
        for _ in range(limit):
            rows = pg.locator('table.list tr').all_inner_texts()[1:]
            if rows and not any(('Pending' in r and 'Duplicate' not in r) or r.split('\t')[3].startswith(('Hashing', 'Slide', 'Reading', 'Processing', 'Media', 'Image', 'Copying', 'Decoding', 'Transcrib')) for r in rows):
                break
            if WHISPER:
                meter = pg.locator('main .row').nth(1).inner_text()
                if meter: print('  meter:', meter.replace('\n', ' '))
            time.sleep(1)
        print('FILES')
        for r in pg.locator('table.list tr').all_inner_texts():
            print('  ', r.replace('\t', ' | '))

        if not WHISPER:
            # taxonomy
            pg.click('#tabs button[data-tab=taxonomies]')
            pg.click('text=+ Add taxonomy')
            pg.fill('main input[type=text]', 'Unit')
            pg.fill('main textarea', 'Which unit the material belongs to')
            pg.click('.chip:has-text("+")')
            pg.keyboard.type('Fractions'); pg.keyboard.press('Enter')
            pg.keyboard.type('Decimals'); pg.keyboard.press('Enter')
            print('TAXONOMY', pg.locator('main .split').inner_text().replace('\n', ' | '))

            # node labels
            pg.click('#tabs button[data-tab=nodes]')
            pg.click('.chip:has-text("Fractions")')
            tas = pg.locator('main textarea')
            tas.nth(0).fill('Intro deck for fractions')
            tas.nth(1).fill('Taught day 1, slides 1-2 only')
            pg.click('text=Markdown')
            print('NODE', pg.locator('main .split > div').nth(1).inner_text()[:900].replace('\n', ' / '))

            # edges
            pg.click('#tabs button[data-tab=edges]')
            pg.fill('.paste textarea', '```jsonl\n{"from":"F-001","to":"F-002.p1","note":"deck → reading"}\n{"from":"F-001","to":"F-099"}\nnot json\n{"from":"F-003","to":"F-001.m1"}\n```')
            pg.click('.paste .btn')
            print('EDGES', pg.locator('.edges-low').inner_text().replace('\n', ' | '))

            # export
            pg.click('#tabs button[data-tab=export]')
            print('EXPORT', pg.locator('main').inner_text().replace('\n', ' | '))
            with pg.expect_download() as dl:
                pg.click('text=Download package (.zip)')
            data = open(dl.value.path(), 'rb').read()
            z = zipfile.ZipFile(io.BytesIO(data))
            print('ZIP')
            for n in z.namelist():
                print('  ', n, z.getinfo(n).file_size)
            for n in ['INDEX.md', 'files/F-001/F-001.md', 'files/F-002/F-002.md', 'files/F-003/F-003.md', 'files/F-004/F-004.md', '.package/nodes.jsonl', '.package/edges/v001.jsonl', '.package/manifest.json']:
                if n in z.namelist():
                    print(f'--- {n}\n' + z.read(n).decode()[:1400])
            pg.screenshot(path=os.path.join(HERE, 'shot-export.png'), full_page=True)
            pg.click('#tabs button[data-tab=files]')
            pg.screenshot(path=os.path.join(HERE, 'shot-files.png'), full_page=True)
        else:
            pg.click('#tabs button[data-tab=nodes]')
            pg.click('text=Markdown')
            print('NODE', pg.locator('pre.md').inner_text())
        b.close()
finally:
    srv.terminate()
print('CONSOLE')
for e in errors:
    print('  ', e[:300])
