#!/usr/bin/env python3
"""V2 Higgsfield generations with stronger photorealism prompts."""
import json
import os
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

KEY_ID = "da99589f-f2b1-49c3-888c-9bb0d636290b"
KEY_SECRET = "8a2f909ae234f7e75b6030f3c5ef92dcfc444ca27ccaddc11503e668e600236c"
BASE = "https://platform.higgsfield.ai"
ENDPOINT = "/flux-pro/kontext/max/text-to-image"
HEADERS = {
    "Authorization": f"Key {KEY_ID}:{KEY_SECRET}",
    "Content-Type": "application/json",
    "User-Agent": "higgsfield-server-js/2.0",
    "Accept": "application/json",
}

# Consistent drink description used across all images
DRINK = (
    "a tall slim highball glass filled with vivid orange juice that is heavily creamy and cloudy, "
    "with white yogurt swirled and partially blended through the drink (not just floating on top, "
    "not just sitting at the bottom — creamy white tendrils mixed throughout the orange liquid like "
    "marble pattern), light foam at the top from stirring, single straight gold stainless-steel straw"
)

PHOTO = (
    "shot on Hasselblad H6D-100c, 85mm f/1.4 prime lens, shallow depth of field, natural soft daylight, "
    "Kodak Portra 400 film grain, editorial documentary photography, hyperrealistic, sharp focus on subject, "
    "natural skin texture with visible pores and fine wrinkles, no airbrushing, no smoothing, no AI plastic "
    "look, raw skin detail, candid and warm"
)

