"""Chen-notation E-R diagram for the 9 MVP entities (DisCharge+).

Hand-placed layout (PlantUML/Graphviz cannot draw Chen notation well), written as SVG and
rendered to PNG with headless Chrome.

    python er_chen.py            -> er-chen.svg + er-chen.png

Entity and attribute names MUST match 08-phase1-data-dictionary.md and er.puml.
The script prints an overlap report; keep it at 0 after moving anything.
"""
import math
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image

HERE = Path(__file__).resolve().parent
W, H = 3480, 3120
FONT = "Calibri, Arial, sans-serif"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# name, centre, fill, border, attrs [(label, key, dx, dy)]  key: PK / FK / U / ''
A, B, C = 600, 1700, 2880
R1, R2, R3 = 470, 1250, 2030
ENTITIES = {
    "USER": ((A, R1), "#FBE0E3", "#C0485A", [
        ("userId", "PK", -330, -200), ("fullName", "", -110, -245), ("phone", "U", 120, -245),
        ("passwordHash", "", 350, -195), ("role", "", -380, -95),
        ("preferredLanguage", "", 330, 135), ("isActive", "", -300, 140)]),
    "PATIENT": ((A, R2), "#DDF1E4", "#3F8F5E", [
        ("patientId", "PK", -330, -115), ("userId", "FK", -380, 15), ("abhaId", "U", -340, 150),
        ("dateOfBirth", "", 350, 40), ("gender", "", 310, 150), ("district", "", -130, 200)]),
    "DISCHARGE_PLAN": ((B, R1), "#E6DEFA", "#6B4FBF", [
        ("planId", "PK", -500, -160), ("patientId", "FK", -300, -240),
        ("clinicianId", "FK", -60, -160), ("admissionDate", "", 90, -240),
        ("dischargeDate", "", 440, -95), ("primaryDiagnosis", "", 340, -235),
        ("redFlags", "", -440, 115), ("followUpProtocol", "", 210, 150), ("status", "", 450, 105)]),
    "FOLLOW_UP": ((C, R1), "#FFF1D6", "#C98A1B", [
        ("followUpId", "PK", -320, -165), ("planId", "FK", -100, -240),
        ("scheduledDate", "", 130, -165), ("type", "", 430, -205), ("description", "", 400, -40),
        ("status", "", 320, 130), ("completedDate", "", 60, 175)]),
    "PRESCRIPTION": ((B, R2), "#DCEBFA", "#3C74B3", [
        ("prescriptionId", "PK", -410, -100), ("planId", "FK", -440, 25),
        ("medicationId", "FK", -390, 150), ("dosage", "", -170, -165), ("frequency", "", 170, -170),
        ("timingSlots", "", -170, 190), ("durationDays", "", 80, 200), ("isCritical", "", 400, -110)]),
    "MEDICATION": ((C, R2), "#DAF3F1", "#2F8C86", [
        ("medicationId", "PK", -170, -160), ("genericName", "U", 170, -160),
        ("form", "", 380, 0), ("strength", "", 170, 150)]),
    "SYMPTOM_LOG": ((A, R3), "#FDE6D8", "#C4642C", [
        ("symptomLogId", "PK", -350, -110), ("patientId", "FK", -400, 30),
        ("reportedAt", "", -290, 165), ("symptoms", "", -20, 200), ("severity", "", 220, 170),
        ("triageTier", "", 290, -125), ("triggeredRules", "", 380, 90)]),
    "ESCALATION": ((B, R3), "#FADCE8", "#B23A6E", [
        ("escalationId", "PK", -650, -300), ("patientId", "FK", -300, -300),
        ("symptomLogId", "FK", -20, -300), ("adherenceId", "FK", 280, -300),
        ("assignedClinicianId", "FK", -600, -140), ("source", "", -250, -165), ("tier", "", 70, -165),
        ("triggeredRules", "", 580, -280), ("status", "", 560, -120),
        ("createdAt", "", -440, 125), ("acknowledgedAt", "", -220, 210),
        ("resolvedAt", "", 220, 210), ("notes", "", 440, 125)]),
    "ADHERENCE_RECORD": ((C, R3), "#E4ECD7", "#6A8A2E", [
        ("adherenceId", "PK", 150, -170), ("prescriptionId", "FK", 400, -55),
        ("scheduledAt", "", 400, 80), ("status", "", 190, 175), ("recordedAt", "", -130, 175)]),
}
ASSOCIATIVE = {"PRESCRIPTION"}

