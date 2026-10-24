# 9. DisCharge+ Project Guide

> A plain-language walkthrough of everything this project covers, so either team member can
> present it, answer viva questions and start building. As of **25 September 2026**.
> Where this guide and a design document disagree, `07-mvp-scope.md` wins for what is built.

---

## 1. The project in brief

**DisCharge+** is a web application that turns a hospital discharge into a tracked care plan
for rural patients in Gujarat. The clinician enters the plan. The system then generates the
follow-up dates and the daily dose schedule. The patient marks doses and reports symptoms in
English, Hindi or Gujarati. A rule engine sends red-flag symptoms and missed critical doses to
the clinician's queue.

| Item | Detail |
|---|---|
| Title | DisCharge+ — Post-Discharge Continuity-of-Care Platform for Rural Patients |
| Submitted as | BCA Semester 5 minor project, Ahmedabad Institute of Technology (GTU) |
| Team | Vandit Doshi (243030601029), Smit Gajera (243030601031) |
| Guide | Prof. Meeta Ahuja |
| Also entered in | TetraTHON 2026, Navrachana University, Vadodara, with ISEN Méditerranée (France) |
| Hackathon track | Track A — HealthTech, Problem Statement 2: *AI-Based Continuity of Care Platform for Rural & Remote Patients* |
| Project type | Web application: responsive, mobile-first, client–server (MERN stack) |
| Code status | Design complete; no code written yet (build starts at Stage 0 / Week 1) |

**One sentence for the examiner:** *DisCharge+ keeps rural patients connected to their doctor
after they leave hospital, and tells the doctor which patients need attention today.*

---

## 2. The problem

After discharge, a rural patient rarely sees the clinician again until something goes wrong.

- Follow-up visits mean travel the patient can't easily afford.
- Discharge instructions are on paper, often not in the patient's language or reading level.
- Missed medicines and warning signs go unnoticed until they become emergencies.
- The result is avoidable readmissions, poor medication adherence and patients lost to follow-up.

### The 7 expected outcomes (from the hackathon brief)

| # | Outcome | What it means | MVP coverage |
|---|---|---|---|
| 1 | Follow-up Management | Discharge follow-ups scheduled and tracked | **Full** |
| 2 | Automated Escalation | Symptom monitoring that escalates red flags to clinicians | **Full** |
| 3 | Localized Education | Patient education in Gujarati and Hindi | Partial: UI and plan text in 3 languages; no content library or audio |
| 4 | Scheme Navigation | PM-JAY / government scheme eligibility | Stretch goal |
| 5 | Interoperability | ABDM-compatible records (ABHA ID, FHIR) | Minimal: ABHA ID field only |
| 6 | Offline Field Capabilities | Village screening with no network, sync later | Future scope |
| 7 | Clinical Impact | Better adherence, fewer avoidable readmissions | Partial: adherence and escalation metrics; no ML model |

Be honest about this table in the viva. The MVP deliberately covers outcomes 1 and 2 fully and
the rest partly, because the team is 2 people with about 10 build weeks.

---

## 3. Full vision vs MVP

The project has two layers of design:

- **Full vision** (documents 01–06): 18 entities, 4 roles, 19 use cases, 28 pages, 3 services
  including a Python ML service. This is the source of "Further Work".
- **MVP** (document 07, decided 23 Sep 2026): what is actually built this semester.

| Area | MVP (built) | Future scope |
|---|---|---|
| Services | 2: `client/` (React) + `server/` (Node) | `ml-svc/` (Python FastAPI) |
| Roles | patient, clinician | caregiver, health_worker |
| Entities | 9 | 18 |
| Pages | 13 | 28 |
| Discharge plan | Plan, prescriptions, red flags, protocol | Allergy-conflict warnings |
| Follow-ups | Auto-generated from protocol + discharge date | Teleconsult integration |
| Adherence | Patient marks doses; cron marks missed; missed **critical** dose escalates | SMS / WhatsApp reminders |
| Symptoms | Icon-based form, rule engine, 4 tiers, clinician queue | Voice notes, on-call re-routing |
| Risk | Rule-based risk band, computed on the fly | ML model + SHAP explanations |
| Language | Patient pages in en / hi / gu | Education library, text-to-speech |
| Schemes | Stretch: PM-JAY rule check | Gujarat schemes, hospital lookup |
| Interop | `abhaId` field (format-checked) | FHIR export, ABDM sandbox, consent |
| Offline | — | PWA, IndexedDB, sync outbox |
| Security | JWT + bcrypt, role + ownership checks | Full audit log |

