"""
Builds the Phase-1 review decks for DisCharge+ from the college's AIT title-slide template.

    python build_decks.py

Outputs (next to this file):
    DisCharge+_Phase1_Review.pptx        the 15 sections of the FINAL college PDF (section 10 = one slide per screen)
    DisCharge+_Architecture_and_DD.pptx  separate: architecture diagram + full data dictionary
    ../08-phase1-data-dictionary.md       the same data dictionary as markdown (source of truth for slides 4 / DD)

Diagrams come from ../diagrams/*.png (rendered from the .puml files with PlantUML).
"""
import copy
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt, Emu
from PIL import Image

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent
TEMPLATE = DOCS / "Minor Project PPT Format.pptx"
DIAGRAMS = DOCS / "diagrams"
SHOTS = DOCS / "documentation" / "screenshots"   # same screenshots as the project report

TITLE = "DisCharge+"
SUBTITLE = "Post-Discharge Continuity-of-Care Platform for Rural Patients"
STUDENTS = [("Vandit Doshi", "243030601029"), ("Smit Gajera", "243030601031")]
GUIDE = "Prof. Meeta Ahuja"

FONT = "Calibri"
TEAL = RGBColor(0x0F, 0x4C, 0x5C)
TEAL_LIGHT = RGBColor(0xE3, 0xF0, 0xEF)
CORAL = RGBColor(0xC8, 0x55, 0x3D)
INK = RGBColor(0x1F, 0x2A, 0x30)
MUTED = RGBColor(0x5B, 0x6B, 0x72)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
RULE = RGBColor(0xC9, 0xD6, 0xD8)

SLIDE_W, SLIDE_H = 13.333, 7.5
MARGIN = 0.5

# ---------------------------------------------------------------------------
# Data dictionary: the ONE list that slide 4, the supporting deck and the markdown
# all read from. The ER (er.puml) and class (class.puml) diagrams use these names.
# (field, type, size, key, description)
# ---------------------------------------------------------------------------
DD = {
    "User": [
        ("userId", "ObjectId", "12", "PK", "Unique ID of the user"),
        ("fullName", "String", "100", "—", "Full name"),
        ("phone", "String", "13", "Unique", "Login mobile number (+91…)"),
        ("passwordHash", "String", "60", "—", "bcrypt hash, never plain text"),
        ("role", "Enum", "10", "—", "patient / clinician"),
        ("preferredLanguage", "Enum", "2", "—", "en / hi / gu"),
        ("isActive", "Boolean", "1", "—", "Account active flag"),
    ],
    "Patient": [
        ("patientId", "ObjectId", "12", "PK", "Unique ID of the patient"),
        ("userId", "ObjectId", "12", "FK → User", "Login account of the patient"),
        ("abhaId", "String", "14", "Unique", "14-digit ABHA health ID (optional)"),
        ("dateOfBirth", "Date", "8", "—", "Date of birth"),
        ("gender", "Enum", "6", "—", "male / female / other"),
        ("district", "String", "60", "—", "Home district"),
    ],
    "DischargePlan": [
        ("planId", "ObjectId", "12", "PK", "Unique ID of the plan"),
        ("patientId", "ObjectId", "12", "FK → Patient", "Patient being discharged"),
        ("clinicianId", "ObjectId", "12", "FK → User", "Doctor who created the plan"),
        ("admissionDate", "Date", "8", "—", "Date of admission"),
        ("dischargeDate", "Date", "8", "—", "Start date for all schedules"),
        ("primaryDiagnosis", "String", "200", "—", "Main diagnosis"),
        ("redFlags", "Array[String]", "20 items", "—", "Danger signs for this condition"),
        ("followUpProtocol", "Enum", "15", "—", "cardiac / diabetes / ckd / post_surgical / general"),
        ("status", "Enum", "20", "—", "active / completed / readmitted / lost_to_followup"),
    ],
    "Medication": [
        ("medicationId", "ObjectId", "12", "PK", "Unique ID of the medicine"),
        ("genericName", "String", "120", "Unique", "Generic name, e.g. metformin"),
        ("form", "Enum", "10", "—", "tablet / capsule / syrup / injection"),
        ("strength", "String", "30", "—", "Strength per unit, e.g. 500 mg"),
    ],
    "Prescription": [
        ("prescriptionId", "ObjectId", "12", "PK", "Unique ID of the prescription line"),
        ("planId", "ObjectId", "12", "FK → DischargePlan", "Plan this line belongs to"),
        ("medicationId", "ObjectId", "12", "FK → Medication", "Medicine prescribed"),
        ("dosage", "String", "40", "—", "Amount per dose, e.g. 1 tablet"),
        ("frequency", "Enum", "3", "—", "OD / BD / TDS / QID"),
        ("timingSlots", "Array[Enum]", "4 items", "—", "morning / afternoon / evening / night"),
        ("durationDays", "Number", "3", "—", "Number of days to take it"),
        ("isCritical", "Boolean", "1", "—", "Missed dose raises an escalation"),
    ],
    "FollowUp": [
        ("followUpId", "ObjectId", "12", "PK", "Unique ID of the follow-up"),
        ("planId", "ObjectId", "12", "FK → DischargePlan", "Plan that generated it"),
        ("scheduledDate", "Date", "8", "—", "Due date"),
        ("type", "Enum", "15", "—", "in_person / teleconsult / lab_test / phone_check"),
        ("description", "String", "300", "—", "e.g. Serum creatinine test"),
        ("status", "Enum", "12", "—", "scheduled / completed / missed"),
        ("completedDate", "Date", "8", "—", "Actual completion date"),
    ],
    "AdherenceRecord": [
        ("adherenceId", "ObjectId", "12", "PK", "Unique ID of one scheduled dose"),
        ("prescriptionId", "ObjectId", "12", "FK → Prescription", "Prescription line of the dose"),
        ("scheduledAt", "Date", "8", "—", "Date and time the dose is due"),
        ("status", "Enum", "8", "—", "pending / taken / missed"),
        ("recordedAt", "Date", "8", "—", "When the patient marked it"),
    ],
    "SymptomLog": [
        ("symptomLogId", "ObjectId", "12", "PK", "Unique ID of the report"),
        ("patientId", "ObjectId", "12", "FK → Patient", "Patient who reported"),
        ("reportedAt", "Date", "8", "—", "Date and time of report"),
        ("symptoms", "Array[String]", "10 items", "—", "Symptom codes selected"),
        ("severity", "Number", "1", "—", "Overall severity 1–5"),
        ("triageTier", "Enum", "12", "—", "self_care / teleconsult / urgent / emergency"),
        ("triggeredRules", "Array[String]", "10 items", "—", "IDs of red-flag rules that matched"),
    ],
    "Escalation": [
        ("escalationId", "ObjectId", "12", "PK", "Unique ID of the escalation"),
        ("patientId", "ObjectId", "12", "FK → Patient", "Patient concerned"),
        ("symptomLogId", "ObjectId", "12", "FK → SymptomLog", "Source report (null if missed dose)"),
        ("adherenceId", "ObjectId", "12", "FK → AdherenceRecord", "Missed dose (null if symptom)"),
        ("assignedClinicianId", "ObjectId", "12", "FK → User", "Clinician handling it"),
        ("source", "Enum", "20", "—", "symptom_log / missed_critical_dose"),
        ("tier", "Enum", "12", "—", "teleconsult / urgent / emergency"),
        ("triggeredRules", "Array[String]", "10 items", "—", "Why it was raised"),
        ("status", "Enum", "12", "—", "open / acknowledged / resolved"),
        ("createdAt", "Date", "8", "—", "When it was raised"),
        ("acknowledgedAt", "Date", "8", "—", "When a clinician acknowledged it"),
        ("resolvedAt", "Date", "8", "—", "When it was closed"),
        ("notes", "String", "1000", "—", "Action taken by the clinician"),
    ],
}


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------
def blank_layout(prs):
    return next(l for l in prs.slide_layouts if l.name == "Blank")