# (entity1, card1, verb, entity2, card2)   same as er.puml
RELS = [
    ("USER", "1", "has", "PATIENT", "0..1"),
    ("USER", "1", "authors", "DISCHARGE_PLAN", "0..N"),
    ("PATIENT", "1", "receives", "DISCHARGE_PLAN", "0..N"),
    ("DISCHARGE_PLAN", "1", "schedules", "FOLLOW_UP", "0..N"),
    ("DISCHARGE_PLAN", "1", "contains", "PRESCRIPTION", "1..N"),
    ("MEDICATION", "1", "prescribed in", "PRESCRIPTION", "0..N"),
    ("PRESCRIPTION", "1", "generates", "ADHERENCE_RECORD", "0..N"),
    ("PATIENT", "1", "reports", "SYMPTOM_LOG", "0..N"),
    ("SYMPTOM_LOG", "0..1", "triggers", "ESCALATION", "0..1"),
    ("ADHERENCE_RECORD", "0..1", "triggers", "ESCALATION", "0..1"),
]
# USER --handles-- ESCALATION is routed round the left and bottom edges (orthogonal).
CHANNEL_X, CHANNEL_Y = 70, 2395
HANDLES_AT = (1150, CHANNEL_Y)

EW, EH = 330, 78          # entity box
DW, DH = 118, 56          # diamond half sizes
AF, EF, RF = 22, 30, 22   # font sizes: attribute, entity, relationship
ARY1, ARY2 = 32, 44       # attribute ellipse ry (one line / two lines)


def text_w(s, size):
    return len(s) * size * 0.49


def attr_geom(label, key):
    sub = {"PK": "(PK)", "FK": "(FK)", "U": "(Unique)"}.get(key, "")
    rx = max(text_w(label, AF), text_w(sub, AF)) / 2 + 26
    return max(rx, 62), (ARY2 if sub else ARY1), sub


svg, shapes, lines = [], [], []   # shapes: (kind, cx, cy, rx, ry, name); lines: (p, q, ends)


def line(p, q, ends, width=2.2, color="#39434A"):
    lines.append((p, q, ends))
    svg.append(f'<line x1="{p[0]:.0f}" y1="{p[1]:.0f}" x2="{q[0]:.0f}" y2="{q[1]:.0f}" '
               f'stroke="{color}" stroke-width="{width}"/>')


def text(x, y, s, size, weight="normal", color="#1F2A30", anchor="middle", deco="", style=""):
    svg.append(f'<text x="{x:.0f}" y="{y:.0f}" font-size="{size}" font-weight="{weight}" '
               f'fill="{color}" text-anchor="{anchor}" dominant-baseline="central" '
               f'text-decoration="{deco}" font-style="{style or "normal"}">{escape(s)}</text>')


def box_exit(c, toward, hw=EW / 2, hh=EH / 2):
    """Point where the ray centre->toward leaves an axis-aligned box."""
    dx, dy = toward[0] - c[0], toward[1] - c[1]
    t = min(hw / abs(dx) if dx else 1e9, hh / abs(dy) if dy else 1e9)
    return c[0] + dx * t, c[1] + dy * t


def card_label(c, toward, s):
    ex, ey = box_exit(c, toward)
    dx, dy = toward[0] - c[0], toward[1] - c[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    px, py = -uy, ux                       # perpendicular
    if py > 0 or (py == 0 and px < 0):     # keep label above / right of the line
        px, py = -px, -py
    d = 34
    while True:   # slide along the line until the label clears the entity box
        x, y = ex + ux * d + px * 24, ey + uy * d + py * 24
        if abs(x - c[0]) > EW / 2 + 30 or abs(y - c[1]) > EH / 2 + 16:
            break
        d += 6
    text(x, y, s, 24, "bold", "#1F2A30")


# ---- 1. lines (drawn first so shapes paint over their ends) --------------------------------
diamonds = []
for e1, c1, verb, e2, c2 in RELS:
    p, q = ENTITIES[e1][0], ENTITIES[e2][0]
    m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    line(p, q, {e1, e2, verb + str(m)})
    diamonds.append((m, verb, e1, c1, e2, c2))

u, esc = ENTITIES["USER"][0], ENTITIES["ESCALATION"][0]
route = [u, (CHANNEL_X, u[1]), (CHANNEL_X, CHANNEL_Y), (esc[0], CHANNEL_Y), esc]
for p, q in zip(route, route[1:]):
    line(p, q, {"USER", "ESCALATION", "handles" + str(HANDLES_AT)})

for name, (c, fill, border, attrs) in ENTITIES.items():
    for label, key, dx, dy in attrs:
        line(c, (c[0] + dx, c[1] + dy), {name, name + "." + label}, 1.6, border)

# ---- 2. attributes ---------------------------------------------------------------------------
for name, (c, fill, border, attrs) in ENTITIES.items():
    for label, key, dx, dy in attrs:
        x, y = c[0] + dx, c[1] + dy
        rx, ry, sub = attr_geom(label, key)
        shapes.append(("ell", x, y, rx, ry, name + "." + label))
        svg.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx:.0f}" ry="{ry}" fill="#FFFFFF" '
                   f'stroke="{border}" stroke-width="2"/>')
        style = "italic" if key == "FK" else ""
        if sub:
            text(x, y - 12, label, AF, "bold" if key == "PK" else "normal",
                 deco="underline" if key == "PK" else "", style=style)
            text(x, y + 14, sub, AF - 2, color="#4A555C")
        else:
            text(x, y, label, AF)