JOBS = [
    {
        "name": "hero",
        "prompt": (
            f"Wide cinematic still life food photograph: {DRINK}. "
            "The glass is the absolute hero of the frame and slightly off-center. Around it on a "
            "warm-cream linen tablecloth, naturally arranged: fresh whole oranges, ripe red strawberries, "
            "deep purple blueberries, halved beetroot showing magenta core, fresh carrots with green tops, "
            "raw almonds, dark red acerola cherries, a sliced apple. "
            f"{PHOTO}, very wide composition with breathing room, magazine cover quality, "
            "no text, no logos, no labels, no packaging, no branding."
        ),
        "aspect": "16:9",
    },
    {
        "name": "lifestyle-familie",
        "prompt": (
            f"Cinematic candid editorial photograph of a real loving family of four (mother around 35, father "
            "around 38, son around 7, daughter around 5) at a sunlit modern Scandinavian kitchen breakfast table. "
            "The mother is laughing while pouring fresh juice from a carafe; in the foreground sits "
            f"{DRINK}. Warm croissants, fresh fruit bowls, oats and berries on the table. "
            f"{PHOTO}, soft golden hour window light, real human imperfections, real skin, lived-in feeling, "
            "no text, no logos, no labels, no packaging, no brand on clothing."
        ),
        "aspect": "4:5",
    },
    {
        "name": "lifestyle-oma",
        "prompt": (
            f"Cinematic editorial portrait of a vibrant active woman around 65, silver gray hair styled "
            "naturally, real wrinkles around her eyes, warm smile, wearing a plain cashmere knit. She holds "
            f"{DRINK} at a bright contemporary kitchen counter. Fresh oranges and a small bowl of berries "
            "nearby. "
            f"{PHOTO}, dignified warmth, healthy vibrant senior, no text, no logos, no labels, no packaging, "
            "no brand on clothing."
        ),
        "aspect": "4:5",
    },
    {
        "name": "lifestyle-sportler",
        "prompt": (
            f"Cinematic editorial photograph of an athletic man around 30, short messy hair, real beard "
            "stubble, plain solid-color athletic shirt with NO logos, slightly sweaty after a run, holding "
            f"{DRINK} in a modern minimal loft kitchen with concrete walls. Some fresh fruit on the counter. "
            f"{PHOTO}, real sweat and skin texture, lived-in body, "
            "no text, no logos, no labels, no packaging, no brand on clothing, plain shirt only."
        ),
        "aspect": "4:5",
    },
    {
        "name": "lifestyle-frau",
        "prompt": (
            f"Cinematic editorial photograph of a real woman around 28, natural hair, minimal makeup, "
            "wearing a plain knit cardigan, sitting at her bright apartment kitchen counter on a barstool, "
            f"holding {DRINK} while looking at her open journal. Plants in background, scandinavian interior. "
            f"{PHOTO}, real freckles, real skin imperfections visible, candid morning moment, "
            "no text, no logos, no labels, no packaging, no brand on clothing."
        ),
        "aspect": "4:5",
    },
    # New foods (8 additional)
    {"name": "food-erdbeere", "prompt": "Studio macro photograph of three perfect ripe red strawberries with green leaves, water droplets, on soft cream linen background. Cinematic warm side light, hyperrealistic food photography, shot on Hasselblad, 100mm macro lens, no text or labels.", "aspect": "1:1"},
    {"name": "food-trauben", "prompt": "Studio macro photograph of a small bunch of dark purple grapes with natural bloom on the skin, single leaf, on soft cream linen background. Cinematic warm side light, hyperrealistic food photography, shot on Hasselblad, 100mm macro lens, no text or labels.", "aspect": "1:1"},
    {"name": "food-brokkoli", "prompt": "Studio macro photograph of a small fresh broccoli floret with deep green tops, on soft cream linen background. Cinematic warm side light, hyperrealistic food photography, shot on Hasselblad, 100mm macro lens, no text or labels.", "aspect": "1:1"},
    {"name": "food-spinat", "prompt": "Studio macro photograph of a few fresh spinach leaves, vibrant green, slightly overlapping, water droplets, on soft cream linen background. Cinematic warm side light, hyperrealistic food photography, shot on Hasselblad, 100mm macro lens, no text or labels.", "aspect": "1:1"},
    {"name": "food-avocado", "prompt": "Studio macro photograph of a ripe avocado halved, showing the buttery green flesh and large brown pit, on soft cream linen background. Cinematic warm side light, hyperrealistic food photography, shot on Hasselblad, 100mm macro lens, no text or labels.", "aspect": "1:1"},
    {"name": "food-banane", "prompt": "Studio macro photograph of a single ripe yellow banana with natural brown freckles, peel slightly opened at the top, on soft cream linen background. Cinematic warm side light, hyperrealistic food photography, shot on Hasselblad, 100mm macro lens, no text or labels.", "aspect": "1:1"},
    {"name": "food-walnuesse", "prompt": "Studio macro photograph of a small pile of walnuts, some halved showing the brain-like interior, on soft cream linen background. Cinematic warm side light, hyperrealistic food photography, shot on Hasselblad, 100mm macro lens, no text or labels.", "aspect": "1:1"},
    {"name": "food-sonnenblumenkerne", "prompt": "Studio macro photograph of a small pile of raw sunflower seeds (kernels), with shells visible, on soft cream linen background. Cinematic warm side light, hyperrealistic food photography, shot on Hasselblad, 100mm macro lens, no text or labels.", "aspect": "1:1"},
]


def post(url, data):
    req = urllib.request.Request(url, headers=HEADERS, data=json.dumps(data).encode("utf-8"), method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def submit(job):
    body = {"prompt": job["prompt"], "aspect_ratio": job["aspect"], "safety_tolerance": 2}
    try:
        res = post(BASE + ENDPOINT, body)
        return {"name": job["name"], "request_id": res.get("request_id"), "status": res.get("status")}
    except urllib.error.HTTPError as e:
        return {"name": job["name"], "error": str(e), "body": e.read().decode("utf-8", errors="ignore")}
    except Exception as e:
        return {"name": job["name"], "error": str(e)}


if __name__ == "__main__":
    out = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for r in [f.result() for f in [ex.submit(submit, j) for j in JOBS]]:
            print(r)
            out.append(r)
    with open(os.path.join(os.path.dirname(__file__), "jobs-v2.json"), "w") as f:
        json.dump(out, f, indent=2)
    print(f"\n{len([j for j in out if j.get('request_id')])}/{len(JOBS)} jobs submitted")
