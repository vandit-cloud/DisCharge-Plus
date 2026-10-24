# 10. Product Requirements Document (PRD) — DisCharge+ MVP

> **Status:** v1.1, 30 Sep 2026 (MVP built; open decisions resolved in `DECISIONS.md`). Written from the decisions already locked in
> `07-mvp-scope.md`, `08-phase1-data-dictionary.md` and `09-project-guide.md`. It adds nothing
> to the scope. It turns the scope into numbered requirements you can build, test and tick off.
>
> **Companion:** `11-build-layout.md` has the page wireframes, API contract, folder layout and
> week-by-week task list.
>
> **Precedence:** `07-mvp-scope.md` > this PRD > documents 01–06. Items marked **⚑ DECIDE** are
> open decisions for the team. The PRD lists the options but does not choose one.

---

## 1. Summary

| Item | Detail |
|---|---|
| Product | DisCharge+: Post-Discharge Continuity-of-Care Platform for Rural Patients |
| Release | MVP (BCA Sem 5 minor project demo + TetraTHON 2026, Track A, PS 2) |
| Team | Vandit Doshi (lead: backend, data model, rule engine) · Smit Gajera (partner: React pages) |
| Guide | Prof. Meeta Ahuja, AIT (GTU) |
| Timeline | 10 build weeks + 2 buffer weeks |
| Platform | Responsive, mobile-first web app. `client/` (React) + `server/` (Node/Express) + MongoDB Atlas |
| Data | Synthetic only. No real patient data, ever |

**Problem, in one line:** once rural patients leave hospital, nobody notices missed medicines
or warning signs until they turn into emergencies and readmissions.

**Product, in one line:** a clinician turns a discharge into a tracked care plan. The patient
follows it and reports symptoms in their own language. A rule engine sends red flags and missed
critical doses to the clinician's queue. The clinician sees who needs attention today.

---

## 2. Goals and non-goals

### 2.1 Goals (what the MVP must prove)

| ID | Goal | Maps to hackathon outcome |
|---|---|---|
| G1 | Every discharge produces a follow-up schedule and a dose schedule automatically | 1 Follow-up Management |
| G2 | A red-flag symptom or a missed critical dose reaches the clinician's queue within seconds, with the rule that fired | 2 Automated Escalation |
| G3 | A low-literacy patient can use the patient pages in Gujarati, Hindi or English | 3 Localized Education (partial) |
| G4 | The clinician can answer "which of my patients need attention today?" from one screen | 7 Clinical Impact (partial) |
| G5 | One patient can never read another patient's records | Security baseline |

### 2.2 Non-goals (explicitly not in this release)

- No ML risk model and no SHAP. The risk band is rule-based (future: `ml-svc`).
- No offline mode, PWA or sync (future: health-worker screening).
- No caregiver or health-worker roles. No admin role.
- No SMS, WhatsApp or push notifications. Reminders are in-app only.
- No FHIR export, ABDM sandbox, consent artefacts or audit log. The `abhaId` field only.
- No education library, text-to-speech or LLM-generated text.
- Not a diagnostic tool, not an EMR, not production-certified.
- *Stretch only:* PM-JAY scheme check (page 14), built only if weeks 11–12 allow.

---

## 3. Users

| Role | Persona (fictional) | Needs | Device |
|---|---|---|---|
| **Patient** | Kantaben Rathwa, 61. Heart failure + diabetes, Chhota Udepur. Gujarati, reads very little | Know which medicine to take now; tell the doctor when unwell without typing | Shared basic Android phone, weak signal |
| **Clinician** | Dr. Ananya Mehta, 38. Cardiologist, district hospital, ~200 discharged patients | Enter a plan fast; see the most urgent patients first; know *why* each alert was raised | Desktop / laptop at hospital |
| **Scheduler** (system actor) | node-cron job | Find doses nobody marked and escalate critical ones | Server |

**Account creation (assumption, confirm ⚑):** patients self-register (page 2). Clinician
accounts are created by the seed script, because there is no admin role.

---

## 4. User stories

