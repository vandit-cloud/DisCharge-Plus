"""Builds the DisCharge+ project documentation (.docx) in the college format.

The format is docs/SAMPLE DOCUMENTATION FILE.docx. This script opens that file as a template and
  * keeps its cover page, certificate, acknowledgement, preface, index table and footer, with the
    placeholders filled in for DisCharge+ (names, enrolment numbers, guide, semester);
  * fills the index's "Page No." column with PAGEREF fields (Word fills the numbers, see below);
  * replaces the sample's body with the DisCharge+ chapters 1-8, in the same order and style:
    Introduction, About Project, Requirement Analysis (hardware, software, data dictionary, ER),
    UML diagrams (use case, sequence, activity), flow chart, screenshots, implementation, bibliography.

Inputs:  docs/diagrams/*.png (UML / ER / flow chart), docs/documentation/screenshots/*.png (app),
         docs/documentation/symbols/*.png (notation tables).
Output:  docs/documentation/DisCharge+_Project_Documentation.docx

Run:  python docs/documentation/scripts/build_report.py
then: powershell -File docs/documentation/scripts/finish_in_word.ps1   (fills page numbers, writes the PDF)
"""
import re
import shutil
import struct
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

DOCS = Path(__file__).resolve().parents[2]
HERE = DOCS / "documentation"
TEMPLATE = DOCS / "SAMPLE DOCUMENTATION FILE.docx"
OUT = HERE / "DisCharge+_Project_Documentation.docx"
DIAGRAMS = DOCS / "diagrams"
SHOTS = HERE / "screenshots"
SYMBOLS = HERE / "symbols"

TITLE = "DisCharge+"
SUBTITLE = "Post-Discharge Continuity-of-Care Platform for Rural Patients"
STUDENTS = [("Vandit Doshi", "243030601029"), ("Smit Gajera", "243030601031")]
GUIDE = "Prof. Meeta Ahuja"

EMU_PER_INCH = 914400
TEXT_WIDTH_IN = 6.2
MAX_IMG_HEIGHT_IN = 8.3

# ---------------------------------------------------------------- XML helpers


def rpr(bold=False, italic=False, size=24, underline=False, color=None, font=None):
    parts = []
    if font:
        parts.append(f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>')
    if bold:
        parts.append("<w:b/><w:bCs/>")
    if italic:
        parts.append("<w:i/><w:iCs/>")
    if color:
        parts.append(f'<w:color w:val="{color}"/>')
    parts.append(f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>')
    if underline:
        parts.append('<w:u w:val="single"/>')
    return "<w:rPr>" + "".join(parts) + "</w:rPr>"


def run(text, **kw):
    return f'<w:r>{rpr(**kw)}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def para(content, jc=None, before=0, after=120, line=276, ind="", keep_next=False, numbering="", page_break_before=False):
    ppr = []
    if keep_next:
        ppr.append("<w:keepNext/>")
    if page_break_before:
        ppr.append("<w:pageBreakBefore/>")
    ppr.append(numbering)
    ppr.append(f'<w:spacing w:before="{before}" w:after="{after}" w:line="{line}" w:lineRule="auto"/>')
    ppr.append(ind)
    if jc:
        ppr.append(f'<w:jc w:val="{jc}"/>')
    return f'<w:p><w:pPr>{"".join(ppr)}</w:pPr>{content}</w:p>'


bookmark_ids = iter(range(500, 9999))


def bookmark(name, content):
    i = next(bookmark_ids)
    return f'<w:bookmarkStart w:id="{i}" w:name="{name}"/>{content}<w:bookmarkEnd w:id="{i}"/>'


def chapter(number, title, mark):
    """Chapter heading as in the sample: '1 . INTRODUCTION', bold 16 pt, title underlined, new page."""
    content = run(f"{number} . ", bold=True, size=32) + run(title, bold=True, size=32, underline=True)
    return para(bookmark(mark, content), after=240, keep_next=True, page_break_before=True)


def section(text, mark=None, before=240):
    """Sub-heading as in the sample: '2.1 Existing System :', bold 14 pt underlined."""
    content = run(text, bold=True, size=28, underline=True)
    return para(bookmark(mark, content) if mark else content, before=before, after=160, keep_next=True)


def label(text, before=200):
    """Small bold label such as 'User :-' above a table or diagram."""
    return para(run(text, bold=True, size=26), before=before, after=100, keep_next=True)


def body(text, first_line=True):
    ind = '<w:ind w:firstLine="567"/>' if first_line else ""
    return para(run(text, size=24), jc="both", after=160, line=360, ind=ind)


def rich(parts, first_line=False):
    """A paragraph built from (text, bold) pairs."""
    ind = '<w:ind w:firstLine="567"/>' if first_line else ""
    return para("".join(run(t, size=24, bold=b) for t, b in parts), jc="both", after=160, line=360, ind=ind)


def bullets(items, num_id=4, size=24, level_ind=720, line=300):
    """Bulleted list using the sample's own bullet definition (numId 4 = round bullet)."""
    out = []
    for item in items:
        if isinstance(item, tuple):
            content = run(item[0], size=size, bold=True) + run(item[1], size=size)
        else:
            content = run(item, size=size)
        numbering = f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num_id}"/></w:numPr>'
        out.append(para(content, jc="both", after=80, line=line, numbering=numbering,
                        ind=f'<w:ind w:left="{level_ind}" w:hanging="360"/>'))
    return "".join(out)


def key_value(items):
    """'Processor Brand : Intel(R)' lines from the sample's hardware/software lists."""
    return "".join(
        para(run(k, bold=True, size=24) + run(" : " + v, size=24), after=60, line=300, ind='<w:ind w:left="720"/>')
        for k, v in items)


def page_break():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


# ---------------------------------------------------------------- images

images = []  # (rId, media name, source path)
drawing_ids = iter(range(2000, 9999))


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def drawing(path, width_in, max_height_in=MAX_IMG_HEIGHT_IN, border=True):
    rid = f"rIdDoc{len(images) + 1}"
    name = f"doc_{len(images) + 1}.png"
    images.append((rid, name, path))
    w, h = png_size(path)
    cx = int(width_in * EMU_PER_INCH)
    cy = int(cx * h / w)
    if cy > max_height_in * EMU_PER_INCH:
        cy = int(max_height_in * EMU_PER_INCH)
        cx = int(cy * w / h)
    n = next(drawing_ids)
    line = ('<a:ln w="6350"><a:solidFill><a:srgbClr val="A6A6A6"/></a:solidFill></a:ln>' if border else "")
    return (
        f'<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="{n}" name="Picture {n}"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:nvPicPr><pic:cNvPr id="{n}" name="{name}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>{line}</pic:spPr>'
        "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>"
    )


figure_counter = {}


def caption(chapter_no, text):
    figure_counter[chapter_no] = figure_counter.get(chapter_no, 0) + 1
    return para(run(f"Figure {chapter_no}.{figure_counter[chapter_no]}: {text}", italic=True, size=20),
                jc="center", after=240)


def rotated(path):
    """A copy of a wide diagram turned 90 degrees, so it can fill a portrait page."""
    from PIL import Image
    out = HERE / ".rotated"
    out.mkdir(exist_ok=True)
    target = out / path.name
    Image.open(path).rotate(90, expand=True).save(target)
    return target


def figure(path, chapter_no, text, width_in=TEXT_WIDTH_IN, max_height_in=MAX_IMG_HEIGHT_IN, border=False, turn=False):
    if turn:
        path = rotated(path)
    return (para(drawing(path, width_in, max_height_in, border), jc="center", after=60, keep_next=True)
            + caption(chapter_no, text))


# ---------------------------------------------------------------- tables

def cell(content_xml, w, fill=None, valign="center", borders=True):
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ""
    nob = "" if borders else ('<w:tcBorders>' + "".join(f'<w:{s} w:val="nil"/>' for s in ("top", "left", "bottom", "right")) + "</w:tcBorders>")
    return f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{nob}{shd}<w:vAlign w:val="{valign}"/></w:tcPr>{content_xml}</w:tc>'


def tbl(rows_xml, widths, borders=True):
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    border = ""
    if borders:
        border = ('<w:tblBorders>' + "".join(
            f'<w:{s} w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
            for s in ("top", "left", "bottom", "right", "insideH", "insideV")) + "</w:tblBorders>")
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/><w:jc w:val="center"/>{border}'
            '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/>'
            f'</w:tblCellMar></w:tblPr><w:tblGrid>{grid}</w:tblGrid>{"".join(rows_xml)}</w:tbl>')


