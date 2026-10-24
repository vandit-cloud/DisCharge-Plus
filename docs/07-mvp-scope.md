# 7. MVP Scope

> **Status:** Decided 2026-09-23. This document narrows the full design (documents 01–06)
> to what will actually be built for the minor-project demo. Where it conflicts with
> earlier documents, **this document wins for the MVP**; the earlier documents remain
> the full-vision design and the source for "Further Work".

## 7.1 Constraints that shaped the cut

| Constraint | Value |
|---|---|
| Time | 2–3 months (≈ 10 build weeks + 2 buffer) |
| Team | 2 people, one carrying most of the work |
| Graded as | BCA Sem 5 minor project (analysis & design + working demo) |
| Decision | ML risk model → **future scope**. Offline sync → **future scope**. |

## 7.2 What the MVP is, in one sentence

A clinician turns a discharge into a tracked care plan; the patient follows it and reports
symptoms in their own language; red-flag symptoms and missed critical doses are escalated
to the clinician by a rule engine, and the clinician sees who needs attention today.

## 7.3 In scope vs. moved to future scope

| Area | MVP | Future scope |
|---|---|---|
| Roles | `patient`, `clinician` | `caregiver`, `health_worker` |
| Discharge plan | Create plan, prescriptions, red flags, protocol | Allergy-conflict warnings |
| Follow-ups | Auto-generated from protocol + discharge date; mark completed | Teleconsult integration |
| Adherence | Patient marks doses; cron job marks missed; missed **critical** dose escalates | SMS / WhatsApp reminders |
| Symptoms & escalation | Icon-based form, **rule engine**, 4 tiers, clinician queue | Voice notes, on-call re-routing |
| Risk | **Rule-based risk band** (computed, not stored) on dashboard | ML model + SHAP (`ml-svc`) |
| Language | Patient pages in English, Hindi, Gujarati (UI labels + care-plan text) | Education library, TTS audio, LLM plain-language |
| Schemes | *Stretch goal* — PM-JAY rule check | Gujarat state schemes, hospital lookup |
| Interoperability | `abhaId` field on Patient (stored, format-validated) | FHIR export, ABDM sandbox, consent artefacts |
| Offline | — | PWA, IndexedDB, sync outbox, conflict review |
| Compliance | JWT + bcrypt, role + ownership checks | Full audit log |

## 7.4 Architecture change

The Python service is **not built** in the MVP. The system becomes two services:

```
client/   React + Vite + Tailwind       ← patient pages + clinician dashboard
server/   Node + Express + MongoDB      ← auth, plans, adherence, rule engine, cron
(ml-svc/  deferred to future scope)
```

The rule-based risk band sits behind a single server function (`computeRiskBand(patient)`),
so a future ML service can replace it without changing the dashboard.

## 7.5 Data entities — 9 (from 18)

| # | Entity | Why it stays |
|---|---|---|
| 1 | `User` | Login + role |
| 2 | `Patient` | Profile, `preferredLanguage`, `abhaId` |
| 3 | `DischargePlan` | The care contract; holds red flags + protocol |
| 4 | `Medication` | Master drug list |
| 5 | `Prescription` | Junction: plan ↔ medication, dose, timing, `isCritical` |
| 6 | `FollowUp` | Generated schedule |
| 7 | `AdherenceRecord` | One row per scheduled dose |
| 8 | `SymptomLog` | Report + `triageTier` + `triggeredRules` |
| 9 | `Escalation` | Source = symptom or missed dose; tier; status |

*Stretch:* `Scheme`, `SchemeEligibilityCheck` (→ 11).
*Deferred:* `CaregiverAssignment`, `RiskAssessment`, `EducationContent`, `ScreeningRecord`,
`ConsentArtefact`, `Notification`, `AuditLog`.

## 7.6 Pages — 13 (from 28)

| # | Page | Role | Replaces (doc 06 #) |
|---|---|---|---|
| 1 | Login | both | 1, 2 |
| 2 | Register | patient | 3 |
| 3 | Patient Home — today's doses + "I feel unwell" | patient | 5 |
| 4 | My Care Plan | patient | 6 |
| 5 | My Medicines | patient | 7 |
| 6 | Report Symptom (result shown as final step) | patient | 8, 9 |
| 7 | Follow-ups | patient | 10 |
| 8 | Clinician Dashboard — risk bands, open escalations, overdue follow-ups | clinician | 16, 23 |
| 9 | Escalation Queue | clinician | 17 |
| 10 | Escalation Detail | clinician | 18 |
| 11 | Patient List | clinician | 19 |
| 12 | Patient Detail — plan, adherence, symptoms | clinician | 20 |
| 13 | Discharge Plan Editor | clinician | 21 |

Language switch and logout live in the header, so Settings is not a separate page.
*Stretch:* 14 — Scheme Navigator.

## 7.7 Expected-outcome coverage (honest)

| # | Outcome | MVP coverage |
|---|---|---|
| 1 | Follow-up Management | **Full** |
| 2 | Automated Escalation | **Full** |
| 3 | Localized Education | Partial — UI and plan text in 3 languages; no content library or audio |
| 4 | Scheme Navigation | Stretch goal |
| 5 | Interoperability | Minimal — ABHA ID field only |
| 6 | Offline Field Capabilities | Future scope |
| 7 | Clinical Impact | Partial — adherence and escalation metrics; no predictive model |

## 7.8 Build plan

Split: **Lead** = backend, data model, rule engine. **Partner** = React pages against agreed API contracts.

| Week | Lead | Partner | Done when |
|---|---|---|---|
| 1 | Repo, 2 services boot, finalise 9 schemas | Vite + Tailwind + routing skeleton | Both services return a health check |
| 2 | Auth, JWT, role + ownership middleware | Login, Register | Patient A cannot read patient B |
| 3–4 | Discharge plan API, follow-up + dose-schedule generation | Discharge Plan Editor | Saving a plan creates follow-ups and doses |
| 5 | Adherence API, cron missed-dose sweep, critical-dose escalation | Patient Home, My Medicines | Unmarked critical dose → escalation |
| 6–7 | Symptom API + **red-flag rule engine** + tiers | Report Symptom, Escalation Queue/Detail | Chest pain post-cardiac → emergency, top of queue |
| 8 | Risk band, dashboard aggregation | Dashboard, Patient List/Detail | "Who needs attention today?" in one view |
| 9 | Input validation, seed script (synthetic patients) | i18n: en / hi / gu on patient pages | Same plan renders in 3 languages |
| 10 | Tests on rule engine + critical paths; deploy | Care Plan, Follow-ups, polish | A stranger can use the live URL |
| 11–12 | Buffer → stretch: scheme check | Buffer → PPT diagrams | — |

## 7.9 Future scope (Slide 10)

1. ML readmission / adherence risk with SHAP explanations (`ml-svc`)
2. Offline field screening with sync (health-worker role)
3. Caregiver role with proxy reporting and alerts
4. SMS / WhatsApp reminders
5. ABDM integration: FHIR export, consent artefacts, audit log
6. Education library with text-to-speech; PM-JAY + state scheme navigator
