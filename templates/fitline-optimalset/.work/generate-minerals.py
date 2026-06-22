#!/usr/bin/env python3
"""Generate top-down powder images for minerals + active ingredients
that are in Activize, Restorate, Probiotic, but not visually in PowerCocktail plants.
Same style as food images for consistency."""
import os
import json
import base64
import urllib.request
import urllib.error
import sys
from concurrent.futures import ThreadPoolExecutor

API_KEY = os.environ.get("OPENAI_API_KEY", "")
ENDPOINT = "https://api.openai.com/v1/images/generations"
OUT_DIR = "/Users/kurzeja/new-finestsites/templates/fitline-optimalset/assets"

STYLE_SUFFIX = (
    "photographed from directly above on a soft warm cream off-white linen "
    "background (#F1EBE0 tone). Editorial top-down still life, studio overhead "
    "soft daylight, subtle natural shadow directly under the heap, "
    "hyperrealistic minimalist product photography, shot on Hasselblad 100mm "
    "macro lens, very sharp focus, single isolated subject, perfectly centered "
    "minimal composition with plenty of breathing room. "
    "No text, no labels, no packaging, no logos, no scoops, no spoons, "
    "no second subjects. Clean studio look, even soft lighting."
)

INGREDIENTS = [
    ("food-magnesium",
     "a small neat round heap of fine pure-white magnesium powder, "
     "soft chalky matte texture, slightly cool snow-white tone, "
     "approximately 5 cm wide"),
    ("food-calcium",
     "a small neat round heap of pure bright-white calcium carbonate powder, "
     "fine chalky soft texture, approximately 5 cm wide"),
    ("food-zink",
     "a small neat round heap of soft creamy off-white zinc powder, "
     "slightly warm beige tone, matte fine texture, approximately 5 cm wide"),
    ("food-eisen",
     "a small neat round heap of rust-red iron oxide powder, "
     "warm terracotta color, fine grainy matte texture, approximately 5 cm wide"),
    ("food-selen",
     "a small neat round heap of pale yellowish-beige selenium yeast powder, "
     "soft pastel tone, fine texture, approximately 5 cm wide"),
    ("food-q10",
     "a small neat round heap of vivid saffron-orange Coenzyme Q10 powder, "
     "warm golden yellow-orange tone, fine matte texture, approximately 5 cm wide"),
    ("food-guarana",
     "a small neat round heap of reddish-brown guarana seed powder, "
     "warm cocoa-like color, slightly grainy texture, approximately 5 cm wide"),
    ("food-inulin",
     "a small neat round heap of fine snow-white inulin fiber powder, "
     "very fluffy light texture, pure white, approximately 5 cm wide"),
]

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def generate(name, subject):
    prompt = f"{subject}, {STYLE_SUFFIX}"
    body = {
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": "1024x1024",
        "quality": "high",
        "n": 1,
        "background": "auto",
    }
    req = urllib.request.Request(
        ENDPOINT, headers=HEADERS,
        data=json.dumps(body).encode(), method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            res = json.loads(r.read())
        b64 = res["data"][0]["b64_json"]
        img_bytes = base64.b64decode(b64)
        out = os.path.join(OUT_DIR, f"{name}.png")
        with open(out, "wb") as f:
            f.write(img_bytes)
        return (name, "ok", len(img_bytes))
    except urllib.error.HTTPError as e:
        return (name, "http_error", e.code, e.read().decode("utf-8", errors="ignore")[:500])
    except Exception as e:
        return (name, "error", str(e))


if __name__ == "__main__":
    if not API_KEY:
        print("OPENAI_API_KEY env var not set", file=sys.stderr)
        sys.exit(1)
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(generate, name, subject) for name, subject in INGREDIENTS]
        for f in futures:
            print(f.result(), flush=True)
