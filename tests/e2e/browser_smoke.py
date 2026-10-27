"""E2E local smoke: python -m pip install playwright; python -m playwright install chromium;
python tests/e2e/browser_smoke.py
Requires a local Chrome/Chromium and localhost navigation (some sandboxes block it).
No production credentials, accounts, or data are accessed.
"""
from __future__ import annotations
import os
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PORT = int(os.environ.get('SURVEYOR_E2E_PORT', '5591'))
URL = f'http://127.0.0.1:{PORT}'
PAGES = ('/login/', '/mapa/', '/memorial/', '/planos/')


def main():
    server = subprocess.Popen(['node', 'scripts/dev.mjs'], cwd=ROOT,
        env={**os.environ, 'SURVEYOR_LOCAL_PORT': str(PORT)},
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(40):
            try:
                with urlopen(f'{URL}/login/', timeout=1) as res:
                    if res.status == 200: break
            except OSError:
                time.sleep(.25)
        else:
            raise AssertionError('Local server did not start.')
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                for path in PAGES:
                    context = browser.new_context(viewport={'width': 1366, 'height': 768})
                    page = context.new_page()
                    failures = []
                    page.on('pageerror', lambda error: failures.append(str(error)))
                    res = page.goto(URL + path, wait_until='domcontentloaded', timeout=20000)
                    assert res is not None and res.status == 200, f'{path}: HTTP error'
                    assert page.locator('body').count() == 1, f'{path}: missing body'
                    print(f'PASS browser navigation: {path}')
                    # Some pages require authentication/online APIs; runtime exceptions
                    # are printed as diagnostics, not silently treated as passed integration tests.
                    if failures: print(f'DIAGNOSTIC {path}:', failures[:5])
                    context.close()
                # Two independent browser contexts must not share localStorage/sessionStorage.
                a, b = browser.new_context(), browser.new_context()
                pa, pb = a.new_page(), b.new_page()
                pa.goto(URL + '/login/', wait_until='domcontentloaded')
                pb.goto(URL + '/login/', wait_until='domcontentloaded')
                pa.evaluate("localStorage.setItem('surveyor_e2e_isolation_probe', 'device_A')")
                assert pb.evaluate("localStorage.getItem('surveyor_e2e_isolation_probe')") is None
                pa.evaluate("localStorage.removeItem('surveyor_e2e_isolation_probe')")
                a.close(); b.close()
                print('PASS browser local-storage isolation (NOT server-side project persistence)')
            finally:
                browser.close()
    finally:
        server.terminate()
        try: server.wait(timeout=5)
        except subprocess.TimeoutExpired: server.kill()

if __name__ == '__main__': main()
