"""Copies the documentation screenshots from dev-browser's temp folder into ../screenshots.

Desktop full-page captures carry white margins (the browser window is wider than the page), so they are
cropped to the non-white area. Phone captures are copied as they are.

Run:  python docs/documentation/scripts/crop_shots.py
"""
from pathlib import Path

from PIL import Image, ImageChops

SRC = Path.home() / ".dev-browser" / "tmp"
OUT = Path(__file__).resolve().parent.parent / "screenshots"
OUT.mkdir(exist_ok=True)

for src in sorted(SRC.glob("doc-*.png")):
    image = Image.open(src).convert("RGB")
    if not src.name.startswith("doc-p-"):
        white = Image.new("RGB", image.size, (255, 255, 255))
        box = ImageChops.difference(image, white).getbbox()
        if box:
            image = image.crop(box)
    target = OUT / src.name.removeprefix("doc-")
    image.save(target, optimize=True)
    print(f"{target.name:24} {image.size}")
