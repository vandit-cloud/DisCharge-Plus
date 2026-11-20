# DisCharge+ — Session Context (resume file)

> **Purpose:** everything decided so far, in one place, so any new AI session (or teammate)
> can pick up with full context. **To resume:** tell the assistant
> *"Read `docs/SESSION-CONTEXT.md` and continue."*
>
> **Keep it current:** append to the Session Log (§10) at the end of every working session.
> Last updated: **2026-11-20**.

---

## 1. Project in one paragraph

**DisCharge+** is a post-discharge continuity-of-care platform for rural and remote patients
in Gujarat. It turns a hospital discharge into a tracked care plan: follow-ups and dose schedules
are generated, the patient marks doses and reports symptoms in their own language, and a
rule engine escalates red flags to a clinician's triaged queue. Built for **TetraTHON 2026**
(Navrachana University, Vadodara, with ISEN Méditerranée), **Track A HealthTech, Problem
Statement 2**, and submitted as a **BCA Semester 5 minor project**.

## 2. How the AI assistant must behave on this project

The root `README.md` has a "Contract with the AI assistant": teach and review, scaffold with
`// TODO(rudra):`, don't write features. **On 2026-09-30 the student overrode it** and asked the
assistant to build the whole MVP (a dated note under the contract records this). From now on:

- Help the student **understand** the built code for the viva: walkthroughs, explain-back checks,
  `LEARNING_LOG.md` entries. Every choice made for them is in `DECISIONS.md`.
- For new work, do what the student asks (build if they ask to build); otherwise explain and review.
- Documentation, design docs and presentation material may always be written by the assistant.
- After any code change: `cd server && npm test` and `cd client && npm run build`.

## 3. File map

```
E:\Minor Project\                     git repo (initialised, no commits yet)
├── README.md                Plan, AI contract (+ 2026-09-30 note), 13 stages, Getting Started
├── CLAUDE.md                Pointer for the AI assistant
├── render.yaml              Render blueprint for the API
├── server\                  Express API (Node 24, Express 5, Mongoose 9, zod, node-cron)
│   ├── src\ config, models (9 + enums), rules (symptom codes, red-flag rules, protocols),
│   │        services (auth, plan, adherence, symptom, escalation, dashboard, riskBand, ruleEngine,
│   │        dose/follow-up generators), jobs/missedDoseSweep, middleware, routes.js, validation.js
│   ├── scripts\seed.js      Synthetic demo data + the Kantaben 30-day journey (DB name must contain "discharge")
│   └── tests\               84 tests: unit (rules, generators, risk, time) + integration (AC-1…AC-13)
├── client\                  React 19 + Vite 8 + Tailwind 4 + TanStack Query + i18next (en/hi/gu)
│   └── src\ pages (Login, Register, 5 patient, 6 clinician), components (SunPath, DoseCard, shells…),
│            i18n/{en,hi,gu}.json, lib (api, auth, format, queries)
└── docs\                    All documentation (DishCharge+/docs was merged here on 2026-09-30)
    ├── 01–06                Full-vision design (18 entities, 4 roles)
    ├── 07-mvp-scope.md      ★ What is built
    ├── 08-phase1-data-dictionary.md   MVP data dictionary (the models match it field for field)
    ├── 09-project-guide.md  Plain-language guide + viva Q&A
    ├── 10-prd.md            Requirements FR-1…FR-10, acceptance tests, NFRs
    ├── 11-build-layout.md   API contract, page layouts, as-built notes
    ├── DECISIONS.md         D1–D12 + B1–B12, each "chosen by AI, review"
    ├── LEARNING_LOG.md      Session log for the student
    ├── SESSION-CONTEXT.md   ← this file
    ├── data-model.md, README.md, diagrams\, presentation\, college PDFs + template, hackathon brief
```

