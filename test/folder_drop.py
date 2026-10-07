# folder drop: simulated directory entries onto the drop box
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app')
FIX = os.path.join(HERE, 'fixtures')
PORT = 8766

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(f'http://localhost:{PORT}/#files')
        pg.wait_for_selector('.intake')
        pptx = list(open(os.path.join(FIX, 'unit1.pptx'), 'rb').read())
        pdf = list(open(os.path.join(FIX, 'reading.pdf'), 'rb').read())
        pg.evaluate('''([pptx, pdf]) => {
          const f = (name, bytes) => new File([new Uint8Array(bytes)], name);
          const file = (path, bytes) => ({ isFile: true, isDirectory: false, fullPath: path, file: ok => ok(f(path.split('/').pop(), bytes)) });
          const dir = (path, kids) => ({ isFile: false, isDirectory: true, fullPath: path,
            createReader() { let sent = false; return { readEntries(ok) { ok(sent ? [] : kids); sent = true; } }; } });
          const tree = dir('/Unit 1', [
            file('/Unit 1/unit1.pptx', pptx),
            file('/Unit 1/.DS_Store', [1, 2, 3]),
            dir('/Unit 1/Readings', [file('/Unit 1/Readings/reading.pdf', pdf)]),
          ]);
          const ev = new Event('drop', { bubbles: true, cancelable: true });
          Object.defineProperty(ev, 'dataTransfer', { value: { items: [{ webkitGetAsEntry: () => tree }], files: [] } });
          document.querySelector('.box.drop').dispatchEvent(ev);
        }''', [pptx, pdf])
        for _ in range(30):
            rows = pg.locator('table.list tr').all_inner_texts()[1:]
            if len(rows) >= 2 and all('Done' in r for r in rows): break
            time.sleep(0.5)
        print('DROP BOX', pg.locator('.box.drop').inner_text())
        for r in pg.locator('table.list tr').all_inner_texts():
            print('  ', r.replace('\t', ' | '))
        print('SOURCES', pg.evaluate("Array.from(document.querySelectorAll('table.list td[title]')).map(td => td.title)"))
        b.close()
finally:
    srv.terminate()
print('ERRORS', errors)
