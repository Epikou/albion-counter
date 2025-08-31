
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse, sys, os, pathlib, tempfile, time
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRAPER = ROOT / "tools" / "scraper" / "fetch_build.py"
OUTDIR = ROOT / "data" / "builds"
SELFILE = ROOT / "tools" / "scraper" / "selectors.yaml"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--wait", type=int, default=0)
    args = ap.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                                      viewport={"width": 1366, "height": 900}, locale="fr-FR")
        page = context.new_page()
        print("[Capture] Ouverture:", args.url)
        page.goto(args.url, wait_until="domcontentloaded")
        try: page.wait_for_load_state("networkidle", timeout=60000)
        except PWTimeout: pass
        input("[Capture] Gérez cookies/challenge puis appuyez ENTRÉE pour capturer...")
        if args.wait>0: time.sleep(args.wait)
        html = page.content()
        browser.close()

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".html", encoding="utf-8") as tf:
        tf.write(html); tmp_path=tf.name

    cmd = [sys.executable, str(SCRAPER), "--html_path", tmp_path, "--out", str(OUTDIR), "--selectors", str(SELFILE)]
    print("[Capture] Parsing avec fetch_build.py ...")
    import subprocess
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT), timeout=120)
        print(proc.stdout)
        if proc.returncode != 0:
            print(proc.stderr or proc.stdout, file=sys.stderr); sys.exit(proc.returncode)
    finally:
        try: os.unlink(tmp_path)
        except Exception: pass

    print("[Capture] Terminé. Consultez data/builds/manifest.json et votre UI.")

if __name__ == "__main__":
    main()