def set_bg(slide, color=WHITE):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def text(slide, x, y, w, h, runs, size=18, color=INK, bold=False, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, italic=False, margin=0.05):
    """runs: str, or list of paragraphs; each paragraph is str or list of (text, {opts})."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for side in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, side, Inches(margin))
    paras = runs if isinstance(runs, list) else [runs]
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        parts = para if isinstance(para, list) else [(para, {})]
        for t, o in parts:
            r = p.add_run()
            r.text = t
            f = r.font
            f.name = FONT
            f.size = Pt(o.get("size", size))
            f.bold = o.get("bold", bold)
            f.italic = o.get("italic", italic)
            f.color.rgb = o.get("color", color)
        if isinstance(para, list) and para and "space_after" in para[0][1]:
            p.space_after = Pt(para[0][1]["space_after"])
    return tb


def bulletize(tb, first=1, gap=6):
    """Real PowerPoint bullets (not typed characters) on paragraphs[first:]."""
    _bullets(tb.text_frame.paragraphs[first:], gap)


def _bullets(paragraphs, gap=6):
    from pptx.oxml.ns import qn
    for p in paragraphs:
        pPr = p._p.get_or_add_pPr()
        pPr.set("marL", str(Inches(0.28)))
        pPr.set("indent", str(-Inches(0.28)))
        for tag in ("a:buFont", "a:buChar"):
            el = pPr.makeelement(qn(tag), {})
            if tag == "a:buFont":
                el.set("typeface", "Arial")
            else:
                el.set("char", "•")
            pPr.append(el)
        p.space_after = Pt(gap)


def box(slide, x, y, w, h, fill=TEAL_LIGHT, line=None, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(1)
    s.shadow.inherit = False
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
    return s


def badge(slide, x, y, label, d=0.46, fill=TEAL, size=16):
    c = box(slide, x, y, d, d, fill=fill, shape=MSO_SHAPE.OVAL)
    tf = c.text_frame
    for side in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, side, 0)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    r = p.add_run()
    r.text = label
    r.font.name, r.font.size, r.font.bold, r.font.color.rgb = FONT, Pt(size), True, WHITE
    return c


def title(slide, t, *_):
    text(slide, MARGIN, 0.3, 11.3, 0.65, t, size=32, bold=True, color=TEAL, anchor=MSO_ANCHOR.MIDDLE, margin=0)


def number_slides(prs):
    """'n / total' on every slide except the college title slide, added last so the total is always right."""
    total = len(prs.slides)
    for n, slide in enumerate(prs.slides, start=1):
        if n > 1:
            text(slide, SLIDE_W - MARGIN - 1.5, 7.02, 1.5, 0.32, f"{n} / {total}", size=14,
                 color=WHITE if n == total else MUTED, align=PP_ALIGN.RIGHT, margin=0)


def picture_fit(slide, path, x, y, w, h, max_px=2600):
    """Fit inside the box keeping aspect; downscale first (PowerPoint 2007 clips very wide bitmaps)."""
    import io
    im = Image.open(path)
    if max(im.size) > max_px:
        k = max_px / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "PNG"); buf.seek(0)
    iw, ih = im.size
    s = min(w / iw, h / ih)
    pw, ph = iw * s, ih * s
    return slide.shapes.add_picture(buf, Inches(x + (w - pw) / 2), Inches(y + (h - ph) / 2),
                                    Inches(pw), Inches(ph))


def table(slide, x, y, w, rows, col_w, size=16, header_size=18, row_h=0.36, first_col_bold=False):
    """A cell is a str, a list of (text, opts) runs, or {"lines": [str | runs, ...], "bullets": bool}."""
    shape = slide.shapes.add_table(len(rows), len(rows[0]), Inches(x), Inches(y), Inches(w),
                                   Inches(row_h * len(rows)))
    tbl = shape.table
    for i, cw in enumerate(col_w):
        tbl.columns[i].width = Inches(cw)
    for r, row in enumerate(rows):
        tbl.rows[r].height = Inches(row_h)
        for c, val in enumerate(row):
            cell = tbl.cell(r, c)
            cell.margin_left = cell.margin_right = Inches(0.08)
            cell.margin_top = cell.margin_bottom = Inches(0.03)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.fill.solid()
            cell.fill.fore_color.rgb = TEAL if r == 0 else (WHITE if r % 2 else RGBColor(0xF3, 0xF8, 0xF8))
            tf = cell.text_frame
            tf.word_wrap = True
            lines = val["lines"] if isinstance(val, dict) else [val]
            for li, line in enumerate(lines):
                p = tf.paragraphs[0] if li == 0 else tf.add_paragraph()
                parts = line if isinstance(line, list) else [(line, {})]
                for t, o in parts:
                    run = p.add_run()
                    run.text = t
                    run.font.name = FONT
                    run.font.size = Pt(header_size if r == 0 else o.get("size", size))
                    run.font.bold = True if (r == 0 or (c == 0 and first_col_bold)) else o.get("bold", False)
                    run.font.color.rgb = WHITE if r == 0 else (TEAL if c == 0 and first_col_bold else o.get("color", INK))
            if isinstance(val, dict) and val.get("bullets"):
                _bullets(tf.paragraphs, gap=0)
    return tbl


def notes(slide, t):
    slide.notes_slide.notes_text_frame.text = t


def fill_title_slide(slide):
    """Edit the college template's own text boxes in place so its fonts and logo stay untouched."""
    for sh in slide.shapes:
        if not sh.has_text_frame:
            continue
        if sh.text_frame.text.startswith(("Developed By", "Under the Guidance")):
            sh.top = sh.top + Inches(0.3)
        for p in sh.text_frame.paragraphs:
            full = "".join(r.text for r in p.runs)
            if "[PROJECT TITLE NAME]" in full:
                p.runs[0].text = TITLE
                for r in p.runs[1:]:
                    r.text = ""
                # subtitle paragraph right after the title, cloned from the title for font/alignment
                new_p = copy.deepcopy(p._p)
                p._p.addnext(new_p)
                from pptx.text.text import _Paragraph
                sp = _Paragraph(new_p, p._parent)
                sp.runs[0].text = SUBTITLE
                sp.runs[0].font.size = Pt(18)
                sp.runs[0].font.bold = False
            elif "Guide Name" in full:
                p.runs[0].text = f"Guide Name   {GUIDE}"
                for r in p.runs[1:]:
                    r.text = ""
            elif "Sem-" in full:
                p.runs[0].text = full.replace("Sem-IV", "Sem-V")
                for r in p.runs[1:]:
                    r.text = ""
            elif "Team Member Name" in full:
                p.runs[0].text = f"{STUDENTS[0][0]} ({STUDENTS[0][1]})"
                for r in p.runs[1:]:
                    r.text = ""
                new_p = copy.deepcopy(p._p)
                p._p.addnext(new_p)
                from pptx.text.text import _Paragraph
                _Paragraph(new_p, p._parent).runs[0].text = f"{STUDENTS[1][0]} ({STUDENTS[1][1]})"


