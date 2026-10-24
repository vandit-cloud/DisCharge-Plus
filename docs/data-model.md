# DisCharge+ — Data Model (Stage 1)

> **Status:** DRAFT — awaiting Rudra's review.
> This file is the single source of truth. The E-R Diagram, UML Class Diagram and
> Data Dictionary are all generated from it. Change it here, regenerate those.

> **MVP (2026-09-23):** only entities 1–9 below (`User` … `Escalation`) are built for the MVP.
> The rest remain the full-vision design. See [07-mvp-scope.md](./07-mvp-scope.md).

**Locked decisions (2026-09-17):**
- `Medication` is a **referenced master collection**, not embedded. M:N between
  `DischargePlan` and `Medication` is resolved by the **`Prescription`** junction entity.
- Caregiver ↔ Patient is **M:N**, resolved by the **`CaregiverAssignment`** junction entity.
- A missed **critical** dose **auto-escalates**, so `Escalation` has two possible origins
  (`SymptomLog` or `AdherenceRecord`) and carries a `source` discriminator.
- `triageTier` is stored on **both** `SymptomLog` and `Escalation`, deliberately denormalised,
  so that non-escalated reports remain auditable (false-negative analysis).
- Offline sync conflicts resolve **server-wins + flag for manual review**.
- ERD is drawn as a **logical relational** model; physical MongoDB embedding noted per-entity.
- Scope: **full 12-stage vision**, covering all 7 problem-statement outcomes.

**Legend:** PK = primary key · FK = foreign key · IX = indexed · ⚠ = YOU decide, see end of file

---

## Entity inventory

| # | Entity | Outcome served | Physical note (MongoDB) |
|---|---|---|---|
| 1 | `User` | 2,5 (auth spine) | own collection |
| 2 | `Patient` | 5 | own collection; 1:1 with User |
| 3 | `DischargePlan` | 1 | own collection |
| 4 | `Medication` | 1 | own collection (master list) |
| 5 | `Prescription` | 1 | own collection (junction) |
| 6 | `FollowUp` | 1 | own collection |
| 7 | `AdherenceRecord` | 1,7 | own collection (high write volume) |
| 8 | `SymptomLog` | 2 | own collection |
| 9 | `Escalation` | 2 | own collection |
| 10 | `RiskAssessment` | 7 | own collection (versioned ML output) |
| 11 | `EducationContent` | 3 | own collection |
| 12 | `Scheme` | 4 | own collection |
| 13 | `SchemeEligibilityCheck` | 4 | own collection |
| 14 | `ScreeningRecord` | 6 | own collection (offline-origin) |
| 15 | `ConsentArtefact` | 5 | own collection |
| 16 | `Notification` | 1,2 | own collection |
| 17 | `AuditLog` | 5 (compliance) | own collection, append-only |
| 18 | `CaregiverAssignment` | 1,2 | own collection (junction) |

---

## 1. User — authentication & RBAC spine

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | Unique user identifier |
| `email` | String(254) | N | IX unique sparse | RFC 5322 | Login ID; optional — rural users may have none |
| `phone` | String(13) | Y | IX unique | `+91` + 10 digits | Primary login ID in rural context |
| `passwordHash` | String(60) | Y | — | bcrypt, cost 12 | Never the plaintext |
| `role` | Enum | Y | IX | `patient` / `caregiver` / `clinician` / `health_worker` | Drives RBAC middleware |
| `fullName` | String(100) | Y | — | — | Display name |
| `preferredLanguage` | Enum | Y | — | `en` / `hi` / `gu` | Default `en`; drives i18n |
| `isActive` | Boolean | Y | — | default `true` | Soft-delete flag |
| `lastLoginAt` | Date | N | — | — | Security monitoring |
| `refreshTokenHash` | String | N | — | hashed | Enables token revocation |
| `createdAt` / `updatedAt` | Date | Y | — | auto | Mongoose timestamps |

