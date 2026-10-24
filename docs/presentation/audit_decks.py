"""
Checks both decks against the rules in BCA_Sem_5_Project_Presentation_Format_and_Instructions.pdf.

    python audit_decks.py [main.pptx] [support.pptx]

1. Slide order of the main deck (exactly 10, in the PDF's order)
2. Fonts: only 1-2 families; sizes against the PDF's font table
3. Consistency: Data Dictionary <-> ER <-> Class <-> Sequence use the same names
"""
import re
import sys
from collections import Counter
from pathlib import Path

from pptx import Presentation
from pptx.util import Pt

HERE = Path(__file__).resolve().parent
DIAG = HERE.parent / "diagrams"
sys.path.insert(0, str(HERE))
from build_decks import DD  # noqa: E402  single source of truth

PDF_ORDER = ["Project Title", "Project Profile", "System Analysis", "Data Dictionary", "Use Case Diagram",
             "Class Diagram", "Sequence Diagram", "Activity Diagram", "ER Diagram", "Further Work"]
MIN_PT = {"title": 28, "table": 16, "body": 18, "reference": 14}
problems = []


def runs_of(slide):
    for sh in slide.shapes:
        frames = []
        if sh.has_text_frame:
            frames.append(("text", sh.text_frame))
        if getattr(sh, "has_table", False) and sh.has_table:
            frames += [("table", c.text_frame) for row in sh.table.rows for c in row.cells]
        for kind, tf in frames:
            for p in tf.paragraphs:
                for r in p.runs:
                    if r.text.strip():
                        yield kind, r


def audit_deck(path, check_order):
    prs = Presentation(str(path))
    print(f"\n=== {path.name}: {len(prs.slides)} slides")
    fonts = Counter()
    for i, slide in enumerate(prs.slides, 1):
        titles = [r.text for k, r in runs_of(slide) if r.font.size and r.font.size >= Pt(28)]
        print(f"  {i:>2}. {titles[0] if titles else '(no title)'}")
        if check_order:
            want = PDF_ORDER[i - 1]
            if i > 1 and not any(want.lower() in t.lower() for t in titles):
                problems.append(f"{path.name} slide {i}: expected '{want}', found {titles[:1]}")
        if i == 1:
            continue  # college template: its fonts and sizes are the college's own
        for kind, r in runs_of(slide):
            size = r.font.size.pt if r.font.size else None
            fonts[r.font.name] += 1
            if size is None:
                continue
            is_ref = size < 16 and kind == "text"
            limit = MIN_PT["table"] if kind == "table" else (MIN_PT["reference"] if is_ref else 16)
            if size < limit:
                problems.append(f"{path.name} slide {i}: {size:g} pt {kind} text '{r.text[:40]}'")
    print("  fonts on content slides:", dict(fonts))
    if len(fonts) > 1:
        problems.append(f"{path.name}: {len(fonts)} fonts on content slides {list(fonts)}")


def puml_names(fname, pattern):
    return set(re.findall(pattern, (DIAG / fname).read_text(encoding="utf-8"), re.M))


def audit_consistency():
    print("\n=== Consistency")
    dd_fields = {t: {f[0] for f in fs} for t, fs in DD.items()}
    er = (DIAG / "er.puml").read_text(encoding="utf-8")
    blocks = dict(re.findall(r'entity "([A-Z_]+)[^"]*" as \w+ \{(.*?)\n\}', er, re.S))
    er_map = {"USER": "User", "PATIENT": "Patient", "DISCHARGE_PLAN": "DischargePlan", "MEDICATION": "Medication",
              "PRESCRIPTION": "Prescription", "FOLLOW_UP": "FollowUp", "ADHERENCE_RECORD": "AdherenceRecord",
              "SYMPTOM_LOG": "SymptomLog", "ESCALATION": "Escalation"}
    for er_name, body in blocks.items():
        t = er_map[er_name]
        names = set(re.findall(r"^\s*(?:<[bi]>)?(\w+)", body, re.M)) - {"b", "i"}
        if names != dd_fields[t]:
            problems.append(f"ER {er_name} vs DD {t}: only in ER {names - dd_fields[t]}, only in DD {dd_fields[t] - names}")
    print(f"  ER entities checked: {len(blocks)} / DD tables: {len(DD)}")

    cl = (DIAG / "class.puml").read_text(encoding="utf-8")
    classes = dict(re.findall(r"^class (\w+) \{(.*?)^\}", cl, re.S | re.M))
    for t, fs in DD.items():
        attrs = set(re.findall(r"^\s*- (\w+) :", classes.get(t, ""), re.M))
        non_fk = {f[0] for f in fs if not f[3].startswith("FK")}
        if attrs != non_fk:
            problems.append(f"Class {t} vs DD (FKs excluded): only in class {attrs - non_fk}, only in DD {non_fk - attrs}")
    methods = {m for body in classes.values() for m in re.findall(r"^\s*\+ (\w+)\(", body, re.M)}
    print(f"  classes: {sorted(classes)}")

    seq = (DIAG / "sequence.puml").read_text(encoding="utf-8")
    participants = re.findall(r'participant "(?::)?([^"]+)"', seq)
    for p in participants:
        p = p.split("\\n")[0].strip()
        if p not in classes and p not in ("DisCharge+",):
            problems.append(f"Sequence participant '{p}' is not a class")
    calls = re.findall(r"-> (?:Log|RE|Esc) : (\w+)\(", seq)
    for c in calls:
        if c not in methods:
            problems.append(f"Sequence message {c}() is not a method in the class diagram")
    print(f"  sequence participants: {participants}; method calls checked: {calls}")

    words = {"doctor": 0}
    for f in ["sequence.puml", "activity.puml", "usecase.puml"]:
        words["doctor"] += len(re.findall(r"\bdoctor\b", (DIAG / f).read_text(encoding="utf-8"), re.I))
    if words["doctor"]:
        problems.append(f"Terminology: 'Doctor' used {words['doctor']}x in diagrams; slides say 'Clinician'")


if __name__ == "__main__":
    main = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "DisCharge+_Phase1_Review.pptx"
    sup = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "DisCharge+_Architecture_and_DD.pptx"
    audit_deck(main, check_order=True)
    audit_deck(sup, check_order=False)
    audit_consistency()
    print("\n=== Problems:", len(problems))
    for p in problems:
        print("  -", p)