# ---------------------------------------------------------------------------
# Main deck: the 15 sections of the FINAL college PDF, in its order.
# Section 10 (User Interface Design / Screenshots) runs over several slides, one screen (or one pair of
# phone screens) per slide, so every screenshot is readable and gets its own 3-4 explanation lines.
# ---------------------------------------------------------------------------
SHOT_TITLE = "User Interface Design / Screenshots"

# (heading, [(file, label, crop box or None)], [3-4 explanation lines])
# crop = (left, top, right, bottom) in source pixels: trims the empty page margins only.
DESK = (190, 0, 1730, None)          # clinician pages: content column of the 1921 px wide shots
FORM = (560, 0, 1360, None)          # login / register: the centred form
SCREENS = [
    ("Login and Registration", [("login.png", "Log in", FORM), ("register.png", "Create an account", FORM)], [
        "One login page for patients and clinicians: Mobile number and Password, then “Log in”.",
        "The server reads the role and opens the patient app or the clinician website.",
        "“Create an account” asks for name, mobile, password, date of birth, gender, district, "
        "language and an optional ABHA ID.",
        "Language buttons at the top switch the page to Gujarati, Hindi or English.",
    ]),
    ("Patient Home", [("p-home.png", "English", None), ("p-home-gu.png", "Gujarati", None)], [
        "Today’s medicines are drawn on a sun path: morning, afternoon, evening, night.",
        "The patient taps “I took it” on each dose; the progress shows how many are taken.",
        "The red “I feel unwell” button opens the symptom report.",
        "The same screen in Gujarati: every label and the plan text are translated.",
    ]),
    ("My Medicines and My Care Plan", [("p-medicines.png", "My medicines", None), ("p-plan.png", "My care plan", None)], [
        "My medicines: dosage, timing and the last 7 days of doses, with the week’s % taken.",
        "My care plan: diagnosis, discharge date, the clinician and the danger signs to watch.",
        "“Emergency? Call 108” is always shown on the plan.",
        "The tab bar moves between Home, Medicines, My plan and Check-ups.",
    ]),
    ("Report a Symptom", [("p-report.png", "Step 1: choose symptoms", None), ("p-severity.png", "Step 2: how bad is it?", None)], [
        "Step 1 “How do you feel?”: tap every symptom icon that applies, then “Next”.",
        "Step 2 “How bad is it?”: pick one of five levels, “A little” to “Very bad”.",
        "“Send to my doctor” saves the report and runs the red-flag rule engine.",
        "Icons and short words suit patients who read very little.",
    ]),
    ("Report Result and My Check-ups", [("p-result.png", "Result", None), ("p-followups.png", "My check-ups", None)], [
        "The result gives the triage tier in plain words, e.g. “See a doctor today”.",
        "When a rule matches, an escalation is raised and shown on the clinician’s queue.",
        "My check-ups lists coming and earlier follow-ups: clinic visit, test or phone call.",
        "Each check-up shows Today, Done, Missed or Overdue.",
    ]),
    ("Clinician Dashboard: Overview", [("dashboard.png", "", (190, 0, 1730, 1300))], [
        "Patients who need attention today, with emergency, urgent and overdue counts.",
        "A chart of doses taken over the last 14 days.",
        "“Needs attention” lists patients by risk band (High / Moderate / Low) with the reason.",
        "Open escalations with “Acknowledge”; quick actions for a new plan, the queue or a search.",
    ]),
    ("Clinician Dashboard: Whom to Phone First", [("dashboard.png", "", (190, 1312, 1730, 2372))], [
        "Follow-ups in the next 7 days, ordered by no-show risk from the logistic regression model.",
        "Each bar shows the probability against the Moderate and High cut-offs.",
        "Amber reasons come from rules: missed an earlier follow-up, lives over 100 km away, low adherence.",
        "Left: active patients by risk (ring chart) and open escalations by tier.",
    ]),
    ("Escalation Queue", [("queue.png", "", DESK)], [
        "All escalations, highest tier first, then oldest first; refreshes every 30 seconds.",
        "Filters: Needs action, Open, Acknowledged, Resolved, and by tier.",
        "Each row shows the patient, the source (symptom report or missed critical dose) and the reason.",
        "“Turn on alerts” gives a sound and a notification for every new escalation.",
    ]),
    ("Escalation Detail", [("escalation.png", "", DESK)], [
        "“What was reported”: the symptoms, the severity and the time of the report.",
        "“Why it was raised”: every red-flag rule that matched, with its rule ID.",
        "The clinician presses “Acknowledge”, contacts the patient, then resolves it with a note.",
        "The phone number and “View patient” link help to act quickly.",
    ]),
    ("Patient List", [("patients.png", "", (190, 0, 1730, 1330))], [
        "Patients with a plan written by this clinician, highest risk first.",
        "Search by name, phone or ABHA ID; filter by risk: High, Moderate, Low.",
        "Columns: diagnosis, day after discharge, adherence %, risk band, open escalations.",
        "A row opens Patient Details; “+ New plan” starts a discharge plan.",
    ]),
    ("Patient Details", [("patient-detail.png", "", DESK)], [
        "Header: age, gender, district, language, ABHA ID, risk band and a call button.",
        "Tabs: Plan, Adherence, Symptoms and Escalations.",
        "The plan shows diagnosis, protocol, red flags, medicines and follow-ups.",
        "“Mark done” closes a follow-up; “Close plan” ends the plan.",
    ]),
    ("New Discharge Plan", [("plan-editor.png", "", DESK)], [
        "1 Admission: admission and discharge dates and the primary diagnosis.",
        "2 Medicines: dosage, frequency, days, timing and the “Critical” tick.",
        "3 Red flags and the follow-up protocol (cardiac, diabetes, CKD, post-surgical, general).",
        "“Save plan” generates every follow-up and every dose automatically.",
    ]),
]


