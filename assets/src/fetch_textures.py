"""Download the CC0 Poly Haven textures used by aquascape.py into assets/textures/ (gitignored).

Run: python3 assets/src/fetch_textures.py
Source: https://polyhaven.com (CC0, no attribution required).
"""

import json
import os
import urllib.request

TEXTURES = ["bark_willow_02", "dark_rock", "ganges_river_pebbles"]
MAPS = {"Diffuse": "diff", "Rough": "rough", "Displacement": "disp"}
HEADERS = {"User-Agent": "aquarium-screen-texture-fetch/0.1"}
OUT = os.path.join(os.path.dirname(__file__), "..", "textures")

for name in TEXTURES:
    req = urllib.request.Request(f"https://api.polyhaven.com/files/{name}", headers=HEADERS)
    files = json.load(urllib.request.urlopen(req))
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    for key, short in MAPS.items():
        dest = os.path.join(OUT, name, f"{short}.jpg")
        if not os.path.exists(dest):
            req = urllib.request.Request(files[key]["2k"]["jpg"]["url"], headers=HEADERS)
            with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
                f.write(r.read())
        print(dest)
