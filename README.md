# DisCharge+

**A post-discharge continuity-of-care platform for rural & remote patients.**

Built for **TetraTHON 2026** (Navrachana Innovation Foundation, Navrachana University, Vadodara) — Indo-French AI Innovation Sprint, under the Franco-Indian Year of Innovation, in collaboration with ISEN Méditerranée, France.

- **Track:** A — HealthTech
- **Problem Statement:** 2 — *AI-Based Continuity of Care Platform for Rural & Remote Patients*
- **Submitted as:** Minor Project

---

## ⚠️ Read This First — How This Project Must Be Built

This is a **learning project**. The point is not to end up with working code. The point is that **I** end up able to build this class of system.

### Contract with the AI assistant

If you are an AI assistant (Claude Code or otherwise) working in this repository, these rules override any default helpfulness instinct you have:

**You are a teacher and a code reviewer. You are not the developer.**

**DO:**
1. **Explain before anything gets written.** For every task, first explain *what* we're building, *why* it's needed, what the alternatives are, and what the trade-offs cost. Concepts before syntax.
2. **Scaffold, don't solve.** Create the file, write the imports, write the function signature, write a docstring explaining inputs/outputs/edge cases, and leave a `// TODO(rudra):` marker. The actual logic is mine to write.
3. **Ask me questions instead of answering my own.** When there's a design decision (schema shape, error-handling strategy, which risk model, sync-conflict resolution), put it back to me with the trade-offs laid out. Let me choose. Then tell me if my choice has a problem.
4. **Review my code honestly.** Point out bugs, security holes, bad naming, wrong complexity. Tell me *why* it's wrong and what concept I'm missing — do not silently rewrite it.
5. **Make me debug.** When something breaks, teach me to read the stack trace, form a hypothesis, and test it. Give me the next question to ask, not the answer.
6. **Check my understanding.** Periodically ask me to explain back what a piece of code does. If I can't, we go back a step.
7. **Keep insights short and concrete** — about *this* codebase and *these* decisions, not generic programming lectures.

**DO NOT:**
- ❌ Write complete features, components, or endpoints for me.
- ❌ Fix a bug without first walking me through the diagnosis.
- ❌ Run ahead to the next stage because it's "obvious."
- ❌ Answer a design question that I should be answering.
- ❌ Hand me a big block of code to paste in.

**Exceptions — you may write these fully:** boilerplate config (`vite.config.js`, `tsconfig`, `.env.example`, `requirements.txt`), repetitive CRUD once I've written the first one myself and understood it, and dependency/tooling setup. Anything that teaches nothing by being typed out.

**Escalation:** If I explicitly say *"just write it, I'm stuck"* — first give me one more targeted hint. If I ask a second time, write it, then explain line by line and ask me to reimplement a variation of it.

> **2026-09-30:** I chose to have the AI assistant build the complete MVP (server, client, tests, seed data) so the demo is ready. My job now is to read and understand every part before the viva; every choice it made for me is in `docs/DECISIONS.md` for me to review.

---

## What the Problem Statement Actually Demands

Straight from the official brief, these are the deliverables I am graded on. Every stage below maps back to one of these.

| # | Expected Outcome | What it means concretely |
|---|---|---|
| 1 | **Follow-up Management** | AI-assisted discharge follow-up scheduling and tracking |
| 2 | **Automated Escalation** | Symptom monitoring that auto-escalates red flags to clinicians |
| 3 | **Localized Education** | Patient/caregiver education in regional languages (Gujarati, Hindi) |
| 4 | **Scheme Navigation** | PM-JAY / government scheme eligibility guidance |
| 5 | **Interoperability** | ABDM-compatible health record structure (ABHA ID, FHIR-shaped records) |
| 6 | **Offline Field Capabilities** | Rural screening module that works with no connectivity, syncs later |
| 7 | **Clinical Impact** | Measurable adherence improvement + reduced avoidable readmissions |

---

## Tech Stack

Chosen deliberately for maximum learning surface: three separate services that must talk to each other.

```
client/     React + Vite + Tailwind CSS        ← patient app + clinician dashboard
server/     Node.js + Express + MongoDB        ← auth, records, business logic, orchestration
ml-svc/     Python + FastAPI + scikit-learn    ← risk models, explainability
```

