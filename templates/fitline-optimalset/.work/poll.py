#!/usr/bin/env python3
"""Poll all jobs.json request_ids until done, download images to assets/."""
import json
import os
import time
import urllib.request

KEY_ID = "da99589f-f2b1-49c3-888c-9bb0d636290b"
KEY_SECRET = "8a2f909ae234f7e75b6030f3c5ef92dcfc444ca27ccaddc11503e668e600236c"
BASE = "https://platform.higgsfield.ai"
HEADERS = {
    "Authorization": f"Key {KEY_ID}:{KEY_SECRET}",
    "User-Agent": "higgsfield-server-js/2.0",
    "Accept": "application/json",
}

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "..", "assets")
os.makedirs(ASSETS, exist_ok=True)


def get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        with open(path, "wb") as f:
            f.write(r.read())


with open(os.path.join(ROOT, "jobs.json")) as f:
    jobs = json.load(f)

remaining = {j["name"]: j["request_id"] for j in jobs if j.get("request_id")}
done = {}
deadline = time.time() + 600  # 10 min max

while remaining and time.time() < deadline:
    finished = []
    for name, rid in remaining.items():
        try:
            res = get(f"{BASE}/requests/{rid}/status")
            status = res.get("status")
            if status == "completed":
                imgs = res.get("images") or res.get("results") or []
                if imgs:
                    url = imgs[0].get("url") or imgs[0].get("raw", {}).get("url")
                    if url:
                        path = os.path.join(ASSETS, f"{name}.png")
                        try:
                            download(url, path)
                            print(f"OK   {name} -> {path}")
                            done[name] = path
                        except Exception as e:
                            print(f"DL_ERR {name}: {e}")
                finished.append(name)
            elif status in ("failed", "nsfw", "error"):
                print(f"FAIL {name}: {status} - {res}")
                finished.append(name)
        except Exception as e:
            print(f"ERR {name}: {e}")

    for n in finished:
        remaining.pop(n, None)

    if remaining:
        print(f"... {len(remaining)} pending: {list(remaining.keys())}")
        time.sleep(6)

print(f"\nDone: {len(done)}/{len(jobs)}")