**Why ML was dropped from the MVP:** a trustworthy risk model needs real data, careful
evaluation and a threshold you can defend clinically. That doesn't fit 10 weeks alongside the
core features. The rule-based risk band sits behind one function, `computeRiskBand(patient)`,
so a model can replace it later without changing the dashboard. That is also why "AI-enabled"
was removed from the subtitle.

---

## 4. Users, roles and personas

### MVP roles

| Role | What they do |
|---|---|
| **Patient** | Views the care plan, marks doses taken, reports symptoms, sees follow-ups |
| **Clinician** | Creates discharge plans, handles escalations, monitors patients on the dashboard |
| **Scheduler** (not a person) | A timed job (node-cron) that finds missed doses |

There is no admin role in either design.

### Personas (fictional, from doc 06)

| Persona | Who | Why they matter |
|---|---|---|
| **Kantaben Rathwa**, 61 | Patient: heart failure + diabetes, village in Chhota Udepur, speaks Gujarati, reads very little, shares a basic phone, weak signal | The main user; drives icon-based, Gujarati-first design |
| **Mahesh Rathwa**, 29 | Her son and caregiver, works in Vadodara | Future caregiver role |
| **Dr. Ananya Mehta**, 38 | Cardiologist at the district hospital, ~200 discharged patients | Needs "who needs attention today?" in one view |
| **Sunita Parmar**, 34 | ASHA health worker, runs screening camps with no network | Future offline screening role |

### The 30-day journey (demo script)

1. **Day 0** — Kantaben is discharged. Dr. Mehta creates her plan; follow-ups and doses are generated.
2. **Day 3** — She misses a critical heart-failure dose. The cron job marks it missed and raises an escalation.
3. **Day 6** — She reports breathlessness. The rule engine matches a red flag, sets tier = urgent,
   and her case goes to the top of Dr. Mehta's queue.
4. **Day 30** — Review visit. The dashboard shows her adherence and escalation history.

---

## 5. How the system works: the four core workflows

### 5.1 Discharge plan → schedules

1. The clinician opens the **Discharge Plan Editor** and picks the patient.
2. They enter admission and discharge dates, the diagnosis and the red-flag list.
3. They add prescriptions: medicine, dosage, frequency (OD / BD / TDS / QID), timing slots,
   duration, and whether it is **critical**.
4. They choose a follow-up protocol (cardiac, diabetes, ckd, post_surgical, general).
5. On save, the server automatically creates:
   - **FollowUp** records from the protocol + discharge date (for example, a check on day 7, a test on day 14);
   - **AdherenceRecord** rows, one for every scheduled dose (timing slots × duration days).

### 5.2 Daily dose tracking and missed-dose detection

1. The patient's **Home** page shows today's doses.
2. The patient taps "taken" → the AdherenceRecord becomes `taken` with `recordedAt`.
3. A **node-cron** job regularly looks for doses still `pending` past a grace window and marks them `missed`.
4. If the dose's prescription has `isCritical = true`, the system creates an **Escalation**
   with `source = missed_critical_dose`.

### 5.3 Symptom report → escalation (the main use case)

1. The patient opens **Report Symptom** and picks symptoms from icons, plus a severity from 1 to 5.
2. The input is validated; if it's invalid, the patient corrects it and resubmits.
3. The **SymptomLog is saved first**, so every report is kept, even harmless ones.
4. The server loads the patient's active DischargePlan (red flags + protocol).
5. The **RuleEngine** checks every rule, collects the matches and picks the **highest** tier.
6. The tier and matched rule IDs are stored on the SymptomLog (`triageTier`, `triggeredRules`).
7. If tier = `self_care` → the patient sees self-care advice. Otherwise an **Escalation**
   is created (`status = open`) and the patient sees "Clinician alerted".