def table(rows, widths, size=20, center_cols=()):
    xml = []
    for i, row in enumerate(rows):
        head = i == 0
        cells = []
        for k, (t, w) in enumerate(zip(row, widths)):
            jc = "center" if head or k in center_cols else None
            cells.append(cell(para(run(t, bold=head, size=size), jc=jc, after=30, before=30, line=240), w,
                              "D9E2F3" if head else None))
        xml.append("<w:tr>" + ('<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' if head else '<w:trPr><w:cantSplit/></w:trPr>')
                   + "".join(cells) + "</w:tr>")
    return tbl(xml, widths) + para("", after=120)


def symbol_table(rows, name_header="Name"):
    """Sr.no | Symbol | Name table, as in the sample's 'ER DIAGRAM SYMBOLS'."""
    widths = [1000, 3400, 3600]
    xml = ["<w:tr><w:trPr><w:tblHeader/></w:trPr>" + "".join(
        cell(para(run(t, bold=True, size=24), jc="center", after=40, before=40), w, "D9E2F3")
        for t, w in zip(("Sr.no", "Symbol", name_header), widths)) + "</w:tr>"]
    for i, (sym, name) in enumerate(rows, start=1):
        xml.append('<w:tr><w:trPr><w:cantSplit/></w:trPr>'
                   + cell(para(run(str(i), size=24), jc="center", after=0), widths[0])
                   + cell(para(drawing(SYMBOLS / f"{sym}.png", 1.6, border=False), jc="center", after=0, before=40), widths[1])
                   + cell(para(run(name, bold=True, size=24), jc="center", after=0), widths[2]) + "</w:tr>")
    return tbl(xml, widths) + para("", after=160)


def phone_pair(left, right, chapter_no, text):
    """Two phone screenshots side by side in a borderless table, one caption."""
    widths = [4513, 4513]
    row = ("<w:tr><w:trPr><w:cantSplit/></w:trPr>"
           + cell(para(drawing(SHOTS / f"{left[0]}.png", 2.45, border=True), jc="center", after=40), widths[0], borders=False)
           + cell(para(drawing(SHOTS / f"{right[0]}.png", 2.45, border=True), jc="center", after=40), widths[1], borders=False)
           + "</w:tr><w:tr>"
           + cell(para(run(left[1], italic=True, size=20), jc="center", after=0), widths[0], borders=False)
           + cell(para(run(right[1], italic=True, size=20), jc="center", after=0), widths[1], borders=False)
           + "</w:tr>")
    return tbl([row], widths, borders=False) + caption(chapter_no, text)


# ---------------------------------------------------------------- content