Format: *As a [role], I want [thing], so that [reason].* The ID links to the functional requirements in §5.

### Patient
| ID | Story |
|---|---|
| US-P1 | As a patient, I want to register with my phone number, so that I don't need an email address. |
| US-P2 | As a patient, I want to see today's doses on my home screen and tap "Taken", so that I don't forget medicines. |
| US-P3 | As a patient, I want to see my care plan (diagnosis, danger signs, instructions) in my language, so that I understand it without help. |
| US-P4 | As a patient, I want to see all my medicines and when to take each one, so that I can plan my day. |
| US-P5 | As a patient, I want to report how I feel by tapping pictures, so that I can tell the doctor without typing. |
| US-P6 | As a patient, I want to be told straight away what to do after I report, so that I know whether to rest, wait for a call or go to hospital. |
| US-P7 | As a patient, I want to see my upcoming check-ups and tests, so that I don't miss them. |
| US-P8 | As a patient, I want to switch the app language at any time, so that a family member can help in their language. |

### Clinician
| ID | Story |
|---|---|
| US-C1 | As a clinician, I want to create a discharge plan with prescriptions, red flags and a protocol, so that the system builds the schedules for me. |
| US-C2 | As a clinician, I want a dashboard with risk bands, open escalations and overdue follow-ups, so that I know who to look at first. |
| US-C3 | As a clinician, I want the escalation queue sorted by urgency and then by age, so that emergencies are never buried. |
| US-C4 | As a clinician, I want to see which rules triggered an escalation, so that I can trust and check the alert. |
| US-C5 | As a clinician, I want to acknowledge and then resolve an escalation with notes, so that there is a record of what was done. |
| US-C6 | As a clinician, I want to search my patients and open one patient's full history, so that I can review adherence and symptoms before calling. |
| US-C7 | As a clinician, I want to mark a follow-up as completed, so that it stops showing as overdue. |

### System
| ID | Story |
|---|---|
| US-S1 | As the scheduler, I mark doses still pending after the grace window as missed and escalate critical ones, so that dangerous gaps are caught even if the patient never opens the app. |

---

## 5. Functional requirements

Priority: **M** = must (MVP fails without it), **S** = should, **C** = could (stretch).
"AC" = acceptance criteria; each one is a test case (Given / When / Then).

### 5.1 Authentication and access — module M1 (Week 2)

| ID | Requirement | Pri |
|---|---|---|
| FR-1.1 | A patient can register with full name, phone (+91, 10 digits), password, preferred language, date of birth, gender, district and an optional ABHA ID. The system creates one `User` (role = patient) and one `Patient`. | M |
| FR-1.2 | Phone numbers are unique. Registering an existing phone is rejected. | M |
| FR-1.3 | ABHA ID, if given, must be exactly 14 digits and unique. | M |
| FR-1.4 | Passwords are stored only as bcrypt hashes. The minimum length is ⚑ DECIDE (suggest 8). | M |
| FR-1.5 | Users log in with phone + password and receive a signed JWT carrying `userId` and `role`. Token lifetime is ⚑ DECIDE. | M |
| FR-1.6 | After login the app redirects by role: patient → `/p`, clinician → `/d`. | M |
| FR-1.7 | Every API route except register, login and health requires a valid JWT (else **401**). | M |
| FR-1.8 | Routes check the role (else **403**). Patient routes are closed to clinicians unless listed in the API contract. | M |
| FR-1.9 | **Ownership:** a patient can only read and change records that belong to their own `patientId`. A clinician can only read patients ⚑ DECIDE (a: patients with a plan they authored; b: all patients). | M |
| FR-1.10 | Login is rate-limited (suggest 5 failed attempts per 15 min per phone/IP). | S |
| FR-1.11 | Logout clears the token on the client. Language switch and logout are in the header on every page. | M |

**AC-1 (the Week 2 "done" test):** Given patient A and patient B are logged in, when A requests
`GET /api/patients/{B's id}/plan`, then the server returns **403** and no data from B.
**AC-2:** Given a registered phone, when someone registers it again, then the response is 409 and no second User exists.
**AC-3:** Given any request without a token to a protected route, then the response is 401.

