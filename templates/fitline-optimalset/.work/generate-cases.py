#!/usr/bin/env python3
"""Generate 12 AG1-style pillar images via OpenAI gpt-image-2.
Cinematic, authentic lifestyle photography. 3 cards feature the PowerCocktail."""
import os
import json
import base64
import urllib.request
import urllib.error
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

API_KEY = os.environ.get("OPENAI_API_KEY", "")
ENDPOINT = "https://api.openai.com/v1/images/generations"
OUT_DIR = "/Users/kurzeja/new-finestsites/templates/fitline-optimalset/assets"

POWERCOCKTAIL = (
    "a tall slim highball glass made of clear cut crystal with a delicate diamond-cut "
    "geometric pattern. The glass is filled with a vivid creamy orange-peach colored drink, "
    "slightly cloudy and opaque (fresh orange juice swirled with creamy white yogurt, "
    "mostly homogeneous with faint marbling). Light foam on top, single gold-tone straight "
    "stainless steel straw, condensation forming on the glass exterior"
)

ACTIVIZE = (
    "a clear cylindrical tall drinking glass filled with a vivid translucent ruby-red "
    "drink, clear and bright (like a fresh berry-cranberry-acerola juice, completely "
    "transparent and crystal-clear red, no creaminess, slightly carbonated with fine "
    "bubbles rising). Condensation forming on the glass exterior"
)

PHOTO_STYLE = (
    "Cinematic lifestyle commercial photography in the style of AG1 Athletic Greens or "
    "Apple editorial global campaigns. Shot on professional cinema camera with 50mm "
    "anamorphic prime lens at T1.8, shallow depth of field with creamy oval bokeh, "
    "natural ambient lighting only, no studio flash. Color graded with Kodak Vision3 "
    "250D motion-picture film stock look: subtle teal shadows and warm midtones, slight "
    "filmic contrast. Magazine-quality editorial photography, authentic candid moment, "
    "genuine unforced expression, person engaged in their natural state. No text on "
    "clothing, no brand logos, no watermarks, no stock-photo polish. Premium commercial "
    "production value."
)

