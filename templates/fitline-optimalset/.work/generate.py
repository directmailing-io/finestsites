#!/usr/bin/env python3
"""Fire all Higgsfield image-generation jobs in parallel, save request_ids."""
import json
import os
import time
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

JOBS = [
    # HERO
    {
        "name": "hero",
        "prompt": (
            "Cinematic hero product photograph: a tall clear glass filled with vivid orange-colored vitamin drink, "
            "creamy white yogurt swirls floating on top and trailing inside the glass, slim natural-paper drinking straw. "
            "Surrounded on a clean light marble countertop by fresh whole oranges, ripe strawberries, blueberries, "
            "halved red beetroot, baby carrots, raw almonds, a sliced apple, and small red acerola cherries, arranged "
            "naturally and abundantly. Bright morning sunlight from the left, soft warm shadows, shallow depth of field, "
            "extreme photorealism, food photography for a wellness magazine. No text, no logos, no labels, no packaging."
        ),
        "aspect": "16:9",
    },
    # LIFESTYLE 1: Familie
    {
        "name": "lifestyle-familie",
        "prompt": (
            "Authentic candid photograph of a happy family of four (mother, father, son around 8, daughter around 6) "
            "having breakfast together at a sunlit modern kitchen table. The mother holds a tall glass of vivid orange "
            "vitamin drink, smiling warmly. Fresh fruits, oats, and bread on the table. Soft morning light through "
            "large windows, natural skin tones, photorealistic, real people, no models, lifestyle photography, "
            "warm and inviting. No text, no logos, no labels, no packaging."
        ),
        "aspect": "4:5",
    },
    # LIFESTYLE 2: Aeltere Dame
    {
        "name": "lifestyle-oma",
        "prompt": (
            "Cinematic portrait of an elegant active woman around 65 years old, silver gray hair styled neatly, "
            "warm friendly smile, wearing a casual cashmere sweater. She is holding a tall glass of vivid orange "
            "vitamin drink at a bright contemporary kitchen counter with a few fresh oranges and apples nearby. "
            "Soft natural window light, photorealistic, real person, vibrant and healthy appearance, lifestyle "
            "photography. No text, no logos, no labels, no packaging."
        ),
        "aspect": "4:5",
    },
    # LIFESTYLE 3: Junger sportlicher Mann
    {
        "name": "lifestyle-sportler",
        "prompt": (
            "Cinematic photograph of an athletic young man around 30 years old, light beard, wearing a fitted "
            "training t-shirt, slightly sweaty after a workout, holding a tall glass of vivid orange vitamin drink "
            "in a modern minimalistic loft kitchen. Fresh fruits on the counter, morning light from a window. "
            "Photorealistic, real person, healthy fit appearance, lifestyle sports photography. "
            "No text, no logos, no labels, no packaging."
        ),
        "aspect": "4:5",
    },
    # LIFESTYLE 4: Junge Frau
    {
        "name": "lifestyle-frau",
        "prompt": (
            "Authentic photograph of a young woman around 28 years old at her bright apartment kitchen, sitting "
            "on a barstool with her laptop, holding a tall glass of vivid orange vitamin drink, smiling. Soft "
            "natural light, plants in the background, contemporary scandinavian interior. Photorealistic, real "
            "person, casual lifestyle photography, warm and friendly. No text, no logos, no labels, no packaging."
        ),
        "aspect": "4:5",
    },
    # FOODS (8 cards)
    {
        "name": "food-rotebete",
        "prompt": (
            "Studio macro photograph of a single vibrant fresh red beetroot with a few green leaves, halved to show "
            "the deep magenta interior, on a soft cream paper background. Cinematic side light, photorealistic food "
            "photography, abundant detail, no text or labels."
        ),
        "aspect": "1:1",
    },
    {
        "name": "food-karotte",
        "prompt": (
            "Studio macro photograph of two fresh orange carrots with green tops, lying on a soft cream paper "
            "background, water droplets visible. Cinematic warm light, photorealistic food photography, no text or labels."
        ),
        "aspect": "1:1",
    },
    {
        "name": "food-orange",
        "prompt": (
            "Studio macro photograph of a fresh orange cut in half, juicy interior facing camera, on a soft cream "
            "paper background. Cinematic warm light, photorealistic, no text or labels."
        ),
        "aspect": "1:1",
    },
    {
        "name": "food-acerola",
        "prompt": (
            "Studio macro photograph of fresh ripe red acerola cherries in a small group, glossy skin, on a soft cream "
            "paper background. Cinematic side light, photorealistic, no text or labels."
        ),
        "aspect": "1:1",
    },
    {
        "name": "food-heidelbeere",
        "prompt": (
            "Studio macro photograph of fresh blueberries in a small pile with a few leaves, on a soft cream paper "
            "background. Cinematic warm light, photorealistic, no text or labels."
        ),
        "aspect": "1:1",
    },
    {
        "name": "food-apfel",
        "prompt": (
            "Studio macro photograph of a fresh red apple cut in half showing seeds and crisp interior, on a soft "
            "cream paper background. Cinematic warm light, photorealistic, no text or labels."
        ),
        "aspect": "1:1",
    },
    {
        "name": "food-mandeln",
        "prompt": (
            "Studio macro photograph of a small pile of fresh raw almonds, some halved showing interior, on a soft "
            "cream paper background. Cinematic warm light, photorealistic, no text or labels."
        ),
        "aspect": "1:1",
    },
    {
        "name": "food-kuerbiskerne",
        "prompt": (
            "Studio macro photograph of a small pile of green pumpkin seeds, on a soft cream paper background. "
            "Cinematic warm light, photorealistic, no text or labels."
        ),
        "aspect": "1:1",
    },
]


def post(url, data):
    req = urllib.request.Request(url, headers=HEADERS, data=json.dumps(data).encode("utf-8"), method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def submit(job):
    body = {
        "prompt": job["prompt"],
        "aspect_ratio": job["aspect"],
        "safety_tolerance": 2,
    }
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
        futures = {ex.submit(submit, j): j for j in JOBS}
        for fut in as_completed(futures):
            r = fut.result()
            print(r)
            out.append(r)
    with open(os.path.join(os.path.dirname(__file__), "jobs.json"), "w") as f:
        json.dump(out, f, indent=2)
    print(f"\n{len([j for j in out if j.get('request_id')])}/{len(JOBS)} jobs submitted")