**Relationships:** `User` 1:1 `Patient` (when role=patient) · `User` 1:N `Escalation` (as assigned clinician)

---

## 2. Patient — ABDM-shaped demographic + clinical root

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | Internal patient ID |
| `userId` | ObjectId | Y | FK→User, IX unique | — | Login identity |
| `abhaId` | String(14) | N | IX unique sparse | 14-digit, Verhoeff checksum | ABHA number (Outcome 5) |
| `abhaAddress` | String(50) | N | — | `name@abdm` | ABHA address |
| `dateOfBirth` | Date | Y | — | past, age ≤ 120 | Age drives risk models |
| `gender` | Enum | Y | — | `male` / `female` / `other` | FHIR-aligned |
| `bloodGroup` | Enum | N | — | A/B/AB/O ± | Emergency use |
| `address.line` | String(200) | Y | — | — | Street/village |
| `address.district` | String(60) | Y | IX | — | Cohort segmentation |
| `address.state` | String(60) | Y | — | — | Drives state-scheme layer |
| `address.pincode` | String(6) | Y | IX | 6 digits, no leading 0 | Nearest-hospital lookup |
| `isRural` | Boolean | Y | IX | — | Key impact-metric segment |
| ~~`primaryCaregiverId`~~ | — | — | — | **removed** | Superseded by `CaregiverAssignment` (M:N) |
| `chronicConditions` | [String] | N | IX | ICD-10 codes | Feeds risk features |
| `allergies` | [String] | N | — | — | Safety check on prescriptions |
| `hasSmartphone` | Boolean | Y | — | — | Decides SMS vs app channel |
| `annualIncome` | Number | N | — | ≥ 0, INR | PM-JAY eligibility input |
| `rationCardType` | Enum | N | — | `APL` / `BPL` / `AAY` / `none` | PM-JAY eligibility input |

**Relationships:** 1:N `DischargePlan`, `SymptomLog`, `RiskAssessment`, `ScreeningRecord`, `SchemeEligibilityCheck`

---

## 3. DischargePlan — the care contract

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | Plan ID |
| `patientId` | ObjectId | Y | FK→Patient, IX | — | Owner |
| `clinicianId` | ObjectId | Y | FK→User | role = clinician | Author, accountable |
| `admissionDate` | Date | Y | — | ≤ dischargeDate | Length-of-stay feature |
| `dischargeDate` | Date | Y | IX | — | Anchor for all follow-up arithmetic |
| `primaryDiagnosis` | String(200) | Y | — | — | Human-readable |
| `diagnosisCode` | String(10) | Y | IX | ICD-10 | Machine-readable; protocol lookup |
| `procedureCodes` | [String] | N | — | ICD-10-PCS | Procedures performed |
| `dischargeSummary` | String(5000) | Y | — | — | Clinical narrative |
| `redFlags` | [String] | Y | — | min 1 | Condition-specific danger signs (drives Stage 4) |
| `dietaryAdvice` | String(1000) | N | — | — | Rendered multilingual |
| `activityRestrictions` | String(1000) | N | — | — | Rendered multilingual |
| `followUpProtocol` | Enum | Y | — | `cardiac` / `ckd` / `diabetes` / `post_surgical` / `general` | Template for auto-generating FollowUps |
| `status` | Enum | Y | IX | `active` / `completed` / `readmitted` / `lost_to_followup` | Outcome-7 denominator |
| `lengthOfStayDays` | Number | Y | — | derived, ≥ 0 | Denormalised risk feature |

**Relationships:** 1:N `Prescription`, 1:N `FollowUp`; N:1 `Patient`

---