CASES = [
    # ---- 1. Energie + PowerCocktail ----
    ("case-1-energie",
     f"Cinematic lifestyle commercial photograph: a Black man in his late 20s, short "
     f"natural hair, light beard, small tattoos visible on the side of his neck, wearing "
     f"a relaxed dark navy sweatshirt, smiling genuinely as he looks down at "
     f"{POWERCOCKTAIL} in his hand. Soft warm golden hour light bouncing off a red brick "
     f"wall in the background, slightly blurred. Anamorphic shallow depth of field with "
     f"warm cinematic color grade."),

    # ---- 2. Immunsystem ----
    ("case-2-immunsystem",
     "Cinematic lifestyle commercial photograph: a woman in her early 30s with shoulder-"
     "length dark wavy hair, embracing her toddler (around two years old) in a warm "
     "outdoor garden setting in Germany. Soft afternoon light filters through tree leaves "
     "behind them. Both share a quiet content smile. Wearing comfortable knitwear. "
     "Authentic tender family moment. Shallow depth of field, warm cinematic color grade."),

    # ---- 3. Konzentration (mit Activize-Drink) ----
    ("case-3-konzentration",
     f"Cinematic lifestyle commercial photograph: a man in his mid 30s wearing a soft "
     f"wool sweater, thin glasses, focused and engaged at a wooden desk in a softly lit "
     f"modern German apartment. He is taking a sip from {ACTIVIZE} held in one hand, his "
     f"open laptop and notebook in front of him. Wooden bookshelf with plants softly out "
     f"of focus behind. Side-light through tall window casts warm rim light on his "
     f"profile. Shallow depth of field, warm cinematic color grade."),

    # ---- 4. Innere Balance ----
    ("case-4-balance",
     "Cinematic lifestyle commercial photograph: a young woman in her late 20s with long "
     "wavy blonde hair, sitting cross-legged in a peaceful lotus pose on a private "
     "rooftop terrace in Munich at sunset, hands resting on her knees palms-up, eyes "
     "softly closed in a deep calming breath. Pink-orange sunset sky and out-of-focus "
     "city lights bokeh behind her. Wearing a simple white tank top. Low side angle shot. "
     "Atmospheric cinematic color grade."),

    # ---- 5. Verdauung + PowerCocktail ----
    ("case-5-verdauung",
     f"Cinematic lifestyle commercial photograph: a woman in her early 40s with long "
     f"wavy honey-brown hair, sitting in the driver's seat of a parked German car wearing "
     f"a black puffer jacket, taking a refreshing sip from {POWERCOCKTAIL}. Soft warm "
     f"natural window light from the side illuminates her profile. Berlin urban setting "
     f"softly blurred outside through the windshield. Genuine satisfied content "
     f"expression. Shallow depth of field, warm cinematic color grade."),

    # ---- 6. Haut, Haare & Nägel ----
    ("case-6-beauty",
     "Cinematic lifestyle commercial photograph: a young Black woman in her late 20s "
     "with a very short cropped haircut, healthy sun-kissed glowing skin, small gold "
     "earrings, wearing a simple black athletic tank top, slightly lifting her chin "
     "toward the sky with eyes softly closed in a moment of self-care. Bright blue sky "
     "with soft cloud wisps behind her. Low angle looking up. Clean vibrant cinematic "
     "color grade."),

    # ---- 7. Muskelkraft ----
    ("case-7-muskelkraft",
     "Cinematic lifestyle commercial photograph: a man in his early 30s with athletic "
     "build, plain black athletic shirt and dark cap, mid-action on an outdoor tennis "
     "court in Germany, focused determined expression as he reaches forward to hit a "
     "forehand volley. Golden hour late-afternoon side-light, slight motion blur on his "
     "arm. Sport documentary cinematic photography, shallow depth of field."),

    # ---- 8. Stoffwechsel ----
    ("case-8-stoffwechsel",
     "Cinematic lifestyle commercial photograph: a woman in her early 30s with medium-"
     "length dark hair in a loose ponytail, engaged and focused, chopping vibrant fresh "
     "colorful vegetables (bell peppers, herbs, lemons, leafy greens) on a wooden cutting "
     "board in a sunlit modern German kitchen. Warm side-light through a large window "
     "illuminates the scene. Shallow depth of field, warm cinematic color grade."),

    # ---- 9. Hormonbalance ----
    ("case-9-hormonbalance",
     "Cinematic lifestyle commercial photograph: a woman in her mid 30s with shoulder-"
     "length brown hair softly falling, wrapped in a soft cream-colored wool cardigan, "
     "sitting peacefully on a wide window bench in a sunlit modern German apartment, "
     "holding a ceramic mug of herbal tea with both hands cupped close to her chest. "
     "Eyes softly closed in a calm reflective content moment. Soft warm morning light "
     "streams through the large window. A few green plants softly out of focus behind "
     "her. Intimate cinematic photography, shallow depth of field, warm cinematic color "
     "grade."),

    # ---- 10. Erholung ----
    ("case-10-erholung",
     "Cinematic lifestyle commercial photograph: a woman in her mid 30s with long "
     "brunette hair, lying back peacefully on a soft cream linen couch in a sunlit "
     "modern German apartment, eyes softly closed, a hardcover book resting open on her "
     "chest. Late afternoon golden light streaming through window casts warm bands of "
     "light across her. Calm dreamy still moment. Shallow depth of field, very warm "
     "cinematic color grade."),

    # ---- 11. Zellschutz + PowerCocktail ----
    ("case-11-zellschutz",
     f"Cinematic lifestyle commercial photograph: a Hispanic woman in her early 30s with "
     f"long dark hair, standing on a forest hiking trail in the Bavarian Alps, looking "
     f"up at the sky through tall pine trees, holding {POWERCOCKTAIL}. Sunlight streams "
     f"through the trees creating dappled light patterns. Wearing comfortable hiking "
     f"attire (soft fleece jacket). Vibrant outdoor cinematic color grade, shallow depth "
     f"of field."),

    # ---- 12. Vital älter werden ----
    ("case-12-vital",
     "Cinematic lifestyle commercial photograph: a German woman around 58, naturally "
     "silver-grey shoulder-length hair styled simply, real laugh lines around her eyes, "
     "vibrant healthy skin, wearing a comfortable beige knit sweater, laughing genuinely "
     "at someone off-camera while standing in her sunlit autumn garden surrounded by "
     "golden falling leaves. Authentic joyful candid moment. Late afternoon golden hour "
     "light, shallow depth of field, warm vibrant cinematic color grade."),
]

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def generate(name, subject):
    prompt = f"{subject} {PHOTO_STYLE}"
    body = {
        "model": "gpt-image-2",
        "prompt": prompt,
        "size": "1536x1024",
        "quality": "high",
        "n": 1,
        "background": "auto",
    }
    req = urllib.request.Request(
        ENDPOINT, headers=HEADERS,
        data=json.dumps(body).encode(), method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            res = json.loads(r.read())
        b64 = res["data"][0]["b64_json"]
        img_bytes = base64.b64decode(b64)
        out_png = os.path.join(OUT_DIR, f"{name}.png")
        out_webp = os.path.join(OUT_DIR, f"{name}.webp")
        with open(out_png, "wb") as f:
            f.write(img_bytes)
        subprocess.run([
            "magick", out_png, "-resize", "900x600", "-quality", "82", out_webp,
        ], check=True)
        os.remove(out_png)
        return (name, "ok", f"webp={os.path.getsize(out_webp)}")
    except urllib.error.HTTPError as e:
        return (name, "http_error", e.code, e.read().decode("utf-8", errors="ignore")[:500])
    except Exception as e:
        return (name, "error", str(e))


if __name__ == "__main__":
    if not API_KEY:
        print("OPENAI_API_KEY env var not set", file=sys.stderr)
        sys.exit(1)
    if len(sys.argv) > 1:
        target = sys.argv[1]
        for name, subject in CASES:
            if name == target:
                print(generate(name, subject))
                sys.exit(0)
        print(f"Unknown: {target}", file=sys.stderr)
        sys.exit(1)
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(generate, name, subject) for name, subject in CASES]
        for f in futures:
            print(f.result(), flush=True)