def shot_image(name, crop):
    im = Image.open(SHOTS / name).convert("RGB")
    if crop:
        l, t, r, b = crop
        im = im.crop((l, t, min(r, im.width), im.height if b is None else min(b, im.height)))
    return im


def picture_img(slide, im, x, y, w, h, border=True):
    """Like picture_fit, for a PIL image; returns (left, top, width, height) in inches."""
    import io
    if max(im.size) > 2600:
        k = 2600 / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "PNG"); buf.seek(0)
    s = min(w / im.width, h / im.height)
    pw, ph = im.width * s, im.height * s
    px, py = x + (w - pw) / 2, y + (h - ph) / 2
    pic = slide.shapes.add_picture(buf, Inches(px), Inches(py), Inches(pw), Inches(ph))
    if border:
        pic.line.color.rgb = RULE
        pic.line.width = Pt(1)
    return px, py, pw, ph


def screenshot_slide(prs, blank, n, heading, images, lines):
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, SHOT_TITLE)
    text(s, MARGIN, 1.0, 12.33, 0.5, [[(f"10.{n}  ", {"color": CORAL}), (heading, {})]],
         size=24, bold=True, color=INK, margin=0)
    ix, iy, iw, ih = MARGIN, 1.6, 8.0, 5.25
    if len(images) == 1:
        name, _, crop = images[0]
        picture_img(s, shot_image(name, crop), ix, iy, iw, ih)
    else:
        gap = 0.3
        cw = (iw - gap) / 2
        for k, (name, label, crop) in enumerate(images):
            cx = ix + k * (cw + gap)
            px, py, pw, ph = picture_img(s, shot_image(name, crop), cx, iy, cw, ih - 0.45)
            text(s, cx, iy + ih - 0.4, cw, 0.38, label, size=16, color=MUTED, align=PP_ALIGN.CENTER, margin=0)
    tx = ix + iw + 0.3
    box(s, tx, iy, SLIDE_W - MARGIN - tx, ih, fill=TEAL_LIGHT)
    tb = text(s, tx + 0.15, iy + 0.15, SLIDE_W - MARGIN - tx - 0.3, ih - 0.3,
              [[("How it works", {"bold": True, "color": TEAL, "size": 20})]] + lines, size=18)
    bulletize(tb, first=1, gap=8)
    return s