## 4. Medication — master drug list (referenced, per your decision)

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | Drug ID |
| `genericName` | String(120) | Y | IX unique | lowercase | e.g. `metformin` — the cohort-query key |
| `brandNames` | [String] | N | IX | — | Indian market brands |
| `form` | Enum | Y | — | `tablet` / `capsule` / `syrup` / `injection` / `inhaler` / `topical` | Dosage form |
| `strength` | String(30) | Y | — | e.g. `500mg` | Per unit |
| `drugClass` | String(80) | N | IX | — | e.g. `biguanide` — class-level analytics |
| `commonSideEffects` | [String] | N | — | — | Shown in patient education |
| `contraindications` | [String] | N | — | — | Checked against `Patient.allergies` |
| `requiresRefrigeration` | Boolean | Y | — | default false | Rural supply-chain reality |

---

## 5. Prescription — junction resolving DischargePlan ↔ Medication

> This entity exists **because** you chose reference-over-embed. It carries the
> relationship attributes — data that belongs to neither parent alone.

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | Prescription line ID |
| `dischargePlanId` | ObjectId | Y | FK→DischargePlan, IX | compound IX with medicationId | Parent plan |
| `medicationId` | ObjectId | Y | FK→Medication, IX | — | Which drug |
| `dosage` | String(40) | Y | — | e.g. `1 tablet` | Amount per administration |
| `frequency` | Enum | Y | — | `OD` / `BD` / `TDS` / `QID` / `SOS` / `weekly` | Times per day |
| `timingSlots` | [Enum] | Y | — | `morning` / `afternoon` / `evening` / `night` | Generates reminder schedule |
| `withFood` | Enum | N | — | `before` / `after` / `with` / `any` | Adherence instruction |
| `durationDays` | Number | Y | — | ≥ 1 | Drives `endDate` |
| `startDate` | Date | Y | — | — | Usually = dischargeDate |
| `endDate` | Date | Y | IX | derived | `startDate + durationDays` |
| `isCritical` | Boolean | Y | IX | default false | ⚠ Missing this one may escalate |
| `instructions` | String(500) | N | — | — | Free-text, translated |

**Cardinality:** `DischargePlan ||--o{ Prescription }o--|| Medication`

---

## 6. FollowUp — the scheduled-contact calendar

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `dischargePlanId` | ObjectId | Y | FK→DischargePlan, IX | — | Parent |
| `patientId` | ObjectId | Y | FK→Patient, IX | denormalised | Query without join |
| `scheduledDate` | Date | Y | IX | — | Cron job scans this |
| `type` | Enum | Y | — | `teleconsult` / `in_person` / `lab_test` / `phone_check` | Modality |
| `description` | String(300) | Y | — | — | e.g. "Serum creatinine test" |
| `status` | Enum | Y | IX | `scheduled` / `completed` / `missed` / `rescheduled` / `cancelled` | Compliance metric |
| `completedDate` | Date | N | — | — | Actual vs scheduled = delay metric |
| `clinicianNotes` | String(1000) | N | — | — | Post-visit |
| `remindersSentCount` | Number | Y | — | default 0 | Prevents spam |
| `generatedBy` | Enum | Y | — | `protocol` / `manual` | Auto vs clinician-added |

---

## 7. AdherenceRecord — per-dose truth

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `prescriptionId` | ObjectId | Y | FK→Prescription, IX | compound IX with scheduledAt | Which med line |
| `patientId` | ObjectId | Y | FK→Patient, IX | denormalised | Cohort rollup |
| `scheduledAt` | DateTime | Y | IX | — | When the dose was due |
| `status` | Enum | Y | IX | `taken` / `missed` / `delayed` / `pending` | The measurement |
| `recordedAt` | DateTime | N | — | — | When patient confirmed |
| `delayMinutes` | Number | N | — | derived | `recordedAt − scheduledAt` |
| `reportedVia` | Enum | Y | — | `app` / `sms` / `ivr` / `caregiver` / `auto_missed` | Channel analysis |

---