8. The clinician sees it in the **Escalation Queue**, acknowledges it, then resolves it with notes.

### 5.4 Clinician dashboard

The dashboard answers one question: *which patients need attention today?* It shows:

- a **risk band** per patient (computed by rules, see §8);
- open escalations, ordered by tier and then by age;
- overdue follow-ups.

---

## 6. Architecture and tech stack

### 3-tier client–server (MVP)

| Tier | What runs there | Hosting |
|---|---|---|
| Presentation | React pages: patient pages (en / hi / gu), clinician dashboard, API client sending the JWT | Vercel |
| Application | Node.js + Express: middleware (JWT, role + ownership, validation), 5 services, node-cron job | Render |
| Data | MongoDB, 9 collections, accessed through Mongoose | MongoDB Atlas |

**Services inside the server:** Auth & User · Discharge Plan & Follow-up · Adherence ·
Symptom + Red-Flag Rule Engine · Escalation & Dashboard (risk band). The cron job calls the
Adherence service; both the adherence and the symptom services feed the Escalation service.

**Request path:** browser → HTTPS/REST (JSON) → check JWT (else 401) → check role (else 403)
→ check ownership (is this record yours?) → validate input (else 400) → service → Mongoose → MongoDB.

The **ownership check** is the one people forget. A valid patient token proves *who* you are,
not *which records* you may read. Without it, a patient could change the ID in the URL and read
someone else's record. The Week 2 test is exactly this: "patient A cannot read patient B".

### Tools and versions (as on slide 2)

| Layer | Tool |
|---|---|
| Language | JavaScript |
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Backend | Node.js 24 LTS, Express 5 |
| Database | MongoDB 8, Mongoose 9 |
| Libraries | jsonwebtoken 9, bcrypt 6, node-cron 4, i18next 26 |
| IDE / tools | VS Code, Git, Postman |
| External services | MongoDB Atlas, Vercel, Render (hosting only; no paid APIs or AI models) |

**Why MongoDB?** Clinical records vary a lot and the schema will change over the build stages.
The ERD is still drawn as a **logical relational** model: each entity is its own collection,
and foreign keys are `ObjectId` references.

**Why JWT?** It's stateless, so the server keeps no session store. The token carries the user ID
and role. Passwords are stored only as **bcrypt hashes** (a one-way hash; never encryption, never plain text).

---

## 7. Data model: the 9 entities

Full field list with types and sizes: `08-phase1-data-dictionary.md`. The same names appear in
the data dictionary, ER diagram, class diagram and sequence diagram; the college requires this.

| # | Entity | Purpose | Key fields |
|---|---|---|---|
| 1 | **User** | Login account + role | userId (PK), fullName, phone (unique), passwordHash, role, preferredLanguage, isActive |
| 2 | **Patient** | Patient profile | patientId (PK), userId (FK), abhaId (unique), dateOfBirth, gender, district |
| 3 | **DischargePlan** | The care contract | planId (PK), patientId (FK), clinicianId (FK), admissionDate, dischargeDate, primaryDiagnosis, redFlags, followUpProtocol, status |
| 4 | **Medication** | Master list of medicines | medicationId (PK), genericName (unique), form, strength |
| 5 | **Prescription** | Associative entity: plan ↔ medicine | prescriptionId (PK), planId (FK), medicationId (FK), dosage, frequency, timingSlots, durationDays, isCritical |
| 6 | **FollowUp** | Generated schedule of visits/tests | followUpId (PK), planId (FK), scheduledDate, type, description, status, completedDate |
| 7 | **AdherenceRecord** | One row per scheduled dose | adherenceId (PK), prescriptionId (FK), scheduledAt, status (pending / taken / missed), recordedAt |
| 8 | **SymptomLog** | One symptom report | symptomLogId (PK), patientId (FK), reportedAt, symptoms, severity (1–5), triageTier, triggeredRules |
| 9 | **Escalation** | An alert for the clinician | escalationId (PK), patientId, symptomLogId, adherenceId, assignedClinicianId (all FK), source, tier, triggeredRules, status, createdAt, acknowledgedAt, resolvedAt, notes |