### 5.2 Discharge plan and schedules — module M2 (Weeks 3–4)

| ID | Requirement | Pri |
|---|---|---|
| FR-2.1 | A clinician finds a patient by phone, name or ABHA ID and opens the Discharge Plan Editor for them. | M |
| FR-2.2 | Plan fields: admission date, discharge date, primary diagnosis, red flags (list), follow-up protocol (cardiac / diabetes / ckd / post_surgical / general). | M |
| FR-2.3 | Discharge date must be on or after admission date and not in the future (⚑ DECIDE: allow future-dated discharge?). | M |
| FR-2.4 | A plan has **at least one** prescription (ER: DischargePlan 1 : 1..N Prescription). | M |
| FR-2.5 | Each prescription: medicine (from the Medication master list), dosage text, frequency (OD / BD / TDS / QID), timing slots, duration in days (1–⚑ max), `isCritical`. | M |
| FR-2.6 | The number of timing slots must equal the frequency (OD = 1, BD = 2, TDS = 3, QID = 4). | M |
| FR-2.7 | A clinician can add a new medicine to the master list from inside the editor (generic name unique, form, strength). | S |
| FR-2.8 | A patient has at most **one active plan** at a time. Creating a new plan for a patient with an active one is ⚑ DECIDE (block, or mark the old one completed). | M |
| FR-2.9 | **On save, the server generates FollowUp records** from the chosen protocol and the discharge date. Protocol templates are ⚑ DECIDE (each must cite a published source; see §9). | M |
| FR-2.10 | **On save, the server generates one AdherenceRecord per scheduled dose:** for each prescription, for each day in `durationDays` starting at the discharge date, for each timing slot → `scheduledAt`, status = pending. Slot clock times are ⚑ DECIDE (e.g. morning 08:00). | M |
| FR-2.11 | Plan save + generation is all-or-nothing: if generation fails, no half-built plan remains. | M |
| FR-2.12 | Editing a plan after save: ⚑ DECIDE (a: only status can change; b: edits regenerate future pending doses only). | S |
| FR-2.13 | A clinician can change plan status: active → completed / readmitted / lost_to_followup. | S |

**AC-4 (Weeks 3–4 done test):** Given a plan with metformin BD for 5 days (morning, night) and
furosemide OD for 5 days (morning, critical), when it is saved, then exactly **15** AdherenceRecords
exist (10 + 5), all pending, and the FollowUps match the protocol template.
**AC-5:** Given a plan with frequency TDS but 2 timing slots, when it is submitted, then the response is 400 naming the field.

### 5.3 Adherence and missed-dose escalation — module M3 (Week 5)

| ID | Requirement | Pri |
|---|---|---|
| FR-3.1 | Patient Home lists today's doses (IST day), grouped by timing slot, with medicine name, strength, dosage and status. | M |
| FR-3.2 | The patient taps **Taken** on a pending dose → status = taken, `recordedAt` = now. | M |
| FR-3.3 | A dose can be marked taken from ⚑ DECIDE (suggest 1 h before `scheduledAt`) until the grace window closes. Future doses cannot be marked. | M |
| FR-3.4 | A **node-cron job** runs every ⚑ DECIDE (suggest 15 min). It sets status = missed on every pending dose whose `scheduledAt + grace window` has passed. Grace window: ⚑ DECIDE (suggest 2 h). | M |
| FR-3.5 | If a missed dose belongs to a prescription with `isCritical = true`, the job creates an **Escalation**: source = missed_critical_dose, `adherenceId` set, `symptomLogId` null, tier = ⚑ DECIDE (suggest urgent), `triggeredRules` = e.g. `MISSED_CRITICAL_DOSE`, assigned clinician = the plan's clinician, status = open. | M |
| FR-3.6 | The job is **idempotent**: running it twice creates no duplicate missed marks and no duplicate escalations (at most one Escalation per `adherenceId`). | M |
| FR-3.7 | My Medicines shows each prescription with its schedule and the last 7 days of dose history. | M |
| FR-3.8 | Adherence % = taken ÷ (taken + missed) over ⚑ DECIDE (whole plan, or last 7 days). Pending doses are not counted. | M |