## 8. SymptomLog — patient-reported state

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `patientId` | ObjectId | Y | FK→Patient, IX | compound IX with reportedAt | Reporter |
| `dischargePlanId` | ObjectId | N | FK→DischargePlan | — | Links symptom to episode |
| `reportedAt` | DateTime | Y | IX | — | Time of report |
| `symptoms` | [Object] | Y | — | min 1 | `{code, label, severity 1-5, durationHours}` |
| `vitals.temperatureC` | Number | N | — | 30–45 | Optional field capture |
| `vitals.systolicBP` | Number | N | — | 60–250 | — |
| `vitals.diastolicBP` | Number | N | — | 40–150 | — |
| `vitals.heartRate` | Number | N | — | 30–200 | — |
| `vitals.spo2` | Number | N | — | 50–100 | Pulse oximeter |
| `vitals.bloodGlucose` | Number | N | — | 20–600 | mg/dL |
| `freeText` | String(1000) | N | — | — | Vernacular narrative |
| `voiceNoteUrl` | String(500) | N | — | URL | Low-literacy input path |
| `reportedBy` | Enum | Y | — | `self` / `caregiver` / `health_worker` | Provenance |
| `triageTier` | Enum | Y | IX | `self_care` / `teleconsult` / `urgent` / `emergency` | ⚠ Rule-engine output |
| `capturedOffline` | Boolean | Y | — | default false | Outcome-6 provenance |

---

## 9. Escalation — the red-flag response record

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `source` | Enum | Y | IX | `symptom_log` / `missed_critical_dose` | Discriminator — which origin fired |
| `symptomLogId` | ObjectId | N | FK→SymptomLog, IX unique sparse | required iff `source=symptom_log` | Symptom trigger |
| `adherenceRecordId` | ObjectId | N | FK→AdherenceRecord, IX unique sparse | required iff `source=missed_critical_dose` | Missed-dose trigger |
| `patientId` | ObjectId | Y | FK→Patient, IX | denormalised | Queue grouping |
| `tier` | Enum | Y | IX | `teleconsult` / `urgent` / `emergency` | Priority ordering |
| `triggeredRules` | [String] | Y | — | min 1 | **Explainability** — which rules fired |
| `assignedClinicianId` | ObjectId | N | FK→User, IX | role = clinician | Queue ownership |
| `status` | Enum | Y | IX | `open` / `acknowledged` / `in_progress` / `resolved` / `escalated_further` | Lifecycle |
| `acknowledgedAt` | DateTime | N | — | — | **Response-time metric** |
| `resolvedAt` | DateTime | N | — | — | — |
| `responseTimeSeconds` | Number | N | — | derived | Outcome-7 KPI |
| `outcome` | Enum | N | — | `resolved_remotely` / `referred_opd` / `admitted` / `false_alarm` | Precision of the rule engine |
| `notes` | String(1000) | N | — | — | Clinician action taken |

---

## 10. RiskAssessment — versioned ML output

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `patientId` | ObjectId | Y | FK→Patient, IX | compound IX with assessedAt | Subject |
| `dischargePlanId` | ObjectId | N | FK→DischargePlan | — | Episode context |
| `modelType` | Enum | Y | IX | `readmission` / `adherence` | Which model |
| `modelVersion` | String(20) | Y | IX | semver | **Reproducibility** — never omit |
| `riskScore` | Number | Y | — | 0.0–1.0 | Raw probability |
| `riskBand` | Enum | Y | IX | `low` / `moderate` / `high` | Thresholded for clinicians |
| `thresholdUsed` | Number | Y | — | 0.0–1.0 | Your Stage-5 ethics decision, recorded |
| `topFactors` | [Object] | Y | — | 3–5 items | SHAP: `{feature, shapValue, direction}` |
| `featureSnapshot` | Object | Y | — | — | Inputs at inference time — audit trail |
| `assessedAt` | DateTime | Y | IX | — | — |

---

