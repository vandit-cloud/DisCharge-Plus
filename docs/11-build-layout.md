# 11. Build Layout — what gets built for the MVP, and where

> **Status: built on 30 Sep 2026.** Companion to `10-prd.md` (requirements `FR-x.y` are
> referenced throughout). Scope comes from `07-mvp-scope.md`; field names come from
> `08-phase1-data-dictionary.md`. Decisions D1–D12 and the ones made while building are in
> `DECISIONS.md`.
>
> **As built, compared with the first draft of this file:**
> - Routes call services directly: one `server/src/routes.js`, no `controllers/` folder (DECISIONS B9).
> - `GET /plans/:planId` was dropped (plans aren't edited after saving, D5). Added `GET /meta`
>   (symptom codes + protocol defaults for forms) and `GET /patients/lookup?q=` (exact phone/ABHA, D1).
> - Validation uses zod (`server/src/validation.js`) instead of express-validator.
> - The risk band also takes the number of open emergencies (D11) and returns its reasons.
> - Vite's dev server proxies `/api` to the API, so no CORS setup is needed in development.
>
> **What's here:** §1 system at a glance · §2 repo and folder layout · §3 API contract ·
> §4 server internals · §5 client routes and components · §6 page-by-page layouts (13 wireframes) ·
> §7 end-to-end flows · §8 week-by-week checklist · §9 who writes what.

---

## 1. System at a glance

```
┌─────────────────────────────── client/ (React + Vite + Tailwind) ───────────────────────────────┐
│  Patient pages  /p/*   (mobile, en/hi/gu)          Clinician pages  /d/*   (desktop, en)         │
│  Home · Care Plan · Medicines · Report Symptom     Dashboard · Escalation Queue · Escalation     │
│  · Follow-ups                                      Detail · Patient List · Patient Detail ·      │
│                                                    Discharge Plan Editor                          │
│  Shared: Login · Register · Header (language switch, logout) · api client (adds the JWT)         │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │ HTTPS · REST · JSON · Authorization: Bearer <JWT>
┌──────────────────────────────────────────────▼──────────────────────────────────────────────────┐
│  server/ (Node + Express)                                                                         │
│  middleware:  requireAuth → requireRole → requireOwnership → validate                            │
│  routes → controllers → services:                                                                 │
│     auth · plans (+ followUpGenerator, doseGenerator) · adherence · symptoms (+ ruleEngine)       │
│     · escalations · dashboard (+ computeRiskBand)                                                 │
│  jobs/missedDoseSweep  (node-cron, every ⚑ min)                                                   │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │ Mongoose
                          ┌────────────────────▼────────────────────┐
                          │ MongoDB Atlas — 9 collections            │
                          │ users · patients · dischargeplans ·      │
                          │ medications · prescriptions · followups ·│
                          │ adherencerecords · symptomlogs ·         │
                          │ escalations                              │
                          └──────────────────────────────────────────┘
```

---

## 2. Repository layout

The old `DishCharge+/docs` folder was merged into `docs/` (2026-09-30), so the repo root is the project.

```
DisCharge+/
├── README.md                      Project README (moved up from E:\Minor Project)
├── .gitignore                     node_modules, .env, dist, coverage
├── docs/                          All design docs (01–11), diagrams/, presentation/
│   ├── LEARNING_LOG.md            One entry per working session (README format)
│   └── DECISIONS.md               One entry per ⚑ decision: chosen, rejected, why
│
├── server/
│   ├── package.json               express, mongoose, jsonwebtoken, bcrypt, node-cron,
│   │                              express-validator (or zod), express-rate-limit, cors, dotenv
│   │                              dev: nodemon, vitest (or jest), supertest, mongodb-memory-server
│   ├── .env.example               PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_ORIGIN,
│   │                              CRON_SCHEDULE, DOSE_GRACE_MINUTES, TZ=Asia/Kolkata
│   ├── src/
│   │   ├── index.js               Load env, connect DB, start app, start cron
│   │   ├── app.js                 Express app: cors, json, routes, 404, error handler
│   │   ├── config/
│   │   │   ├── env.js             Read + check env vars once
│   │   │   └── db.js              mongoose.connect
│   │   ├── models/                One file per entity (9)
│   │   │   ├── User.js  Patient.js  DischargePlan.js  Medication.js  Prescription.js
│   │   │   └── FollowUp.js  AdherenceRecord.js  SymptomLog.js  Escalation.js
│   │   ├── middleware/
│   │   │   ├── requireAuth.js     Verify JWT → req.user = { userId, role }       (401)
│   │   │   ├── requireRole.js     requireRole('clinician')                       (403)
│   │   │   ├── requireOwnership.js  Is :patientId yours? (patient: own; clinician: ⚑D1) (403)
│   │   │   ├── validate.js        Run validators, turn failures into 400 {fields}
│   │   │   └── errorHandler.js    One JSON error shape (NFR-18)
│   │   ├── routes/                auth · patients · medications · plans · followups ·
│   │   │                          doses · symptoms · escalations · dashboard · health
│   │   ├── controllers/           Thin: read req → call service → send res
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── planService.js             Create plan + prescriptions + generate (transaction)
│   │   │   ├── followUpGenerator.js       generateFollowUps(plan, protocolTemplate) → FollowUp[]
│   │   │   ├── doseGenerator.js           generateDoses(prescription, dischargeDate) → AdherenceRecord[]
│   │   │   ├── adherenceService.js        markTaken, getDoses, adherencePercent
│   │   │   ├── ruleEngine.js              evaluate(symptomLog, plan) → { tier, triggeredRules }
│   │   │   ├── symptomService.js          save log → evaluate → update → maybe escalate
│   │   │   ├── escalationService.js       create, list (sorted), acknowledge, resolve
│   │   │   ├── riskBand.js                computeRiskBand(patientStats) → 'low'|'moderate'|'high'
│   │   │   └── dashboardService.js        Aggregations for dashboard + patient list
│   │   ├── rules/
│   │   │   ├── symptomCodes.js            The fixed symptom code list (⚑D8)
│   │   │   ├── redFlagRules.js            Rule table as data, each with a source (⚑D9)
│   │   │   └── protocols.js               Follow-up templates per protocol (⚑D3)
│   │   ├── jobs/
│   │   │   └── missedDoseSweep.js         sweep(now) + cron.schedule(...)
│   │   └── utils/
│   │       ├── time.js                    IST day boundaries, slot → clock time (⚑D4)
│   │       └── httpError.js               new HttpError(404, 'PLAN_NOT_FOUND', msg)
│   ├── scripts/
│   │   └── seed.js                        Synthetic data + the Kantaben demo journey (FR-9)
│   └── tests/
│       ├── unit/        ruleEngine · doseGenerator · followUpGenerator · riskBand · sweep
│       └── integration/ auth-ownership (AC-1) · plan-create (AC-4) · sweep (AC-6) · symptom (AC-8)
│
└── client/
    ├── package.json               react, react-dom, react-router, @tanstack/react-query,
    │                              i18next, react-i18next, i18next-browser-languagedetector
    │                              dev: vite, tailwindcss, @vitejs/plugin-react
    ├── .env.example               VITE_API_URL
    ├── index.html
    └── src/
        ├── main.jsx               Router + QueryClientProvider + i18n init
        ├── App.jsx                Route table (§5.1)
        ├── lib/
        │   ├── api.js             fetch wrapper: base URL, JWT header, JSON errors → throw
        │   ├── auth.jsx           AuthContext: token, user, login(), logout()
        │   └── format.js          Dates in IST, tier → colour/icon
        ├── i18n/
        │   ├── index.js
        │   └── locales/{en,hi,gu}.json    ui.*, symptom.*, redFlag.*, tier.*, slot.*, followUpType.*
        ├── components/
        │   ├── layout/   Header · LanguageSwitch · PatientShell (bottom nav) · ClinicianShell (sidebar)
        │   ├── guards/   RequireRole (redirects to /login or the other role's home)
        │   ├── common/   Button · Card · Badge · TierBadge · RiskBadge · EmptyState · ErrorBanner · Spinner
        │   ├── patient/  DoseCard · SymptomIconGrid · SeverityScale · TriageResult · FollowUpItem
        │   └── clinician/ EscalationRow · PatientRow · StatTile · PrescriptionRow · Tabs
        ├── hooks/        useMe · usePatientDoses · usePlan · useEscalations · useDashboard …
        └── pages/
            ├── Login.jsx  Register.jsx
            ├── patient/   Home.jsx  CarePlan.jsx  Medicines.jsx  ReportSymptom.jsx  FollowUps.jsx
            └── clinician/ Dashboard.jsx  EscalationQueue.jsx  EscalationDetail.jsx
                           PatientList.jsx  PatientDetail.jsx  PlanEditor.jsx
```

---

## 3. API contract

Base URL: `/api`. JSON only. Auth header: `Authorization: Bearer <token>`.
Errors: `{ "error": { "code": "VALIDATION_FAILED", "message": "…", "fields": { "phone": "…" } } }`.

**Legend** — Auth: `—` public · `P` patient · `C` clinician · `P*` patient, own records only ·
`C*` clinician, patients they may see (⚑D1).

### 3.1 Endpoints

| # | Method & path | Auth | Purpose | FR | Used by page |
|---|---|---|---|---|---|
| 1 | `GET /health` | — | `{ status: "ok", db: "up" }` | — | — |
| 2 | `POST /auth/register` | — | Create User (patient) + Patient → token | 1.1–1.4 | 2 Register |
| 3 | `POST /auth/login` | — | Phone + password → token + user | 1.5 | 1 Login |
| 4 | `GET /auth/me` | P, C | Current user (+ `patientId` if patient) | 1.6 | all (header, guards) |
| 5 | `PATCH /auth/me` | P, C | Change `preferredLanguage` | 8.3 | header |
| 6 | `GET /patients?search=&risk=` | C | Patient list rows incl. risk band | 6.3 | 11 |
| 6a | `GET /patients/lookup?q=` | C | Exact phone / ABHA lookup for a first plan (D1) | 2.1 | 13 |
| 6b | `GET /meta` | P, C | Symptom codes and protocol defaults for forms | 2.2, 4.1 | 13 |
| 7 | `GET /patients/:patientId` | P*, C* | Patient profile + summary stats | 6.4 | 12 |
| 8 | `GET /patients/:patientId/plan` | P*, C* | Active plan + prescriptions (medication populated) | 7.1, 3.7 | 4, 5, 12 |
| 9 | `GET /patients/:patientId/followups` | P*, C* | Follow-ups, upcoming + past | 7.2 | 3, 7, 12 |
| 10 | `GET /patients/:patientId/doses?from=&to=` | P*, C* | AdherenceRecords in a date range (default: today IST) | 3.1, 3.7 | 3, 5, 12 |
| 11 | `GET /patients/:patientId/adherence` | P*, C* | `{ percent, taken, missed, window }` | 3.8 | 5, 12 |
| 12 | `GET /patients/:patientId/symptoms` | P*, C* | SymptomLogs, newest first | 6.4 | 12 |
| 13 | `PATCH /doses/:adherenceId` | P* | `{ status: "taken" }` → recordedAt set | 3.2, 3.3 | 3 |
| 14 | `POST /symptoms` | P | `{ symptoms[], severity }` → `{ symptomLog, escalation? }` | 4.1–4.9 | 6 |
| 15 | `GET /medications?q=` | C | Search master list | 2.5 | 13 |
| 16 | `POST /medications` | C | Add a medicine | 2.7 | 13 |
| 17 | `POST /plans` | C | Plan + prescriptions → generates follow-ups + doses | 2.2–2.11 | 13 |
| 19 | `PATCH /plans/:planId` | C (author) | Close the plan: completed / readmitted / lost_to_followup (D5) | 2.12, 2.13 | 12 |
| 20 | `PATCH /followups/:followUpId` | C* | `{ status: "completed" }` | 6.5 | 12 |
| 21 | `GET /escalations?status=&tier=&patientId=` | C | Queue, sorted tier desc then createdAt asc | 5.1–5.3 | 8, 9, 12 |
| 22 | `GET /escalations/:escalationId` | C* | Detail with source record populated | 5.5 | 10 |
| 23 | `PATCH /escalations/:escalationId/acknowledge` | C* | open → acknowledged | 5.6 | 10 |
| 24 | `PATCH /escalations/:escalationId/resolve` | C* | → resolved, `{ notes }` required | 5.7 | 10 |
| 25 | `GET /dashboard` | C | Band counts, top-risk patients, open escalations by tier, overdue follow-ups | 6.2 | 8 |
| 26 | `POST /dev/run-sweep` | C (dev/demo only) | Run the missed-dose sweep now (Render free tier sleeps) | 3.4 | demo |

**Why patient routes are nested under `/patients/:patientId`:** both roles use the same URL
shape and one `requireOwnership` middleware protects them all. That middleware is exactly
what the Week 2 test (AC-1) exercises.

### 3.2 Example payloads (shapes, not final)

**`POST /auth/login`**
```json
// request
{ "phone": "+919876543210", "password": "••••••••" }
// 200
{ "token": "eyJ…", "user": { "userId": "…", "fullName": "Kantaben Rathwa", "role": "patient",
  "preferredLanguage": "gu", "patientId": "…" } }
```

**`POST /plans`**
```json
{
  "patientId": "…",
  "admissionDate": "2026-10-01",
  "dischargeDate": "2026-10-06",
  "primaryDiagnosis": "Heart failure (HFrEF) with type 2 diabetes",
  "redFlags": ["BREATHLESS", "CHEST_PAIN", "SWELLING_LEGS"],
  "followUpProtocol": "cardiac",
  "prescriptions": [
    { "medicationId": "…", "dosage": "1 tablet", "frequency": "OD",
      "timingSlots": ["morning"], "durationDays": 30, "isCritical": true },
    { "medicationId": "…", "dosage": "1 tablet", "frequency": "BD",
      "timingSlots": ["morning", "night"], "durationDays": 30, "isCritical": false }
  ]
}
// 201
{ "plan": { "planId": "…", "status": "active", … },
  "generated": { "followUps": 4, "doses": 90 } }
```

**`POST /symptoms`**
```json
// request
{ "symptoms": ["BREATHLESS", "SWELLING_LEGS"], "severity": 4 }
// 201
{ "symptomLog": { "symptomLogId": "…", "triageTier": "urgent",
                  "triggeredRules": ["CARD_BREATHLESS_SEV3"] },
  "escalation": { "escalationId": "…", "tier": "urgent", "status": "open" } }
// escalation is null when triageTier = self_care
```

**`GET /dashboard`**
```json
{
  "riskBands": { "high": 3, "moderate": 7, "low": 10 },
  "topRisk": [ { "patientId": "…", "fullName": "…", "band": "high",
                 "adherencePercent": 62, "openEscalations": 2, "daysSinceDischarge": 6 } ],
  "openEscalations": { "emergency": 1, "urgent": 2, "teleconsult": 4, "items": [ … top 5 … ] },
  "overdueFollowUps": [ { "followUpId": "…", "fullName": "…", "scheduledDate": "…", "type": "lab_test" } ]
}
```

### 3.3 Status codes used

| Code | When |
|---|---|
| 200 / 201 | OK / created |
| 400 | Validation failed (`fields` says which) |
| 401 | No token, bad token, expired token, wrong password |
| 403 | Right login, wrong role or not your record |
| 404 | ID doesn't exist (for records you're allowed to see) |
| 409 | Duplicate phone / ABHA; illegal status change; active plan exists (⚑D5) |
| 429 | Too many login attempts |
| 500 | Anything unexpected (logged; message hidden from the client) |

