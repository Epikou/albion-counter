
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse, os, re, json, datetime, hashlib, sys
from bs4 import BeautifulSoup

try:
    import yaml
except Exception:
    yaml = None

def load_selectors(path):
    if not path or not os.path.exists(path) or yaml is None:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}

def text_or_none(el):
    if not el: return None
    t = el.get_text(strip=True)
    return t if t else None

def guess_from_img(img):
    if not img: return None
    alt = img.get("alt"); title = img.get("title"); src = img.get("src")
    if alt and alt.strip(): return alt.strip()
    if title and title.strip(): return title.strip()
    if src:
        base = os.path.basename(src.split("?")[0])
        base = re.sub(r"[_\\-]+", " ", re.sub(r"\\.[a-zA-Z0-9]+$", "", base))
        if base: return base
    return None

def try_fields(soup, spec):
    result = {}
    fields = (spec.get("fields") or {}) if spec else {}
    for k, trials in fields.items():
        val = None
        for t in trials:
            css = t.get("css"); 
            if not css: continue
            el = soup.select_one(css)
            if not el: continue
            if el.name == "img":
                val = guess_from_img(el)
            elif el.name == "meta":
                val = el.get("content")
            else:
                val = text_or_none(el)
            if val: break
        if val: result[k] = val
    return result

def extract_abilities(soup, spec):
    names=set()
    fields=(spec.get("fields") or {}) if spec else {}
    for tr in fields.get("abilities", []):
        css=tr.get("css")
        for el in soup.select(css or ""):
            txt=text_or_none(el)
            if txt and len(txt)<=64: names.add(txt)
    return sorted(names)


def extract_weapon_code(soup):
    '''
    Try to extract an internal item code like T4_MAIN_AXE.
    1) Search inside common weapon slot containers.
    2) Fallback: scan the whole HTML for the first plausible weapon code.
    '''
    import re
    pat = re.compile(r"\bT[1-8]_[A-Z0-9_]{3,}\b")

    containers = [
        soup.select_one("[data-slot='weapon']"),
        soup.select_one("[class*='slot-weapon']"),
        soup.select_one("[class*='Weapon']"),
    ]
    for c in containers:
        if not c: continue
        html = str(c)
        m = pat.search(html)
        if m:
            return m.group(0)

    for img in soup.select("img"):
        for attr in ["alt", "title", "src", "data-uniqname", "data-item", "data-name"]:
            val = img.get(attr)
            if not val: continue
            m = pat.search(val if isinstance(val,str) else "")
            if m:
                return m.group(0)

    m = pat.search(str(soup))
    if m:
        return m.group(0)

    return None


def heuristic_weapon(soup):
    for sel in [
        "[data-slot='weapon'] img",
        "[class*='slot-weapon'] img",
        "[class*='Weapon'] img",
        "img[alt*='Axe' i], img[alt*='Sword' i], img[alt*='Spear' i], img[alt*='Bow' i], img[alt*='Dagger' i], img[alt*='Staff' i]",
        "img[title*='Axe' i], img[title*='Sword' i], img[title*='Spear' i], img[title*='Bow' i], img[title*='Dagger' i], img[title*='Staff' i]",
    ]:
        try:
            el = soup.select_one(sel)
            if el:
                g = guess_from_img(el)
                if g: return g
        except Exception:
            pass
    return None

def normalize(record, url):
    now = datetime.datetime.utcnow().isoformat()+"Z"
    src = url or ""
    id_seed = src if src else json.dumps(record, ensure_ascii=False)
    h = hashlib.sha256(id_seed.encode("utf-8")).hexdigest()[:12]
    title = record.get("title") or "Albion Build"
    return {
        "source": {"type":"albiononline_characterbuilder","url":src,"fetched_at":now,"id_hint":h},
        "meta": {"title": title, "author": record.get("author")},
        "gear": {
            "weapon": record.get("weapon"),
            "weapon_code": record.get("weapon_code"),
            "head": record.get("head"),
            "chest": record.get("chest"),
            "shoes": record.get("shoes"),
            "cape": record.get("cape"),
            "bag": record.get("bag"),
            "mount": record.get("mount"),
            "food": record.get("food"),
            "potion": record.get("potion"),
        },
        "abilities": record.get("abilities", [])
    }

def write_manifest(manifest_path, entry, filename):
    manifest={"builds":[]}
    if os.path.exists(manifest_path):
        try: manifest=json.load(open(manifest_path,"r",encoding="utf-8"))
        except Exception: pass
    entry2=dict(entry); entry2["_file"]=filename
    manifest["builds"].append(entry2)
    json.dump(manifest, open(manifest_path,"w",encoding="utf-8"), ensure_ascii=False, indent=2)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--url", required=False)
    ap.add_argument("--html_path", required=False)
    ap.add_argument("--out", default="data/builds")
    ap.add_argument("--selectors", default="tools/scraper/selectors.yaml")
    args=ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    if args.html_path:
        html = open(args.html_path,"r",encoding="utf-8").read()
    else:
        print("ERROR: use --html_path from api_server", file=sys.stderr)
        sys.exit(1)

    soup=BeautifulSoup(html,"lxml")
    spec=load_selectors(args.selectors)
    fields=try_fields(soup,spec)
    if not fields.get("weapon"):
        hw=heuristic_weapon(soup)
        if hw: fields["weapon"]=hw
    fields["abilities"] = extract_abilities(soup, spec)

    code_guess = extract_weapon_code(soup)
    if code_guess:
        fields["weapon_code"] = code_guess

    normalized=normalize(fields,args.url)
    slug=re.sub(r"[^a-z0-9]+","-", (normalized["meta"]["title"] or "").lower()).strip("-") or "albion-build"
    fname=f"{slug}-{normalized['source']['id_hint']}.json"
    fpath=os.path.join(args.out,fname)
    json.dump(normalized, open(fpath,"w",encoding="utf-8"), ensure_ascii=False, indent=2)
    write_manifest(os.path.join(args.out,"manifest.json"), normalized, fname)
    print("Saved:", fpath)
    print("Manifest:", os.path.join(args.out,"manifest.json"))

if __name__=="__main__":
    try: main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr); sys.exit(1)