| Layer | Choice | Why this, and what I'll learn from it |
|---|---|---|
| Frontend | React + Vite + Tailwind | Component thinking, state management, forms, data-viz, PWA/offline |
| State/data | TanStack Query | Server-state caching — the right primitive for offline-first |
| Backend | Node + Express | REST design, middleware, auth, service-to-service calls |
| Database | MongoDB + Mongoose | Schema design for messy clinical data, indexes, aggregation pipelines |
| ML service | FastAPI + scikit-learn | Model training, evaluation, serving, versioning |
| Explainability | SHAP | The PS demands explainable AI — this is non-negotiable, not a bonus |
| Offline store | IndexedDB (Dexie.js) | Local-first writes, sync queues, conflict resolution |
| Auth | JWT + bcrypt | Roles: patient, caregiver, clinician, health worker |
| Notifications | Twilio / MSG91 (SMS), later WhatsApp | Rural reality: SMS reaches people smartphones don't |
| i18n | i18next | Gujarati + Hindi + English |
| Deploy | Vercel (client), Render (server + ml-svc), MongoDB Atlas | Free tiers, real deployment experience |

**Why a separate Python ML service instead of ML in Node:** the entire scientific ML ecosystem lives in Python. Splitting it teaches me service boundaries, API contracts between services, and independent deployment — which is how real systems are actually shaped.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  client/  React PWA                                  │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Patient app    │  │ Clinician    │  │ Field    │  │
│  │ (multilingual) │  │ dashboard    │  │ worker   │  │
│  └────────────────┘  └──────────────┘  │ (OFFLINE)│  │
│                                        └──────────┘  │
│              IndexedDB + sync queue                  │
└──────────────────────────┬───────────────────────────┘
                           │ REST / JWT
┌──────────────────────────▼───────────────────────────┐
│  server/  Node + Express                             │
│  auth · patients · discharge plans · symptom logs    │
│  escalation engine · scheme matcher · sync endpoint   │
└──────┬───────────────────────────────┬───────────────┘
       │                               │ REST
┌──────▼──────────┐         ┌──────────▼───────────────┐
│  MongoDB Atlas  │         │  ml-svc/  FastAPI        │
│  ABDM-shaped    │         │  readmission risk        │
│  records        │         │  adherence risk          │
└─────────────────┘         │  SHAP explanations       │
                            └──────────────────────────┘