---

## 4. Server internals

### 4.1 Request pipeline (every protected route)

```
request → cors/json → requireAuth ──401──┐
                         │               │
                    requireRole ──403────┤
                         │               ├──► errorHandler → { error: {…} }
                 requireOwnership ──403──┤
                         │               │
                      validate ──400─────┤
                         │               │
                controller → service ─throw HttpError─┘
                         │
                    200 / 201 JSON
```

### 4.2 Indexes to create

| Collection | Index | Why |
|---|---|---|
| users | `{ phone: 1 }` unique | Login lookup, FR-1.2 |
| patients | `{ userId: 1 }` unique · `{ abhaId: 1 }` unique **sparse** | ABHA is optional, but unique when present |
| dischargeplans | `{ patientId: 1, status: 1 }` · `{ clinicianId: 1 }` | Active plan lookup; clinician's patients |
| medications | `{ genericName: 1 }` unique | FR-2.7 |
| prescriptions | `{ planId: 1 }` | |
| followups | `{ planId: 1, scheduledDate: 1 }` | Upcoming / overdue |
| adherencerecords | `{ prescriptionId: 1, scheduledAt: 1 }` unique · `{ status: 1, scheduledAt: 1 }` | No duplicate doses; the sweep's query |
| symptomlogs | `{ patientId: 1, reportedAt: -1 }` | |
| escalations | `{ assignedClinicianId: 1, status: 1, tier: 1, createdAt: 1 }` · `{ adherenceId: 1 }` unique **sparse** | The queue's sort; FR-3.6 idempotency |