# ---- 3. relationships ------------------------------------------------------------------------
def diamond(m, verb):
    x, y = m
    shapes.append(("dia", x, y, DW, DH, verb + str(m)))
    svg.append(f'<polygon points="{x},{y - DH} {x + DW},{y} {x},{y + DH} {x - DW},{y}" '
               f'fill="#EEE6FB" stroke="#6B4FBF" stroke-width="2.2"/>')
    text(x, y, verb, RF, "bold", "#3A2A73")


for m, verb, e1, c1, e2, c2 in diamonds:
    diamond(m, verb)
    card_label(ENTITIES[e1][0], m, c1)
    card_label(ENTITIES[e2][0], m, c2)
diamond(HANDLES_AT, "handles")
card_label(u, (CHANNEL_X, u[1]), "1")
text(esc[0] + 26, esc[1] + EH / 2 + 40, "0..N", 24, "bold", anchor="start")

# ---- 4. entities -----------------------------------------------------------------------------
for name, (c, fill, border, attrs) in ENTITIES.items():
    x, y = c[0] - EW / 2, c[1] - EH / 2
    shapes.append(("box", c[0], c[1], EW / 2, EH / 2, name))
    svg.append(f'<rect x="{x}" y="{y}" width="{EW}" height="{EH}" fill="{fill}" '
               f'stroke="{border}" stroke-width="3"/>')
    if name in ASSOCIATIVE:   # Chen associative entity: diamond inside the rectangle
        svg.append(f'<polygon points="{c[0]},{y + 5} {x + EW - 8},{c[1]} {c[0]},{y + EH - 5} '
                   f'{x + 8},{c[1]}" fill="none" stroke="{border}" stroke-width="1.8"/>')
    text(c[0], c[1], name, EF if len(name) < 15 else EF - 3, "bold", "#1F2A30")

# ---- 5. title --------------------------------------------------------------------------------
svg.insert(0, f'<rect x="{W / 2 - 700}" y="24" width="1400" height="140" rx="16" '
              f'fill="#DCEBFA" stroke="#3C74B3" stroke-width="3"/>')
svg.insert(1, f'<text x="{W / 2}" y="78" font-size="60" font-weight="bold" fill="#14304F" '
              f'text-anchor="middle" dominant-baseline="central">E-R Diagram \u2013 DisCharge+</text>')
svg.insert(2, f'<text x="{W / 2}" y="134" font-size="32" fill="#14304F" text-anchor="middle" '
              f'dominant-baseline="central">(MVP Design \u00b7 9 Entities \u00b7 Chen Notation)</text>')

# ---- 6. legend + attribute cards -------------------------------------------------------------
PY = 2480
svg.append(f'<rect x="30" y="{PY}" width="360" height="{H - PY - 30}" rx="14" fill="#F7FAFD" '
           f'stroke="#3C74B3" stroke-width="2"/>')
text(60, PY + 40, "Legend", 32, "bold", anchor="start")
ly = PY + 100
svg.append(f'<rect x="60" y="{ly - 20}" width="90" height="40" fill="#DCEBFA" stroke="#3C74B3" stroke-width="2.5"/>')
text(170, ly, "= Entity", 22, anchor="start")
ly += 64
svg.append(f'<rect x="60" y="{ly - 20}" width="90" height="40" fill="#DCEBFA" stroke="#3C74B3" stroke-width="2.5"/>'
           f'<polygon points="105,{ly - 16} 144,{ly} 105,{ly + 16} 66,{ly}" fill="none" stroke="#3C74B3" stroke-width="1.6"/>')
text(170, ly, "= Associative entity", 22, anchor="start")
ly += 64
svg.append(f'<ellipse cx="105" cy="{ly}" rx="45" ry="20" fill="#fff" stroke="#39434A" stroke-width="2"/>')
text(170, ly, "= Attribute", 22, anchor="start")
ly += 64
svg.append(f'<polygon points="105,{ly - 24} 150,{ly} 105,{ly + 24} 60,{ly}" fill="#EEE6FB" stroke="#6B4FBF" stroke-width="2"/>')
text(170, ly, "= Relationship", 22, anchor="start")
ly += 60
svg.append(f'<line x1="60" y1="{ly}" x2="150" y2="{ly}" stroke="#39434A" stroke-width="2.5"/>')
text(170, ly, "= Link", 22, anchor="start")
for k, v in [("PK", "Primary key (underlined)"), ("FK", "Foreign key (italic)"),
             ("1, 0..1", "Cardinality (min..max)"), ("0..N, 1..N", "N = many")]:
    ly += 48
    text(60, ly, k, 21, "bold", anchor="start")
    text(165, ly, v, 20, anchor="start")