```

---

## Build Stages

Each stage: **Learn → Design → Build → Review → Reflect.** No stage starts before the previous one's Definition of Done is met.

### Stage 0 — Foundations & Setup
*Concepts:* monorepo layout, environment variables and secrets, git discipline, why three services.

- [ ] Repo structure (`client/`, `server/`, `ml-svc/`, `docs/`, `data/`)
- [ ] Git init, `.gitignore`, first commit
- [ ] `.env.example` for each service, and understanding why `.env` is never committed
- [ ] All three services boot and return a health-check response
- [ ] `docs/LEARNING_LOG.md` created

**DoD:** three terminals, three running services, one `git log`.

### Stage 1 — Data Modelling (the stage that decides everything)
*Concepts:* clinical data modelling, ABDM/ABHA and FHIR basics, embed-vs-reference in MongoDB, indexing, PII and consent.

- [ ] Read enough ABDM/FHIR to know what a *Patient* and an *Encounter* resource contain
- [ ] Design `Patient`, `DischargePlan`, `Medication`, `SymptomLog`, `FollowUp`, `User` schemas — **I design these, then defend them in review**
- [ ] Decide: embed medications inside a discharge plan, or reference them? (justify)
- [ ] Consent model — who can see what
- [ ] Seed script with realistic synthetic patients

**DoD:** I can whiteboard the schema from memory and explain every relationship choice.

### Stage 2 — Auth & Roles
*Concepts:* hashing vs encryption, JWT structure and its actual weaknesses, refresh tokens, RBAC middleware, why healthcare auth is stricter.

- [ ] Register/login, bcrypt password hashing
- [ ] JWT issue + verify middleware
- [ ] Four roles: `patient`, `caregiver`, `clinician`, `health_worker`
- [ ] Route protection by role
- [ ] Rate limiting on auth routes

**DoD:** a patient cannot read another patient's record. I've tested that it fails correctly.

### Stage 3 — Discharge Plan & Follow-up Engine → *Outcome #1*
*Concepts:* CRUD at scale, date arithmetic and timezones, scheduling/cron, idempotency.

- [ ] Clinician creates a discharge plan (meds, tests, follow-up dates, red-flag list)
- [ ] Auto-generate the follow-up calendar from discharge date + protocol
- [ ] Adherence tracking: taken / missed / delayed
- [ ] Scheduled reminder job (node-cron)
- [ ] SMS reminders via Twilio/MSG91

**DoD:** create a plan, watch reminders fire on schedule, adherence numbers update.

### Stage 4 — Symptom Reporting & Automated Escalation → *Outcome #2*
*Concepts:* rule engines vs ML, clinical red flags, priority queues, notification fan-out, and the cost asymmetry of false negatives in medicine.

- [ ] Patient symptom-reporting form — must work for low-literacy users (icons, voice, vernacular)
- [ ] Red-flag rule engine — **the core logic I write myself**
- [ ] Severity tiering: self-care → teleconsult → urgent → emergency
- [ ] Escalation to clinician queue + SMS/call trigger
- [ ] Clinician dashboard with a triaged, prioritized queue

**DoD:** report chest pain post-cardiac-discharge → escalates to emergency within seconds, clinician sees it top of queue.

### Stage 5 — ML Service: Risk Prediction → *Outcome #7*
*Concepts:* the full ML pipeline, class imbalance, train/val/test discipline, why accuracy is a bad metric here, ROC-AUC and precision/recall trade-offs, SHAP, model versioning.

- [ ] Source datasets (MIMIC-derived readmission sets, Framingham, Pima, UCI CKD) or generate defensible synthetic data
- [ ] EDA notebook — I do the exploration
- [ ] Feature engineering — **I decide the features and justify them clinically**
- [ ] Train readmission-risk and adherence-risk models; compare logistic regression vs gradient boosting
- [ ] Evaluate properly: ROC-AUC, PR-AUC, calibration, confusion matrix at a chosen threshold
- [ ] **Choose the operating threshold myself** — this is a clinical ethics decision, not a metric maximisation
- [ ] SHAP explanations exposed through the API
- [ ] `POST /predict/readmission` returning score + top contributing factors
- [ ] Node server consumes the ML service

**DoD:** I can explain why my model made a specific prediction for a specific patient, and defend my threshold choice.

### Stage 6 — Multilingual Patient Education → *Outcome #3*
*Concepts:* i18n architecture, content vs UI translation, health literacy levels, LLM prompting for safety-critical text, accessibility.

- [ ] i18next setup: English, Hindi, Gujarati
- [ ] Condition-specific education content library
- [ ] LLM-generated plain-language explanations at a controlled reading level
- [ ] **Safety guardrails on generated medical text** — decide the strategy: template-constrained, retrieval-grounded, or human-reviewed
- [ ] Text-to-speech for non-readers

**DoD:** the same discharge instruction renders correctly and safely in three languages, with audio.

### Stage 7 — Government Scheme Navigator → *Outcome #4*
*Concepts:* eligibility rule engines, decision trees, explainable non-ML decisions.

- [ ] PM-JAY eligibility criteria encoded as rules
- [ ] State-scheme layer (Gujarat)
- [ ] Eligibility checker that **explains** the verdict, criterion by criterion
- [ ] Document checklist + nearest empanelled hospital lookup

**DoD:** given a patient profile, the app says eligible/not and cites the exact criteria.

### Stage 8 — Offline-First Rural Screening Module → *Outcome #6*
*Concepts:* PWAs, service workers, IndexedDB, local-first architecture, sync queues, conflict resolution, last-write-wins vs CRDTs.

- [ ] PWA setup, installable, service worker caching
- [ ] IndexedDB (Dexie) local store
- [ ] Screening camp form that fully works with the network off
- [ ] Outbox/sync queue with retry and backoff
- [ ] **Conflict-resolution strategy — my design decision**, with the trade-offs written down
- [ ] Offline risk stratification (lightweight on-device rules, ML on sync)
- [ ] Bulk sync endpoint on the server

**DoD:** aeroplane mode → record 10 patients → reconnect → all 10 sync, no duplicates, conflicts handled predictably.

### Stage 9 — ABDM Interoperability Layer → *Outcome #5*
*Concepts:* health data standards, FHIR resources, ABHA identity, consent artefacts, why interoperability is a policy problem as much as a technical one.

- [ ] ABHA ID field + validation
- [ ] FHIR-shaped export of patient records
- [ ] ABDM sandbox integration (or a documented mock if sandbox access blocks)
- [ ] Consent artefact model

**DoD:** export a patient as valid FHIR JSON and explain each resource.

### Stage 10 — Clinician Dashboard & Impact Metrics → *Outcome #7*
*Concepts:* dashboard information hierarchy, aggregation pipelines, data visualisation that doesn't mislead.

- [ ] Cohort view with risk stratification
- [ ] Adherence + follow-up compliance trends
- [ ] Escalation history and response times
- [ ] Readmission-avoided estimate — **and honesty about what this number can and cannot claim**

**DoD:** dashboard answers "which of my 200 discharged patients should I worry about today?" in one glance.

### Stage 11 — Hardening, Testing, Deploy
*Concepts:* testing pyramid, input validation, healthcare security posture, audit logs, CI/CD.

- [ ] Input validation everywhere (Zod / express-validator)
- [ ] Unit tests on the rule engines and ML preprocessing
- [ ] Integration tests on critical paths
- [ ] Audit logging of every record access
- [ ] Deploy all three services; live demo URL
- [ ] Load-sanity check

**DoD:** a stranger can open the URL and use it.

### Stage 12 — Demo, Pitch & Documentation
- [ ] Demo script — the 3-minute story, not a feature tour
- [ ] Architecture diagrams
- [ ] Pitch deck: problem → solution → demo → impact → scale
- [ ] Known limitations, honestly stated
- [ ] Full `LEARNING_LOG.md`

---

## Repo Layout

```
DisCharge+/
├── README.md
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── db/              # Dexie / IndexedDB + sync queue
│   │   ├── locales/         # en, hi, gu
│   │   └── lib/
│   └── package.json
├── server/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/        # escalation engine, scheme matcher, ml client
│   │   └── jobs/            # cron reminders
│   └── package.json
├── ml-svc/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/          # serialized models + versions
│   │   ├── features/
│   │   └── explain/         # SHAP
│   ├── notebooks/           # EDA + training, my work
│   └── requirements.txt
├── data/                    # synthetic + public datasets (gitignored if large)
└── docs/
    ├── LEARNING_LOG.md
    ├── DECISIONS.md         # architecture decision records
    └── diagrams/