> Question to think about before Week 5: `AdherenceRecord` has no `patientId` in the data
> dictionary. `GET /patients/:id/doses` must go patient → active plan → prescriptions → doses.
> Is that fine, or is it worth a denormalised `patientId` (like `Escalation.patientId`)? If you
> add it, the DD, ER and class diagram must change too, because the college requires them to match.

### 4.3 Generators (student-written, pure functions, unit-tested)

| Function | In | Out | Edge cases to test |
|---|---|---|---|
| `generateDoses(prescription, dischargeDate)` | durationDays, timingSlots, discharge date | Array of `{ prescriptionId, scheduledAt, status: 'pending' }` | Slots count ≠ frequency · duration 1 · a slot already past on discharge day (⚑) · IST midnight |
| `generateFollowUps(plan, template)` | dischargeDate, protocol template | Array of FollowUp | Unknown protocol · day 0 |

### 4.4 Rule engine shape

The **shape** is fixed here; the **contents** are ⚑D9 and belong to the team.

```
rule = {
  id:        'CARD_CHEST_PAIN',          // stored in triggeredRules
  protocols: ['cardiac'],                // or ['*'] for all
  tier:      'emergency',                // self_care | teleconsult | urgent | emergency
  when:      (log, plan) => boolean,     // condition on symptoms / severity / plan.redFlags
  source:    '<guideline name, year, section>'
}

evaluate(log, plan):
  candidates = rules whose protocols include plan.followUpProtocol (or '*')
  matched    = candidates where when(log, plan) is true
  tier       = highest tier in matched, else 'self_care'
  return { tier, triggeredRules: matched.map(r => r.id) }
```