px0, py0 = 410, PY
svg.append(f'<rect x="{px0}" y="{py0}" width="{W - px0 - 30}" height="{H - PY - 30}" rx="14" '
           f'fill="#FBFCFE" stroke="#3C74B3" stroke-width="2"/>')
text(px0 + 30, py0 + 40, "Entities and Attributes (Full Details)", 32, "bold", anchor="start")
order = ["USER", "PATIENT", "DISCHARGE_PLAN", "PRESCRIPTION", "MEDICATION", "FOLLOW_UP",
         "ADHERENCE_RECORD", "SYMPTOM_LOG", "ESCALATION"]
cw = (W - px0 - 60 - 8 * 14) / 9
for i, name in enumerate(order):
    c, fill, border, attrs = ENTITIES[name]
    x, y = px0 + 15 + i * (cw + 14), py0 + 80
    svg.append(f'<rect x="{x:.0f}" y="{y}" width="{cw:.0f}" height="{H - y - 50}" rx="8" '
               f'fill="#FFFFFF" stroke="{border}" stroke-width="2"/>'
               f'<rect x="{x:.0f}" y="{y}" width="{cw:.0f}" height="46" rx="8" fill="{fill}" '
               f'stroke="{border}" stroke-width="2"/>')
    text(x + 12, y + 23, name, 21 if len(name) < 15 else 18, "bold", anchor="start")
    for j, (label, key, *_) in enumerate(attrs):
        tag = {"PK": " (PK)", "FK": " (FK)", "U": " (U)"}.get(key, "")
        s = label + tag
        text(x + 12, y + 72 + j * 31, "\u2022 " + s, 19 if len(s) < 21 else 17,
             "bold" if key == "PK" else "normal", anchor="start",
             style="italic" if key == "FK" else "")

# ---- 7. overlap report -----------------------------------------------------------------------
def bbox(s):
    _, x, y, rx, ry, _ = s
    return x - rx, y - ry, x + rx, y + ry


def inside(s, x, y, pad=4):
    kind, cx, cy, rx, ry, _ = s
    if kind == "box":
        return abs(x - cx) < rx + pad and abs(y - cy) < ry + pad
    if kind == "dia":
        return abs(x - cx) / (rx + pad) + abs(y - cy) / (ry + pad) < 1
    return ((x - cx) / (rx + pad)) ** 2 + ((y - cy) / (ry + pad)) ** 2 < 1


problems = []
for i, a in enumerate(shapes):
    for b in shapes[i + 1:]:
        ax0, ay0, ax1, ay1 = bbox(a)
        bx0, by0, bx1, by1 = bbox(b)
        if ax0 < bx1 and bx0 < ax1 and ay0 < by1 and by0 < ay1:
            # bbox overlap; confirm by sampling a's outline against b
            pts = [(a[1] + a[3] * math.cos(t / 20 * math.pi), a[2] + a[4] * math.sin(t / 20 * math.pi))
                   for t in range(40)]
            if any(inside(b, x, y, 6) for x, y in pts) or inside(b, a[1], a[2]):
                problems.append(f"overlap: {a[5]}  x  {b[5]}")
for p, q, ends in lines:
    for s in shapes:
        if s[5] in ends:
            continue
        for k in range(1, 60):
            x, y = p[0] + (q[0] - p[0]) * k / 60, p[1] + (q[1] - p[1]) * k / 60
            if inside(s, x, y, 2):
                problems.append(f"line {sorted(ends)[0]}..  crosses  {s[5]}")
                break
print(f"{len(problems)} layout problems")
for p in problems:
    print("  ", p)

# ---- 8. write + render -----------------------------------------------------------------------
doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
       f'font-family="{FONT}"><rect width="{W}" height="{H}" fill="#FFFFFF"/>' + "\n".join(svg) + "</svg>")
(HERE / "er-chen.svg").write_text(doc, encoding="utf-8")
html = HERE / "_er-chen.html"
html.write_text(f'<html><body style="margin:0">{doc}</body></html>', encoding="utf-8")
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                f"--window-size={W},{H + 300}", f"--screenshot={HERE / 'er-chen.png'}", html.as_uri()],
               check=True, capture_output=True)
Image.open(HERE / "er-chen.png").crop((0, 0, W, H)).save(HERE / "er-chen.png")   # drop the slack
html.unlink()
print("wrote er-chen.svg, er-chen.png")