## 11. EducationContent — multilingual library

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `contentKey` | String(80) | Y | IX | slug; compound unique with `language` | e.g. `cardiac-wound-care` |
| `conditionCodes` | [String] | Y | IX | ICD-10 | Matches DischargePlan |
| `language` | Enum | Y | IX | `en` / `hi` / `gu` | Compound unique with contentKey |
| `title` | String(200) | Y | — | — | — |
| `body` | String(5000) | Y | — | — | Plain-language text |
| `readingLevel` | Number | Y | — | 1–12 | Health-literacy control |
| `audioUrl` | String(500) | N | — | URL | TTS for non-readers |
| `source` | Enum | Y | — | `curated` / `llm_generated` | Provenance |
| `reviewStatus` | Enum | Y | IX | `draft` / `clinician_reviewed` / `published` | ⚠ Safety guardrail |
| `reviewedBy` | ObjectId | N | FK→User | role = clinician | Accountability |

---

## 12. Scheme — government scheme definitions

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `schemeCode` | String(30) | Y | IX unique | — | e.g. `PMJAY`, `GUJ_MA_AMRUTAM` |
| `name` | String(150) | Y | — | — | Official name |
| `level` | Enum | Y | IX | `central` / `state` | Layering |
| `applicableStates` | [String] | N | IX | — | Empty = all-India |
| `coverageAmount` | Number | Y | — | INR | e.g. 500000 |
| `eligibilityRules` | [Object] | Y | — | min 1 | `{criterion, operator, value, description}` |
| `requiredDocuments` | [String] | Y | — | — | Checklist output |
| `isActive` | Boolean | Y | — | default true | Schemes lapse |

---

## 13. SchemeEligibilityCheck — explainable verdict record

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `patientId` | ObjectId | Y | FK→Patient, IX | — | Subject |
| `schemeId` | ObjectId | Y | FK→Scheme, IX | — | Scheme tested |
| `isEligible` | Boolean | Y | IX | — | Verdict |
| `criteriaResults` | [Object] | Y | — | — | `{criterion, expected, actual, passed}` — the explanation |
| `checkedAt` | DateTime | Y | — | — | Rules change; verdicts expire |

---

## 14. ScreeningRecord — offline-first field capture

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | Server ID |
| `clientUuid` | String(36) | Y | IX unique | UUID v4 | **Idempotency key** — generated offline, prevents duplicate sync |
| `healthWorkerId` | ObjectId | Y | FK→User, IX | role = health_worker | Who screened |
| `patientId` | ObjectId | N | FK→Patient | — | Null until matched/registered |
| `campLocation` | String(150) | Y | — | — | Village/camp name |
| `capturedAt` | DateTime | Y | — | — | **Device** time |
| `syncedAt` | DateTime | N | IX | — | **Server** time — the gap is your offline proof |
| `syncStatus` | Enum | Y | IX | `pending` / `synced` / `conflict` / `failed` | Outbox state |
| `screeningData` | Object | Y | — | — | Vitals + questionnaire responses |
| `offlineRiskFlag` | Enum | Y | — | `green` / `amber` / `red` | On-device rule output |
| `conflictResolution` | Enum | N | — | `server_wins_flagged` (chosen strategy) | Server value kept; record flagged for manual review |
| `conflictReviewedBy` | ObjectId | N | FK→User | role = health_worker | Who resolved the flagged conflict |
| `conflictReviewedAt` | DateTime | N | — | — | Closes the conflict queue item |

---

## 15. ConsentArtefact — ABDM consent (Outcome 5)

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `patientId` | ObjectId | Y | FK→Patient, IX | — | Grantor |
| `grantedToUserId` | ObjectId | Y | FK→User, IX | — | Grantee |
| `purpose` | Enum | Y | — | `care_management` / `emergency` / `research` | ABDM purpose codes |
| `dataCategories` | [Enum] | Y | — | — | What is shared |
| `validFrom` | Date | Y | IX | — | Start of consent window |
| `validUntil` | Date | Y | IX | > validFrom | Time-boxed |
| `status` | Enum | Y | IX | `active` / `revoked` / `expired` | — |
| `revokedAt` | DateTime | N | — | — | Patient's right to withdraw |