### 4.5 Missed-dose sweep

```
sweep(now):
  due = AdherenceRecord where status = 'pending' and scheduledAt + grace < now
  for each dose in due:
    set status = 'missed'                 (only if still pending → safe to run twice)
    if dose.prescription.isCritical:
      create Escalation(source = missed_critical_dose, adherenceId = dose.id, …)
      (unique index on adherenceId makes a second create fail → catch and ignore)
  log { checked, markedMissed, escalationsRaised }
```

`sweep(now)` takes `now` as a parameter so the tests can pass a fake time.

### 4.6 Risk band

```
computeRiskBand({ adherencePercent, openEscalations, daysSinceDischarge }) → 'low' | 'moderate' | 'high'
```
Thresholds: ⚑D11. It takes plain numbers (not a DB document), so it's easy to unit-test and easy
to replace with a call to a future ML service.

---

## 5. Client structure

### 5.1 Routes

| Path | Page | Role | Guard |
|---|---|---|---|
| `/login` | 1 Login | public | logged-in users are sent to their home |
| `/register` | 2 Register | public | 〃 |
| `/p` | 3 Patient Home | patient | `RequireRole('patient')` |
| `/p/plan` | 4 My Care Plan | patient | 〃 |
| `/p/medicines` | 5 My Medicines | patient | 〃 |
| `/p/report` | 6 Report Symptom (steps: pick → severity → result) | patient | 〃 |
| `/p/followups` | 7 Follow-ups | patient | 〃 |
| `/d` | 8 Clinician Dashboard | clinician | `RequireRole('clinician')` |
| `/d/escalations` | 9 Escalation Queue | clinician | 〃 |
| `/d/escalations/:id` | 10 Escalation Detail | clinician | 〃 |
| `/d/patients` | 11 Patient List | clinician | 〃 |
| `/d/patients/:id` | 12 Patient Detail | clinician | 〃 |
| `/d/plans/new?patientId=` · `/d/plans/:id` | 13 Discharge Plan Editor | clinician | 〃 |
| `*` | Not found → redirect to home | — | — |

### 5.2 Shells

- **PatientShell** (mobile): header (logo · language switch · logout) + content + **bottom nav**
  with 4 icons: Home · Medicines · Plan · Follow-ups. "I feel unwell" is on Home as a big button.
- **ClinicianShell** (desktop): header + **left sidebar**: Dashboard · Escalations (badge = open count) ·
  Patients · New Plan.

### 5.3 Server data (TanStack Query keys)

| Key | Endpoint | Refetch |
|---|---|---|
| `['me']` | 4 | on login |
| `['doses', patientId, date]` | 10 | after marking a dose |
| `['plan', patientId]` | 8 | — |
| `['followups', patientId]` | 9 | after completing one |
| `['escalations', filters]` | 21 | **every 30 s (⚑)** — FR-5.4 |
| `['dashboard']` | 25 | every 60 s |
| `['patients', search, risk]` | 6 | — |

---

## 6. Page-by-page layouts

Patient pages are drawn at phone width, clinician pages at desktop width. Text in `«»` is an
i18n key example. Each box lists **data**, **actions**, **states** (loading / empty / error).