**AC-6 (Week 5 done test):** Given a critical dose scheduled at 08:00 and a 2 h grace window, when the
job runs at 10:15 and the dose is still pending, then the dose is missed and one open Escalation
(source = missed_critical_dose) exists. When the job runs again at 10:30, there is still exactly one.
**AC-7:** Given a non-critical dose missed, then no Escalation is created and adherence % drops.

### 5.4 Symptom reporting and the rule engine — module M4 (Weeks 6–7)

| ID | Requirement | Pri |
|---|---|---|
| FR-4.1 | Report Symptom shows a grid of symptom icons with labels in the patient's language. The symptom code list is ⚑ DECIDE (suggest 10–12 codes, e.g. `CHEST_PAIN`, `BREATHLESS`, `SWELLING_LEGS`, `DIZZY`, `FEVER`, `VOMITING`, `WOUND_REDNESS`, `LOW_URINE`, `CONFUSION`, `OTHER`). | M |
| FR-4.2 | The patient picks 1–10 symptoms and a severity 1–5 (faces or a 5-step scale, not a number field). | M |
| FR-4.3 | Invalid input (no symptom, severity out of range, unknown code) is rejected with **400**; the form shows the error and keeps what was entered. | M |
| FR-4.4 | **The SymptomLog is saved first**, before evaluation, so every report is kept. | M |
| FR-4.5 | The **rule engine** loads the patient's active plan (red flags + protocol) and evaluates every rule for that protocol against the symptoms and severity. | M |
| FR-4.6 | All matched rule IDs are stored in `triggeredRules`. The tier is the **highest** tier among the matches. No match → `self_care`. | M |
| FR-4.7 | Tier and rule IDs are written to the SymptomLog, whatever the tier. | M |
| FR-4.8 | If tier ≥ teleconsult, an Escalation is created: source = symptom_log, `symptomLogId` set, same tier and rules, status = open, assigned to the plan's clinician. | M |
| FR-4.9 | The last step of Report Symptom shows the result in the patient's language: tier colour + icon + plain instruction (self_care → advice; teleconsult → "your doctor will call"; urgent → "see a doctor today"; emergency → "go to hospital now / call 108"). | M |
| FR-4.10 | The rule set lives in one server module as data (ID, protocol, condition, tier, source citation), not scattered `if`s. Rule contents are ⚑ DECIDE and must cite a published source. | M |
| FR-4.11 | A patient with no active plan can still report; rules fall back to the `general` set. | S |

**AC-8 (Weeks 6–7 done test):** Given a patient on a cardiac plan, when they report `CHEST_PAIN`
with any severity, then the SymptomLog tier = emergency, one open Escalation (tier = emergency)
exists, and it is **first** in the clinician's queue.
**AC-9:** Given matches for a teleconsult rule and an urgent rule in one report, then the tier is urgent and both rule IDs are stored.
**AC-10:** Given no rule matches, then the SymptomLog is stored with tier = self_care, `triggeredRules` = [] and no Escalation exists.

### 5.5 Escalation handling — module M5 (Weeks 6–7)

| ID | Requirement | Pri |
|---|---|---|
| FR-5.1 | The Escalation Queue lists the clinician's escalations with status open or acknowledged, sorted by tier (emergency → urgent → teleconsult), then open before acknowledged, then by `createdAt` (oldest first). *(Refined while building: DECISIONS B6.)* | M |
| FR-5.2 | Each row shows patient name, tier badge, source (symptom / missed dose), the triggered rules and the time since creation. | M |
| FR-5.3 | Filters: status (open / acknowledged / resolved) and tier. | S |
| FR-5.4 | The queue refreshes automatically every ⚑ DECIDE (suggest 30 s), so a new emergency appears without a manual reload. | M |
| FR-5.5 | Escalation Detail shows the source record (symptoms + severity, or the missed dose + medicine), the triggered rules in words, and the patient's phone. | M |
| FR-5.6 | **Acknowledge:** open → acknowledged, `acknowledgedAt` = now. | M |
| FR-5.7 | **Resolve:** acknowledged → resolved, `resolvedAt` = now, notes required (1–1000 chars). Open → resolved directly is ⚑ DECIDE. | M |
| FR-5.8 | Status only moves forward (open → acknowledged → resolved). Any other change returns **409**. | M |