DATA_DICTIONARY = [
    ("User", "Login account of a patient or a clinician", [
        ("userId", "ObjectId", "Primary Key", "Unique id of the user"),
        ("fullName", "String(100)", "Not Null", "Full name of the user"),
        ("phone", "String(13)", "Unique, Not Null", "Login mobile number (+91 and 10 digits)"),
        ("passwordHash", "String(60)", "Not Null", "bcrypt hash of the password, never plain text"),
        ("role", "Enum", "Not Null", "patient / clinician"),
        ("preferredLanguage", "Enum", "Not Null", "en / hi / gu (default en)"),
        ("isActive", "Boolean", "Not Null", "Account active flag"),
    ]),
    ("Patient", "Profile of a patient (one per patient user)", [
        ("patientId", "ObjectId", "Primary Key", "Unique id of the patient"),
        ("userId", "ObjectId", "Foreign Key, Unique", "Reference to User (login account)"),
        ("abhaId", "String(14)", "Unique, Null", "14-digit ABHA health id (optional)"),
        ("dateOfBirth", "Date", "Not Null", "Date of birth (age is calculated from it)"),
        ("gender", "Enum", "Not Null", "male / female / other"),
        ("district", "String(60)", "Not Null", "Home district (used for travel distance)"),
    ]),
    ("DischargePlan", "Care plan written by the clinician at discharge", [
        ("planId", "ObjectId", "Primary Key", "Unique id of the plan"),
        ("patientId", "ObjectId", "Foreign Key", "Reference to Patient being discharged"),
        ("clinicianId", "ObjectId", "Foreign Key", "Reference to User (doctor who wrote the plan)"),
        ("admissionDate", "Date", "Not Null", "Date of admission"),
        ("dischargeDate", "Date", "Not Null", "Start date of every schedule"),
        ("primaryDiagnosis", "String(200)", "Not Null", "Main diagnosis"),
        ("redFlags", "Array[Enum]", "Not Null (1-20)", "Danger signs for this condition"),
        ("followUpProtocol", "Enum", "Not Null", "cardiac / diabetes / ckd / post_surgical / general"),
        ("status", "Enum", "Not Null", "active / completed / readmitted / lost_to_followup"),
    ]),
    ("Medication", "Medicine master list", [
        ("medicationId", "ObjectId", "Primary Key", "Unique id of the medicine"),
        ("genericName", "String(120)", "Unique, Not Null", "Generic name, e.g. metformin"),
        ("form", "Enum", "Not Null", "tablet / capsule / syrup / injection"),
        ("strength", "String(30)", "Not Null", "Strength per unit, e.g. 500 mg"),
    ]),
    ("Prescription", "One medicine line of a plan (links DischargePlan and Medication)", [
        ("prescriptionId", "ObjectId", "Primary Key", "Unique id of the prescription line"),
        ("planId", "ObjectId", "Foreign Key", "Reference to DischargePlan"),
        ("medicationId", "ObjectId", "Foreign Key", "Reference to Medication"),
        ("dosage", "String(40)", "Not Null", "Amount per dose, e.g. 1 tablet"),
        ("frequency", "Enum", "Not Null", "OD / BD / TDS / QID (1-4 doses a day)"),
        ("timingSlots", "Array[Enum]", "Not Null", "morning / afternoon / evening / night"),
        ("durationDays", "Number(3)", "Not Null (1-365)", "Number of days to take it"),
        ("isCritical", "Boolean", "Not Null", "A missed dose raises an escalation"),
    ]),
    ("FollowUp", "Follow-up visit, test or call generated from the protocol", [
        ("followUpId", "ObjectId", "Primary Key", "Unique id of the follow-up"),
        ("planId", "ObjectId", "Foreign Key", "Reference to DischargePlan"),
        ("scheduledDate", "Date", "Not Null", "Due date"),
        ("type", "Enum", "Not Null", "in_person / teleconsult / lab_test / phone_check"),
        ("description", "String(300)", "Not Null", "e.g. Serum creatinine test"),
        ("status", "Enum", "Not Null", "scheduled / completed / missed"),
        ("completedDate", "Date", "Null", "Actual completion date"),
    ]),
    ("AdherenceRecord", "One scheduled dose of a prescription", [
        ("adherenceId", "ObjectId", "Primary Key", "Unique id of the dose"),
        ("prescriptionId", "ObjectId", "Foreign Key", "Reference to Prescription"),
        ("scheduledAt", "Date", "Not Null", "Date and time the dose is due"),
        ("status", "Enum", "Not Null", "pending / taken / missed"),
        ("recordedAt", "Date", "Null", "When the patient marked it taken"),
    ]),
    ("SymptomLog", "Symptom report sent by the patient", [
        ("symptomLogId", "ObjectId", "Primary Key", "Unique id of the report"),
        ("patientId", "ObjectId", "Foreign Key", "Reference to Patient"),
        ("reportedAt", "Date", "Not Null", "Date and time of the report"),
        ("symptoms", "Array[Enum]", "Not Null (1-10)", "Symptom codes selected"),
        ("severity", "Number(1)", "Not Null (1-5)", "Overall severity"),
        ("triageTier", "Enum", "Not Null", "self_care / teleconsult / urgent / emergency"),
        ("triggeredRules", "Array[String]", "Null", "Ids of the red-flag rules that matched"),
    ]),
    ("Escalation", "Alert raised to the clinician", [
        ("escalationId", "ObjectId", "Primary Key", "Unique id of the escalation"),
        ("patientId", "ObjectId", "Foreign Key", "Reference to Patient"),
        ("symptomLogId", "ObjectId", "Foreign Key, Null", "Source report (null for a missed dose)"),
        ("adherenceId", "ObjectId", "Foreign Key, Null", "Missed dose (null for a symptom report)"),
        ("assignedClinicianId", "ObjectId", "Foreign Key", "Reference to User (clinician handling it)"),
        ("source", "Enum", "Not Null", "symptom_log / missed_critical_dose"),
        ("tier", "Enum", "Not Null", "teleconsult / urgent / emergency"),
        ("triggeredRules", "Array[String]", "Not Null", "Why it was raised"),
        ("status", "Enum", "Not Null", "open / acknowledged / resolved"),
        ("createdAt", "Date", "Not Null", "When it was raised"),
        ("acknowledgedAt", "Date", "Null", "When a clinician acknowledged it"),
        ("resolvedAt", "Date", "Null", "When it was closed"),
        ("notes", "String(1000)", "Null", "Action taken (required to resolve)"),
    ]),
]

BIBLIOGRAPHY = [
    ("https://react.dev", "React documentation"),
    ("https://vite.dev/guide/", "Vite documentation"),
    ("https://tailwindcss.com/docs", "Tailwind CSS documentation"),
    ("https://tanstack.com/query/latest/docs", "TanStack Query documentation"),
    ("https://www.i18next.com", "i18next (translations)"),
    ("https://expressjs.com", "Express.js documentation"),
    ("https://www.mongodb.com/docs/manual/", "MongoDB manual"),
    ("https://mongoosejs.com/docs/", "Mongoose documentation"),
    ("https://zod.dev", "Zod (input validation)"),
    ("https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression", "scikit-learn: logistic regression"),
    ("https://www.kaggle.com/datasets/joniarroba/noshowappointments",
     "Joni Hoppen, Medical Appointment No Shows (Kaggle dataset, CC BY-NC-SA 4.0)"),
    ("https://capacitorjs.com/docs", "Capacitor (Android app) documentation"),
    ("https://abdm.gov.in", "Ayushman Bharat Digital Mission (ABHA health id)"),
    ("https://plantuml.com", "PlantUML (UML diagrams)"),
    ("https://graphviz.org", "Graphviz (ER diagram and flow chart)"),
]

hyperlinks = []  # (rId, url)


def hyperlink(url, text):
    rid = f"rIdLink{len(hyperlinks) + 1}"
    hyperlinks.append((rid, url))
    return (f'<w:hyperlink r:id="{rid}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/>'
            f'<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:hyperlink>')


