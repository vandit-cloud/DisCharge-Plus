# DisCharge+ Learning Log

This file tracks learning progress throughout the project. One entry per working session.

Format for each session:
```markdown
## [Date] — Stage N: <what I worked on>

**Concepts learned:**
**What I built myself:**
**Where I got stuck, and how I got unstuck:**
**Design decision I made, and why:**
**What I still don't understand:**
```

---

## 2026-09-30 — Stage 0: Project Setup

**Concepts learned:**
- Monorepo structure with separate client and server services
- Environment variable management with .env files
- Why we separate services (client/server) and the API contract between them
- Basic Express app structure with middleware and routes
- Basic Vite + React setup

**What I built myself:**
- Created project structure: client/, server/, docs/
- Set up server with Express, basic middleware, health check route structure
- Set up client with Vite, React, basic App component
- Created .env.example files for both services
- Created .gitignore for the repository

**Where I got stuck, and how I got unstuck:**
- No issues encountered during setup

**Design decision I made, and why:**
- Used standard folder structure as per build layout (11-build-layout.md)
- Kept TODO markers for code that needs to be implemented by the student

**What I still don't understand:**
- Need to implement the actual MongoDB connection logic in db.js
- Need to implement the health check route
- Need to understand how to properly configure React Router and TanStack Query

---

## 2026-09-30 — Stage 1: Data Model Schemas

**Concepts learned:**
- Mongoose schema structure and validation
- MongoDB indexing for performance
- Reference relationships between collections (foreign keys)
- Sparse indexes for optional unique fields (like ABHA ID)
- Schema validation rules (min, max, match, custom validators)
- Virtual fields and derived data
- Compound unique indexes for preventing duplicates

**What I built myself:**
- Created all 9 MVP entity schemas: User, Patient, DischargePlan, Medication, Prescription, FollowUp, AdherenceRecord, SymptomLog, Escalation
- Implemented field validation matching the data dictionary (08-phase1-data-dictionary.md)
- Added appropriate indexes for query performance
- Created model index file for easy imports
- Built and ran schema validation test - all schemas pass

**Where I got stuck, and how I got unstuck:**
- Initially added a userId field to User schema that conflicted with _id - removed it to use MongoDB's default _id
- Forgot to add startDate field to Prescription schema - added it based on data dictionary
- Setup script for client failed due to ES module - renamed to .cjs extension

**Design decision I made, and why:**
- Used sparse unique indexes for optional fields (ABHA ID, symptomLogId, adherenceId) - allows multiple nulls but enforces uniqueness when present
- Added validation to ensure timingSlots count matches frequency (OD=1, BD=2, TDS=3, QID=4) - prevents data inconsistency
- Used timestamps: true for automatic createdAt/updatedAt fields - standard Mongoose practice
- Added compound unique index on (prescriptionId, scheduledAt) for AdherenceRecord - prevents duplicate dose records

**What I still don't understand:**
- Need to implement instance methods on schemas (e.g., markTaken(), acknowledge())
- Need to understand how to properly use populate() for joining collections
- Need to learn about Mongoose middleware (pre/post hooks) for data consistency

> **Note (2026-09-30):** the two entries above were written by the Devin AI assistant at the
> student's request, so "What I built myself" there means "what Devin built". Devin's model files
> were replaced in the entry below.

---

## 2026-09-30 — Stages 0–11 (MVP): built by Claude Code at the student's request

**Concepts to learn from this code (study in this order):**
1. `server/src/utils/time.js`: calendar dates vs instants, and why IST needs no daylight-saving logic.
2. `server/src/middleware/auth.js`: JWT (who you are) vs role (what you may do) vs ownership (which records are yours).
3. `server/src/services/doseGenerator.js` and `followUpGenerator.js`: pure functions, and why they are easy to test.
4. `server/src/services/ruleEngine.js` + `rules/redFlagRules.js`: rules as data; highest tier wins.
5. `server/src/jobs/missedDoseSweep.js`: idempotency (safe to run twice) with a unique index.
6. `server/src/services/riskBand.js`: the explainable points system, and the hook for future ML.
7. `client/src/lib/queries.js` + `DoseCard.jsx`: server state with TanStack Query, optimistic updates.
8. `client/src/i18n/`: how one screen renders in three languages.

**What I built myself:** nothing in this session; the code was written by Claude Code. The design
(docs 01–10, diagrams, deck) is mine.

**Design decisions made for me:** all listed in `DECISIONS.md` (D1–D12, B1–B12), to review and defend.

**What I still don't understand:** *(fill in while reading the code above; anything that stays
here after three sessions gets a dedicated walkthrough)*