**AC-11:** Given a resolved escalation, when a clinician tries to acknowledge it, then the response is 409 and nothing changes.

### 5.6 Dashboard, patient list and risk band — module M6 (Week 8)

| ID | Requirement | Pri |
|---|---|---|
| FR-6.1 | `computeRiskBand(patient)` returns `low` / `moderate` / `high` (plus its reasons) from: adherence %, number of open escalations, number of open emergencies, days since discharge. It is **computed on request, never stored**, and only for patients with an active plan. Thresholds: DECISIONS D11. | M |
| FR-6.2 | The dashboard shows: counts of patients per risk band; the top ⚑ N high-risk patients; open escalations by tier; overdue follow-ups (scheduled date passed, status scheduled). | M |
| FR-6.3 | Patient List: the clinician's patients with name, phone, diagnosis, days since discharge, adherence %, risk band, open-escalation count. Search by name / phone / ABHA; filter by risk band. | M |
| FR-6.4 | Patient Detail tabs: **Plan** (plan + prescriptions + follow-ups), **Adherence** (7-day / whole-plan %, dose history), **Symptoms** (all SymptomLogs with tier, including self_care), **Escalations**. | M |
| FR-6.5 | A clinician marks a follow-up completed from Patient Detail → status = completed, `completedDate` = today. | M |
| FR-6.6 | A follow-up whose date has passed without completion shows as overdue. Whether a job changes it to `missed` is ⚑ DECIDE. | S |

**AC-12 (Week 8 done test):** Given the seed data, when the clinician opens the dashboard, then the
seeded "Kantaben" patient (missed critical dose + urgent symptom) appears in the high band and her
escalations are at the top, without opening any other page.

### 5.7 Patient information pages (Weeks 5 and 10)

| ID | Requirement | Pri |
|---|---|---|
| FR-7.1 | My Care Plan shows diagnosis, discharge date, red flags as icon + text, and when to seek help, in the patient's language. | M |
| FR-7.2 | Follow-ups shows upcoming (date, type icon, description) and past (with status). | M |
| FR-7.3 | Patient Home shows the next follow-up and a large **"I feel unwell"** button that opens Report Symptom. | M |

### 5.8 Languages — module M7 (Week 9)

| ID | Requirement | Pri |
|---|---|---|
| FR-8.1 | All patient pages (1–7) are available in English, Hindi and Gujarati through i18next. Clinician pages are English only. | M |
| FR-8.2 | The language defaults to `User.preferredLanguage` after login; before login, to the browser language, falling back to English. | M |
| FR-8.3 | Switching language in the header changes the UI immediately and saves the new `preferredLanguage`. | M |
| FR-8.4 | Coded values (symptoms, red flags, tiers, timing slots, follow-up types, frequency) are translated from code → label. Free text typed by the clinician (e.g. diagnosis) is **not** translated. ⚑ DECIDE: store red flags as codes from a fixed list (translatable, matchable by rules) or as free text. | M |
| FR-8.5 | No missing-translation keys on patient pages (checked by a script or test). | S |

**AC-13 (Week 9 done test):** The same seeded plan renders on My Care Plan in en, hi and gu with no English left in coded labels.

### 5.9 Seed data and demo (Week 9)

| ID | Requirement | Pri |
|---|---|---|
| FR-9.1 | A seed script creates: 2 clinicians, ~20 synthetic patients across protocols, a medication list (~20 generics), plans, doses in the past and future, some taken/missed, symptom logs and escalations in every tier. | M |
| FR-9.2 | The seed includes the **30-day demo journey** for "Kantaben" (Day 0 plan, Day 3 missed critical dose, Day 6 breathlessness → urgent). | M |
| FR-9.3 | All seeded data is labelled synthetic; names are fictional. | M |
| FR-9.4 | The seed script can be re-run safely (clears and reloads the demo database only). | M |