### Relationships and cardinality

| Relationship | Cardinality | Read it as |
|---|---|---|
| User **has** Patient | 1 : 0..1 | A user has at most one patient profile (only users with role = patient) |
| User **authors** DischargePlan | 1 : 0..N | A clinician writes many plans |
| Patient **receives** DischargePlan | 1 : 0..N | One plan per admission; a patient can be admitted again |
| DischargePlan **contains** Prescription | 1 : 1..N | Every plan has at least one prescription |
| Medication **prescribed in** Prescription | 1 : 0..N | One medicine appears in many prescriptions |
| DischargePlan **schedules** FollowUp | 1 : 0..N | Generated from the protocol |
| Prescription **generates** AdherenceRecord | 1 : 0..N | One row per due dose |
| Patient **reports** SymptomLog | 1 : 0..N | — |
| SymptomLog **triggers** Escalation | 0..1 : 0..1 | Only if a red flag matched |
| AdherenceRecord **triggers** Escalation | 0..1 : 0..1 | Only if a critical dose was missed |
| User **handles** Escalation | 1 : 0..N | The assigned clinician |

### Three data-model points to know well

1. **Prescription resolves a many-to-many.** One plan has many medicines, and one medicine
   appears in many plans. Prescription sits between them and holds data that belongs to the
   pair: dosage, frequency, timing, `isCritical`. The college PDF asks for exactly this
   ("M:N resolved by an associative entity").
2. **Escalation has two possible sources.** `source` says which: `symptom_log` or
   `missed_critical_dose`. Exactly one of `symptomLogId` / `adherenceId` is filled, never both.
3. **`triggeredRules` is on both SymptomLog and Escalation.** Every report keeps its verdict,
   even when nothing was escalated, so you can later check whether the rules missed something
   (false negatives). `Escalation.patientId` is copied from the source record on purpose, so
   the queue can be grouped by patient without extra lookups.

---

## 8. Rule engine, triage tiers and risk band

### Triage tiers (lowest → highest)

| Tier | Meaning | Escalated? |
|---|---|---|
| `self_care` | Manage at home; advice shown | No (still stored) |
| `teleconsult` | Clinician should call | Yes |
| `urgent` | See a clinician soon | Yes, high priority |
| `emergency` | Go to hospital now | Yes, top of the queue |

### How the rule engine decides

1. Load the red flags from the patient's DischargePlan and the rule set for its `followUpProtocol`.
2. Check every rule against the reported symptoms and severity.
3. Collect **all** matched rule IDs → `triggeredRules`.
4. Tier = the **highest** tier among the matches. No match → `self_care`.

**Business rule: when rules disagree, the highest severity wins.** In post-discharge care a
missed danger sign (false negative) costs far more than an unnecessary call (false positive).
Example: chest pain after a cardiac discharge → `emergency`, top of the queue within seconds.

**Why rules and not ML for escalation?** A rule engine is auditable: for every alert you can
name the exact rule that fired. A missed red flag is not an acceptable "model error".

### Missed-dose escalation

The cron job marks unconfirmed doses past the grace window as `missed`. A missed dose of a
prescription with `isCritical = true` (for example, a heart-failure diuretic) creates an escalation.
A missed non-critical dose only lowers the adherence percentage.

### Rule-based risk band (dashboard)

Computed when the dashboard asks for it, never stored. It uses three inputs:

- adherence % (doses taken ÷ doses due);
- the number of open escalations;
- days since discharge (the early weeks are the riskiest).

It returns a band such as low / moderate / high. The exact thresholds are a design decision
still to be made and justified by the team. The function signature is the future ML hook:
`computeRiskBand(patient)`.

---

## 9. The 13 pages

Language switch and logout live in the header, so there's no separate Settings page.

