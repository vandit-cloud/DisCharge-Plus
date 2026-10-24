"""
Builds the Phase-1 review decks for DisCharge+ from the college's AIT title-slide template.

    python build_decks.py

Outputs (next to this file):
    DisCharge+_Phase1_Review.pptx        10 slides, exactly the college format
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


def title(slide, t, n, total=10, deck="Phase 1 Review"):
    text(slide, MARGIN, 0.32, 11.3, 0.7, t, size=32, bold=True, color=TEAL, anchor=MSO_ANCHOR.MIDDLE, margin=0)
    text(slide, SLIDE_W - MARGIN - 1.5, 6.98, 1.5, 0.34, f"{n} / {total}", size=14, color=MUTED,
         align=PP_ALIGN.RIGHT, margin=0)


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
                p.runs[0].text = "DisCharge+"
                for r in p.runs[1:]:
                    r.text = ""
                # subtitle paragraph right after the title, cloned from the title for font/alignment
                new_p = copy.deepcopy(p._p)
                p._p.addnext(new_p)
                from pptx.text.text import _Paragraph
                sp = _Paragraph(new_p, p._parent)
                sp.runs[0].text = "Post-Discharge Continuity-of-Care Platform for Rural Patients"
                sp.runs[0].font.size = Pt(18)
                sp.runs[0].font.bold = False
            elif "Sem-" in full:
                p.runs[0].text = full.replace("Sem-IV", "Sem-V")
                for r in p.runs[1:]:
                    r.text = ""
            elif "Team Member Name" in full:
                p.runs[0].text = "[Member 1 Name] ([Enrollment No])"
                for r in p.runs[1:]:
                    r.text = ""
                new_p = copy.deepcopy(p._p)
                p._p.addnext(new_p)
                from pptx.text.text import _Paragraph
                _Paragraph(new_p, p._parent).runs[0].text = "[Member 2 Name] ([Enrollment No])"


# ---------------------------------------------------------------------------
# Main deck: exactly 10 slides in the order the college PDF prescribes
# ---------------------------------------------------------------------------
def build_main():
    prs = Presentation(str(TEMPLATE))
    blank = blank_layout(prs)

    # 1 — Title (college template)
    s1 = prs.slides[0]
    fill_title_slide(s1)
    notes(s1, "Introduce the team and guide. One line: DisCharge+ keeps rural patients connected to their "
              "doctor after they leave hospital. Built for TetraTHON 2026, Track A HealthTech, Problem Statement 2.")

    # 2 — Project Profile: the PDF's six numbered sections as a Section | Details table
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Project Profile", 2)
    text(s, MARGIN, 1.02, 12.33, 0.45,
         [[("Project Title:  ", {"bold": True, "color": TEAL}),
           ("DisCharge+ — Post-Discharge Continuity-of-Care Platform for Rural Patients", {})]], size=20, margin=0)
    B = {"bold": True}
    table(s, MARGIN, 1.6, 12.33, [
        ["Section", "Details"],
        ["1. Project Objectives", {"bullets": True, "lines": [
            "Create a digital care plan with follow-up and dose schedules for each discharge",
            "Track daily medicine doses and automatically detect missed critical doses",
            "Let patients report symptoms in English, Hindi or Gujarati using icons",
            "Escalate red-flag symptoms to a clinician queue, ordered by severity",
            "Show clinicians in one dashboard which patients need attention today",
        ]}],
        ["2. Problem Statement", "Rural patients lose contact with care after discharge; missed medicines and "
                                 "warning signs go unnoticed until they become emergencies."],
        ["3. Tools & Technologies", {"lines": [
            [("Language: ", B), ("JavaScript   ", {}), ("Frontend: ", B), ("React 19, Vite 8, Tailwind CSS 4", {})],
            [("Backend: ", B), ("Node.js 24 LTS, Express 5   ", {}), ("Database: ", B), ("MongoDB 8, Mongoose 9", {})],
            [("Libraries: ", B), ("JWT 9, bcrypt 6, node-cron 4, i18next 26   ", {}), ("IDE: ", B),
             ("VS Code, Git, Postman", {})],
        ]}],
        ["4. External Tools / Services", "MongoDB Atlas (cloud DB), Vercel and Render (hosting). No paid APIs or AI models."],
        ["5. Target Users", "Discharged patients (rural Gujarat) and hospital clinicians"],
        ["6. Project Type / Platform", "Web Application: responsive, mobile-first, client–server (MERN stack)"],
    ], col_w=[3.15, 9.18], size=16, header_size=18, row_h=0.4, first_col_bold=True)
    notes(s, "Objectives map 1:1 to the Key Features on the next slide and to the use cases. "
             "External services are hosting only; the MVP uses no paid APIs. Versions are the current stable releases.")

    # 3 — System Analysis: the PDF's format for a NEW system (no invented existing system)
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "System Analysis", 3)
    table(s, MARGIN, 1.15, 12.33, [
        ["Section", "Content"],
        ["Problem Statement", "After discharge, rural patients rarely see their clinician until something goes wrong. "
                              "Paper instructions, often not in their language, and unnoticed warning signs lead "
                              "to avoidable readmissions."],
        ["Proposed System", {"bullets": True, "lines": [
            "A web application that turns each discharge into a tracked care plan",
            "The patient follows the plan and reports symptoms in their own language",
            "A rule engine alerts the clinician on a red flag or a missed critical dose",
        ]}],
        ["Key Features", {"bullets": True, "lines": [
            "Discharge plan editor with auto-generated follow-ups and dose schedule",
            "Daily dose tracker with missed-dose detection",
            "Icon-based symptom report in English, Hindi and Gujarati",
            "Red-flag rule engine with 4 triage tiers and a severity-ordered escalation queue",
            "Clinician dashboard with rule-based risk band",
        ]}],
        ["Target Users", {"lines": [
            [("Patient: ", B), ("views the care plan, marks doses, reports symptoms", {})],
            [("Clinician: ", B), ("creates plans, handles escalations, monitors patients", {})],
        ]}],
    ], col_w=[2.9, 9.43], size=16, header_size=18, row_h=0.4, first_col_bold=True)
    notes(s, "DisCharge+ is a new system, so per the college format we do not invent an existing system. "
             "Today the discharge is a paper summary plus verbal advice. Each Key Feature matches an objective on slide 2.")

    # 4 — Data Dictionary: the PDF's multi-table form (Table | Important Attributes), keys marked
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Data Dictionary", 4)
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
         "PK = Primary Key  ·  FK = Foreign Key  ·  full field list: Data Dictionary file", size=16, color=MUTED, margin=0)
    notes(s, "9 tables, the same 9 entities as the ER and class diagrams. Prescription is the associative table that "
             "resolves the many-to-many between DischargePlan and Medication. Escalation has two possible sources, "
             "so symptomLogId or adherenceId is filled, never both.")

    # 5–9 — diagrams
    diagram_slides = [
        ("Use Case Diagram", "usecase.png",
         "«include» = always performed  ·  «extend» = only when the condition holds",
         "Two human actors and the scheduler that runs the missed-dose check. Report Symptom always includes "
         "Evaluate Red-Flag Rules; Raise Escalation extends it only when a red flag is found, and extends "
         "Detect Missed Doses only for a critical medicine."),
        ("UML Class Diagram", "class.png",
         "◆ composition  ·  → association  ·  - private  + public  ·  multiplicity on every association",
         "Nine domain classes plus RuleEngine, the service class that appears in the sequence diagram. "
         "Foreign keys are shown as associations, not attributes."),
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
    for i, (t, img, caption, note) in enumerate(diagram_slides, start=5):
        s = prs.slides.add_slide(blank); set_bg(s)
        title(s, t, i)
        picture_fit(s, DIAGRAMS / img, MARGIN, 1.05, 12.33, 5.55)
        text(s, MARGIN, 6.6, 10.8, 0.4, caption, size=16, color=MUTED, margin=0)
        notes(s, note)

    # 10 — Further Work
    s = prs.slides.add_slide(blank); set_bg(s)
    title(s, "Further Work", 10)
    text(s, MARGIN, 1.08, 12.33, 0.5,
         "Designed in the full-vision documents; deliberately left out of this semester's build.",
         size=18, color=MUTED, italic=True, margin=0)
    fw_items = [
        ("ML risk prediction", "Readmission and adherence risk with SHAP explanations, replacing the rule-based risk band."),
        ("Offline field screening", "Health-worker role; works with no network and syncs later without duplicates."),
        ("Caregiver role", "Family members or ASHA workers report for the patient and receive alerts."),
        ("SMS / WhatsApp reminders", "Dose and follow-up reminders for patients without a smartphone."),
        ("ABDM integration", "FHIR record export, consent management and a full audit log."),
        ("Education & schemes", "Audio health education in Hindi/Gujarati; PM-JAY scheme eligibility check."),
    ]
    gw, gh = (12.33 - 0.5) / 3, 2.4
    for i, (h, b) in enumerate(fw_items):
        gx = MARGIN + (i % 3) * (gw + 0.25)
        gy = 1.75 + (i // 3) * (gh + 0.25)
        box(s, gx, gy, gw, gh, fill=TEAL_LIGHT)
        badge(s, gx + 0.25, gy + 0.28, str(i + 1), d=0.5, fill=CORAL, size=17)
        text(s, gx + 0.9, gy + 0.25, gw - 1.1, 0.6, h, size=20, bold=True, color=TEAL, anchor=MSO_ANCHOR.MIDDLE)
        text(s, gx + 0.25, gy + 0.98, gw - 0.5, gh - 1.1, b, size=18)
    notes(s, "Everything here already has a design in docs 01–06, so it is planned future scope, not a wish list. "
             "The rule-based risk band sits behind one function, so an ML model can replace it without touching the dashboard.")

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
         "Three tiers: React client → Express REST API (JWT, role + ownership checks) → MongoDB Atlas. "
         "The red-flag rule engine and the missed-dose cron job both raise escalations.",
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
