from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import subprocess, sys, os, json, pathlib, tempfile
from pathlib import Path
import re

# --- STATIC & CORS (fixed) ---
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Repo root = dossier parent de /tools
ROOT_DIR = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT_DIR

@app.route("/")
def _index():
    return send_from_directory(APP_ROOT, "index.html")

@app.route("/<path:path>")
def _static(path):
    p = APP_ROOT / path
    if p.is_dir():
        idx = p / "index.html"
        if idx.exists():
            return send_from_directory(p, "index.html")
    return send_from_directory(APP_ROOT, path)

# --- API CONFIG ---
ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRAPER = ROOT / "tools" / "scraper" / "fetch_build.py"
OUTDIR = ROOT / "data" / "builds"

def extract_code_from_html(html: str):
    try:
        m = re.search(r"\bT[1-8]_[A-Z0-9_]{3,}\b", html or "")
        return m.group(0) if m else None
    except Exception:
        return None

def fetch_html_playwright(url: str, timeout_sec: int = 60, headless: bool = True) -> str:
    from playwright.sync_api import sync_playwright
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless, args=["--no-sandbox", "--disable-setuid-sandbox"])
        context = browser.new_context(user_agent=ua, locale="fr-FR", viewport={"width": 1366, "height": 768})
        page = context.new_page()
        page.set_default_timeout(timeout_sec * 1000)
        page.goto(url, wait_until="networkidle")
        try:
            page.click("button:has-text('Accept')", timeout=2000)
        except Exception:
            pass
        html = page.content()
        browser.close()
        return html

@app.get("/api/health")
def health():
    return jsonify({"ok": True})

@app.post("/api/scrape")
def scrape():
    data = request.get_json(force=True, silent=True) or {}
    url = data.get("url") or request.args.get("url")
    if not url:
        return jsonify({"ok": False, "error": "Missing url"}), 400

    try:
        html = fetch_html_playwright(url, headless=True)
    except Exception as e1:
        try:
            html = fetch_html_playwright(url, headless=False)
        except Exception as e2:
            return jsonify({"ok": False, "error": f"Playwright fetch failed: {e1} / {e2}"}), 500

    OUTDIR.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".html", encoding="utf-8") as tf:
        tf.write(html)
        tmp_path = tf.name

    cmd = [sys.executable, str(SCRAPER), "--html_path", tmp_path, "--out", str(OUTDIR),
           "--selectors", str(ROOT / "tools" / "scraper" / "selectors.yaml")]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT), timeout=120)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    if proc.returncode != 0:
        return jsonify({"ok": False, "error": proc.stderr or proc.stdout}), 500

    try:
        manifest_path = OUTDIR / "manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            last = manifest.get("builds", [])[-1] if manifest.get("builds") else None
            if last:
                fpath = OUTDIR / last.get("_file", "")
                if fpath.exists():
                    data = json.loads(fpath.read_text(encoding="utf-8"))
                    wc = extract_code_from_html(html)
                    if wc:
                        data.setdefault('gear', {})['weapon_code'] = wc
                    if "source" in data and not data["source"].get("url"):
                        data["source"]["url"] = url
                    return jsonify({"ok": True, "build": data, "file": last.get("_file")})
        return jsonify({"ok": True, "message": "Scraped, but could not read back file."})
    except Exception as e:
        return jsonify({"ok": True, "message": f"Scraped. Read-back failed: {e}"}), 200

@app.post("/api/scrape_html")
def scrape_html():
    data = request.get_json(force=True, silent=True) or {}
    raw_html = data.get("html")
    url = data.get("url")
    if not raw_html:
        return jsonify({"ok": False, "error": "Missing 'html'"}), 400

    tmp_path = None
    try:
        OUTDIR.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".html", encoding="utf-8") as tf:
            tf.write(raw_html)
            tmp_path = tf.name
        cmd = [sys.executable, str(SCRAPER), "--html_path", tmp_path, "--out", str(OUTDIR),
               "--selectors", str(ROOT / "tools" / "scraper" / "selectors.yaml")]
        proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT), timeout=120)
        if proc.returncode != 0:
            return jsonify({"ok": False, "error": proc.stderr or proc.stdout}), 500

        manifest_path = OUTDIR / "manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            last = manifest.get("builds", [])[-1] if manifest.get("builds") else None
            if last:
                fpath = OUTDIR / last.get("_file", "")
                if fpath.exists():
                    data = json.loads(fpath.read_text(encoding="utf-8"))
                    wc = extract_code_from_html(raw_html)
                    if wc:
                        data.setdefault('gear', {})['weapon_code'] = wc
                    if url and "source" in data:
                        data["source"]["url"] = url
                    return jsonify({"ok": True, "build": data, "file": last.get("_file")})
        return jsonify({"ok": True, "message": "Parsed HTML, but could not read back file."})
    except Exception as e:
        return jsonify({"ok": False, "error": f"parse_html: {e}"}), 500
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except Exception:
            pass

if __name__ == "__main__":
    pass  # app.run disabled for Gunicorn