| # | Page | Role | What it shows |
|---|---|---|---|
| 1 | Login | both | Phone + password |
| 2 | Register | patient | New patient account |
| 3 | Patient Home | patient | Today's doses + an "I feel unwell" button |
| 4 | My Care Plan | patient | Diagnosis, red flags, instructions in the patient's language |
| 5 | My Medicines | patient | Prescriptions and the dose schedule |
| 6 | Report Symptom | patient | Icon symptom form; the result is the last step |
| 7 | Follow-ups | patient | Upcoming and past visits/tests |
| 8 | Clinician Dashboard | clinician | Risk bands, open escalations, overdue follow-ups |
| 9 | Escalation Queue | clinician | Open escalations ordered by tier, then age |
| 10 | Escalation Detail | clinician | One escalation: triggered rules, acknowledge, resolve |
| 11 | Patient List | clinician | All the clinician's discharged patients |
| 12 | Patient Detail | clinician | One patient's plan, adherence, symptoms |
| 13 | Discharge Plan Editor | clinician | Create / edit a plan and its prescriptions |

Stretch page: 14 — Scheme Navigator. Open question: whether Escalation Detail should merge into the queue.

---

## 10. The five Phase-1 diagrams and how to read them

All are in `diagrams/`. Four are drawn in PlantUML (`*.puml` → `*.png`); the ER diagram is
also drawn in Chen notation by `er_chen.py`. They are real UML/ER, not flowcharts, because the
college PDF demands strict notation.

### 10.1 Use case diagram (`usecase.png`)

- **Actors** (stick figures): Patient, Clinician, Scheduler (the system timer).
- **System box**: "DisCharge+ System" with 12 use cases (ovals).
- Patient: Register, Login, View Care Plan & Follow-ups, Mark Dose Taken, Report Symptom.
- Clinician: Login, Create Discharge Plan, Manage Escalation Queue, View Dashboard & Patient Details.
- Scheduler: Detect Missed Doses.
- **«include»** = always happens: Report Symptom includes Evaluate Red-Flag Rules; Create
  Discharge Plan includes Generate Follow-up & Dose Schedule.
- **«extend»** = happens only under a condition: Raise Escalation extends Evaluate Red-Flag Rules
  [red flag found] and Detect Missed Doses [critical dose].

### 10.2 UML class diagram (`class.png`)

- Nine domain classes + **RuleEngine** (a service class used in the sequence diagram).
- Three compartments: name / attributes (`- name : Type`, private) / methods (`+ method()`, public).
- **Composition (◆)**: DischargePlan owns its Prescriptions and FollowUps; Prescription owns its
  AdherenceRecords. If the owner is deleted, its parts go too.
- **Association** with multiplicities on every line (1, 0..1, 0..*, 1..*).
- Foreign keys are shown as associations, not as attributes (the UML convention).
- Key methods: `Patient.computeRiskBand()`, `DischargePlan.generateFollowUps()`,
  `Prescription.generateDoses()`, `Escalation.acknowledge()` / `resolve()`, `RuleEngine.evaluate()`.

### 10.3 UML sequence diagram (`sequence.png`)

Use case: **Report Symptom → Escalation**. Lifelines: Patient, Web App, :SymptomLog,
:RuleEngine, :Escalation, MongoDB. Activation bars show who is working; dashed arrows are returns.
The SymptomLog is created and saved first; then the plan is fetched; then `evaluate(log, plan)`;
then an **alt** frame: `self_care` → advice, otherwise a new Escalation is created and saved
(`status = open`). It stops at "patient informed"; the clinician's handling is a separate use case.

### 10.4 UML activity diagram (`activity.png`)

Workflow: Symptom Report and Escalation, in three **swimlanes** (Patient · System · Clinician).
Filled circle = start; rounded boxes = actions; diamonds = decisions with **[Yes]/[No]** guards;
a while-loop for input validation; a **fork bar** where the patient sees "Clinician alerted" while,
in parallel, the clinician acknowledges and resolves; the branches meet at a merge before the end node.

### 10.5 ER diagram (`er.png` crow's-foot, `er-chen.png` Chen)