### 5.10 Stretch — Scheme check (Weeks 11–12)

| ID | Requirement | Pri |
|---|---|---|
| FR-10.1 | Page 14 Scheme Navigator: the patient answers a few questions; PM-JAY rules return eligible / not eligible / unsure with the verdict for each criterion. Adds `Scheme`, `SchemeEligibilityCheck`. | C |

---

## 6. Non-functional requirements

| ID | Area | Requirement | How it's checked |
|---|---|---|---|
| NFR-1 | Security | JWT secret, DB URI and other secrets come from environment variables; `.env` is never committed | `.gitignore`, review |
| NFR-2 | Security | Every protected route runs **auth → role → ownership → validation** in that order | Integration tests AC-1, AC-3 |
| NFR-3 | Security | All input is validated on the server (the client check is for UX only). Unknown fields are ignored | Tests on each POST/PATCH |
| NFR-4 | Security | Password hashes and other users' data never appear in any API response | Review of `toJSON` / projections |
| NFR-5 | Privacy | Only synthetic data. The UI footer and README say so | Review |
| NFR-6 | Performance | Symptom submit → result screen in under 2 s on a normal connection; the escalation appears in the queue within one refresh interval | Manual timing in demo |
| NFR-7 | Performance | Dashboard loads in under 3 s with the seed data (~20 patients) | Manual |
| NFR-8 | Reliability | The cron job is idempotent and logs each run (doses marked, escalations raised) | AC-6 |
| NFR-9 | Reliability | Plan creation is atomic (FR-2.11) | Test that forces a failure |
| NFR-10 | Usability | Patient pages usable at 360 px width; tap targets ≥ 48 px; icons with every coded label; no free typing needed to mark a dose or report a symptom | Manual on a phone |
| NFR-11 | Usability | Tier results use colour **and** icon **and** text (never colour alone) | Review |
| NFR-12 | Accessibility | Font ≥ 16 px on patient pages; contrast ratio ≥ 4.5 : 1 | Lighthouse |
| NFR-13 | Time | All times stored in UTC, shown in IST (Asia/Kolkata). "Today" means the IST day | Tests around midnight |
| NFR-14 | Maintainability | The rule set and protocol templates are data files with source citations; `computeRiskBand` is a single function (the future ML hook) | Review |
| NFR-15 | Quality | Unit tests for the rule engine, dose generation, follow-up generation, risk band and the cron sweep; integration tests for AC-1, AC-4, AC-6, AC-8 | `npm test` |
| NFR-16 | Deploy | Client on Vercel, server on Render, DB on MongoDB Atlas; a live URL works for someone outside the team | Week 10 test |
| NFR-17 | Browser | Latest Chrome (Android + desktop) and Edge | Manual |
| NFR-18 | Errors | API errors use one JSON shape: `{ "error": { "code", "message", "fields"? } }` with correct status codes (400 / 401 / 403 / 404 / 409 / 500) | Review |

---

## 7. Success metrics (for the demo and the viva)

These are measured on seed data. Don't claim clinical results; there is no real-world trial.

| Metric | Target |
|---|---|
| All "done when" tests from §5 (AC-1, 4, 6, 8, 12, 13) pass | 6 / 6 |
| Rule engine unit tests: every rule has at least one test where it fires and one where it doesn't | 100 % of rules |
| The 3-minute demo script (30-day journey) runs end to end on the live URL without errors | Yes |
| Share of seeded escalations whose triggering rule is shown in the UI | All |
| Patient pages with complete hi + gu translations | 7 / 7 |

---

## 8. Dependencies, assumptions and risks