def build_main():
    prs = Presentation(str(TEMPLATE))
    blank = blank_layout(prs)
    B = {"bold": True}

    # 1 - Project Title (college template)
    s1 = prs.slides[0]
    fill_title_slide(s1)
    notes(s1, "Introduce the team and guide. One line: DisCharge+ keeps rural patients connected to their "
              "clinician after they leave hospital. Built for TetraTHON 2026, Track A HealthTech, Problem Statement 2.")

    # 2 - Project Profile: the PDF's six numbered sections as a Section | Details table
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Project Profile")
    text(s, MARGIN, 0.98, 12.33, 0.45,
         [[("Project Title:  ", {"bold": True, "color": TEAL}), (f"{TITLE} — {SUBTITLE}", {})]], size=20, margin=0)
    table(s, MARGIN, 1.5, 12.33, [
        ["Section", "Details"],
        ["1. Project Objectives", {"bullets": True, "lines": [
            "Turn each discharge into a digital care plan with follow-ups and a dose schedule",
            "Track doses, remind patients on Android and detect missed critical doses",
            "Let patients report symptoms in English, Hindi or Gujarati using icons",
            "Escalate red flags to a triaged clinician queue with sound alerts",
            "Help clinicians decide whom to contact first: risk band and ML no-show prediction",
        ]}],
        ["2. Problem Statement", "Rural patients lose contact with care after discharge; missed medicines, missed "
                                 "follow-ups and warning signs go unnoticed until they become emergencies."],
        ["3. Tools & Technologies", {"lines": [
            [("Languages: ", B), ("JavaScript, Python 3.12   ", {}), ("Frontend: ", B), ("React 19, Vite 8, Tailwind CSS 4", {})],
            [("Backend: ", B), ("Node.js 24 LTS, Express 5   ", {}), ("Database: ", B), ("MongoDB 8.2, Mongoose 9", {})],
            [("ML: ", B), ("pandas 3, scikit-learn 1.9   ", {}), ("Mobile: ", B), ("Capacitor 8   ", {}),
             ("IDE: ", B), ("VS Code, Android Studio", {})],
        ]}],
        ["4. External Tools / Services", "MongoDB Atlas (cloud DB), Vercel and Render (hosting), Kaggle “Medical "
                                         "Appointment No Shows” dataset (ML training). No paid APIs."],
        ["5. Target Users", "Discharged patients (rural Gujarat) and hospital clinicians"],
        ["6. Project Type / Platform", "Web application + Android app (client–server, MERN) with an ML prediction module"],
    ], col_w=[3.15, 9.18], size=16, header_size=18, row_h=0.4, first_col_bold=True)
    notes(s, "Objectives map one to one to the Key Features on the next slide and to the use cases. "
             "The ML model is trained once in Python; the server only applies its exported weights, so no Python runs online.")

    # 3 - System Analysis: the PDF's format for a NEW system (no invented existing system)
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "System Analysis")
    table(s, MARGIN, 1.1, 12.33, [
        ["Section", "Content"],
        ["Problem Statement", "After discharge, rural patients rarely see their clinician until something goes wrong. "
                              "Paper instructions, often not in their language, missed follow-ups and unnoticed "
                              "warning signs lead to avoidable readmissions."],
        ["Proposed System", {"bullets": True, "lines": [
            "A web and Android application that turns each discharge into a tracked care plan",
            "The patient follows the plan and reports symptoms in their own language",
            "A rule engine alerts the clinician on a red flag or a missed critical dose",
            "An ML model ranks upcoming follow-ups by the risk of a no-show",
        ]}],
        ["Key Features", {"bullets": True, "lines": [
            "Discharge plan editor that generates follow-ups and the dose schedule",
            "Dose tracker with Android reminders and missed-dose detection",
            "Icon-based symptom report in English, Hindi and Gujarati",
            "23 red-flag rules, 4 triage tiers and an escalation queue with alerts",
            "Dashboard: risk band, adherence trend and “whom to phone first” (ML)",
        ]}],
        ["Target Users", {"lines": [
            [("Patient: ", B), ("views the care plan, marks doses, reports symptoms", {})],
            [("Clinician: ", B), ("creates plans, handles escalations, monitors patients", {})],
        ]}],
    ], col_w=[2.9, 9.43], size=16, header_size=18, row_h=0.4, first_col_bold=True)
    notes(s, "DisCharge+ is a new system, so per the college format we do not invent an existing system. "
             "Today the discharge is a paper summary plus verbal advice. Each Key Feature matches an objective on slide 2.")

    # 4 - Data Dictionary: the PDF's multi-table form (Table | Important Attributes), keys marked
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Data Dictionary")
    shown = {
        "User": ["userId", "fullName", "phone", "passwordHash", "role", "preferredLanguage"],
        "Patient": ["patientId", "userId", "abhaId", "dateOfBirth", "gender", "district"],
        "DischargePlan": ["planId", "patientId", "clinicianId", "dischargeDate", "primaryDiagnosis", "redFlags", "status"],
        "Medication": ["medicationId", "genericName", "form", "strength"],
        "Prescription": ["prescriptionId", "planId", "medicationId", "dosage", "frequency", "isCritical"],
        "FollowUp": ["followUpId", "planId", "scheduledDate", "type", "status"],
        "AdherenceRecord": ["adherenceId", "prescriptionId", "scheduledAt", "status", "recordedAt"],
        "SymptomLog": ["symptomLogId", "patientId", "reportedAt", "symptoms", "severity", "triageTier"],
        "Escalation": ["escalationId", "patientId", "symptomLogId", "adherenceId", "assignedClinicianId", "tier", "status"],
    }
    rows = [["Table", "Important Attributes"]]
    for tname, names in shown.items():
        key = {f[0]: f[3] for f in DD[tname]}
        runs = []
        for i, n in enumerate(names):
            k = key[n]  # KeyError here = a name missing from the DD, which would break consistency
            sep = ", " if i else ""
            if k == "PK":
                runs += [(sep, {}), (n + " (PK)", {"bold": True})]
            elif k.startswith("FK"):
                runs += [(sep, {}), (n + " (FK)", {"color": CORAL, "bold": True})]
            else:
                runs.append((sep + n, {}))
        rows.append([tname, runs])
    table(s, MARGIN, 1.12, 12.33, rows, col_w=[2.6, 9.73], size=16, header_size=18, row_h=0.47, first_col_bold=True)
    text(s, MARGIN, 6.45, 12.33, 0.35,
         "PK = Primary Key  ·  FK = Foreign Key  ·  the no-show probability and risk band are calculated, not stored",
         size=16, color=MUTED, margin=0)
    notes(s, "9 tables, the same 9 entities as the ER and class diagrams. Prescription is the associative table that "
             "resolves the many-to-many between DischargePlan and Medication. The ML prediction is computed on read, "
             "so it needs no table.")

    # 5-9 - diagrams
    diagram_slides = [
        ("Use Case Diagram", "usecase.png",
         "«include» = always performed  ·  «extend» = only when the condition holds",
         "Two human actors and the scheduler that runs the missed-dose check. Viewing the dashboard always includes "
         "the no-show prediction; Raise Escalation extends the rule check or the missed-dose check."),
        ("UML Class Diagram", "class.png",
         "◆ composition  ·  → association  ·  - private  + public  ·  multiplicity on every association",
         "Nine domain classes plus two service classes: RuleEngine (used in the sequence diagram) and NoShowModel "
         "(the ML prediction). Foreign keys are shown as associations, not attributes."),
        ("UML Sequence Diagram", "sequence.png",
         "Use case: Report Symptom  ·  objects match the Class Diagram  ·  dashed = return message",
         "Walk top to bottom: the report is saved first, then evaluated, so even a self-care report is kept "
         "for auditing. The alt frame shows the two outcomes."),
        ("UML Activity Diagram", "activity.png",
         "Swimlanes: Patient · System · Clinician  ·  [Yes]/[No] guards  ·  fork/join = parallel actions",
         "Main workflow of the system. Decision nodes carry [Yes]/[No] guards; the two branches rejoin at the "
         "merge node before the final node."),
        ("ER Diagram", "er-chen.png",
         "Chen notation  ·  PRESCRIPTION (associative entity) resolves the M:N DISCHARGE_PLAN ↔ MEDICATION",
         "Cardinalities: a user has at most one patient profile; a plan has one or more prescriptions; a "
         "symptom log or missed dose triggers at most one escalation."),
    ]
    for t, img, caption, note in diagram_slides:
        s = prs.slides.add_slide(blank); set_bg(s)
        title(s, t)
        picture_fit(s, DIAGRAMS / img, MARGIN, 1.05, 12.33, 5.55)
        text(s, MARGIN, 6.6, 10.8, 0.4, caption, size=16, color=MUTED, margin=0)
        notes(s, note)

    # 10 - User Interface Design / Screenshots (one slide per screen or phone pair)
    for n, (heading, images, lines) in enumerate(SCREENS, start=1):
        s = screenshot_slide(prs, blank, n, heading, images, lines)
        notes(s, "Screenshot from the running application with the synthetic demo data (no real patients). "
                 "Patient screens at phone size, clinician screens at desktop size.")

    # 11 - Limitations of the Project (only limits that exist in the built system)
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Limitations of the Project")
    table(s, MARGIN, 1.15, 12.33, [
        ["Limitation", "Explanation"],
        ["No-show model accuracy", "Trained on 2016 public appointments from Brazil, not Gujarat follow-ups; test AUC is only 0.595."],
        ["Rules not clinically validated", "Red-flag rules and risk-band thresholds come from published guidelines; a clinician must still review them."],
        ["Internet and smartphone needed", "There is no offline mode, SMS or voice, so patients with a basic phone cannot use it."],
        ["Reminders only on Android", "Dose reminders are local notifications in the Android app; website users get none."],
        ["Only two roles", "Caregivers and ASHA health workers cannot log in or report for a patient."],
        ["Free cloud hosting", "The API sleeps after 15 idle minutes, so the first request after a pause is slow."],
    ], col_w=[3.6, 8.73], size=18, header_size=20, row_h=0.72, first_col_bold=True)
    notes(s, "Each limitation is true of the system as built today. How we would remove them is on the next slide.")

    # 12 - Future Scope / Further Work
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Future Scope / Further Work")
    fw_items = [
        ("Retrain the ML model", "Retrain no-show prediction on DisCharge+ records; add readmission risk with explanations."),
        ("Offline field screening", "Health-worker role that works with no network and syncs later."),
        ("Caregiver & ASHA roles", "Family members or ASHA workers report for the patient and receive alerts."),
        ("SMS, WhatsApp & voice", "Reminders on basic phones; text-to-speech for patients who cannot read."),
        ("ABDM integration", "FHIR record exchange using the ABHA ID, consent management and an audit log."),
        ("Schemes & education", "PM-JAY scheme eligibility check; audio health education in Hindi and Gujarati."),
    ]
    gw, gh = (12.33 - 0.5) / 3, 2.5
    for i, (h, b) in enumerate(fw_items):
        gx = MARGIN + (i % 3) * (gw + 0.25)
        gy = 1.2 + (i // 3) * (gh + 0.25)
        box(s, gx, gy, gw, gh, fill=TEAL_LIGHT)
        badge(s, gx + 0.25, gy + 0.28, str(i + 1), d=0.5, fill=CORAL, size=17)
        text(s, gx + 0.9, gy + 0.25, gw - 1.1, 0.6, h, size=20, bold=True, color=TEAL, anchor=MSO_ANCHOR.MIDDLE)
        text(s, gx + 0.25, gy + 0.98, gw - 0.5, gh - 1.1, b, size=18)
    notes(s, "Each item answers a limitation on the previous slide, and most already have a design in docs 01-06.")

    # 13 - Conclusion (one slide)
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Conclusion")
    text(s, MARGIN, 1.0, 12.33, 0.75,
         "DisCharge+ turns a hospital discharge into a tracked care plan, so rural patients stay connected "
         "to their clinician after they go home.", size=20, color=INK, margin=0)
    colw = (12.33 - 0.3) / 2
    tb = text(s, MARGIN, 1.85, colw, 4.6, [
        [("Key Achievements", {"bold": True, "color": TEAL, "size": 22})],
        "All five objectives met: care plans, dose tracking, multilingual symptom report, triaged escalations, dashboard",
        "23 red-flag rules and a missed-dose check every 15 minutes",
        "ML no-show prediction and Android dose reminders",
        "Live on Vercel, Render and MongoDB Atlas; 98 automated tests pass",
    ], size=18)
    bulletize(tb, first=1, gap=8)
    tb = text(s, MARGIN + colw + 0.3, 1.85, colw, 4.6, [
        [("Benefits", {"bold": True, "color": TEAL, "size": 22})],
        "Danger signs reach the clinician early",
        "Clinicians know whom to call first",
        "Patients use the app in their own language",
        [("What we learned", {"bold": True, "color": TEAL, "size": 22})],
        "Full-stack MERN development, REST APIs and JWT security",
        "Rule engines, basic machine learning, testing and cloud deployment",
    ], size=18)
    bulletize(tb, first=1, gap=8)
    paras = tb.text_frame.paragraphs
    for p in (paras[4],):  # second heading: no bullet
        pPr = p._p.get_or_add_pPr()
        for el in list(pPr):
            if el.tag.endswith("}buChar") or el.tag.endswith("}buFont"):
                pPr.remove(el)
        pPr.set("marL", "0"); pPr.set("indent", "0")
        p.space_before = Pt(10)
    text(s, MARGIN, 6.45, 12.33, 0.45,
         [[("Technologies: ", {"bold": True, "color": TEAL}),
           ("React, Node.js, Express, MongoDB, Python (scikit-learn), Capacitor", {})]], size=18, margin=0)
    notes(s, "Overall outcome: the objectives on slide 2 are all implemented and running live with synthetic demo data.")

    # 14 - References / Bibliography (14 pt, as the PDF allows for references)
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "References / Bibliography")
    left = [
        "Meta, React documentation — https://react.dev",
        "Vite documentation — https://vite.dev/guide/",
        "Tailwind Labs, Tailwind CSS docs — https://tailwindcss.com/docs",
        "TanStack Query docs — https://tanstack.com/query/latest/docs",
        "i18next documentation — https://www.i18next.com",
        "OpenJS Foundation, Express.js — https://expressjs.com",
        "MongoDB manual — https://www.mongodb.com/docs/manual/",
        "Mongoose documentation — https://mongoosejs.com/docs/",
        "Zod documentation — https://zod.dev",
        "Ionic, Capacitor documentation — https://capacitorjs.com/docs",
        "scikit-learn, Logistic regression — https://scikit-learn.org/stable/modules/linear_model.html",
        "PlantUML — https://plantuml.com  ·  Graphviz — https://graphviz.org",
    ]
    right = [
        "J. Hoppen, Medical Appointment No Shows (Kaggle, CC BY-NC-SA 4.0) — "
        "https://www.kaggle.com/datasets/joniarroba/noshowappointments",
        "National Health Authority, Ayushman Bharat Digital Mission (ABHA) — https://abdm.gov.in",
        "NICE CG95 Chest pain; CG109 Transient loss of consciousness — https://www.nice.org.uk/guidance",
        "NICE NG106 Chronic heart failure; NG51 Sepsis; NG125 Surgical site infections — https://www.nice.org.uk/guidance",
        "ESC 2021 Guidelines for heart failure — https://www.escardio.org/Guidelines",
        "American Diabetes Association, Standards of Care in Diabetes 2025 — https://diabetesjournals.org/care",
        "KDIGO 2024 Clinical Practice Guideline for CKD — https://kdigo.org/guidelines/",
        "TetraTHON 2026 Problem Statements, Track A HealthTech, PS 2 (Navrachana University)",
    ]
    for col, (items, start) in enumerate(((left, 1), (right, len(left) + 1))):
        tb = text(s, MARGIN + col * 6.3, 1.05, 6.03, 5.85,
                  [[(f"[{start + i}] ", {"bold": True, "color": TEAL}), (t, {})] for i, t in enumerate(items)], size=14)
        for p in tb.text_frame.paragraphs:
            p.space_after = Pt(5)
    notes(s, "Only sources we actually used: the framework docs, the Kaggle dataset the model is trained on, and the "
             "clinical guidelines each red-flag rule cites in server/src/rules/redFlagRules.js.")

    # 15 - THANK YOU
    s = prs.slides.add_slide(blank); set_bg(s, TEAL)
    text(s, MARGIN, 2.3, 12.33, 1.3, "THANK YOU", size=60, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE, margin=0)
    text(s, MARGIN, 3.7, 12.33, 0.6, f"{TITLE} — {SUBTITLE}", size=22, color=WHITE, align=PP_ALIGN.CENTER, margin=0)
    text(s, MARGIN, 4.5, 12.33, 0.5, "  ·  ".join(f"{n} ({e})" for n, e in STUDENTS) + f"  ·  Guide: {GUIDE}",
         size=18, color=WHITE, align=PP_ALIGN.CENTER, margin=0)
    text(s, MARGIN, 5.4, 12.33, 0.5, "Questions?", size=24, bold=True, color=WHITE, align=PP_ALIGN.CENTER, margin=0)

    number_slides(prs)
    out = HERE / "DisCharge+_Phase1_Review.pptx"
    prs.save(str(out))
    return out