- **Chen version (now on slide 9):** rectangles = entities, ovals = attributes, diamonds =
  relationships, `1 / 0..1 / 0..N / 1..N` = (min..max) cardinality. PK is underlined and marked
  (PK); FK is italic and marked (FK). PRESCRIPTION is drawn as a **diamond inside a rectangle**,
  the Chen symbol for an associative entity. A legend and one attribute card per entity sit at the bottom.
- **Crow's-foot version (`er.png`):** attributes inside the boxes; line ends show cardinality
  (`||` exactly one, `o|` zero or one, `o{` zero or many, `|{` one or many).
- To redraw the Chen version: `python diagrams/er_chen.py` (it also checks for overlaps).

---

## 11. The review deck and the college rules

Files in `presentation/`:

- `DisCharge+_Phase1_Review.pptx` — the 10-slide review deck, with speaker notes.
- `DisCharge+_Architecture_and_DD.pptx` — the architecture diagram + full data dictionary, one table per slide.
- `build_decks.py` rebuilds both decks (and `08-phase1-data-dictionary.md`); `audit_decks.py`
  checks them against the college PDF. Rebuilding overwrites any hand edits in the .pptx.

### The 10 slides (order fixed by the college PDF)

| # | Slide | What it holds |
|---|---|---|
| 1 | Title | AIT template, project title, subtitle, Sem-V, guide, team names + enrolment numbers |
| 2 | Project Profile | Title + a table: objectives, problem statement, tools with versions + IDE, external services, target users, project type |
| 3 | System Analysis | Problem / Proposed System / Key Features (5) / Target Users; the project is new, so no "existing system" is invented |
| 4 | Data Dictionary | Table \| Important Attributes, PK/FK marked, same 9 entities as the ER |
| 5 | Use Case Diagram | §10.1 |
| 6 | UML Class Diagram | §10.2 |
| 7 | UML Sequence Diagram | §10.3 |
| 8 | UML Activity Diagram | §10.4 |
| 9 | ER Diagram | §10.5 (Chen version) |
| 10 | Further Work | The 6 future-scope items (§14) |

### College PPT rules to remember

