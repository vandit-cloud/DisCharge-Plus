# 1. Project Profile

## 1.1 Identification

| Field | Detail |
|---|---|
| **Project Title** | DisCharge+ |
| **Subtitle** | An AI-enabled post-discharge continuity-of-care platform for rural & remote patients |
| **Submitted as** | Minor Project |
| **Event** | TetraTHON 2026 — Indo-French AI Innovation Sprint |
| **Organised by** | Navrachana Innovation Foundation, Navrachana University, Vadodara |
| **In collaboration with** | ISEN Méditerranée, France |
| **Context** | Franco-Indian Year of Innovation |
| **Track** | A — HealthTech |
| **Problem Statement** | 2 — AI-Based Continuity of Care Platform for Rural & Remote Patients |
| **Document date** | 17 September 2026 |

## 1.2 Problem Context

Discharge from hospital is treated as the end of an episode of care. For rural and
remote patients it is where care most often breaks down.

Once a patient leaves the ward, the clinical relationship becomes effectively
asynchronous and unmonitored. Follow-up appointments require travel the patient
cannot easily afford. Discharge instructions are issued in a language and at a
reading level the patient may not share. Deterioration between discharge and the
first follow-up goes unnoticed until it becomes an emergency. Financial protection
schemes the patient is entitled to go unclaimed because nobody explains eligibility.
Health workers conducting village screening camps operate where there is no network
at all.

The result is a well-documented pattern of avoidable readmissions, poor medication
adherence, and patients lost to follow-up entirely — concentrated among exactly the
population least able to absorb the cost.

## 1.3 Proposed Solution

DisCharge+ is a three-service platform that extends the clinical relationship past
the hospital door. It converts a discharge summary into an active, monitored,
multilingual care plan, and gives clinicians a risk-stratified view of every
discharged patient so attention reaches whoever needs it most.

The system combines:

- **Rule-based reasoning** for clinical escalation and scheme eligibility, where
  decisions must be auditable and explainable criterion by criterion;
- **Machine learning** for readmission and adherence risk, with SHAP explanations
  so no prediction is a black box;
- **Offline-first architecture** so field screening works with no connectivity and
  reconciles later.

## 1.4 Objectives

| # | Objective | Maps to expected outcome |
|---|---|---|
| O1 | Generate and track a structured post-discharge follow-up calendar automatically from the discharge plan | Follow-up Management |
| O2 | Monitor patient-reported symptoms and auto-escalate clinical red flags to a triaged clinician queue | Automated Escalation |
| O3 | Deliver condition-specific patient education in English, Hindi and Gujarati, with audio for non-readers | Localized Education |
| O4 | Determine PM-JAY and Gujarat state scheme eligibility, and explain the verdict criterion by criterion | Scheme Navigation |
| O5 | Structure health records to be ABDM-compatible, with ABHA identity and FHIR-shaped export | Interoperability |
| O6 | Provide a rural screening module that functions fully offline and syncs without duplication | Offline Field Capabilities |
| O7 | Predict readmission and adherence risk with explainable models, and measure care outcomes | Clinical Impact |

## 1.5 Scope

**In scope**

- Discharge plan authoring by clinicians; automatic follow-up calendar generation
- Medication schedules, dose-level adherence tracking, SMS and in-app reminders
- Patient symptom reporting designed for low-literacy users (icons, voice, vernacular)
- Rule-based clinical escalation with four severity tiers
- Readmission-risk and adherence-risk ML models with SHAP explainability
- Multilingual education content with clinician review workflow
- Government scheme eligibility engine with per-criterion explanation
- Offline-capable PWA screening module with a sync outbox
- ABHA identity fields, consent artefacts, FHIR-shaped record export
- Clinician dashboard with cohort risk stratification and impact metrics
- Role-based access control across four roles, with a full audit trail

**Out of scope**

- Hospital Information System or EMR replacement
- Diagnostic device functionality — the system supports care, it does not practise medicine
- Production clinical certification; no real patient data is processed at any stage
- Multi-tenant SaaS deployment
- Direct hardware/medical-device integration
- Billing, claims processing, or payment settlement

## 1.6 Stakeholders