### Assumptions
- A1. Clinician accounts are seeded (no admin role).
- A2. The patient–clinician link is the plan's `clinicianId`. An escalation is assigned to that clinician.
- A3. One active plan per patient at a time.
- A4. The app runs online. If the network drops, the page shows an error and the patient retries.
- A5. Emergency guidance points to **108**, India's emergency number. The app never gives a diagnosis.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Red-flag rules or protocols look invented | Examiner doubts clinical validity | Every rule and protocol cites a published source (§9); the app says it supports, not replaces, the clinician |
| Timezone bugs (UTC vs IST) break "today's doses" and the cron | Wrong doses shown or missed | NFR-13; tests at 23:30 and 00:30 IST |
| Partner's pages blocked waiting for APIs | Schedule slip | API contract in `11-build-layout.md` is agreed in Week 1; mock JSON until the API is ready |
| Render free tier sleeps, so the cron doesn't run | Missed doses not detected in the demo | A demo button / script that runs the sweep on demand (clinician-only or dev-only) |
| Translation quality in hi / gu | Confusing labels | Native speaker checks the labels; keep sentences short |
| Scope creep toward future-scope features | MVP unfinished | This PRD's non-goals (§2.2); stretch only after AC-12 passes |

---

## 9. Open decisions (⚑) — the team must decide these

> **Update 2026-09-30:** all twelve were decided while building the MVP; see `DECISIONS.md` (each marked "chosen by AI, review").

Each one needs a short entry in `docs/DECISIONS.md` (option chosen, option rejected, why).

| # | Decision | Needed by | Options |
|---|---|---|---|
| D1 | Which patients a clinician can see (FR-1.9) | Week 2 | Own plans only / all patients |
| D2 | JWT lifetime; refresh token or not (FR-1.5) | Week 2 | e.g. 1 day, no refresh / 15 min + refresh |
| D3 | Follow-up protocol templates (FR-2.9) | Week 3 | Per protocol: list of `{ dayOffset, type, description }` + source |
| D4 | Timing-slot clock times (FR-2.10) | Week 3 | Fixed (08/13/18/22 h) / per prescription |
| D5 | New plan while one is active; editing after save (FR-2.8, 2.12) | Week 3 | Block / auto-complete old · status-only / regenerate future doses |
| D6 | Grace window, cron interval, missed-dose tier (FR-3.4, 3.5) | Week 5 | e.g. 2 h, 15 min, urgent |
| D7 | Adherence window (FR-3.8) | Week 5 | Whole plan / last 7 days |
| D8 | Symptom code list; red flags as codes or free text (FR-4.1, 8.4) | Week 6 | Fixed code list recommended so rules and i18n both work |
| D9 | The rule set: IDs, conditions, tiers, sources (FR-4.10) | Week 6 | Per protocol |
| D10 | Can open → resolved skip acknowledge (FR-5.7) | Week 7 | Yes / no |
| D11 | Risk-band thresholds (FR-6.1) | Week 8 | Points system / decision table |
| D12 | Merge Escalation Detail into the queue (open question from Sep) | Week 6 | Separate page (current) / side panel |

---

## 10. Traceability

| Requirement group | Use case (diagram) | Pages | Entities | Week |
|---|---|---|---|---|
| FR-1 Auth | Register, Login | 1, 2 | User, Patient | 2 |
| FR-2 Plan | Create Discharge Plan «include» Generate Follow-up & Dose Schedule | 13 | DischargePlan, Prescription, Medication, FollowUp, AdherenceRecord | 3–4 |
| FR-3 Adherence | Mark Dose Taken; Detect Missed Doses «extend» Raise Escalation | 3, 5 | AdherenceRecord, Escalation | 5 |
| FR-4 Symptoms | Report Symptom «include» Evaluate Red-Flag Rules «extend» Raise Escalation | 6 | SymptomLog, Escalation | 6–7 |
| FR-5 Escalations | Manage Escalation Queue | 9, 10 | Escalation | 6–7 |
| FR-6 Dashboard | View Dashboard & Patient Details | 8, 11, 12 | all (read) | 8 |
| FR-7 Info pages | View Care Plan & Follow-ups | 3, 4, 7 | DischargePlan, FollowUp | 5, 10 |
| FR-8 Languages | (all patient use cases) | 1–7 | User.preferredLanguage | 9 |
| FR-9 Seed | — | — | all | 9 |