**Code status (2026-09-30): MVP built and verified.** 84 server tests pass; client builds; every
patient page renders in en/hi/gu (141 translation keys, checked by `npm run check:i18n`); every page
fits a 360–375 px phone. Not deployed yet (needs the student's Render / Vercel / Atlas accounts).
Demo logins: clinician `9000000001`, patient Kantaben `9000000101`, all with password `demo1234`.

## 4. Full-vision design (docs 01–06)

### 4.1 The 7 expected outcomes (from the problem statement)
1 Follow-up Management · 2 Automated Escalation · 3 Localized Education (en / hi / gu) ·
4 Scheme Navigation (PM-JAY) · 5 Interoperability (ABHA, FHIR) · 6 Offline Field Capabilities ·
7 Clinical Impact.

### 4.2 Full stack
React + Vite + Tailwind PWA, TanStack Query, Dexie (IndexedDB), i18next · Node + Express +
MongoDB / Mongoose, JWT + bcrypt, node-cron · Python FastAPI + scikit-learn + SHAP ·
Twilio / MSG91 SMS · Vercel, Render, MongoDB Atlas.

### 4.3 Locked design decisions (2026-09-17)
| # | Decision | Why |
|---|---|---|
| 1 | `Medication` referenced, not embedded (`Prescription` junction) | Cohort queries ("all on metformin") |
| 2 | Caregiver ↔ Patient is M:N (`CaregiverAssignment`) | One ASHA covers a village; patients have several carers |
| 3 | Missed **critical** dose auto-escalates | False negatives cost more than false positives |
| 4 | `triageTier` on both SymptomLog and Escalation | Keep non-escalated verdicts so false negatives can be measured |
| 5 | Offline conflicts: server wins + flag for review | Device clocks unreliable; never silently overwrite clinical data |
| 6 | ERD drawn logical-relational | Standard notation; Mongo embedding noted per entity |
| 7 | Rule engine for escalation, ML for risk | Escalation must be auditable rule by rule |

### 4.4 Full-vision numbers
18 entities · 4 roles (patient, caregiver, clinician, health_worker) · 19 use cases ·
28 pages (shared 4, patient 9, caregiver 2, clinician 8, health worker 5) · no admin role.

### 4.5 Personas (doc 06, all fictional)
- **Kantaben Rathwa**, 61, patient — heart failure + diabetes, Chhota Udepur village,
  Gujarati, reads very little, shared basic phone, weak signal.
- **Mahesh Rathwa**, 29, caregiver — her son, works in Vadodara.
- **Dr. Ananya Mehta**, 38, clinician — cardiologist, district hospital, ~200 discharged patients.
- **Sunita Parmar**, 34, health worker — ASHA, screening camps with no network.
- The **30-day journey** (Day 0 discharge → Day 3 missed critical dose → Day 6 urgent red flag →
  Day 30 review) is intended as the demo script.

## 5. ★ MVP scope (decided 2026-09-23) — what is actually built

Full detail: `07-mvp-scope.md`.

| Item | MVP |
|---|---|
| Constraints | 2–3 months · 2 people, the student leads · graded as college minor project |
| Services | **2**: `client/` + `server/`. **`ml-svc/` NOT built.** |
| Roles | **patient, clinician** |
| Entities (9) | User, Patient, DischargePlan, Medication, Prescription, FollowUp, AdherenceRecord, SymptomLog, Escalation |
| Stretch entities | Scheme, SchemeEligibilityCheck |
| Pages (13) | Login, Register, Patient Home, My Care Plan, My Medicines, Report Symptom (result as last step), Follow-ups, Clinician Dashboard, Escalation Queue, Escalation Detail, Patient List, Patient Detail, Discharge Plan Editor |
| Stretch page | Scheme Navigator |
| Risk | Rule-based risk band (adherence %, open escalations, days since discharge), computed, not stored, behind `computeRiskBand(patient)` so ML can replace it later |
| Language | Patient pages in en / hi / gu (UI + plan text), week 9 |
| Reminders | In-app + cron missed-dose sweep; **no SMS** |
| Interop | `abhaId` field only |

**Future scope (Slide 10):** ML risk + SHAP · offline screening + sync · caregiver role ·
SMS / WhatsApp · FHIR / ABDM / consent / audit log · education library + TTS · full scheme navigator.

**10-week plan:** W1 setup + schemas · W2 auth + roles · W3–4 discharge plan + generation ·
W5 adherence + cron + critical-dose escalation · W6–7 symptoms + rule engine · W8 dashboard +
risk band · W9 validation, seed data, i18n · W10 tests + deploy · W11–12 buffer / scheme check / PPT.
Split: student = backend + rule engine; partner = React pages.

## 6. College PPT requirements (BCA Sem 5 PDF)

**Exactly 10 slides:** 1 Title · 2 Project Profile · 3 System Analysis · 4 Data Dictionary ·
5 Use Case · 6 Class · 7 Sequence · 8 Activity · 9 ER · 10 Further Work.

Key rules:
- **Slide 1:** title, student names, enrollment numbers, BCA Sem 5, guide, college, logo.
- **Slide 2:** 4–5 objectives; problem statement in 1–2 lines; tools **with versions** and **IDE**;
  external services; target users; project type / platform.
- **Slide 3:** the project is new, so use the "Problem / Proposed System / Key Features (4–6) /
  Target Users" format. Don't invent an existing system. 3–5 points per section; no "100%" claims.
- **Slide 4:** Field / Type / Size / Key (PK, FK) / Description; must match the ER diagram.
- **Diagrams:** strict standard UML / ER only. No flowchart-style or decorative diagrams.
  Use case = stick-figure actors, ovals, system box, include / extend. Activity = filled initial
  node, rounded actions, decision + merge diamonds, [Yes] / [No] labels, final node (forks as bars).
  Class = 3 compartments, `- name : Type`, visibility, multiplicities. Sequence = one use case,
  lifelines, activation bars, returns. ER = PK / FK, cardinality, M:N resolved by an associative entity.
- **Consistency:** Data Dictionary ↔ ER ↔ Class ↔ Sequence must use the **same entities**.
- **Fonts:** 1–2 fonts (Arial / Calibri / Aptos / Poppins); titles 28–36 pt, body ≥ 18 pt,
  tables and diagram labels 16–20 pt; shorten text rather than shrinking it.

### 6.1 Fit analysis (done this session)
- Existing Mermaid **Use Case and Activity diagrams are flowcharts**, so they must be redrawn in real
  UML (PlantUML or draw.io, not Mermaid).
- Class diagram needs `- name : Type` syntax and multiplicities.
- Sequence diagrams are fine; use **3.4.2 Symptom report → escalation**.
- ER / Data Dictionary are good but must shrink to the **9 MVP entities**.
- Slide 2 is missing tool versions and an IDE.
- Further Work = the future-scope list in §5.

## 7. Open decisions (need the student's answer)

1. ~~"AI-enabled" subtitle~~ dropped (2026-09-24).
2. Title-slide details: names, enrollment numbers, guide are still `[placeholders]` in the deck.
3. ~~13-page list / Escalation Detail~~ kept as a separate page (D12).
4. ~~Rename `DishCharge+`~~ merged into `docs/` (2026-09-30).
5. **Review `DECISIONS.md`**: D1–D12 and B1–B12 were chosen by the AI; the student must agree or change them
   (especially the red-flag rules D9 and risk thresholds D11, which should be checked with a clinician).
6. Hindi and Gujarati texts should be checked by a native speaker (FR-8, risk table in the PRD).

## 8. Known inconsistencies to fix

- Docs 03, 04, 05 and 06 still describe the full 18-entity / 4-role system (by design: full vision).
- The `data-model.md` header still says "DRAFT — awaiting review" although its decisions are locked.
- The class diagram lists methods such as `Patient.computeRiskBand()` and `Prescription.generateDoses()`;
  in the code these are service functions (`riskBand.js`, `doseGenerator.js`). Fine to explain in the viva,
  or update `diagrams/class.puml`.

## 9. Next steps (in order)

0. Deck is on the FINAL PDF (26 slides, 2026-11-20). Still: align `01-project-profile.md` with the title; commit + push, then reseed Atlas.
   Project report done (`docs/documentation/`): student checks names/guide, hand-fills certificate date/place/signatures.
1. Student reads the code in the order listed in `LEARNING_LOG.md` (2026-09-30 entry) and reviews `DECISIONS.md`.
2. ~~First git commit~~ and ~~deploy~~ done (Oct 2026); reseed Atlas before each live demo (demo data ages).
4. Fill the title-slide placeholders; rehearse the 3-minute demo script in the root README.
5. Stretch (weeks 11–12): PM-JAY scheme check (FR-10.1).

## 10. Session log

### 2026-09-23
- Reviewed the whole project and the memory files; fixed the stale PDF path in memory.
- Checked the project against the BCA Sem 5 PPT format PDF (§6.1).
- Created `06-personas-workflows-pages.docx` (4 personas, 30-day journey, 7 workflows,
  28 pages, access matrix, traceability).
- Scoped the MVP: ML moved to future scope by the student's decision; offline also deferred →
  `07-mvp-scope.md`; linked from the docs index and `data-model.md`.
- Created this resume file and a root `CLAUDE.md` pointer.

### 2026-09-24 — Phase-1 review material
- Review notice asks for: profile, architecture, ER / use case / activity / sequence, UML, data dictionary.
- Decisions: 10-slide deck kept exactly to the college PDF; **architecture made a separate file**;
  "AI" dropped from the subtitle; names left as placeholders.
- New college files in root `docs/`: `Minor Project PPT Format.pptx` (AIT title-slide template, Times
  New Roman, says "Sem-IV" → deck changes it to Sem-V) and `Minor Project_Cover_Page_Documentation.pdf`.
- Diagrams redrawn in **PlantUML** (real UML shapes) for the 9 MVP entities: `diagrams/*.puml` → `*.png`.
  Render: `java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tpng *.puml` (needs Graphviz; Java 21 is at
  Android Studio `jbr`).
- Decks built by `presentation/build_decks.py` (python-pptx, on the AIT template):
  `DisCharge+_Phase1_Review.pptx` (10 slides + speaker notes) and `DisCharge+_Architecture_and_DD.pptx`
  (architecture + full field-level data dictionary). Also writes `08-phase1-data-dictionary.md`.
- Data model choices for the MVP DD: FKs shown only as associations in the class diagram; `triggeredRules`
  on both SymptomLog and Escalation (missed-dose escalations need a reason too); `Escalation.patientId`
  kept as a denormalised FK for queue grouping; sequence diagram stops at "patient informed" (clinician
  handling = the Manage Escalation Queue use case).
- Known limit: class / sequence / architecture labels are ~8–10 pt on the slide (below the PDF's 16 pt);
  full-size PNGs are in `diagrams/` to open if an examiner wants to zoom.
- Follow-up same day: deck reworked to the PDF literally. Slide 2 = Project Title + Section|Details table with
  the PDF's six numbered sections; slide 3 = Section|Content table (Problem / Proposed / Key Features / Target
  Users); slide 4 = Table|Important Attributes with PK/FK marked. All text now 16 pt or more (captions and
  page numbers 14 pt, as the PDF allows for references); supporting DD deck is one table per slide at 16 pt.
- PDF compliance audit (`presentation/audit_decks.py`: slide order, fonts/sizes, DD<->ER<->Class<->Sequence
  names): 0 problems. Fixed on the way: "Doctor" -> "Clinician" everywhere; Key Features cut to 5 (PDF: max
  3-5 points); diagrams now use Calibri (2 fonts total with the template's Times New Roman); activity diagram
  uses true diamonds with labelled [Yes]/[No] guards (while-loop for input validation); ER boxes square;
  captions 16 pt; slide titles "UML Class / Sequence / Activity Diagram" as in the PDF.


### 2026-09-25 — Chen-notation ER diagram
- Added `diagrams/er_chen.py` → `er-chen.svg` / `er-chen.png`: a hand-laid-out Chen ER diagram (entity boxes,
  attribute ellipses, relationship diamonds, min..max cardinality, legend + attribute cards) in the style
  of a reference picture the student supplied. Same 9 entities, fields and relationships as `er.puml` / the DD.
  PRESCRIPTION drawn as an associative entity (a diamond inside the box). Rendered with headless Chrome;
  the script prints an overlap check (currently 0). Not yet swapped into slide 9 of the deck.
- Slide 9 of `DisCharge+_Phase1_Review.pptx` now shows `er-chen.png` (patched in place; `build_decks.py` updated to match).
- Added `09-project-guide.md`: a plain-language guide to the whole project (scope, workflows, data model, rule
  engine, diagrams, deck, decisions, build plan, viva Q&A, glossary). The student can't open claude.ai artifacts,
  so keep deliverables as local files.

### 2026-09-30 — PRD and build layout
- Student asked whether the plan exists (yes: root README stages + `07-mvp-scope.md` 10-week plan) and for
  PRD docs + a detailed layout of what's being built now.
- Added `10-prd.md`: goals G1–G5, non-goals, user stories, functional requirements FR-1…FR-10 (M/S/C priority)
  with Given/When/Then acceptance tests (AC-1…AC-13, one per weekly "done when"), NFR-1…18, success metrics,
  risks, traceability to use cases / pages / entities / weeks.
- Added `11-build-layout.md`: repo + folder tree, proposed API contract (26 endpoints, patient data nested under
  `/patients/:patientId` so one ownership middleware guards it), indexes, rule-engine / sweep / risk-band shapes
  (contents left to the team), client routes (`/p/*`, `/d/*`), ASCII wireframes for all 13 pages, 3 end-to-end
  flows, week-by-week checklist, "who writes what" table.
- No decisions taken for the team: all open items are listed as ⚑ D1–D12 in PRD §9 (clinician visibility, JWT
  lifetime, protocol templates, slot times, plan editing, grace window, adherence window, symptom codes, rule set,
  resolve-without-ack, risk thresholds, merging Escalation Detail).
- Flagged for review: `AdherenceRecord` has no `patientId`, so the doses query goes via plan → prescriptions;
  adding one would mean changing DD/ER/class to keep them consistent.

### 2026-09-30 — Review of the first code (Stage 0 + models)
- Found: root `.git` (no commits), `.gitignore`, `server/` (Express app, env/db config, 9 models, `test-schemas.js`),
  `client/` (Vite + React 19 + Tailwind 4 skeleton), root `docs/` (a copy of `DishCharge+/docs` + `LEARNING_LOG.md`),
  `.devin/` (another AI tool's config). The learning log says "built myself", but the files look AI-generated
  (`TODO(rudra)` headers on files that are already finished). Asked the student who wrote what.
- Verified: server boots against local MongoDB; `GET /health` works, but the contract says `/api/health` (404).
- Client **build fails**: Tailwind 4 is wired the v3 way (`tailwindcss` PostCSS plugin + `@tailwind` directives).
- `test-schemas.js` only calls `new Model()` and never validates, so its "✅ all schemas validated" proves nothing.
  With real `validateSync()`: timing slots ≠ frequency is rejected ✓; but `completedDate` / `recordedAt` validators
  never fire (custom validators skip undefined values); an Escalation with both or neither source ID is accepted.
- The models don't match the DD: `Prescription.startDate` and `FollowUp.patientId` were added (not in the DD/ER/class
  diagrams, yet the log says "based on data dictionary"); index on a non-existent `Prescription.endDate`;
  `sparse` on the non-indexed `Escalation.symptomLogId` does nothing; `redFlags` ≥ 1 was decided without a record.
- Week 1 still open: folder rename, first commit, `DECISIONS.md`, API-contract agreement, 13 placeholder routes,
  Router/Query/i18n setup. The deck says Vite 8, but Vite 6 is installed.

### 2026-09-30 — MVP built (student asked the AI to build everything)
- Student: "the code was written by Devin and I told it to do so … complete the whole project as per
  plan … make no mistakes … then self-check, find what's unnecessary, fix it." The README contract was
  overridden at their request (note added under the contract; memory updated).
- Housekeeping: merged `DishCharge+/docs` into `docs/` (only SESSION-CONTEXT differed; newer copy kept),
  moved the hackathon PDF, fixed `build_decks.py` template path, deleted the duplicate folder. `.devin/`
  kept and git-ignored.
- Server rebuilt as ES modules: 9 models matching the DD exactly (Devin's extra `Prescription.startDate`,
  `FollowUp.patientId` removed; cross-field rules in `pre('validate')`), zod validation, auth → role →
  ownership middleware, plan creation with generators and manual rollback, missed-dose sweep (idempotent),
  22-rule red-flag engine with cited sources, risk band, dashboard, seed script with the Kantaben journey.
- Client: 13 pages, en/hi/gu, "sun-path" dose view on Patient Home, Indigo/neem/turmeric palette,
  Baloo + Hind fonts (Gujarati/Devanagari native).
- Verified in a real browser (dev-browser): login, register, dose marking, Hindi symptom report, clinician
  dashboard, escalation acknowledge/resolve, plan creation for a newly registered patient; no console errors;
  no horizontal overflow at 360–375 px.
- Self-check + an independent review agent found and fixed: login rate limit bypass via phone spellings;
  follow-ups closable by a non-author clinician; race creating two active plans (now a partial unique
  index); closed plans leaving follow-ups/doses actionable; result screen promising a doctor's call when no
  doctor is linked; "doctor has been told" wording; risk band ignoring open emergencies and counting closed
  plans; queue burying new open alerts under acknowledged ones; new medicine overwriting a chosen line; stale
  form errors; unused code, exports and translation keys. Tests grew to 84.
- All decisions recorded in `DECISIONS.md`; PRD, build layout, project guide, README updated.


### 2026-10-24 — Health check and local run
- No file changes since 2026-09-30; still no git commit and not deployed.
- Verified: 84/84 server tests pass, client builds, i18n 141 keys OK; reseeded local DB; API (:3000) and client (:5173) running, demo login works.
- First commit (branch renamed master -> main) and pushed to https://github.com/vandit-cloud/DisCharge-Plus (public).
- MongoDB Atlas: project DisCharge-Plus, M0 cluster discharge-cluster (Mumbai), DB discharge, seeded. Atlas URI kept as a commented ATLAS_URI line in server/.env; local stays active so npm run seed cannot wipe Atlas.
- Discussed reminders: MVP has none (pull only). Twilio trial unusable (template-only bodies); options: Telegram bot, Web Push, Capacitor APK with local notifications (preferred). Render free sleeps after 15 min idle and in-process node-cron does not keep it awake; use an external pinger in demo weeks.
- Next: Render blueprint (MONGODB_URI) -> Vercel (root client, VITE_API_URL) -> set CLIENT_ORIGIN -> cron-job.org ping.
- Render live: https://discharge-api-bhpc.onrender.com (first MONGODB_URI lacked /discharge -> used empty "test" DB; fixed). Atlas password rotated after it was pasted in chat. Smoke test passed: logins, dashboard, escalations, patient doses, patient blocked (403) from clinician routes. Empty "test" DB still on Atlas (delete in Atlas UI).
- Vercel live: https://dis-charge-plus.vercel.app (VITE_API_URL needed a redeploy; CLIENT_ORIGIN on Render set to it). Browser-verified end to end: clinician dashboard + escalation queue (/d/escalations), Kantaben home in Gujarati with sun-path, no console errors. Remaining: cron-job.org pinger on /api/health for demo weeks; delete empty Atlas "test" DB.
- Patient Android app started (Capacitor 8, appId in.discharge.plus): client/android/, `npm run build:android` (mode android -> .env.android with Render URL, then cap sync), APK via `cd client/android && ./gradlew assembleDebug` (local.properties sdk.dir must use forward slashes). Reminders: client/src/lib/reminders.js (local notifications, cleared on logout), wired in PatientShell (doses today+tomorrow, app only); planReminders() left as TODO(rudra); i18n reminder.* keys added (145 keys; hi/gu need native check). Render CLIENT_ORIGIN must add https://localhost. Not committed yet.
- Clinician alerts (website): client/src/lib/alerts.js (new open escalations since last 30 s poll -> browser notification + Web Audio beeps + "(n) DisCharge+" tab title), "Turn on alerts" button in ClinicianShell sidebar, escalations poll continues in background tabs. alertFor() policy left as TODO(rudra) (returns null = no notification yet). Locally verified: title 4 -> 5 after a new report, no console errors. User had not seen Kantaben alerts: they were in Dr. Mehta live queue (likely looked at localhost or wrong login). Not committed/pushed yet (Vercel deploys on push).
- Speed: Render was in Oregon (default) vs Atlas Mumbai -> dashboard 3.3 s. Recreated from Blueprint with region: singapore -> new API https://discharge-api.onrender.com; reused-connection health 0.1 s, dashboard ~1.3 s, patients ~1.1 s (rest = ~100 small queries on free-tier CPU). .env.android updated, APK rebuilt. User to update Vercel VITE_API_URL + cron-job URL.
- Dose reminders policy written by AI at the student's request (planReminders: one per slot time at dose time + one nudge 60 min later if still pending, critical line if any critical medicine). Emulator test found the plugin opens Android "Alarms & reminders" settings and waits on every schedule() (exact alarms denied by default on Android 14+): fixed with isExactNotification:false. Verified on emulator: 6 reminders scheduled for Kantaben, test notification delivered ~25 s late. Dev helper: npm run try:reminders (writes client/try-reminders.txt). APK rebuilt; not committed yet.

### 2026-10-26 — FSD lab manual (separate subject, not DisCharge+)
- Student asked for the Full Stack Development (BC05001051) lab manual from `docs/format for LAB Manual (1).docx`: all 11 practicals with code and output.
- AI built everything in `lab-manual/` (own package.json, shared node_modules): p01–p11 code, `scripts/capture.mjs` (headless Chrome screenshots + API/console output), `scripts/build_manual.py` (fills the college template: cover, certificate, index kept; index page numbers are PAGEREF fields filled by Word via `scripts/finish_in_word.ps1`).
- Output: `lab-manual/FSD-Lab-Manual.docx` + `.pdf`, 68 pages, 35 real screenshots. P5 uses a real network log of amazon.in recorded on 2026-10-26.
- Student must hand-fill name/enrolment/class/term, certificate blanks, footer "Enrolment No." and the Date/Sign columns. Not committed.

### 2026-10-28 — SDO (DevOps) lab manual started (separate subject, not DisCharge+)
- Student asked for practicals for `docs/SDO-INDEX.pdf` (15 DevOps practicals) in printable form. Answers: subject
  name/code left blank to hand-fill; outputs from real runs; P10 Cloud VM left for later (write steps, blank output);
  small separate demo app; public GitHub repo allowed; student will add the `workflow` gh scope for P15.
- Built in `sdo-lab-manual/` (see its README): demo app `app/` (Express + prom-client, 5 node:test tests, Dockerfile,
  Jenkinsfile, k8s/, .github/workflows/devops.yml), configs for P4–P15, `scripts/lib.sh` transcript helper.
- Done for real: P1, P2, P3 transcripts in `outputs/`. GitHub repo https://github.com/vandit-cloud/sdo-devops-lab
  created (PR #1 merged = Jenkinsfile; issue #2 "Add Kubernetes manifests" open, to be closed by the P15 PR).
- Blocked: Docker Desktop can't start (`hasNoVirtualization`): WSL 2 is not installed (firmware virtualization is on).
  Student must run `wsl --install --no-distribution` in an admin PowerShell and restart.
- Next: download jq/kind/terraform into `sdo-lab-manual/tools/`; write run.sh for P4–P9, P11–P15 and test each;
  `scripts/capture.mjs` (screenshots, playwright-core + Chrome); `scripts/build_manual.py` adapted from
  `lab-manual/scripts/build_manual.py` (cover + certificate from the template, index copied from SDO-INDEX.pdf with
  DATE/SIGN columns); Word COM -> PDF.
- Later same day: WSL 2 could not be installed (winget reinstalled the WSL package, but DISM's VirtualMachinePlatform
  download from Windows Update stalled at 37%/50% on this Insider build 26300). Docker practicals were run on a GitHub
  Codespace instead (`sdo-lab-4jrvwx5v59wqfq64r`, 4-core, now **stopped**); its leftover iptables-legacy FORWARD DROP
  blocked container-to-container traffic (fix in sdo-lab-manual/README).
- Student chose "hybrid" to save time: real output for P1-P4, P5 (pipeline build #1), P6-P9 with 9 screenshots;
  P5 steps 3-5 and P11-P15 written as "Expected Output" (manual says they were not executed); P10 steps + blank boxes.
- Built `sdo-lab-manual/SDO-Lab-Manual.docx` + `.pdf` (63 pages): template cover (subject name/code blank) + certificate,
  index copied from SDO-INDEX.pdf, 15 practicals (Aim, Objective, Environment, Theory, Procedure, Code, Output, Conclusion).
- Not done: P15's PR (k8s/ + .github/workflows) was never pushed, so issue #2 on the GitHub repo is still open. Not committed.
- Follow-up: codespace deleted. P10 now also has a written "Expected Output" (EC2 details, SSH session, curl from PC)
  instead of blank screenshot boxes; manual still 63 pages. DOCX is the editable source, PDF is the print copy.

### 2026-11-16 — Clinician alert policy
- Student asked the AI to finish and commit the clinician alert rules. `alertFor()` in `client/src/lib/alerts.js`
  (was `TODO(rudra)`): every new open escalation notifies; emergency = 3 beeps + sticky, urgent = 2 beeps,
  teleconsult = silent; tier only (missed critical dose is already urgent, D6); unknown tier = no alert. Recorded as B13.
- 84/84 server tests pass, client builds. Committed alerts.js + DECISIONS.md + this file; the Android reminder
  changes (reminders.js, PatientShell.jsx, .env.android, package.json, try-reminders.mjs, .gitignore) are still uncommitted.

### 2026-11-17 — Plan: follow-up no-show ML model (not built yet)
- Committed + pushed the Android reminder work (`8c95ef6`); Vercel redeploys on push.
- Student wants the "AI-enabled" title to be honest; ~2 days left. Considered a "likely cause of symptoms" model
  (synthetic data from a knowledge table, ICD-10 labels) -> moved to future scope. **Chosen: follow-up no-show model**,
  because it trains on real data and serves expected outcome 1 (Follow-up Management).
  - **Data:** Kaggle "Medical Appointment No Shows" (joniarroba/noshowappointments), ~110,527 public-hospital
    appointments, Vitoria, Brazil, 2016, file `KaggleV2-May-2016.csv`. Student downloads it (Kaggle login) to
    `ml/data/` (git-ignored: size + licence). Python 3.12, pandas 3.0, scikit-learn 1.9 already installed.
  - **Features (only ones our app also has):** age (`Patient.dateOfBirth`), gender, hypertension (~ cardiac protocol),
    diabetes (diabetes protocol), lead days (dataset: AppointmentDay - ScheduledDay; app: `FollowUp.scheduledDate` -
    plan creation). Clean: drop age < 0, lead days < 0. Label `No-show` = "Yes".
  - **Model:** logistic regression (class_weight balanced) in one script `ml/train_noshow.py`: train/test split,
    print AUC + confusion matrix, export coefficients to `server/src/ml/noshow-model.json`. Node `predictNoShow()`
    = sigmoid of the weighted sum (no Python on Render). Computed on read, not stored -> no DB / DD change.
  - **UI (decided 2026-11-17):** on the **Clinician Dashboard**, beside the existing overdue follow-ups, a panel
    "Upcoming follow-ups (next 7 days), highest no-show risk first", each row with a "Low / Medium / High (n %)"
    badge. Clinician only; patients never see it. Action it supports: call the high-risk patients first.
  - **Training time measured:** ~0.5 s (71,959 rows after cleaning, logistic regression). Can be re-run live in the viva.
  - **Viva framing:** "outreach decision support, trained on public data, to be retrained on our own records" (the app
    already stores completed / missed = the same label). Weak points to state up front: Brazil outpatients vs rural
    Gujarat, no distance/travel-cost feature, only 5 inputs, modest AUC.
  - **Honest limits for the viva:** expect AUC ~0.6-0.7; Brazilian outpatient visits, not Gujarat discharge follow-ups;
    adherence % (our best signal) is not in the dataset -> retrain on our own data later (future scope).
  - Student writes the Low/Medium/High thresholds (`TODO(rudra)`).
  - **Dataset checked (2026-11-17):** `ml/data/KaggleV2-May-2016.csv` extracted from `archive.zip`; 110,527 rows x 14
    cols, no nulls, no duplicate AppointmentIDs; 20.2 % no-shows. Dirty rows: 1 age < 0, 5 appointments before booking.
    **Same-day appointments** (lead 0) have 4.6 % no-shows vs 28.5 % for later ones; follow-ups are never same-day,
    so train on lead >= 1 only. Patients repeat -> split train/test **by PatientId** (no patient in both).
  - **Licence: CC BY-NC-SA 4.0** (attribution, non-commercial, share-alike). Fine for college/hackathon; credit
    "Joni Hoppen, Medical Appointment No Shows, Kaggle" on the slide and in the model JSON; the trained model may not
    be used commercially and must carry the same licence.
  - **Rejected:** ML-based escalation priority (no outcome data, loses rule-by-rule auditability, decision 7).
- Also to fix: `docs/01-project-profile.md:8` subtitle wording must match the final title.

### 2026-11-17 — Built: follow-up no-show model
- `ml/train_noshow.py` (~1 s): cleans the Kaggle CSV (71,959 rows used), splits by PatientId, fits logistic regression,
  prints AUC + confusion matrix, folds the scaler into raw-input weights (asserted equal), writes
  `server/src/ml/noshow-model.json` (weights, intercept, metrics, score percentiles, dataset credit, licence).
- **Results:** test AUC 0.586 (below the 0.6-0.7 guess). Ceiling check: all Kaggle columns = 0.596; an age 13-30 flag = 0.593.
  Flagging the top quarter (score >= 0.327) catches 31 % of no-shows at 36 % precision (base rate 28.5 %).
  Weights: lead days +0.172 per ln-day (strongest), diabetes +0.129, hypertension -0.063, age -0.009/yr, male -0.022.
- **Changed from the plan:** dropped `class_weight="balanced"`: it centred scores on ~50 % so the "n %" badge would overstate
  risk; unweighted gives real probabilities (DECISIONS B14). Lead days = `scheduledDate - dischargeDate` (plans have no createdAt).
- `server/src/ml/noShow.js`: `noShowInputs()`, `predictNoShow()`, `noShowBand()` (**TODO(rudra)**, returns null until written).
- `dashboardService.js` returns `upcomingFollowUps` (scheduled, next 7 days, active plans, riskiest first);
  `Dashboard.jsx` shows the panel with an "n %" badge (coloured by band once cut-offs exist). Patients never see it.
- Tests: `tests/unit/noShow.test.js` + dashboard integration assertions; 88/88 pass; client build OK. Not committed.
- **Later the same day: model v2 + rules (option A).** Discussed with the student why a model can only learn columns that
  come with outcomes; searched for datasets with distance/income: only synthetic ones (rejected) or real ones without
  no-show outcomes; Indian studies (Karnataka hypertension PLOS ONE, AIIMS Delhi) cited as evidence for rules instead.
  - ML: added `missedBefore` (earlier-day misses only; a looser same-day version scored 0.606 but leaks). AUC **0.595**.
    Welfare scheme (`Scholarship`) tested: 35.0 % vs 27.9 % no-shows but AUC +0.002 only; not added (app has no field).
  - Rules (`noShowReasons()` in `server/src/ml/noShow.js`): adherence < 60 %, no app activity >= 3 days, district >= 100 km
    from Vadodara (`server/src/rules/districtDistance.js`, haversine on district HQ coordinates). New
    `server/src/services/noShowService.js` gathers the facts; dashboard rows show the reasons in amber.
  - `noShowBand(probability, reasons)` is still **TODO(rudra)**; it may use the reasons (e.g. bump a level for 2+).
  - Checked on a fresh seed in a temporary DB (dropped after): scores 18-35 %, reasons look right. The local `discharge`
    DB was seeded ~24 days ago, so everything shows as overdue/inactive: **reseed before the demo** (`npm run seed`).
  - Health Connect (steps, sleep) -> future scope, as an optional consented beta feeding red-flag rules.
  - 92/92 server tests pass; client build OK. Not committed.
- **Robustness + cut-offs (same day).** Student delegated the cut-offs: B16 (percentile bands from the model JSON + bump for
  2+ rule reasons). Endpoint audit = new `robustness.test.js` (~6,700 bad requests, 0 x 500 after fixing 413/415 -> 500).
  Reboot: MongoDB service is AUTO_START; added connect retries, startup catch-up sweep, 503 when the DB is down (B17);
  verified with a scratch simulation (API before DB, DB outage mid-run, DB restart). Client already logs out on 401 and the
  alert hook treats the first list as the baseline (no alarm storm after a restart). Dashboard guards a missing
  `upcomingFollowUps` during a deploy. 98/98 tests, build OK. Local DB reseeded today. Demo has no High no-show patient
  (top scores 0.326-0.328 < 0.329). PM-JAY (FR-10.1) recapped for the student, not built.
- **Redesign demo (not applied).** Student asked for a teal palette (#EAF7FB #BFEAF2 #63C9D6 #1E7F8C #20343A), a glass look
  like a reference fintech screenshot, graphs and transitions. Built `docs/design-demo/redesign-demo.html` (open in a
  browser): clinician dashboard in dark glass with live 17 Nov data (14-day adherence trend uses sample values: would need
  an API addition), risk donut, escalations-by-tier bars, "whom to phone first" no-show bars with cut-off lines; patient
  home in light glass inside a phone frame (contrast for NFR-12; "I feel unwell" stays red). Status colours checked with the
  dataviz validator. Waiting for the student's go-ahead before applying it to `client/`.
- **Redesign applied (B18).** Tokens + `.theme-dark` in `index.css`; new `ClinicianShell` (top bar), `components/charts.jsx`
  (CountUp, TrendChart, Donut), rebuilt `Dashboard.jsx`; patient shell with floating glass tab bar, teal sun path, teal
  logo + favicon. API: `adherenceTrend`, `dischargedLast7Days`, `noShowCutoffs` on `/dashboard` (+ test). Fixed CSS-grid
  lists stretching to their text width (`grid-cols-1`). Checked by screenshots: dashboard, patients, escalations, escalation
  detail, patient detail, plan editor (desktop); all clinician + patient pages report no horizontal overflow at 390 px.
  98/98 tests, build + i18n OK. Not committed. The Android APK still has the old look until rebuilt (`npm run build:android`).

### 2026-11-17 — Project documentation (college report) built
- Student asked for the project documentation in the format of `docs/SAMPLE DOCUMENTATION FILE.docx`, updated for the
  new features, with old diagrams changed where needed.
- New `docs/documentation/`: `DisCharge+_Project_Documentation.docx` + `.pdf` (41 pages), built by `scripts/build_report.py`
  on the sample file as template (cover, certificate, acknowledgement, preface, index kept and filled; index page numbers are
  PAGEREF fields filled by `scripts/finish_in_word.ps1`). Names/enrolment/guide taken from the Phase-1 deck (Vandit Doshi
  243030601029, Smit Gajera 243030601031, Prof. Meeta Ahuja). Certificate date/place/signatures left for hand-filling.
- New diagrams in `docs/diagrams/`: `usecase-patient`, `usecase-clinician`, `activity-patient`, `activity-clinician`
  (sample style: login loop + fork bar), `sequence-noshow` (dashboard -> NoShowService -> model), `flowchart.dot`
  (Graphviz). Reused unchanged: `er-chen.png` (data model unchanged), `sequence.png`, `activity.png` (swimlanes).
  The deck's combined `usecase.png` and `class.puml` were **not** updated.
- 17 fresh screenshots (seeded data) in `docs/documentation/screenshots/`; notation symbol images in `symbols/`.
- PlantUML 1.2026.10 + Graphviz 16.1.1 downloaded to `.tools/` (now git-ignored). Local DB reseeded after the screenshots.
- No code changed (docs + `.gitignore` only). Not committed.

### 2026-11-20 — Deck moved to the FINAL college format; report check
- The college issued `docs/BCA_Sem_5_Project_Presentation_Format_and_Instructions FINAL.pdf`: **15 sections** (old 10 + User
  Interface Design / Screenshots, Limitations, Conclusion, References, THANK YOU), "add each and every screenshot", 5-7+
  screens with a title and 3-4 lines each. Its list puts Limitations before Future Scope, but its detail pages number them
  11 = Future Scope, 12 = Limitations; we followed the list (Limitations first). Student may swap if the guide says otherwise.
- `presentation/build_decks.py` rewritten for it: `DisCharge+_Phase1_Review.pptx` = **26 slides** (sections 1-9, then 12
  screenshot slides 10.1-10.12 using all 16 report screenshots, dashboard split in two, then 11-15). Slides 2/3 now include
  the no-show ML model, Android reminders, clinician alerts, Python/scikit-learn/Capacitor. Names + guide now come from the
  script (were hand edits). Old deck backed up only in the session scratchpad.
- Diagrams updated: `usecase.puml` (+ Receive Dose Reminder, Predict Follow-up No-show Risk «include» from View Dashboard,
  Receive Escalation Alert), `class.puml` (+ NoShowModel service class), `architecture.puml` (+ Android app, No-show Model).
- `audit_decks.py` checks the FINAL order (screenshot run, >= 5 screens): 0 problems. 98/98 server tests pass. No app code changed.
- Report check against `SAMPLE DOCUMENTATION FILE.docx` (both rendered via Word): same structure, chapters, symbol tables and
  screenshot style. Fixed: a **blank page 5** (the sample's ~36 padding paragraphs before INDEX + our page break) and a stray
  control character in `build_report.py` (`` instead of ``) that made a fresh build unreadable in Word. Report is now 40 pages.
- Known limits: diagram labels on slides 5-9 are below 16 pt (full-size PNGs in `diagrams/`); no screenshot of the Android
  notification or the browser alert exists (described in text on 10.2 / 10.8).