| Stakeholder | Role in the system | Primary need |
|---|---|---|
| **Patient** | Primary user | Understand and follow the care plan; report deterioration easily |
| **Caregiver** | Proxy user | Act for patients who cannot use the app; receive alerts |
| **Clinician** | Decision maker | See which discharged patients need attention today |
| **Health Worker (ASHA/ANM)** | Field operator | Screen patients in villages with no connectivity |
| **Hospital administration** | Indirect beneficiary | Reduced avoidable readmissions |
| **Government (NHA / ABDM)** | Standards authority | Interoperable, consent-governed records |

## 1.7 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | Component model; PWA and offline capability |
| Client state | TanStack Query | Server-state caching — correct primitive for offline-first |
| Offline store | IndexedDB via Dexie.js | Local-first writes with a sync queue |
| Internationalisation | i18next | English, Hindi, Gujarati |
| Backend | Node.js + Express | REST API, middleware, service orchestration |
| Database | MongoDB + Mongoose | Flexible schema for heterogeneous clinical data |
| ML service | Python + FastAPI | Access to the scientific ML ecosystem |
| ML libraries | scikit-learn, pandas, NumPy | Model training and evaluation |
| Explainability | SHAP | Per-prediction factor attribution — mandated, not optional |
| Authentication | JWT + bcrypt | Stateless auth with four-role RBAC |
| Notifications | Twilio / MSG91 (SMS), WhatsApp (later) | SMS reaches populations smartphones do not |
| Scheduling | node-cron | Reminder and follow-up jobs |
| Deployment | Vercel, Render, MongoDB Atlas | Three independently deployable services |

**Architectural rationale for three services:** the ML workload requires the Python
scientific stack, while the transactional API is better served by Node's I/O model.
Separating them enforces an explicit API contract between components and allows each
to be deployed and scaled independently.

## 1.8 Modules

| # | Module | Description |
|---|---|---|
| M1 | Authentication & Authorisation | Registration, login, JWT issuance, four-role RBAC, audit logging |
| M2 | Patient Record Management | ABDM-shaped demographics, ABHA identity, consent artefacts |
| M3 | Discharge Plan Management | Plan authoring, prescriptions, protocol-driven follow-up generation |
| M4 | Adherence & Reminder Engine | Dose scheduling, adherence capture, multi-channel reminders |
| M5 | Symptom Monitoring & Escalation | Symptom capture, red-flag rule engine, tiered clinician queue |
| M6 | ML Risk Service | Readmission and adherence models, SHAP explanations, versioned inference |
| M7 | Patient Education | Multilingual content library, reading-level control, TTS, clinician review |
| M8 | Scheme Navigator | PM-JAY and state eligibility rules, explainable verdicts, document checklists |
| M9 | Offline Screening | PWA, IndexedDB store, sync outbox, conflict flagging |
| M10 | Interoperability | FHIR-shaped export, ABHA validation, consent enforcement |
| M11 | Clinician Dashboard | Cohort risk view, adherence trends, escalation response metrics |

## 1.9 Expected Outcomes

- A clinician can identify, in a single view, which of their discharged patients
  require intervention today.
- A patient receives their discharge instructions in their own language, at a
  reading level they can act on, with audio where literacy is a barrier.
- A clinical red flag reported by a patient reaches a clinician within seconds,
  with the triggering rules stated explicitly.
- A health worker can screen patients in a village with no network and sync the
  records later without creating duplicates.
- Every risk prediction is accompanied by the specific factors that produced it.
- Every access to a patient record is logged and attributable.

## 1.10 Constraints and Assumptions

**Constraints**

- No real patient data may be used; all data is synthetic and labelled as such
- ABDM sandbox access may be unavailable, in which case interoperability is
  demonstrated against a documented mock
- SMS delivery depends on third-party gateway availability and credits
- Free-tier deployment imposes cold starts and resource limits

**Assumptions**

- Patients or their caregivers have access to at least a basic mobile phone with SMS
- Health workers' devices have intermittent, not permanent, connectivity
- Clinicians access the dashboard from a device with a stable connection
- Clinical red-flag rules are sourced from published protocols and cited

## 1.11 Limitations

The system does not diagnose. Risk scores are decision support, not clinical verdicts,
and are trained on synthetic or public datasets that do not represent the target
population's true distribution. Reported impact figures are estimates derived from
system-recorded behaviour, not from a controlled trial, and are presented as such.
