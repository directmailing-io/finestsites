#!/usr/bin/env python3
"""Generate top-down food/ingredient images via OpenAI gpt-image-1.

Style: cinematic editorial top-down on cream linen, centered/isolated,
realistic stock-photo feel, einheitlich für die "Was steckt drin"-Sektion.
"""
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
    "soft daylight, subtle natural shadow directly under the subject, "
    "hyperrealistic food photography, shot on Hasselblad 100mm macro lens, "
    "very sharp focus on the subject, single isolated subject, perfectly "
    "centered minimal composition with plenty of breathing room around the subject. "
    "No text, no labels, no packaging, no logos, no second subjects, no props. "
    "Clean studio look, even soft lighting, no harsh highlights."
)

INGREDIENTS = [
    ("food-rotebete", "one small fresh raw red beetroot bulb with its thin green leafy top still attached"),
    ("food-brokkoli", "one small fresh green broccoli floret with stem"),
    ("food-karotte", "a small bundle of three fresh slender orange carrots with their green leafy tops"),
    ("food-heidelbeere", "a small loose pile of about fifteen fresh whole blueberries"),
    ("food-apfel", "one whole fresh ripe deep-red apple with a tiny stem"),
    ("food-kurkuma", "two fresh turmeric roots, one of them sliced in half showing the vivid orange interior"),
    ("food-spinat", "a small loose pile of about ten fresh young spinach leaves"),
    ("food-granatapfel", "one fresh pomegranate cut in half, the cut side facing up showing the glossy ruby red seeds"),
    ("food-zimt", "two natural rolled cinnamon sticks lying parallel"),
    ("food-tomate", "three fresh ripe red cherry tomatoes still on the green vine"),
    ("food-ingwer", "one fresh whole ginger root piece, knobby and beige"),
    ("food-erdbeere", "three perfect fresh ripe red strawberries with their green stems"),
    ("food-acerola", "a small cluster of about eight fresh red acerola cherries with stems"),
    ("food-schwarzejohannisbeere", "a small cluster of fresh dark black currants on a thin stem with one or two small green leaves"),
    ("food-cranberry", "a small loose pile of about twelve fresh whole red cranberries"),
    ("food-sauerkirsche", "a small bunch of about six fresh dark-red sour cherries with green stems joined together"),
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
        ENDPOINT,
        headers=HEADERS,
        data=json.dumps(body).encode(),
        method="POST",
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
    # Allow single-ingredient test: python generate-foods.py food-rotebete
    if len(sys.argv) > 1:
        target = sys.argv[1]
        for name, subject in INGREDIENTS:
            if name == target:
                print(generate(name, subject))
                sys.exit(0)
        print(f"Unknown: {target}", file=sys.stderr)
        sys.exit(1)
    # Batch
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(generate, name, subject) for name, subject in INGREDIENTS]
        for f in futures:
            print(f.result(), flush=True)
