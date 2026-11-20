# Project documentation (college report)

`DisCharge+_Project_Documentation.docx` is the editable report and the `.pdf` is the print copy (40 pages).
Both follow `docs/SAMPLE DOCUMENTATION FILE.docx`: cover, certificate, acknowledgement, preface, index, then
1 Introduction · 2 About Project · 3 Requirement Analysis · 4 UML Diagram · 5 Flow Chart · 6 System Development ·
7 Implementation · 8 Bibliography.

**Hand edits are lost when the report is rebuilt.** Either edit the text in `scripts/build_report.py` and rebuild,
or make the final hand edits in Word once you stop rebuilding.

## Rebuild

```
python docs/documentation/scripts/build_report.py                  # writes the .docx
powershell -File docs/documentation/scripts/finish_in_word.ps1     # fills the index page numbers, writes the .pdf
```

## Inputs

| Folder | What | How it is made |
|---|---|---|
| `../diagrams/*.png` | ER, use case, sequence, activity, flow chart | PlantUML (`*.puml`) and Graphviz (`flowchart.dot`); tools in `.tools/` (git-ignored) |
| `screenshots/` | App screenshots (seeded demo data) | dev-browser scripts, then `scripts/crop_shots.py` |
| `symbols/` | Notation tables (ER / use case / activity / flow chart) | `scripts/make_symbols.py` |

Render the diagrams (from `docs/diagrams`; Java 21 is the Android Studio one):

```
export GRAPHVIZ_DOT="E:/Minor Project/.tools/gv/Graphviz-16.1.1-win64/bin/dot.exe"
"/c/Program Files/Android/Android Studio/jbr/bin/java" -DPLANTUML_LIMIT_SIZE=8192 -jar ../../.tools/plantuml.jar -tpng usecase-patient.puml ...
"$GRAPHVIZ_DOT" -Tpng -Gdpi=170 flowchart.dot -o flowchart.png
```

## Still to fill by hand

The certificate's date, place and signatures. Check the names, enrolment numbers and the guide's name on the cover
before printing.