def build_body():
    x = []

    # 1 ------------------------------------------------------------ Introduction
    x.append(chapter("1", "INTRODUCTION", "S1"))
    x.append(rich([("DisCharge+", True), (" is a web-based post-discharge continuity-of-care platform for patients from rural and "
                   "remote areas of Gujarat. When a patient leaves the hospital, the discharge summary is usually a sheet of "
                   "paper written in English. Between discharge and the first follow-up nobody checks whether the medicines "
                   "are taken, and danger signs such as breathlessness or swelling are noticed only when the patient comes "
                   "back as an emergency.", False)], first_line=True))
    x.append(rich([("DisCharge+ turns every discharge into a ", False), ("tracked care plan", True), (". When the clinician saves "
                   "the plan, the system generates the follow-up dates and the complete dose schedule. The patient marks doses "
                   "and reports symptoms on a mobile phone in English, Hindi or Gujarati. A rule engine checks every report "
                   "against the danger signs of the patient's condition and raises an escalation to the clinician when a red "
                   "flag appears or a critical medicine dose is missed. The clinician dashboard also uses a ", False),
                  ("machine learning model", True), (" to estimate which patients are likely to miss their next follow-up, so "
                   "the hospital can phone them first.", False)], first_line=True))
    x.append(body("The project was built for TetraTHON 2026 (Navrachana University, Vadodara, with ISEN Méditerranée), "
                  "Track A HealthTech, Problem Statement 2: AI-Based Continuity of Care Platform for Rural and Remote "
                  "Patients, and is submitted as the BCA Semester V minor project."))

    x.append(section("Module :-"))
    x.append(bullets(["Patient", "Clinician", "System (scheduler, rule engine and prediction)"], num_id=2, level_ind=1080))
    x.append(section("Patient :-", before=160))
    x.append(bullets(["Register", "Log in", "Choose language (English / Hindi / Gujarati)", "View today's medicines",
                      "Mark dose taken", "View care plan and red flags", "View check-ups (follow-ups)",
                      "Report symptom with severity", "Receive dose reminders (Android app)", "Logout"], num_id=2, level_ind=1080))
    x.append(section("Clinician :-", before=160))
    x.append(bullets(["Log in", "View dashboard (risk, adherence trend, whom to phone first)", "Find patient by mobile number or ABHA ID",
                      "Create discharge plan", "View patient details", "Mark follow-up done / close plan",
                      "Manage escalation queue (acknowledge / resolve)", "Receive escalation alerts", "Logout"], num_id=2, level_ind=1080))
    x.append(section("System :-", before=160))
    x.append(bullets(["Generate follow-ups and the dose schedule from the plan", "Evaluate red-flag rules on every symptom report",
                      "Detect missed doses every 15 minutes", "Raise escalations (teleconsult / urgent / emergency)",
                      "Compute the risk band of each patient", "Predict the follow-up no-show risk"], num_id=2, level_ind=1080))

    x.append(section("Overview", before=320))
    x.append(body("DisCharge+ follows a role-based design with two roles. A patient registers with a mobile number and sees "
                  "only their own plan, medicines, check-ups and reports. A clinician writes discharge plans, watches the "
                  "dashboard and handles escalations for the patients they discharged. Every request is checked on the "
                  "server, so a patient can never open another patient's data."))
    x.append(body("The patient pages are designed for low-literacy users on basic smartphones: large buttons, symptom icons, "
                  "a sun-path picture of the day's doses (morning, afternoon, evening, night) and full translation into Hindi "
                  "and Gujarati. The same pages are packaged as an Android app that shows dose reminders as phone "
                  "notifications, even without opening the app."))
    x.append(body("The clinician website shows a dashboard with the patients who need attention, a 14-day adherence trend, "
                  "patients by risk band (high / moderate / low), open escalations by tier and overdue follow-ups. The "
                  "escalation queue is sorted by tier and then by age, refreshes every 30 seconds and can sound a browser "
                  "alert for every new escalation."))
    x.append(body("The follow-up no-show prediction is a logistic regression model trained on 71,959 real public-hospital "
                  "appointments (Kaggle \"Medical Appointment No Shows\"). It gives each upcoming follow-up a probability "
                  "of being missed, and simple rules add visible reasons such as low adherence, no activity in the app for "
                  "three days or a home district more than 100 km from the hospital. It supports a decision (whom to phone "
                  "first); it never changes the patient's treatment."))

    # 2 ------------------------------------------------------------ About project
    x.append(chapter("2", "About Project", "S2"))
    x.append(section("2.1 Existing System :", "S2_1", before=120))
    x.append(bullets([
        "Discharge instructions are given on a paper summary, usually in English, which many rural patients cannot read.",
        "Follow-up visits depend on the patient remembering the date and travelling to the hospital.",
        "Nobody checks whether medicines are taken between discharge and the first follow-up.",
        "Danger signs are noticed only when the patient returns as an emergency or is readmitted.",
        "The hospital has no list of discharged patients at risk or likely to miss their follow-up.",
    ], size=26, line=360))
    x.append(section("2.2 Proposed System :", "S2_2", before=360))
    x.append(bullets([
        "Each discharge becomes a digital care plan with follow-ups and a dose schedule generated automatically.",
        "The patient marks doses and reports symptoms on a phone in English, Hindi or Gujarati, using icons.",
        "A red-flag rule engine escalates danger signs and missed critical doses to the clinician in a triaged queue.",
        "The clinician dashboard shows risk bands, the adherence trend, overdue follow-ups and open escalations.",
        "A machine learning model ranks upcoming follow-ups by no-show risk so the riskiest patients are phoned first.",
        "An Android app reminds the patient at dose time; the website alerts the clinician with sound by tier.",
    ], size=26, line=360))

    # 3 ------------------------------------------------------------ Requirement analysis
    x.append(chapter("3", "Requirement Analysis", "S3"))
    x.append(section("3.1 Hardware Requirements :", "S3_1", before=120))
    x.append(label("Development machine :", before=60))
    x.append(key_value([("Processor Brand", "AMD Ryzen 7 7435HS"), ("System Type", "64-bit operating system, x64-based PC"),
                        ("Processor Speed", "3.10 GHz (8 cores)"), ("RAM Size", "16.00 GB"), ("Hard Drive Size", "512 GB SSD")]))
    x.append(label("Minimum for users :"))
    x.append(key_value([("Patient", "Android 8+ smartphone or any phone with a modern browser"),
                        ("Clinician", "PC or laptop with 4 GB RAM and Chrome / Edge / Firefox"),
                        ("Network", "Mobile data or Wi-Fi (the pages are small and load on 3G)")]))
    x.append(section("3.2 Software Requirements :", "S3_2", before=320))
    x.append(key_value([
        ("Operating system", "Windows 11"),
        ("Frontend", "React 19, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query 5, i18next"),
        ("Backend", "Node.js 24 LTS, Express 5"),
        ("Database", "MongoDB 8.2 (local), MongoDB Atlas (cloud)"),
        ("Database connectivity", "Mongoose 9"),
        ("Security", "JWT (jsonwebtoken 9), bcrypt 6, Zod 4 validation, rate limiting"),
        ("Scheduler", "node-cron 4 (missed-dose sweep every 15 minutes)"),
        ("Machine learning", "Python 3.12, pandas 3, scikit-learn 1.9 (training only)"),
        ("Mobile app", "Capacitor 8 (Android), Local Notifications"),
        ("Testing", "Vitest 5, Supertest 7, mongodb-memory-server"),
        ("Hosting", "Vercel (website), Render (API), MongoDB Atlas (database)"),
        ("Tools", "Git and GitHub, PlantUML and Graphviz (diagrams), Android Studio, MS Word, MS PowerPoint"),
        ("IDE", "Visual Studio Code"),
    ]))

    x.append(section("3.3 Data Dictionary", "S3_3", before=320))
    x.append(body("The database has 9 collections. MongoDB gives every document an ObjectId (_id), shown below as the "
                  "primary key; foreign keys hold the ObjectId of the referenced document. Size is the maximum number of "
                  "characters (String) or digits (Number).", first_line=False))
    widths = [800, 2150, 1500, 1800, 2776]
    for name, purpose, fields in DATA_DICTIONARY:
        x.append(label(f"{name} :-  ", before=200).replace("</w:p>", run(f"({purpose})", italic=True, size=22) + "</w:p>", 1))
        rows = [("Sr.no", "Field Name", "Data Type", "Constraint", "Description")]
        rows += [(str(i), *f) for i, f in enumerate(fields, start=1)]
        x.append(table(rows, widths, center_cols=(0,)))
    x.append(rich([("Note: ", True), ("the no-show probability and the risk band are calculated each time the dashboard is "
                   "opened and are not stored, so they need no collection.", False)]))

    x.append(label("ER DIAGRAM SYMBOLS", before=360))
    x.append(symbol_table([("er-entity", "Entity"), ("er-associative", "Associative entity"), ("er-attribute", "Attribute"),
                           ("er-key", "Key attribute (underlined)"), ("er-relationship", "Relationship"),
                           ("er-link", "Link (connector)"), ("er-cardinality", "Cardinality (1, 0..1, 0..N, 1..N)")]))
    x.append(section("3.4 ER DIAGRAM", "S3_4", before=0).replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(figure(DIAGRAMS / "er-chen.png", 3, "E-R diagram of DisCharge+ (9 entities, Chen notation)", max_height_in=8.0))

    # 4 ------------------------------------------------------------ UML
    x.append(chapter("4", "UML DIAGRAM", "S4"))
    x.append(label("USE CASE DIAGRAM SYMBOL :", before=0))
    x.append(symbol_table([("uc-actor", "Actor (Patient / Clinician)"), ("uc-usecase", "Use case"),
                           ("uc-system", "System boundary"), ("uc-association", "Association"),
                           ("uc-dependency", "Include / Extend relationship")], "Reference Name"))
    x.append(section("4.1 USE CASE DIAGRAM :", "S4_1", before=0).replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(label("PATIENT USE CASE :", before=60))
    x.append(figure(DIAGRAMS / "usecase-patient.png", 4, "Use case diagram: Patient", width_in=5.4, max_height_in=7.6))
    x.append(label("CLINICIAN USE CASE :").replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(figure(DIAGRAMS / "usecase-clinician.png", 4, "Use case diagram: Clinician and the Scheduler",
                    width_in=5.0, max_height_in=7.8))

    x.append(section("4.2 SEQUENCE DIAGRAM :", "S4_2", before=0).replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(label("REPORT SYMPTOM → ESCALATION :", before=60))
    x.append(figure(DIAGRAMS / "sequence.png", 4, "Sequence diagram: a symptom report raises an escalation", max_height_in=8.0, turn=True))
    x.append(label("VIEW DASHBOARD → NO-SHOW PREDICTION :").replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(figure(DIAGRAMS / "sequence-noshow.png", 4, "Sequence diagram: the dashboard predicts follow-up no-show risk",
                    max_height_in=8.0, turn=True))

    x.append(label("ACTIVITY DIAGRAM SYMBOL :", before=0).replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(symbol_table([("act-initial", "Initial node (start)"), ("act-action", "Action"),
                           ("act-decision", "Decision / merge"), ("act-bar", "Fork / join bar"),
                           ("act-flow", "Control flow"), ("act-final", "Final node (end)")]))
    x.append(section("4.3 ACTIVITY DIAGRAM :", "S4_3", before=0).replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(label("PATIENT ACTIVITY :", before=60))
    x.append(figure(DIAGRAMS / "activity-patient.png", 4, "Activity diagram: Patient", max_height_in=7.4))
    x.append(label("CLINICIAN ACTIVITY :").replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(figure(DIAGRAMS / "activity-clinician.png", 4, "Activity diagram: Clinician", max_height_in=7.4))
    x.append(label("SYMPTOM REPORT AND ESCALATION (SWIMLANES) :").replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(figure(DIAGRAMS / "activity.png", 4, "Activity diagram: symptom report and escalation across Patient, System and Clinician",
                    width_in=5.6, max_height_in=7.6))

    # 5 ------------------------------------------------------------ Flow chart
    x.append(chapter("5", "FLOW CHART", "S5"))
    x.append(label("FLOW CHART SYMBOLS :", before=0))
    x.append(symbol_table([("fc-terminal", "Terminal (start / stop)"), ("fc-process", "Process"),
                           ("fc-io", "Input / output"), ("fc-decision", "Decision"), ("fc-flow", "Flow line")]))
    x.append(para("", after=0).replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1))
    x.append(figure(DIAGRAMS / "flowchart.png", 5, "System flow chart of DisCharge+", max_height_in=8.6))

    # 6 ------------------------------------------------------------ Screenshots
    x.append(chapter("6", "System Development", "S6"))
    x.append(section("6.1 Screen Shots of Input / Output Forms", "S6_1", before=120))
    x.append(body("The screenshots below were taken from the running application with the synthetic demo data (no real "
                  "patient data is used). Patient pages are shown at phone size; clinician pages at desktop size.",
                  first_line=False))
    n = 0

    def shot_title(text, page_break_before=False):
        nonlocal n
        n += 1
        p = label(f"{n} . {text}", before=200)
        return p.replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1) if page_break_before else p

    x.append(shot_title("Login"))
    x.append(figure(SHOTS / "login.png", 6, "Login page (shared by patients and clinicians)", border=True))
    x.append(shot_title("Patient registration", True))
    x.append(figure(SHOTS / "register.png", 6, "Patient registration with language choice and optional ABHA id",
                    width_in=5.6, max_height_in=7.6, border=True))
    x.append(shot_title("Patient home", True))
    x.append(phone_pair(("p-home", "English"), ("p-home-gu", "Gujarati"), 6,
                        "Patient home: today's doses on the sun path, in English and in Gujarati"))
    x.append(shot_title("My medicines and my care plan", True))
    x.append(phone_pair(("p-medicines", "My medicines"), ("p-plan", "My care plan"), 6,
                        "Medicines with the last 7 days of doses; care plan with the red flags"))
    x.append(shot_title("Report a symptom", True))
    x.append(phone_pair(("p-report", "Step 1: choose symptoms"), ("p-severity", "Step 2: how bad is it?"), 6,
                        "Symptom report: icon buttons, then a 5-level severity scale"))
    x.append(shot_title("Report result and check-ups", True))
    x.append(phone_pair(("p-result", "Result: doctor alerted"), ("p-followups", "My check-ups"), 6,
                        "The red-flag rules raised an escalation; the patient's follow-up list"))
    x.append(shot_title("Clinician dashboard", True))
    x.append(figure(SHOTS / "dashboard.png", 6, "Clinician dashboard: attention count, 14-day adherence trend, risk ring, "
                    "open escalations, whom to phone first (no-show prediction) and overdue follow-ups",
                    max_height_in=8.4, border=True))
    x.append(shot_title("Escalation queue", True))
    x.append(figure(SHOTS / "queue.png", 6, "Escalation queue sorted by tier, then oldest first", border=True))
    x.append(shot_title("Escalation detail"))
    x.append(figure(SHOTS / "escalation.png", 6, "Escalation detail: what was reported, which rules fired, acknowledge / resolve",
                    border=True))
    x.append(shot_title("Patient list", True))
    x.append(figure(SHOTS / "patients.png", 6, "Patient list with adherence and risk band", border=True))
    x.append(shot_title("Patient details", True))
    x.append(figure(SHOTS / "patient-detail.png", 6, "Patient details: plan, medicines and follow-ups", border=True))
    x.append(shot_title("New discharge plan", True))
    x.append(figure(SHOTS / "plan-editor.png", 6, "Discharge plan editor: admission, medicines, red flags and follow-up protocol",
                    border=True))

    # 7 ------------------------------------------------------------ Implementation
    x.append(chapter("7", "Implementation", "S7"))
    x.append(bullets([
        "DisCharge+ is implemented as a three-tier client-server web application: a React single-page app (client), "
        "a REST API in Node.js and Express (server) and a MongoDB database.",
        "The frontend is built with React 19, Vite and Tailwind CSS. Patient pages are mobile-first and translated into "
        "English, Hindi and Gujarati with i18next; a script checks that all 145 translation keys exist in every language.",
        "TanStack Query fetches and caches data; the escalation queue and alerts refresh every 30 seconds.",
        "The backend exposes about 30 REST endpoints. Every request body and query is validated with Zod, users log in "
        "with a JSON Web Token, passwords are hashed with bcrypt, and logins are rate-limited.",
        "Role checks run on the server: clinician routes reject patients, and a patient can open only their own records.",
        "Saving a discharge plan generates the follow-ups from the chosen protocol (cardiac, diabetes, CKD, post-surgical, "
        "general) and one AdherenceRecord for every dose of every prescription.",
        "The red-flag rule engine matches each symptom report against the plan's red flags and the condition rules; the "
        "highest tier wins, and teleconsult, urgent or emergency raises an Escalation. The tier is stored on every report "
        "so missed red flags can be audited.",
        "A node-cron job runs every 15 minutes, marks overdue doses as missed and raises an urgent escalation for a missed "
        "critical dose. It also runs once at start-up so nothing is lost after a restart.",
        "The risk band (high / moderate / low) is calculated from adherence, open escalations and days since discharge "
        "each time it is shown, so it is never out of date.",
        "The no-show model is trained by ml/train_noshow.py: logistic regression on 71,959 appointments, split by patient, "
        "test AUC 0.595. Its weights are exported to JSON and the Node.js server applies the sigmoid function, so no Python "
        "runs in production. Rules add reasons (adherence below 60 %, no app activity for 3 days, home over 100 km away).",
        "The Android app is built from the same React code with Capacitor and schedules local dose reminders.",
        "98 automated tests (unit and integration with an in-memory MongoDB) check the rules, generators, API and "
        "security, including a robustness test that sends about 6,700 invalid requests and expects no server error.",
        "The website is hosted on Vercel, the API on Render (Singapore) and the database on MongoDB Atlas. Only "
        "synthetic demo data is used.",
    ], size=24, line=320))
    x.append(section("Limitations :", before=240))
    x.append(bullets([
        "The no-show model is trained on public appointments from Brazil, not on Gujarat discharge follow-ups, and its "
        "accuracy is modest (AUC 0.595); it should be retrained on the hospital's own follow-up records.",
        "The red-flag rules and risk thresholds were written from published guidance and must be reviewed by a clinician.",
        "Hindi and Gujarati texts need checking by native speakers; reminders by SMS are not built.",
    ], size=24, line=320))
    x.append(section("Future Enhancements :", before=240))
    x.append(bullets([
        "Caregiver and ASHA health-worker roles, with offline screening that syncs later.",
        "SMS / WhatsApp reminders, voice (text-to-speech) for patients who cannot read.",
        "PM-JAY scheme eligibility check, ABDM / FHIR interoperability and an audit log.",
        "Retraining the prediction model on DisCharge+ data, with distance and adherence as learned features.",
    ], size=24, line=320))

    # 8 ------------------------------------------------------------ Bibliography
    x.append(chapter("8", "Bibliography", "S8"))
    for url, text in BIBLIOGRAPHY:
        numbering = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="15"/></w:numPr>'
        x.append(para(hyperlink(url, url) + run(f"  ({text})", size=22), after=100, line=300, numbering=numbering,
                      ind='<w:ind w:left="720" w:hanging="360"/>'))
    return "".join(x)


# ---------------------------------------------------------------- front matter edits

P_RE = re.compile(r"<w:p[ >].*?</w:p>", re.S)


def first_rpr(p_xml):
    """Formatting of the paragraph's first run (empty when that run has none)."""
    m = re.search(r"<w:r(?: [^>]*)?>(<w:rPr>.*?</w:rPr>)?", p_xml, re.S)
    return m.group(1) if m and m.group(1) else "<w:rPr></w:rPr>"


def with_bold(rpr_xml, bold, size=None):
    r = re.sub(r'<w:b/>|<w:bCs/>|<w:b w:val="[^"]*"/>|<w:bCs w:val="[^"]*"/>|<w:rStyle w:val="Strong"/>', "", rpr_xml)
    if size:
        r = re.sub(r'<w:sz w:val="\d+"/>|<w:szCs w:val="\d+"/>', "", r)
        r = r.replace("</w:rPr>", f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>')
    return r.replace("<w:rPr>", "<w:rPr><w:b/><w:bCs/>", 1) if bold else r


def set_runs(p_xml, segments):
    """Replace a paragraph's runs, keeping its paragraph properties and the first run's formatting.
    segments: list of (text, bold or None) where None keeps the template's weight; "\\n" = line break."""
    base = first_rpr(p_xml)
    start = re.search(r"<w:r[ >]", p_xml).start()
    runs = []
    for text, bold, *size in segments:
        r = base if bold is None and not size else with_bold(base, bool(bold), size[0] if size else None)
        if text == "\n":
            runs.append(f"<w:r>{r}<w:br/></w:r>")
        else:
            runs.append(f'<w:r>{r}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>')
    return p_xml[:start] + "".join(runs) + "</w:p>"


def edit_front(front):
    paras = list(P_RE.finditer(front))

    def texts(i):
        return "".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", paras[i].group(0)))

    edits = {}

    def find(snippet):
        hits = [i for i in range(len(paras)) if snippet in texts(i)]
        assert hits, snippet
        return hits[0]

    names = [s for s in STUDENTS]
    team = []
    for k, (n, e) in enumerate(names):
        if k:
            team.append(("\n", None))
        team.append((f"{n} ({e})", None))

    edits[find("[PROJECT TITLE NAME]")] = [(TITLE, None), ("\n", None), (SUBTITLE, False)]
    edits[find("Submitted as Partial")] = [("Submitted as Partial Fulfilment of Bachelor of Computer Application Sem-V", None)]
    edits[find("Team Member Name")] = team
    edits[find("Guide Name")] = [(f"Guide Name   {GUIDE}", None)]
    who = " and ".join(n for n, _ in STUDENTS)
    nos = " and ".join(e for _, e in STUDENTS)
    edits[find("This is to certify")] = [
        ("This is to certify that the project entitled ", False), (f"“{TITLE} – {SUBTITLE}”", True),
        (" has been successfully completed by ", False), (who, True), (", bearing Enrolment Nos. ", False), (nos, True),
        (", of ", False), ("BCA Semester V", True), (", during the academic year ", False), ("2026–27", True), (".", False)]
    edits[find("carried out under the guidance")] = [
        ("The project work has been carried out under the guidance and supervision of ", False), (GUIDE, True),
        (" in partial fulfilment of the academic requirements prescribed by ", False),
        ("Ahmedabad Institute of Technology", True), (".", False)]
    edits[find("It is a great sense of satisfaction")] = [
        ("It is a great sense of satisfaction that we present our real venture in practical computing in the form of a "
         "project work. It is also a matter of privilege and an honour for us to work on the project ", False),
        (f"“{TITLE}”", True), (". We wish to express our hearty thanks to all who assisted us during the project.", False)]
    edits[find("could not have been completed")] = [
        ("The project could not have been completed without the valuable suggestions and guidance from various sources. "
         "At the very onset we would like to express our sincere gratitude to ", False), (f"({GUIDE})", True),
        (" for the valuable guidance during the project.", False)]
    edits[find("We are very grateful")] = [
        ("We are very grateful to our ", False), ("Ahmedabad Institute of Technology", True),
        (" to which we are submitting our project. We would also like to thank all our professors, especially the BCA "
         "faculty, who helped us throughout the project, and our friends who gave us wonderful support in design and "
         "technical problems.", False)]
    edits[find("At last but not least")] = [
        ("Last but not least, we thank our parents and family members for their invaluable help at every stage.", False)]
    edits[find("The work entitled to the students")] = [
        ("The project work given to the students of BCA is a reflection of their knowledge and its practical "
         "application, and an endeavour towards developing talent, extending help and, above all, team effort "
         "amongst the students.", False)]
    edits[find("The present project report titled")] = [
        ("The present project report titled “", False), (TITLE, True),
        ("” describes a platform designed and developed for the continuity of care of patients after they are "
         "discharged from hospital. The system keeps the complete record of each discharge plan, its medicines, "
         "doses, follow-ups, symptom reports and escalations, and helps the clinician decide whom to contact first.", False)]

    guide = find("Guide Name")
    address = find("AIT - Beside")
    spacers = list(range(find("Submitted as Partial") + 1, find("Developed By")))[:1] + list(range(guide + 1, address))
    for i in spacers:
        if not texts(i).strip() and "<w:drawing" not in paras[i].group(0):
            edits[i] = None  # remove

    out, last = [], 0
    for i, m in enumerate(paras):
        if i in edits and edits[i] is None:
            out.append(front[last:m.start()])
            last = m.end()
        elif i in edits:
            out.append(front[last:m.start()])
            new = set_runs(m.group(0), edits[i])
            if "[PROJECT TITLE NAME]" in "".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", m.group(0))):
                new = new.replace('<w:ind w:left="2160" w:firstLine="720"/>', '<w:jc w:val="center"/>', 1)  # centre it
            out.append(new)
            last = m.end()
    out.append(front[last:])
    return "".join(out)


INDEX_MARKS = {
    "Introduction": "S1", "About Project": "S2", "Existing System": "S2_1", "Proposed System": "S2_2",
    "Requirement Analysis": "S3", "Hardware Requirements": "S3_1", "Software Requirements": "S3_2",
    "Data Dictionary": "S3_3", "Entity Relationship Diagram": "S3_4", "UML Diagram": "S4",
    "Use Case diagram": "S4_1", "Sequence diagram": "S4_2", "Activity Diagram": "S4_3", "Flow Chart": "S5",
    "System Development": "S6", "Screen Shots of Input/ Output Forms": "S6_1", "Implementation": "S7",
    "Bibliography": "S8",
}


def fill_index(front):
    """Put a PAGEREF field in the Page No. cell of every index row."""
    t0 = front.index("Particulars")
    tbl_start = front.rfind("<w:tbl>", 0, t0)
    tbl_end = front.index("</w:tbl>", t0) + len("</w:tbl>")
    table_xml = front[tbl_start:tbl_end]
    done = set()

    def fix_row(m):
        row = m.group(0)
        cells = re.findall(r"<w:tc>.*?</w:tc>", row, re.S)
        if len(cells) != 4:
            return row
        name = "".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", cells[2])).strip()
        mark = INDEX_MARKS.get(name)
        if not mark:
            return row
        done.add(name)
        field = ('<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>'
                 f'<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:instrText xml:space="preserve"> PAGEREF {mark} \\h </w:instrText></w:r>'
                 '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>'
                 '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>#</w:t></w:r>'
                 '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>')
        new_cell = cells[3][: cells[3].rindex("</w:p>")] + field + cells[3][cells[3].rindex("</w:p>"):]
        new_cell = re.sub(r"<w:pPr>", '<w:pPr><w:jc w:val="center"/>', new_cell, 1) if "<w:jc " not in new_cell else new_cell
        return row.replace(cells[3], new_cell)

    new_table = re.sub(r"<w:tr[ >].*?</w:tr>", fix_row, table_xml, flags=re.S)
    missing = set(INDEX_MARKS) - done
    assert not missing, f"index rows not found: {missing}"
    new_table = re.sub(r"<w:tblpPr [^>]*/>", "", new_table, 1)
    new_table = re.sub(r"(<w:tblW [^>]*/>)", r'\1<w:jc w:val="center"/>', new_table, 1)  # schema order: tblW, jc

    after = front[tbl_end:]
    paras = list(P_RE.finditer(after))
    heading = next(m.group(0) for m in paras if "INDEX" in m.group(0))
    kept = [m.group(0) for m in paras if "<w:sectPr" in m.group(0)]
    heading = heading.replace("<w:pPr>", '<w:pPr><w:pageBreakBefore/><w:spacing w:after="360"/>', 1)
    # The sample pads the preface page with ~36 empty paragraphs to push the index down. With the explicit
    # page break above they overflow into a blank page, so drop the empty paragraphs right before the table.
    before = front[:tbl_start]
    empty_tail = re.compile(r"(?:<w:p[ >](?:(?!</w:p>).)*?</w:p>\s*)$", re.S)
    while True:
        m = empty_tail.search(before)
        if not m or re.search(r"<w:t[ >]|<w:drawing|<w:sectPr|<w:br ", m.group(0)):
            break
        before = before[:m.start()]
    return before + heading + new_table + "".join(kept)


# ---------------------------------------------------------------- assemble

def build():
    work = HERE / ".build"
    shutil.rmtree(work, ignore_errors=True)
    with zipfile.ZipFile(TEMPLATE) as z:
        z.extractall(work)
    doc_path = work / "word" / "document.xml"
    doc = doc_path.read_text(encoding="utf-8")

    body_start = doc.index("<w:body>") + len("<w:body>")
    first_sect = doc.index("<w:sectPr", body_start)
    front_end = doc.index("</w:p>", first_sect) + len("</w:p>")  # the paragraph that carries the section break
    final_sect = doc[doc.rindex("<w:sectPr"):doc.rindex("</w:body>") + len("</w:body>")]
    front = fill_index(edit_front(doc[body_start:front_end]))
    doc = doc[:body_start] + front + build_body() + final_sect + "</w:document>"
    doc_path.write_text(doc, encoding="utf-8")

    # Footer: project name instead of the sample's.
    footer_path = work / "word" / "footer1.xml"
    footer = footer_path.read_text(encoding="utf-8").replace("Learning MANAGEMENT SYSTEM", "DisCharge+ Project Report")
    footer_path.write_text(footer, encoding="utf-8")
    core_path = work / "docProps" / "core.xml"
    core = core_path.read_text(encoding="utf-8")
    core = re.sub(r"<dc:creator>.*?</dc:creator>", "<dc:creator>DisCharge+ Project Report</dc:creator>", core)
    core = re.sub(r"<dc:title>.*?</dc:title>", f"<dc:title>{TITLE} – Project Documentation</dc:title>", core)
    core_path.write_text(core, encoding="utf-8")

    # Relationships: drop the sample's images and links that are no longer used, add ours.
    rels_path = work / "word" / "_rels" / "document.xml.rels"
    rels = rels_path.read_text(encoding="utf-8")
    for m in re.finditer(r'<Relationship [^>]*Id="(rId\d+)"[^>]*/>', rels):
        rid, rel = m.group(1), m.group(0)
        if ('/image"' in rel or '/hyperlink"' in rel) and f'"{rid}"' not in doc:
            rels = rels.replace(rel, "")
            target = re.search(r'Target="([^"]+)"', rel).group(1)
            if "/image" in rel:
                (work / "word" / target).unlink(missing_ok=True)
    media = work / "word" / "media"
    new = []
    for rid, name, src in images:
        shutil.copy(src, media / name)
        new.append(f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{name}"/>')
    for rid, url in hyperlinks:
        new.append(f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="{escape(url)}" TargetMode="External"/>')
    rels_path.write_text(rels.replace("</Relationships>", "".join(new) + "</Relationships>"), encoding="utf-8")

    ct_path = work / "[Content_Types].xml"
    ct = ct_path.read_text(encoding="utf-8")
    if 'Extension="png"' not in ct:
        ct = ct.replace("<Default ", '<Default Extension="png" ContentType="image/png"/><Default ', 1)
    ct_path.write_text(ct, encoding="utf-8")

    if OUT.exists():
        OUT.unlink()
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(work.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(work).as_posix())
    shutil.rmtree(work)
    shutil.rmtree(HERE / ".rotated", ignore_errors=True)
    print(f"Wrote {OUT.name}: {len(images)} images, {len(hyperlinks)} links")


if __name__ == "__main__":
    build()