- Exactly 10 slides, in the order above.
- 1–2 fonts only (the deck uses Calibri + the template's Times New Roman).
- Titles 28–36 pt; body ≥ 18 pt; tables and diagram labels 16–20 pt; shorten text rather than shrink it.
- Diagrams must be strict UML / ER: no flowchart-style drawings.
- Data Dictionary ↔ ER ↔ Class ↔ Sequence must use the **same entity names**.
- No "100%" claims; 3–5 points per section.

**Known weak spot:** on the slide, the class, sequence, ER and architecture labels come out
smaller than 16 pt because the diagrams are dense. Keep the full-size PNGs in `diagrams/` ready
to open if an examiner wants to zoom.

---

## 12. Design decisions and how to defend them

| # | Decision | Rejected option | Why |
|---|---|---|---|
| 1 | Medication is a separate master list, linked through Prescription | Embed medicines inside the plan | Lets you ask "all patients on metformin" and avoids repeating drug data |
| 2 | A missed **critical** dose escalates automatically | Only symptoms escalate | A false negative costs more than a false positive after discharge |
| 3 | `triageTier` / `triggeredRules` stored on SymptomLog too | Store only on Escalation | Keeps non-escalated verdicts, so missed red flags can be measured |
| 4 | Rule engine for escalation | ML for escalation | Every alert must be explainable rule by rule |
| 5 | Rule-based risk band behind `computeRiskBand()` | Build ML now | Fits the time available; ML can replace it without touching the dashboard |
| 6 | MongoDB, drawn as a logical relational ERD | PostgreSQL | Flexible schema for varied clinical data; relational ERD is the standard notation |
| 7 | JWT + bcrypt, role + ownership checks | Server sessions | Stateless; ownership check stops patients reading others' records |
| 8 | Two services (client + server) for the MVP | Three services with ML | Less to deploy and debug with a 2-person team |
| 9 | Phone number as the login ID | Email | Many rural users have no email |
| 10 | Highest matched tier wins | Average or first match | Safety first when rules disagree |

---

## 13. Build plan, status and next steps

**Status (30 Sep 2026):** the MVP is built: `server/` (API, rule engine, cron, 81 tests) and `client/` (13 pages in English, Hindi and Gujarati). See the root `README.md` → Getting Started, and `DECISIONS.md` for every choice made while building.

**Split:** Vandit = backend, data model, rule engine. Smit = React pages against agreed API contracts.

| Week | Backend (lead) | Frontend (partner) | Done when |
|---|---|---|---|
| 1 | Repo, 2 services boot, finalise 9 schemas | Vite + Tailwind + routing skeleton | Both services return a health check |
| 2 | Auth, JWT, role + ownership middleware | Login, Register | Patient A cannot read patient B |
| 3–4 | Discharge plan API, follow-up + dose generation | Discharge Plan Editor | Saving a plan creates follow-ups and doses |
| 5 | Adherence API, cron missed-dose sweep, critical-dose escalation | Patient Home, My Medicines | Unmarked critical dose → escalation |
| 6–7 | Symptom API + red-flag rule engine + tiers | Report Symptom, Escalation Queue/Detail | Chest pain post-cardiac → emergency, top of queue |
| 8 | Risk band, dashboard aggregation | Dashboard, Patient List/Detail | "Who needs attention today?" in one view |
| 9 | Input validation, seed script (synthetic patients) | i18n en / hi / gu on patient pages | Same plan renders in 3 languages |
| 10 | Tests on the rule engine + critical paths; deploy | Care Plan, Follow-ups, polish | A stranger can use the live URL |
| 11–12 | Buffer → stretch: scheme check | Buffer → PPT | — |

**How the build is done:** it's a learning project. The AI assistant acts as teacher and
reviewer: it explains, scaffolds files with `// TODO(rudra):` markers and reviews; the team writes
the logic. Each session gets an entry in `docs/LEARNING_LOG.md` (to be created in Stage 0).

**Next steps:**

1. Rehearse the review deck using the speaker notes.
2. Stage 0 / Week 1: repo layout, `git init`, `.env.example`, both services with health checks, `LEARNING_LOG.md`.

**Open decisions:** confirm the 13-page list (merge Escalation Detail?) · rename the folder ·
risk-band thresholds · the exact red-flag rules per protocol (they must cite a published source).

---

## 14. Future scope (slide 10)

Each item already has a design in documents 01–06, so it is planned work, not a wish list.

1. **ML risk prediction** — readmission and adherence risk with SHAP explanations, replacing the rule-based band.
2. **Offline field screening** — health-worker role; works with no network and syncs later without duplicates (UUID made on the device; server wins on conflicts, which are flagged for review).
3. **Caregiver role** — family members or ASHA workers report for the patient and receive alerts (many-to-many, via CaregiverAssignment).
4. **SMS / WhatsApp reminders** — for patients without a smartphone.
5. **ABDM integration** — FHIR record export, consent management, a full audit log.
6. **Education & schemes** — audio health education in Hindi/Gujarati; PM-JAY eligibility check that explains each criterion.

---

## 15. Likely viva questions

**Q: What problem does your project solve?**
Rural patients lose contact with care after discharge. DisCharge+ tracks their plan, doses and
symptoms, and alerts the clinician on red flags or missed critical doses.

**Q: Why is Prescription a separate entity?**
DischargePlan and Medication are many-to-many. Prescription resolves it and holds the pair's own
data: dosage, frequency, timing, duration, isCritical.

**Q: What happens when a patient reports chest pain after a cardiac discharge?**
The SymptomLog is saved, the rule engine matches the cardiac red flag, the tier is `emergency`, an
Escalation is created with status `open`, and it appears at the top of the clinician's queue.

**Q: Why not use AI/ML for escalation?**
Escalation must be explainable; we store the exact rules that fired. A missed red flag is not an
acceptable model error. ML is planned for risk prediction, in future scope.

**Q: How do you stop one patient seeing another patient's data?**
Three checks on every request: a valid JWT (who you are), the role (what you may do) and ownership
(whether this record is yours). Ownership is the one that stops ID-guessing in the URL.

**Q: How are passwords stored?**
As bcrypt hashes. A hash is one-way, so even we can't read the password.

**Q: How do you detect a missed dose?**
Every due dose is an AdherenceRecord. A node-cron job finds records still `pending` after the grace
window and marks them `missed`; if the prescription is critical, it raises an escalation.

**Q: Why store the triage tier even when nothing is escalated?**
So we can audit the rule engine later and find false negatives.

**Q: Why MongoDB if you drew a relational ER diagram?**
The ERD is the logical model. Physically, each entity is a MongoDB collection and foreign keys are
ObjectId references.

**Q: Include vs extend?**
Include always happens (Report Symptom always runs the rules). Extend happens only when its
condition holds (Raise Escalation only when a red flag is found or a critical dose is missed).

**Q: What is composition in your class diagram?**
A whole–part link where parts can't exist alone: a Prescription can't exist without its
DischargePlan, and an AdherenceRecord can't exist without its Prescription.

**Q: What's the risk band?**
A low / moderate / high label computed from adherence %, open escalations and days since
discharge. It's calculated each time, not stored, and sits behind one function so ML can replace it.

**Q: What does your system NOT do?**
It doesn't diagnose, doesn't replace a hospital system, uses only synthetic data, and in the MVP
has no offline mode, SMS or ML.

**Q: What languages, and how?**
English, Hindi and Gujarati on the patient pages, using i18next; the user's `preferredLanguage` picks it.

**Q: What is ABHA?**
The 14-digit Ayushman Bharat Health Account number under India's digital health mission (ABDM).
The MVP stores and format-checks it; full ABDM integration is future scope.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| ABDM | Ayushman Bharat Digital Mission, India's national digital health framework |
| ABHA | 14-digit health ID issued under ABDM |
| Adherence | Whether the patient takes medicines as prescribed |
| ASHA | Accredited Social Health Activist, a village health worker |
| Associative entity | An entity that resolves an M:N relationship and holds its attributes (here: Prescription) |
| bcrypt | A slow, salted one-way password-hashing algorithm |
| Cardinality | How many of one entity relate to another (1, 0..1, 0..N, 1..N) |
| Chen notation | ER style with rectangles, ovals and diamonds |
| Crow's-foot notation | ER style with attributes in boxes and forked line ends |
| Cron job | A task that runs automatically on a timer (node-cron here) |
| Escalation | An alert raised for a clinician |
| FHIR | A standard format for exchanging health records |
| FK / PK | Foreign key / primary key |
| i18n | Internationalisation: showing the app in several languages |
| JWT | JSON Web Token, a signed token proving who the user is |
| MERN | MongoDB, Express, React, Node |
| MVP | Minimum viable product: the smallest version worth demonstrating |
| OD / BD / TDS / QID | Once / twice / three times / four times a day |
| PM-JAY | Pradhan Mantri Jan Arogya Yojana, a government health-insurance scheme |
| Red flag | A danger sign for a condition that needs quick medical attention |
| Rule engine | Code that checks inputs against explicit rules and reports which fired |
| SHAP | A method that explains which factors drove an ML prediction |
| Triage tier | Urgency level: self_care, teleconsult, urgent, emergency |

---

## 17. Where everything lives

```
E:\Minor Project\
├── README.md                 Plan, AI contract (+ 2026-09-30 note), Getting Started
├── CLAUDE.md                 Pointer for the AI assistant
├── render.yaml               Render blueprint for the API
├── server\                   Express API: src/ (models, rules, services, jobs, routes.js), scripts/seed.js, tests/
├── client\                   React app: src/ (pages/patient, pages/clinician, components, i18n en/hi/gu, lib)
└── docs\                     All design docs 01–11, DECISIONS.md, SESSION-CONTEXT.md, LEARNING_LOG.md,
                              diagrams/, presentation/, college PDFs and templates, hackathon brief
```

Documents 03–06 still describe the full 18-entity, 4-role system. For anything being built, go by
`07-mvp-scope.md` and `08-phase1-data-dictionary.md`.
