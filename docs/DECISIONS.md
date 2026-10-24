# Decisions

Every real design decision, with the option rejected and why (root README, guardrail 4).
Decisions 1–7 were locked on 2026-09-17 (see `README.md` in this folder). D1–D12 were left
open in `10-prd.md` §9. On **2026-09-30** the student asked the AI assistant to build the whole
MVP, so the assistant chose them. **Each one is marked "chosen by AI, review".** Change any of them,
and the code location is listed so you know where.

## Open decisions from the PRD (D1–D12)

| # | Decision | Chosen | Rejected | Why | Where in code |
|---|---|---|---|---|---|
| D1 | Which patients a clinician can see | Only patients they have written a plan for; plus an **exact** phone/ABHA lookup to find a new patient for a first plan | All patients | Least privilege: a doctor can't browse other doctors' patients | `server/src/middleware/auth.js` `canAccessPatient`, `patientService.lookupPatient` |
| D2 | Login token | JWT, 1 day, no refresh token | 15 min + refresh token | Simpler for an MVP; the user logs in again the next day | `JWT_EXPIRES_IN` in `.env` |
| D3 | Follow-up templates | One template per protocol, each citing a guideline (NICE NG106, ADA 2025, KDIGO 2024, NICE NG125, NICE NG27) | Free-form follow-ups typed by the clinician | Automatic scheduling was the point of outcome 1; citations make the choice defensible | `server/src/rules/protocols.js` |
| D4 | Dose clock times (IST) | Morning 08:00 · afternoon 13:00 · evening 18:00 · night 21:00 | A time per prescription | One simple rule the patient can learn; the sun-path home screen is built on it | `server/src/utils/time.js` `SLOT_TIMES` (and `client/src/lib/format.js`) |
| D5 | New plan while one is active; editing | One active plan per patient (409 otherwise). After saving, only the **status** changes (completed / readmitted / lost to follow-up); closing deletes future pending doses | Editing a saved plan and regenerating doses | Regenerating doses that a patient has already marked is error-prone; close and write a new plan instead | `planService.createPlan`, `changePlanStatus` |
| D6 | Missed dose | Cron every 15 min; missed 120 min after its time; a missed **critical** dose raises an **urgent** escalation | 60 min grace / teleconsult tier | Leaves time for real life, still catches a missed diuretic the same morning | `.env`, `redFlagRules.js` `MISSED_DOSE_RULE` |
| D7 | Adherence % | taken ÷ (taken + missed) over the **whole current plan**; the patient's Medicines page shows the last 7 days | Pending doses counted as missed | A dose that isn't due yet isn't a failure | `adherenceService.js` |
| D8 | Symptoms and red flags | A fixed list of **12 symptom codes**; red flags are chosen from the same codes | Free text | Codes can be matched by rules **and** translated into Gujarati/Hindi; free text can't | `server/src/rules/symptomCodes.js` |
| D9 | The rule set | 22 rules (9 for all protocols + cardiac, diabetes, CKD, post-surgical), each with a cited source. **Demo rules, not clinically validated.** | ML triage | Every alert must be explainable rule by rule | `server/src/rules/redFlagRules.js` |
| D10 | Resolve without acknowledging | Not allowed: open → acknowledged → resolved (with notes) | Allow open → resolved | The acknowledged time shows how fast someone responded | `escalationService.js` |
| D11 | Risk band | Points: adherence < 60 % +2, 60–79 % +1; 2+ open escalations +2, 1 open +1; first 7 days +1; **any open emergency +3**. 3+ = high, 1–2 = moderate, 0 = low. Only for patients with an **active** plan | A weighted formula / ML | Explainable: the dashboard lists the reason for every point | `server/src/services/riskBand.js` |
| D12 | Escalation Detail | Kept as a separate page (`/d/escalations/:id`) | Side panel in the queue | Simpler to build and to link from the dashboard and patient page | `client/src/pages/clinician/EscalationDetail.jsx` |

## Decisions made while building (2026-09-30, chosen by AI, review)

| # | Decision | Rejected | Why |
|---|---|---|---|
| B1 | Plan save is all-or-nothing using a **manual rollback** (delete what was written if a step fails) | MongoDB transactions | Transactions need a replica set; the local MongoDB is standalone. Atlas would support them. |
| B2 | Doses before the moment the plan is saved are **not generated** | Generate all doses from discharge day | Otherwise saving a plan at 3 pm marks that morning's dose missed at once and raises a false alert |
| B3 | A dose can be marked from 1 h before its time until the grace window closes; marking twice is harmless | Any time | Stops marking tomorrow's dose today and stops late marks racing the missed-dose sweep |
| B4 | The sweep creates the escalation **before** marking the dose missed; a unique index allows one escalation per dose | Mark first, then escalate | If the server crashes in between, the next run still escalates, and never twice |
| B5 | A patient with no plan can still report symptoms; the report is kept and the result screen says no doctor could be reached | Block reporting | A report is never lost; the patient still gets "call 108" advice |
| B6 | Queue order: tier → **open before acknowledged** → oldest first | Tier → oldest first (PRD FR-5.1) | An acknowledged alert already has someone on it; a new open one mustn't be buried under it |
| B7 | Calendar dates stored as midnight UTC; instants shown in IST | Store everything in IST | A date means a day, not a moment, so it must never shift by 5:30 h |
| B8 | Clinician accounts come from the seed script | Admin role / clinician self-sign-up | The design has no admin role (doc 06) |
| B9 | Routes call services directly (no controllers layer); all routes in one `routes.js` | routes/ + controllers/ folders | The controllers would only forward the request; one file of ~150 lines is easier to read |
| B10 | API field names use the data-dictionary keys (`planId`, `userId`…) instead of Mongo's `_id` | Expose `_id` | Keeps the API, the DD, the ER and the class diagram using the same names |
| B11 | Patient pages use emoji icons | Custom SVG icon set | Available on every phone, recognisable without reading, no extra files |
| B12 | Fonts: Baloo 2 / Baloo Bhai 2 (headings), Hind / Hind Vadodara (text) | Generic system fonts | Designed for Devanagari and Gujarati, so all three languages look native |