```

---

## My Learning Log Format

Every session, I append to `docs/LEARNING_LOG.md`:

```markdown
## [Date] — Stage N: <what I worked on>

**Concepts learned:**
**What I built myself:**
**Where I got stuck, and how I got unstuck:**
**Design decision I made, and why:**
**What I still don't understand:**
```

The last line is the important one. Any concept that survives three sessions in that list gets a dedicated teaching session before I move on.

---

## Guardrails I'm Setting for Myself

1. **No copy-paste I can't explain.** If I can't explain a line, it doesn't go in.
2. **Design before code.** Every stage begins on paper.
3. **Commit small, commit often**, with messages that say *why*.
4. **Document every real decision** in `docs/DECISIONS.md`, including the option I rejected.
5. **Test the failure path**, not just the happy path — this is healthcare software.
6. **Never fake clinical authority.** Synthetic data is labelled synthetic; rule sources are cited; the app never claims to diagnose.

---

## Non-Goals

- Not a hospital information system or an EMR replacement
- Not a diagnostic device — it supports care, it does not practise medicine
- Not production-certified; no real patient data, ever
- Not multi-tenant SaaS at this stage

---

## Getting Started

What is built is the **MVP** (`docs/07-mvp-scope.md`): 2 services, 2 roles, 9 collections, 13 pages. The ML service is future scope.

**Needs:** Node.js 22+ (24 LTS used) and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
# 1. API
cd server
npm install
cp .env.example .env        # then set MONGODB_URI and a long random JWT_SECRET
npm run seed                # synthetic demo data (wipes only a database whose name contains "discharge")
npm run dev                 # http://localhost:3000/api/health

# 2. Web app (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

**Demo logins** (password `demo1234`): clinician Dr. Ananya Mehta `9000000001` · patient Kantaben Rathwa `9000000101` (the 30-day demo journey, in Gujarati) · patient Bhavna Rathwa `9000000102` (chest pain today, emergency).

**Checks:** `cd server && npm test` (81 tests, uses an in-memory MongoDB; the first run downloads it) · `cd client && npm run build` · `cd client && npm run check:i18n` (every English text has Hindi and Gujarati).

**Deploy:** API on Render with `render.yaml` (set `MONGODB_URI` to Atlas and `CLIENT_ORIGIN` to the Vercel URL); web app on Vercel with root `client/` and `VITE_API_URL=https://<your-api>.onrender.com/api`. The free Render plan sleeps, so during a demo use the clinician-only `POST /api/dev/run-sweep` to run the missed-dose check on demand.

**Demo script (3 minutes):** log in as Kantaben (Gujarati home, sun path, a missed dose on day 3) → report "short of breath" → urgent result → log in as Dr. Mehta → she is high risk on the dashboard → open her escalation, see the rules that fired → acknowledge → resolve with notes.

---

**First move:** ask the AI to teach me Stage 0 — why three services instead of one, what a monorepo actually buys me, and how secrets should flow between them. Then I set up the repo myself.