# ---------------------------------------------------------------------------
# Supporting deck: architecture + full data dictionary (review item 2 and item 5 in detail)
# ---------------------------------------------------------------------------
def build_support():
    prs = Presentation(str(TEMPLATE))
    blank = blank_layout(prs)
    fill_title_slide(prs.slides[0])
    pages = [["User"], ["Patient"], ["DischargePlan"], ["Medication", "AdherenceRecord"], ["Prescription"],
             ["FollowUp"], ["SymptomLog"], ["Escalation"]]
    total = 2 + len(pages)
    deck = "Architecture & Data Dictionary"

    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Architecture Diagram", 2, total, deck)
    picture_fit(s, DIAGRAMS / "architecture.png", MARGIN, 1.1, 12.33, 5.2)
    text(s, MARGIN, 6.4, 10.8, 0.55,
         "Three tiers: React website and Android app → Express REST API (JWT, role + ownership checks) → MongoDB Atlas. "
         "The rule engine and the missed-dose job raise escalations; the no-show model scores follow-ups.",
         size=14, color=MUTED, margin=0)
    notes(s, "Two deployable services in the MVP: client/ on Vercel and server/ on Render, plus MongoDB Atlas. "
             "The Python ML service from the full design is future scope.")

    for n, group in enumerate(pages, start=3):
        s = prs.slides.add_slide(blank); set_bg(s)
        title(s, "Data Dictionary — " + " & ".join(group), n, total, deck)
        y = 1.1
        rh = 0.34
        for tname in group:
            text(s, MARGIN, y, 6, 0.4, f"Table: {tname}", size=20, bold=True, color=TEAL, margin=0)
            y += 0.45
            rows = [["Field Name", "Data Type", "Size", "Key", "Description"]]
            rows += [list(f) for f in DD[tname]]
            table(s, MARGIN, y, 12.33, rows, col_w=[2.6, 1.85, 1.1, 2.5, 4.28], size=16, header_size=17, row_h=rh)
            y += rh * len(rows) + 0.3
        text(s, MARGIN, 6.62, 10.5, 0.34,
             "Size = max characters (String/Enum), digits (Number), bytes (ObjectId, Date), items (Array)",
             size=14, color=MUTED, margin=0)

    number_slides(prs)
    out = HERE / "DisCharge+_Architecture_and_DD.pptx"
    prs.save(str(out))
    return out


def write_markdown():
    lines = ["# 8. Phase-1 Data Dictionary (MVP, 9 collections)", "",
             "> Generated by `presentation/build_decks.py` — edit the `DD` table there and re-run.",
             "> Must stay consistent with `diagrams/er.puml` and `diagrams/class.puml`.", "",
             "Size = max characters (String/Enum), digits (Number), bytes (ObjectId, Date) or max items (Array).", ""]
    for tname, fields in DD.items():
        lines += [f"## {tname}", "", "| Field Name | Data Type | Size | Key | Description |", "|---|---|---|---|---|"]
        lines += [f"| `{f[0]}` | {f[1]} | {f[2]} | {f[3]} | {f[4]} |" for f in fields]
        lines.append("")
    (DOCS / "08-phase1-data-dictionary.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    print(build_main())
    print(build_support())
    write_markdown()
