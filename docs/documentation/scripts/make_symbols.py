"""Draws the small notation symbols used in the "Diagram symbols" tables of the project report.

Each symbol is a 300 x 120 PNG in ../symbols/, drawn in the same teal as the diagrams.
Run:  python docs/documentation/scripts/make_symbols.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "symbols"
OUT.mkdir(exist_ok=True)

W, H = 300, 120
LINE = (30, 127, 140)
INK = (32, 52, 58)
FILL = (234, 247, 251)
FONT = ImageFont.truetype("C:/Windows/Fonts/calibri.ttf", 22)
FONT_U = ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 22)


def canvas():
    image = Image.new("RGB", (W, H), "white")
    return image, ImageDraw.Draw(image)


def text(d, xy, s, font=FONT, fill=INK, underline=False):
    box = d.textbbox((0, 0), s, font=font)
    x, y = xy[0] - (box[2] - box[0]) / 2, xy[1] - (box[3] - box[1]) / 2 - box[1]
    d.text((x, y), s, font=font, fill=fill)
    if underline:
        d.line((x, y + box[3] + 2, x + box[2] - box[0], y + box[3] + 2), fill=fill, width=2)


def save(image, name):
    image.save(OUT / f"{name}.png")


def arrow_head(d, tip, direction="right", size=12, fill=INK):
    x, y = tip
    if direction == "right":
        d.polygon([(x, y), (x - size, y - size / 2), (x - size, y + size / 2)], fill=fill)
    else:  # down
        d.polygon([(x, y), (x - size / 2, y - size), (x + size / 2, y - size)], fill=fill)


# ---------- ER (Chen) ----------
i, d = canvas(); d.rectangle((70, 30, 230, 90), outline=LINE, fill=FILL, width=3); text(d, (150, 60), "ENTITY"); save(i, "er-entity")
i, d = canvas(); d.rectangle((70, 30, 230, 90), outline=LINE, fill=FILL, width=3)
d.polygon([(76, 60), (150, 34), (224, 60), (150, 86)], outline=LINE, width=2); save(i, "er-associative")
i, d = canvas(); d.ellipse((80, 30, 220, 90), outline=LINE, fill="white", width=3); text(d, (150, 60), "attribute"); save(i, "er-attribute")
i, d = canvas(); d.ellipse((80, 30, 220, 90), outline=LINE, fill="white", width=3); text(d, (150, 58), "keyId", FONT_U, underline=True); save(i, "er-key")
i, d = canvas(); d.polygon([(70, 60), (150, 22), (230, 60), (150, 98)], outline=LINE, fill=(237, 231, 250), width=3); text(d, (150, 60), "verb"); save(i, "er-relationship")
i, d = canvas(); d.line((50, 60, 250, 60), fill=INK, width=3); save(i, "er-link")
i, d = canvas(); d.line((40, 60, 260, 60), fill=INK, width=3); text(d, (70, 40), "1"); text(d, (225, 40), "0..N"); save(i, "er-cardinality")

# ---------- Use case ----------
i, d = canvas()
d.ellipse((135, 12, 165, 42), outline=INK, width=3)
d.line((150, 42, 150, 80), fill=INK, width=3); d.line((120, 55, 180, 55), fill=INK, width=3)
d.line((150, 80, 125, 110), fill=INK, width=3); d.line((150, 80, 175, 110), fill=INK, width=3)
save(i, "uc-actor")
i, d = canvas(); d.ellipse((60, 32, 240, 88), outline=LINE, fill="white", width=3); text(d, (150, 60), "Use case"); save(i, "uc-usecase")
i, d = canvas(); d.rounded_rectangle((40, 15, 260, 105), radius=8, outline=LINE, width=3); text(d, (150, 34), "System", FONT_U); save(i, "uc-system")
i, d = canvas(); d.line((50, 60, 250, 60), fill=INK, width=3); save(i, "uc-association")
i, d = canvas()
for x in range(40, 240, 16):
    d.line((x, 70, x + 9, 70), fill=INK, width=3)
arrow_head(d, (260, 70)); text(d, (150, 42), "<<include>> / <<extend>>"); save(i, "uc-dependency")

# ---------- Activity ----------
i, d = canvas(); d.ellipse((132, 42, 168, 78), fill=INK); save(i, "act-initial")
i, d = canvas(); d.rounded_rectangle((70, 32, 230, 88), radius=14, outline=LINE, fill=FILL, width=3); text(d, (150, 60), "Action"); save(i, "act-action")
i, d = canvas(); d.polygon([(150, 25), (190, 60), (150, 95), (110, 60)], outline=LINE, fill="white", width=3); save(i, "act-decision")
i, d = canvas(); d.rectangle((40, 54, 260, 66), fill=INK); save(i, "act-bar")
i, d = canvas(); d.ellipse((128, 38, 172, 82), outline=INK, width=3); d.ellipse((138, 48, 162, 72), fill=INK); save(i, "act-final")
i, d = canvas(); d.line((50, 60, 240, 60), fill=INK, width=3); arrow_head(d, (255, 60)); save(i, "act-flow")

# ---------- Flowchart ----------
i, d = canvas(); d.ellipse((80, 32, 220, 88), outline=LINE, fill="white", width=3); text(d, (150, 60), "Start / Stop"); save(i, "fc-terminal")
i, d = canvas(); d.rectangle((70, 32, 230, 88), outline=LINE, fill=FILL, width=3); text(d, (150, 60), "Process"); save(i, "fc-process")
i, d = canvas(); d.polygon([(100, 32), (262, 32), (200, 88), (38, 88)], outline=LINE, fill=FILL, width=3); text(d, (150, 60), "Input / Output"); save(i, "fc-io")
i, d = canvas(); d.polygon([(150, 18), (220, 60), (150, 102), (80, 60)], outline=LINE, fill="white", width=3); text(d, (150, 60), "Yes/No?"); save(i, "fc-decision")
i, d = canvas(); d.line((50, 60, 240, 60), fill=INK, width=3); arrow_head(d, (255, 60)); save(i, "fc-flow")

print("symbols written to", OUT)