### Page 1 — Login `/login` (both roles)

```
┌──────────────────────────────┐
│  DisCharge+        [EN|हि|ગુ] │
│                              │
│   Phone  [+91 __________ ]   │
│   Password [ ___________ ]   │
│                              │
│   [        Log in        ]   │
│                              │
│   New patient? Register →    │
│  ─────────────────────────── │
│  Demo system · synthetic data│
└──────────────────────────────┘
```
- **Actions:** log in → `POST /auth/login` → store token → redirect by role (FR-1.6).
- **Errors:** wrong phone/password → one message, "Phone or password is wrong" (don't say which).
  429 → "Too many attempts, try again in 15 minutes".

### Page 2 — Register `/register` (patient)

```
┌──────────────────────────────┐
│  ← Register        [EN|हि|ગુ] │
│  Full name     [__________]  │
│  Phone         [+91 _______] │
│  Password      [__________]  │
│  Date of birth [dd/mm/yyyy]  │
│  Gender   (•)F ( )M ( )Other │
│  District      [Chhota U… ▾] │
│  Language (•)ગુજરાતી ( )हिंदी ( )English │
│  ABHA ID (optional) [14 digits] │
│  [       Create account     ] │
└──────────────────────────────┘
```
- **API:** `POST /auth/register`. On success → logged in → `/p`.
- **Validation (FR-1.1–1.4):** field errors under each field; 409 on phone → "This number is already registered".

### Page 3 — Patient Home `/p`

```
┌──────────────────────────────┐
│ ☰ DisCharge+       [ગુ ▾] ⎋  │
│ Namaste, Kantaben            │
│                              │
│ ┌──────────────────────────┐ │
│ │  🤒  I feel unwell       │ │  ← large red-outline button → /p/report
│ └──────────────────────────┘ │
│                              │
│ Today's medicines  3 of 5 ✓  │
│ ☀ Morning                    │
│ ┌──────────────────────────┐ │
│ │ 💊 Furosemide 40 mg  ⚠   │ │  ⚠ = critical
│ │ 1 tablet      [ Taken ✓ ]│ │  status: taken (green)
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 💊 Metformin 500 mg      │ │
│ │ 1 tablet     [  Taken  ] │ │  pending → button
│ └──────────────────────────┘ │
│ 🌙 Night                     │
│ │ 💊 Metformin 500 mg  later │  future → disabled
│ │ 💊 Atorvastatin …   missed │  missed (grey/red)
│                              │
│ Next check-up: 13 Oct · 📞   │
├──────────────────────────────┤
│  🏠 Home  💊 Meds  📋 Plan  📅 │  ← bottom nav
└──────────────────────────────┘
```
- **API:** 10 (today's doses), 9 (next follow-up), 13 (mark taken).
- **Actions:** Taken → optimistic update, roll back on error (FR-3.2, 3.3).
- **States:** no active plan → "Your doctor hasn't added a care plan yet"; all taken → "All done for today ✓".

### Page 4 — My Care Plan `/p/plan`

```
┌──────────────────────────────┐
│ ← My care plan     [ગુ ▾]    │
│ Discharged: 6 Oct 2026       │
│ Doctor: Dr. Ananya Mehta     │
│ Diagnosis:                   │
│  Heart failure with diabetes │  ← free text, not translated (FR-8.4)
│                              │
│ ⚠ Get help if you notice:    │
│  🫁 «redFlag.BREATHLESS»      │
│  💔 «redFlag.CHEST_PAIN»      │
│  🦵 «redFlag.SWELLING_LEGS»   │
│                              │
│ 🚑 Emergency: call 108       │
│ [ 🤒 I feel unwell ]         │
└──────────────────────────────┘
```
- **API:** 8. Coded red flags translated through i18n.

### Page 5 — My Medicines `/p/medicines`

```
┌──────────────────────────────┐
│ ← My medicines     [ગુ ▾]    │
│ This week: 86% taken         │
│ ┌──────────────────────────┐ │
│ │ 💊 Furosemide 40 mg  ⚠   │ │
│ │ 1 tablet · once a day    │ │
│ │ ☀ morning · 30 days      │ │
│ │ Last 7 days: ✓✓✓✗✓✓✓     │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 💊 Metformin 500 mg      │ │
│ │ 1 tablet · twice a day   │ │
│ │ ☀ morning  🌙 night      │ │
│ │ Last 7 days: ✓✓ ✓✓ ✓✗ …  │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```
- **API:** 8 (prescriptions), 10 (last 7 days), 11 (percent).

### Page 6 — Report Symptom `/p/report` (3 steps, result is the last step)

```
Step 1 of 2                      Step 2 of 2                     Result
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│ ← How do you feel?     │      │ ← How bad is it?       │      │  🟧  See a doctor today │
│ Tap all that apply     │      │                        │      │  (urgent)              │
│ ┌────┐┌────┐┌────┐     │      │  😊  🙂  😐  😟  😫    │      │                        │
│ │ 🫁 ││ 💔 ││ 🦵 │     │      │  1   2   3   4   5     │      │ Your doctor has been   │
│ │Brea││Ches││Swel│     │      │           [ 4 ]        │      │ told. Keep your phone  │
│ └────┘└────┘└────┘     │      │                        │      │ near you.              │
│ ┌────┐┌────┐┌────┐     │      │ You chose:             │      │                        │
│ │ 😵 ││ 🤒 ││ 🤮 │     │      │ 🫁 Breathless          │      │ If it gets worse:      │
│ │Dizz││Feve││Vomi│     │      │ 🦵 Swelling            │      │ 🚑 call 108            │
│ └────┘└────┘└────┘     │      │                        │      │                        │
│ … 10–12 icons (⚑D8)    │      │ [  Send to my doctor  ]│      │ [  Back to home  ]     │
│ [      Next →      ]   │      └────────────────────────┘      └────────────────────────┘
└────────────────────────┘
```
- **API:** 14. Result uses tier colour **+** icon **+** text (NFR-11).
- **Tier → message:** self_care 🟩 "Rest at home" + advice · teleconsult 🟨 "Your doctor will call you" ·
  urgent 🟧 "See a doctor today" · emergency 🟥 "Go to hospital now, call 108".
- **Errors:** 400 → back to the step with the error; network error → "Not sent. Try again" (nothing is lost on screen).

### Page 7 — Follow-ups `/p/followups`

```
┌──────────────────────────────┐
│ ← My check-ups     [ગુ ▾]    │
│ Upcoming                     │
│  📞 13 Oct  Phone check      │
│  🧪 20 Oct  Blood test       │
│  🏥 05 Nov  Clinic visit     │
│ Past                         │
│  ✓ 09 Oct  Phone check  done │
│  ✗ 07 Oct  Blood test   missed│
└──────────────────────────────┘
```
- **API:** 9. Type icons: in_person 🏥 · teleconsult 💻 · lab_test 🧪 · phone_check 📞.

### Page 8 — Clinician Dashboard `/d`

```
┌──────────┬─────────────────────────────────────────────────────────────────────────┐
│DisCharge+│  Good morning, Dr. Mehta                                   Mon 12 Oct   │
│          ├─────────────────────────────────────────────────────────────────────────┤
│▸Dashboard│  ┌──────────┐ ┌──────────┐ ┌──────────┐   ┌──────────────────────────┐  │
│ Escalat.3│  │ HIGH   3 │ │ MOD    7 │ │ LOW   10 │   │ Open escalations          │  │
│ Patients │  └──────────┘ └──────────┘ └──────────┘   │ 🟥 1  🟧 2  🟨 4          │  │
│ + New    │                                           └──────────────────────────┘  │
│   plan   │  Needs attention today                                                  │
│          │  Patient          Band   Adherence  Open esc.  Day                       │
│          │  Kantaben Rathwa  HIGH   62%        2 🟧🟧      6    [Open]              │
│          │  Ramesh Vasava    HIGH   48%        1 🟨        11   [Open]              │
│          │  …                                                                      │
│          │                                                                         │
│          │  Overdue follow-ups                                                     │
│          │  Jashoda Bhil   🧪 Serum creatinine   due 9 Oct (3 days)   [Open]        │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```
- **API:** 25, refresh every 60 s. Rows link to Patient Detail; the escalation tile links to the queue.

### Page 9 — Escalation Queue `/d/escalations`

```
┌──────────┬─────────────────────────────────────────────────────────────────────────┐
│ sidebar  │ Escalations    Status [Open+Ack ▾]  Tier [All ▾]      auto-refresh 30 s │
│          ├─────────────────────────────────────────────────────────────────────────┤
│          │ Tier        Patient          Source        Rules              Age  State │
│          │ 🟥 EMERG.   Bhavna Rathwa    Symptom       CARD_CHEST_PAIN    4 m  open  │
│          │ 🟧 URGENT   Kantaben Rathwa  Symptom       CARD_BREATHLESS…   2 h  open  │
│          │ 🟧 URGENT   Kantaben Rathwa  Missed dose   MISSED_CRITICAL…   3 d  ack   │
│          │ 🟨 TELE.    Ramesh Vasava    Symptom       GEN_FEVER_SEV3     5 h  open  │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```
- **API:** 21. Sort is done by the **server** (tier, then oldest first — FR-5.1). Click a row → page 10.

### Page 10 — Escalation Detail `/d/escalations/:id`

```
┌──────────┬─────────────────────────────────────────────────────────────────────────┐
│ sidebar  │ ← Queue    🟧 URGENT · open · raised 2 h ago                             │
│          │ Kantaben Rathwa · 61 F · Chhota Udepur · 📞 +91 98765 43210              │
│          │ Plan: Heart failure + diabetes (cardiac) · day 6                         │
│          ├──────────────────────────────┬──────────────────────────────────────────┤
│          │ What was reported            │ Why it was raised                        │
│          │ 🫁 Breathless                │ • CARD_BREATHLESS_SEV3 — breathlessness   │
│          │ 🦵 Swelling of legs          │   with severity ≥ 3 on a cardiac plan     │
│          │ Severity 4 / 5               │   (source: …)                             │
│          │ 12 Oct, 07:42                │                                           │
│          ├──────────────────────────────┴──────────────────────────────────────────┤
│          │ [ Acknowledge ]                                                          │
│          │ Notes (required to resolve)                                              │
│          │ [ Called patient; advised to come to OPD today; furosemide confirmed… ] │
│          │ [ Resolve ]                          View patient →                      │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```
- **API:** 22, 23, 24. Buttons enabled by status (FR-5.8). For missed-dose escalations, the left
  panel shows the medicine, scheduled time and "not marked by the grace window".

### Page 11 — Patient List `/d/patients`

```
┌──────────┬─────────────────────────────────────────────────────────────────────────┐
│ sidebar  │ Patients   [🔍 name / phone / ABHA     ]  Risk [All ▾]   [+ New plan]    │
│          ├─────────────────────────────────────────────────────────────────────────┤
│          │ Name            Phone         Diagnosis          Day  Adher.  Risk  Esc. │
│          │ Kantaben Rathwa 98765 43210   Heart failure …     6   62%    HIGH   2    │
│          │ Ramesh Vasava   …             Type 2 diabetes    11   48%    HIGH   1    │
│          │ …                                                                       │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```
- **API:** 6. "+ New plan" on a row with no active plan → page 13 with `patientId`.

### Page 12 — Patient Detail `/d/patients/:id`

```
┌──────────┬─────────────────────────────────────────────────────────────────────────┐
│ sidebar  │ ← Patients   Kantaben Rathwa · 61 F · ABHA 12-3456-7890-1234   RISK HIGH │
│          │ 📞 +91 98765 43210 · Chhota Udepur · Gujarati                            │
│          │ [ Plan ] [ Adherence ] [ Symptoms ] [ Escalations ]                      │
│          ├─────────────────────────────────────────────────────────────────────────┤
│  Plan    │ Heart failure + diabetes · cardiac · discharged 6 Oct · active [Change ▾]│
│  tab     │ Medicines: Furosemide 40 mg OD ⚠ · Metformin 500 mg BD · …               │
│          │ Follow-ups: 📞 13 Oct scheduled [Mark done] · 🧪 20 Oct scheduled …       │
│ Adherence│ 62% (whole plan) · 7-day strip per medicine, ✓ / ✗ / ·                  │
│ Symptoms │ 12 Oct 07:42  Breathless, Swelling  sev 4  🟧 urgent  CARD_BREATHLESS…   │
│          │ 09 Oct 18:10  Dizzy                 sev 2  🟩 self_care  —               │
│ Escal.   │ Same rows as the queue, filtered to this patient, incl. resolved + notes │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```
- **API:** 7, 8, 9, 10, 11, 12, 21 (`?patientId=`), 19, 20.
- The Symptoms tab shows **self_care** reports too (design decision #4: measure false negatives).

### Page 13 — Discharge Plan Editor `/d/plans/new?patientId=`

```
┌──────────┬─────────────────────────────────────────────────────────────────────────┐
│ sidebar  │ New discharge plan — Kantaben Rathwa                                    │
│          │  ① Admission  ──  ② Prescriptions  ──  ③ Red flags & protocol  ── Save   │
│          ├─────────────────────────────────────────────────────────────────────────┤
│ Step 1   │ Admission [01/10/2026]   Discharge [06/10/2026]                          │
│          │ Primary diagnosis [ Heart failure (HFrEF) with type 2 diabetes       ]  │
│ Step 2   │ Medicine            Dosage     Freq  Slots          Days  Critical      │
│          │ [Furosemide 40mg ▾] [1 tablet] [OD▾] [☀]             [30]  [✓]   🗑      │
│          │ [Metformin 500mg ▾] [1 tablet] [BD▾] [☀][🌙]          [30]  [ ]   🗑      │
│          │ [+ Add medicine]   Not in list? [+ New medicine]                         │
│ Step 3   │ Protocol ( )general (•)cardiac ( )diabetes ( )ckd ( )post_surgical       │
│          │ Red flags  [✓] Breathless  [✓] Chest pain  [✓] Swelling  [ ] Confusion … │
│          │ Preview: 4 follow-ups · 90 doses will be created                         │
│          │                                             [ Back ]  [ Save plan ]      │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```
- **API:** 15, 16, 17 (and 18/19 for edit, ⚑D5).
- **Client checks** (the server checks again): at least one prescription; slot count = frequency;
  discharge ≥ admission. Server 400 → highlight the fields named in `fields`.
- On 201 → go to Patient Detail and show "Plan saved: 4 follow-ups, 90 doses created".

### Stretch — Page 14 Scheme Navigator `/p/schemes`
Only after AC-12 passes. A few yes/no questions → PM-JAY verdict per criterion.

---

## 7. End-to-end flows (what calls what)

### 7.1 Save a discharge plan (Weeks 3–4)
```
PlanEditor ─POST /plans─► requireAuth ► requireRole(C) ► validate
  ► planService.create  [one transaction]
       ├─ DischargePlan.create
       ├─ Prescription.insertMany
       ├─ followUpGenerator(plan, protocols[plan.followUpProtocol]) → FollowUp.insertMany
       └─ for each prescription: doseGenerator(p, dischargeDate) → AdherenceRecord.insertMany
  ◄ 201 { plan, generated: { followUps, doses } }
```
Atlas supports transactions (replica set). For local dev and tests, use `mongodb-memory-server`
in replica-set mode, or a local replica set.

### 7.2 Mark a dose / missed-dose escalation (Week 5)
```
Home ─PATCH /doses/:id {taken}─► auth ► role(P) ► ownership ► adherenceService.markTaken
cron every ⚑ min ─► missedDoseSweep(now) ─► pending + past grace → missed
                                        └─ isCritical → escalationService.create(missed_critical_dose)
```

### 7.3 Report symptom → escalation (Weeks 6–7) — matches the sequence diagram
```
ReportSymptom ─POST /symptoms─► auth ► role(P) ► validate
  ► symptomService.report
       1. SymptomLog.create        (saved first, FR-4.4)
       2. load active plan
       3. ruleEngine.evaluate(log, plan) → { tier, triggeredRules }
       4. update the log with tier + rules
       5. tier ≠ self_care → escalationService.create(symptom_log)
  ◄ 201 { symptomLog, escalation | null } ─► result step
EscalationQueue (polls 30 s) ─GET /escalations─► new row at the top
```

---

## 8. Week-by-week checklist

✅ = "done when" test from the PRD. **B** = backend (Vandit), **F** = frontend (Smit).

### Week 1 — Setup (Stage 0) · FR: —
- [ ] B+F: rename folder, `git init`, `.gitignore`, first commit, move docs into `docs/`
- [ ] B+F: **agree §3 API contract** and §5.1 routes (write any change back into this file)
- [ ] B: `server/` boots, `.env.example`, `GET /api/health` shows DB status, Atlas cluster created
- [ ] B: 9 Mongoose models with validation + §4.2 indexes (first model hand-written and reviewed)
- [ ] F: Vite + Tailwind + React Router, both shells, placeholder pages for all 13 routes
- [ ] B+F: `LEARNING_LOG.md`, `DECISIONS.md`
- ✅ Both services boot; `/api/health` returns ok

### Week 2 — Auth (Stage 2) · FR-1 · decide D1, D2
- [ ] B: register, login, `/auth/me`, bcrypt, JWT, rate limit
- [ ] B: `requireAuth`, `requireRole`, `requireOwnership`, `validate`, `errorHandler`
- [ ] B: integration test AC-1, AC-2, AC-3
- [ ] F: Login, Register, `AuthContext`, `api.js`, `RequireRole`, redirect by role
- ✅ **Patient A cannot read patient B** (AC-1)

### Weeks 3–4 — Discharge plan (Stage 3) · FR-2 · decide D3, D4, D5
- [ ] B: protocols data + sources, `generateFollowUps`, `generateDoses` + unit tests
- [ ] B: `POST /plans` in a transaction, medications search/add, `GET/PATCH /plans/:id`
- [ ] B: integration test AC-4, AC-5
- [ ] F: Discharge Plan Editor (3 steps), medicine picker, client-side checks
- ✅ **Saving a plan creates follow-ups and doses**

### Week 5 — Adherence (Stage 3) · FR-3, FR-7.3 · decide D6, D7
- [ ] B: doses + adherence endpoints, `PATCH /doses/:id`, time window rule
- [ ] B: `missedDoseSweep(now)` + cron + `/dev/run-sweep`; unit + integration test AC-6, AC-7
- [ ] F: Patient Home (DoseCard, optimistic Taken), My Medicines
- ✅ **Unmarked critical dose → escalation**

### Weeks 6–7 — Symptoms + rule engine (Stage 4) · FR-4, FR-5 · decide D8, D9, D10, D12
- [ ] B: symptom codes, **rule table with sources**, `ruleEngine.evaluate` + a test per rule (fires / doesn't)
- [ ] B: `POST /symptoms`, escalation list/detail/acknowledge/resolve; tests AC-8–AC-11
- [ ] F: Report Symptom (grid → severity → result), Escalation Queue (30 s refresh), Escalation Detail
- ✅ **Chest pain post-cardiac → emergency, top of queue**

### Week 8 — Dashboard (Stage 10, cut down) · FR-6 · decide D11
- [ ] B: `computeRiskBand` + unit tests; `GET /dashboard`; patient list aggregation; follow-up complete
- [ ] F: Dashboard, Patient List, Patient Detail (4 tabs)
- ✅ **"Who needs attention today?" in one view** (AC-12)

### Week 9 — Seed, validation, languages · FR-8, FR-9
- [ ] B: seed script incl. the Kantaben 30-day journey; review every route's validation
- [ ] F: i18next, en/hi/gu JSON for pages 1–7, language switch saves `preferredLanguage`; native-speaker check
- ✅ **Same plan renders in 3 languages** (AC-13)

### Week 10 — Tests + deploy (Stage 11) · NFRs
- [ ] B: close test gaps (NFR-15); deploy server to Render, DB on Atlas; CORS for the Vercel URL
- [ ] F: My Care Plan, Follow-ups, empty/error states, 360 px check, Lighthouse
- [ ] B+F: run the demo script on the live URL
- ✅ **A stranger can use the live URL**

### Weeks 11–12 — Buffer
- [ ] Fix anything left over → stretch: Scheme check (FR-10.1)
- [ ] Update the PPT if anything changed (DD ↔ ER ↔ Class ↔ Sequence must still match)
- [ ] Rehearse the 3-minute demo (30-day journey) and the viva Q&A in `09-project-guide.md`

---

## 9. Who writes what (per the README contract)

| Part | Who types it | Why |
|---|---|---|
| Config: `package.json`, `vite.config`, Tailwind, `.env.example`, `.gitignore`, eslint | AI may write | Teaches nothing by typing |
| First Mongoose model, first route, first page | **Team**, reviewed | Learn the pattern once |
| Remaining models / CRUD routes after the first | AI may write, team reviews | Repetitive CRUD exception |
| `requireAuth`, `requireRole`, **`requireOwnership`** | **Team** (AI scaffolds `TODO(rudra)`) | The security core, and the AC-1 test |
| **`generateDoses`, `generateFollowUps`** | **Team** | Date arithmetic + IST: the Weeks 3–4 learning goal |
| **`ruleEngine.evaluate` + the rule table** | **Team** | "The core logic I write myself" (README Stage 4) |
| **`missedDoseSweep`** | **Team** | Idempotency + cron |
| **`computeRiskBand`** | **Team** | Thresholds are a design decision (D11) |
| React pages | **Smit**, AI reviews | Partner's share of the split |
| i18n translation strings | Team + native speaker | Quality matters more than speed |
| Seed data content | Team; AI may generate bulk synthetic rows | Kantaben journey written by the team |
| Tests for the pure functions | **Team** writes the cases; AI may suggest missing edge cases | Knowing the edge cases is the point |