---

## 16. Notification — outbound message log

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `recipientUserId` | ObjectId | Y | FK→User, IX | — | Target |
| `channel` | Enum | Y | IX | `sms` / `push` / `whatsapp` / `ivr` | Delivery route |
| `purpose` | Enum | Y | IX | `med_reminder` / `followup_reminder` / `escalation_alert` / `education` | — |
| `relatedEntityType` | String(40) | N | — | — | Polymorphic link |
| `relatedEntityId` | ObjectId | N | — | — | — |
| `language` | Enum | Y | — | `en` / `hi` / `gu` | Rendered language |
| `body` | String(500) | Y | — | — | Sent text |
| `status` | Enum | Y | IX | `queued` / `sent` / `delivered` / `failed` | Provider callback |
| `providerMessageId` | String(100) | N | — | — | Twilio/MSG91 trace |
| `sentAt` | DateTime | N | — | — | — |

---

## 17. AuditLog — append-only access trail

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `actorUserId` | ObjectId | Y | FK→User, IX | — | Who acted |
| `action` | Enum | Y | IX | `read` / `create` / `update` / `delete` / `export` / `login_fail` | What |
| `resourceType` | String(40) | Y | IX | — | Which collection |
| `resourceId` | ObjectId | N | — | — | Which record |
| `patientId` | ObjectId | N | FK→Patient, IX | — | Whose data was touched |
| `ipAddress` | String(45) | N | — | IPv4/IPv6 | Forensics |
| `occurredAt` | DateTime | Y | IX | immutable | Retention: 7 years |

---

## 18. CaregiverAssignment — junction resolving User(caregiver) ↔ Patient

> Mirrors the `Prescription` pattern: an M:N relationship carrying its own attributes.
> Models the rural reality that one ASHA worker covers a village, and one patient
> may be supported by several family members.

| Field | Type | Req | Key/IX | Constraint | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | Y | PK | auto | — |
| `caregiverUserId` | ObjectId | Y | FK→User, IX | role = caregiver or health_worker; compound unique with patientId | The carer |
| `patientId` | ObjectId | Y | FK→Patient, IX | — | The cared-for |
| `relationship` | Enum | Y | — | `son` / `daughter` / `spouse` / `parent` / `asha_worker` / `other` | Nature of the bond |
| `isPrimary` | Boolean | Y | IX | max one `true` per patient | First contact on escalation |
| `canViewRecords` | Boolean | Y | — | default false | Enforced by RBAC + `ConsentArtefact` |
| `receivesAlerts` | Boolean | Y | — | default true | Escalation fan-out target |
| `assignedAt` | Date | Y | — | — | — |
| `isActive` | Boolean | Y | IX | default true | Carers change over time |

**Cardinality:** `User ||--o{ CaregiverAssignment }o--|| Patient`

---

## Decisions resolved (2026-09-17)

| # | Question | Decision | Consequence in the model |
|---|---|---|---|
| 1 | Medication embed vs reference | **Reference** | `Prescription` junction entity exists |
| 2 | Caregiver cardinality | **M:N** | `CaregiverAssignment` junction; `primaryCaregiverId` removed |
| 3 | Missed critical dose | **Auto-escalate** | `Escalation.source` enum; `symptomLogId` now nullable; `adherenceRecordId` added |
| 4 | Triage verdict storage | **Both entities** | `SymptomLog.triageTier` retained alongside `Escalation.tier` |
| 5 | Sync conflict strategy | **Server-wins + flag** | `conflictResolution`, `conflictReviewedBy`, `conflictReviewedAt` |
| 6 | ERD style | **Logical relational** | Physical embedding noted per entity, not drawn |

**Entity count: 18.** Two of them (`Prescription`, `CaregiverAssignment`) are junctions
resolving M:N relationships — the same pattern applied consistently.
