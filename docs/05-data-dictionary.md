# 5. Data Dictionary

**System:** DisCharge+ · **Database:** MongoDB (Atlas) · **ODM:** Mongoose
**Collections:** 18 · **Document date:** 17 September 2026

## Conventions

| Notation | Meaning |
|---|---|
| **PK** | Primary key |
| **FK** | Foreign key (Mongoose `ObjectId` reference) |
| **UK** | Unique key |
| **IX** | Indexed (non-unique) |
| **CIX** | Component of a compound index |
| **Null** | `N` = NOT NULL (required); `Y` = nullable (optional) |
| ObjectId | MongoDB 12-byte identifier, 24 hex characters |

All collections carry Mongoose `createdAt` and `updatedAt` timestamps
(`Date`, NOT NULL, auto-managed); these are omitted from the tables below.

---

## 5.1 `users`

Authentication and role assignment for all four actor types.

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | Unique user identifier |
| `email` | String | 254 | UK sparse | Y | RFC 5322 format; lowercased | Optional login ID |
| `phone` | String | 13 | UK | N | `+91` followed by 10 digits, first digit 6–9 | Primary login ID |
| `passwordHash` | String | 60 | — | N | bcrypt hash, cost factor 12 | Never stores plaintext |
| `role` | String (enum) | 12 | IX | N | See ENUM-01 | Drives RBAC |
| `fullName` | String | 100 | — | N | Min 2 characters | Display name |
| `preferredLanguage` | String (enum) | 2 | — | N | See ENUM-02; default `en` | UI and message language |
| `isActive` | Boolean | 1 B | — | N | Default `true` | Soft-delete flag |
| `lastLoginAt` | Date | 8 B | — | Y | — | Security monitoring |
| `refreshTokenHash` | String | 64 | — | Y | SHA-256 hash | Enables token revocation |

---

## 5.2 `patients`

ABDM-shaped demographic and clinical profile.

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | Internal patient ID |
| `userId` | ObjectId | 12 B | FK, UK | N | → `users._id`; role must be `patient` | Login identity |
| `abhaId` | String | 14 | UK sparse | Y | 14 digits; Verhoeff checksum | ABHA number |
| `abhaAddress` | String | 50 | — | Y | Format `name@abdm` | ABHA address |
| `dateOfBirth` | Date | 8 B | — | N | Must be past; implied age ≤ 120 | Age is a model feature |
| `gender` | String (enum) | 6 | — | N | See ENUM-03 | FHIR-aligned |
| `bloodGroup` | String (enum) | 3 | — | Y | See ENUM-04 | Emergency reference |
| `address.line` | String | 200 | — | N | — | Street / village |
| `address.district` | String | 60 | IX | N | — | Cohort segmentation |
| `address.state` | String | 60 | — | N | — | Selects state scheme layer |
| `address.pincode` | String | 6 | IX | N | 6 digits; first digit 1–9 | Facility lookup |
| `isRural` | Boolean | 1 B | IX | N | — | Impact-metric segment |
| `chronicConditions` | Array\<String\> | — | IX | Y | Each a valid ICD-10 code | Risk model features |
| `allergies` | Array\<String\> | — | — | Y | — | Checked before prescribing |
| `hasSmartphone` | Boolean | 1 B | — | N | — | Selects push vs SMS channel |
| `annualIncome` | Number | 8 B | — | Y | ≥ 0; INR | PM-JAY eligibility input |
| `rationCardType` | String (enum) | 4 | — | Y | See ENUM-05 | PM-JAY eligibility input |

---

## 5.3 `caregiverassignments`

Junction resolving the M:N relationship between caregivers and patients.

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `caregiverUserId` | ObjectId | 12 B | FK, CIX | N | → `users._id`; role `caregiver` or `health_worker` | The carer |
| `patientId` | ObjectId | 12 B | FK, CIX | N | → `patients._id` | The cared-for |
| `relationship` | String (enum) | 12 | — | N | See ENUM-06 | Nature of the bond |
| `isPrimary` | Boolean | 1 B | IX | N | At most one `true` per patient | First escalation contact |
| `canViewRecords` | Boolean | 1 B | — | N | Default `false` | Gates record access |
| `receivesAlerts` | Boolean | 1 B | — | N | Default `true` | Escalation fan-out target |
| `assignedAt` | Date | 8 B | — | N | — | Assignment date |
| `isActive` | Boolean | 1 B | IX | N | Default `true` | Carers change over time |

**Compound unique index:** (`caregiverUserId`, `patientId`)

---

## 5.4 `dischargeplans`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | Plan ID |
| `patientId` | ObjectId | 12 B | FK, IX | N | → `patients._id` | Owner |
| `clinicianId` | ObjectId | 12 B | FK | N | → `users._id`; role `clinician` | Accountable author |
| `admissionDate` | Date | 8 B | — | N | ≤ `dischargeDate` | Start of episode |
| `dischargeDate` | Date | 8 B | IX | N | ≥ `admissionDate` | Anchor for all scheduling |
| `primaryDiagnosis` | String | 200 | — | N | — | Human-readable |
| `diagnosisCode` | String | 10 | IX | N | Valid ICD-10 | Protocol and content lookup |
| `procedureCodes` | Array\<String\> | — | — | Y | Valid ICD-10-PCS | Procedures performed |
| `dischargeSummary` | String | 5000 | — | N | — | Clinical narrative |
| `redFlags` | Array\<String\> | — | — | N | Min 1 element | Danger signs for rule engine |
| `dietaryAdvice` | String | 1000 | — | Y | — | Translated for patient |
| `activityRestrictions` | String | 1000 | — | Y | — | Translated for patient |
| `followUpProtocol` | String (enum) | 14 | — | N | See ENUM-07 | Template for scheduling |
| `status` | String (enum) | 18 | IX | N | See ENUM-08; default `active` | Outcome-7 denominator |
| `lengthOfStayDays` | Number | 8 B | — | N | ≥ 0; derived | Denormalised risk feature |

---

## 5.5 `medications`

Master drug reference list.

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | Drug ID |
| `genericName` | String | 120 | UK | N | Lowercased | Cohort-query key |
| `brandNames` | Array\<String\> | — | IX | Y | — | Indian market brands |
| `form` | String (enum) | 10 | — | N | See ENUM-09 | Dosage form |
| `strength` | String | 30 | — | N | e.g. `500mg` | Per unit |
| `drugClass` | String | 80 | IX | Y | — | Class-level analytics |
| `commonSideEffects` | Array\<String\> | — | — | Y | — | Shown in education content |
| `contraindications` | Array\<String\> | — | — | Y | — | Checked against allergies |
| `requiresRefrigeration` | Boolean | 1 B | — | N | Default `false` | Rural supply constraint |

---

## 5.6 `prescriptions`

Junction resolving the M:N relationship between discharge plans and medications.

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | Prescription line |
| `dischargePlanId` | ObjectId | 12 B | FK, CIX | N | → `dischargeplans._id` | Parent plan |
| `medicationId` | ObjectId | 12 B | FK, CIX | N | → `medications._id` | Drug prescribed |
| `dosage` | String | 40 | — | N | e.g. `1 tablet` | Amount per administration |
| `frequency` | String (enum) | 6 | — | N | See ENUM-10 | Doses per day |
| `timingSlots` | Array\<String (enum)\> | — | — | N | See ENUM-11; min 1 | Generates dose schedule |
| `withFood` | String (enum) | 6 | — | Y | See ENUM-12 | Administration instruction |
| `durationDays` | Number | 8 B | — | N | ≥ 1 | Course length |
| `startDate` | Date | 8 B | — | N | — | Usually = discharge date |
| `endDate` | Date | 8 B | IX | N | Derived: start + duration | Course end |
| `isCritical` | Boolean | 1 B | IX | N | Default `false` | Missing this escalates |
| `instructions` | String | 500 | — | Y | — | Free text, translated |

---

## 5.7 `followups`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `dischargePlanId` | ObjectId | 12 B | FK, IX | N | → `dischargeplans._id` | Parent plan |
| `patientId` | ObjectId | 12 B | FK, IX | N | → `patients._id`; denormalised | Avoids join on cohort query |
| `scheduledDate` | Date | 8 B | IX | N | ≥ discharge date | Scanned by reminder job |
| `type` | String (enum) | 12 | — | N | See ENUM-13 | Modality |
| `description` | String | 300 | — | N | — | e.g. "Serum creatinine test" |
| `status` | String (enum) | 12 | IX | N | See ENUM-14; default `scheduled` | Compliance metric |
| `completedDate` | Date | 8 B | — | Y | — | Actual date attended |
| `clinicianNotes` | String | 1000 | — | Y | — | Post-visit record |
| `remindersSentCount` | Number | 4 B | — | N | ≥ 0; default 0 | Prevents over-messaging |
| `generatedBy` | String (enum) | 8 | — | N | See ENUM-15 | Auto vs manual origin |

---

## 5.8 `adherencerecords`

One document per scheduled dose. Highest-volume collection.

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `prescriptionId` | ObjectId | 12 B | FK, CIX | N | → `prescriptions._id` | Parent med line |
| `patientId` | ObjectId | 12 B | FK, IX | N | → `patients._id`; denormalised | Cohort rollup |
| `scheduledAt` | DateTime | 8 B | CIX | N | — | When dose was due |
| `status` | String (enum) | 8 | IX | N | See ENUM-16; default `pending` | The measurement |
| `recordedAt` | DateTime | 8 B | — | Y | — | When confirmed |
| `delayMinutes` | Number | 4 B | — | Y | Derived; ≥ 0 | `recordedAt − scheduledAt` |
| `reportedVia` | String (enum) | 12 | — | N | See ENUM-17 | Channel effectiveness analysis |

**Compound index:** (`prescriptionId`, `scheduledAt`)

---

## 5.9 `symptomlogs`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `patientId` | ObjectId | 12 B | FK, CIX | N | → `patients._id` | Subject |
| `dischargePlanId` | ObjectId | 12 B | FK | Y | → `dischargeplans._id` | Episode context |
| `reportedAt` | DateTime | 8 B | CIX | N | — | Report timestamp |
| `symptoms` | Array\<Object\> | — | — | N | Min 1; see COMP-01 | Structured symptom list |
| `vitals.temperatureC` | Number | 4 B | — | Y | 30.0 – 45.0 | Degrees Celsius |
| `vitals.systolicBP` | Number | 4 B | — | Y | 60 – 250 | mmHg |
| `vitals.diastolicBP` | Number | 4 B | — | Y | 40 – 150 | mmHg |
| `vitals.heartRate` | Number | 4 B | — | Y | 30 – 200 | Beats per minute |
| `vitals.spo2` | Number | 4 B | — | Y | 50 – 100 | Oxygen saturation % |
| `vitals.bloodGlucose` | Number | 4 B | — | Y | 20 – 600 | mg/dL |
| `freeText` | String | 1000 | — | Y | — | Narrative, any language |
| `voiceNoteUrl` | String | 500 | — | Y | Valid URL | Low-literacy input |
| `reportedBy` | String (enum) | 14 | — | N | See ENUM-18 | Provenance |
| `triageTier` | String (enum) | 12 | IX | N | See ENUM-19 | Rule-engine verdict |
| `capturedOffline` | Boolean | 1 B | — | N | Default `false` | Offline provenance |

**Compound index:** (`patientId`, `reportedAt` desc)

---

## 5.10 `escalations`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `source` | String (enum) | 20 | IX | N | See ENUM-20 | Which origin fired |
| `symptomLogId` | ObjectId | 12 B | FK, UK sparse | Y | → `symptomlogs._id`; required iff `source = symptom_log` | Symptom trigger |
| `adherenceRecordId` | ObjectId | 12 B | FK, UK sparse | Y | → `adherencerecords._id`; required iff `source = missed_critical_dose` | Missed-dose trigger |
| `patientId` | ObjectId | 12 B | FK, IX | N | → `patients._id`; denormalised | Queue grouping |
| `tier` | String (enum) | 12 | IX | N | See ENUM-21 | Priority ordering |
| `triggeredRules` | Array\<String\> | — | — | N | Min 1 element | Explainability record |
| `assignedClinicianId` | ObjectId | 12 B | FK, IX | Y | → `users._id`; role `clinician` | Queue ownership |
| `status` | String (enum) | 18 | IX | N | See ENUM-22; default `open` | Lifecycle state |
| `acknowledgedAt` | DateTime | 8 B | — | Y | — | Starts response-time metric |
| `resolvedAt` | DateTime | 8 B | — | Y | ≥ `acknowledgedAt` | Closure time |
| `responseTimeSeconds` | Number | 8 B | — | Y | Derived; ≥ 0 | Outcome-7 KPI |
| `outcome` | String (enum) | 18 | — | Y | See ENUM-23 | Measures rule precision |
| `notes` | String | 1000 | — | Y | — | Clinician action taken |

---

## 5.11 `riskassessments`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `patientId` | ObjectId | 12 B | FK, CIX | N | → `patients._id` | Subject |
| `dischargePlanId` | ObjectId | 12 B | FK | Y | → `dischargeplans._id` | Episode context |
| `modelType` | String (enum) | 12 | IX | N | See ENUM-24 | Which model ran |
| `modelVersion` | String | 20 | IX | N | Semantic version | Reproducibility |
| `riskScore` | Number | 8 B | — | N | 0.0 – 1.0 | Raw probability |
| `riskBand` | String (enum) | 8 | IX | N | See ENUM-25 | Thresholded band |
| `thresholdUsed` | Number | 8 B | — | N | 0.0 – 1.0 | Operating point applied |
| `topFactors` | Array\<Object\> | — | — | N | 3–5 elements; see COMP-02 | SHAP attribution |
| `featureSnapshot` | Object | — | — | N | — | Inference inputs, for audit |
| `assessedAt` | DateTime | 8 B | CIX | N | — | Scoring timestamp |

**Compound index:** (`patientId`, `assessedAt` desc)

---

## 5.12 `educationcontents`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `contentKey` | String | 80 | CIX | N | Slug format | Logical content identifier |
| `conditionCodes` | Array\<String\> | — | IX | N | Valid ICD-10 | Matches discharge diagnosis |
| `language` | String (enum) | 2 | CIX | N | See ENUM-02 | Rendered language |
| `title` | String | 200 | — | N | — | Content heading |
| `body` | String | 5000 | — | N | — | Plain-language text |
| `readingLevel` | Number | 4 B | — | N | 1 – 12 | Health-literacy control |
| `audioUrl` | String | 500 | — | Y | Valid URL | TTS for non-readers |
| `source` | String (enum) | 14 | — | N | See ENUM-26 | Provenance |
| `reviewStatus` | String (enum) | 20 | IX | N | See ENUM-27; default `draft` | Safety gate |
| `reviewedBy` | ObjectId | 12 B | FK | Y | → `users._id`; role `clinician` | Accountability |

**Compound unique index:** (`contentKey`, `language`)
**Business rule:** a document with `source = llm_generated` may not reach
`reviewStatus = published` without a non-null `reviewedBy`.

---

## 5.13 `schemes`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `schemeCode` | String | 30 | UK | N | Uppercase | e.g. `PMJAY` |
| `name` | String | 150 | — | N | — | Official scheme name |
| `level` | String (enum) | 7 | IX | N | See ENUM-28 | Central or state |
| `applicableStates` | Array\<String\> | — | IX | Y | Empty = all-India | Geographic applicability |
| `coverageAmount` | Number | 8 B | — | N | ≥ 0; INR | Annual cover |
| `eligibilityRules` | Array\<Object\> | — | — | N | Min 1; see COMP-03 | Encoded criteria |
| `requiredDocuments` | Array\<String\> | — | — | N | — | Applicant checklist |
| `isActive` | Boolean | 1 B | — | N | Default `true` | Schemes lapse |

---

## 5.14 `schemeeligibilitychecks`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `patientId` | ObjectId | 12 B | FK, IX | N | → `patients._id` | Subject |
| `schemeId` | ObjectId | 12 B | FK, IX | N | → `schemes._id` | Scheme evaluated |
| `isEligible` | Boolean | 1 B | IX | N | — | Verdict |
| `criteriaResults` | Array\<Object\> | — | — | N | See COMP-04 | Per-criterion explanation |
| `checkedAt` | DateTime | 8 B | — | N | — | Verdicts expire as rules change |

---

## 5.15 `screeningrecords`

Offline-originated field screening data.

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | Server-side ID |
| `clientUuid` | String | 36 | UK | N | UUID v4, device-generated | **Idempotency key** for sync |
| `healthWorkerId` | ObjectId | 12 B | FK, IX | N | → `users._id`; role `health_worker` | Who screened |
| `patientId` | ObjectId | 12 B | FK | Y | → `patients._id` | Null until matched |
| `campLocation` | String | 150 | — | N | — | Village or camp name |
| `capturedAt` | DateTime | 8 B | — | N | Device clock | Capture time |
| `syncedAt` | DateTime | 8 B | IX | Y | Server clock | Sync time |
| `syncStatus` | String (enum) | 8 | IX | N | See ENUM-29; default `pending` | Outbox state |
| `screeningData` | Object | — | — | N | — | Vitals + questionnaire |
| `offlineRiskFlag` | String (enum) | 5 | — | N | See ENUM-30 | On-device rule output |
| `conflictResolution` | String (enum) | 20 | — | Y | `server_wins_flagged` | Applied strategy |
| `conflictReviewedBy` | ObjectId | 12 B | FK | Y | → `users._id` | Who resolved conflict |
| `conflictReviewedAt` | DateTime | 8 B | — | Y | — | Closes conflict item |

---

## 5.16 `consentartefacts`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `patientId` | ObjectId | 12 B | FK, IX | N | → `patients._id` | Grantor |
| `grantedToUserId` | ObjectId | 12 B | FK, IX | N | → `users._id` | Grantee |
| `purpose` | String (enum) | 16 | — | N | See ENUM-31 | ABDM purpose code |
| `dataCategories` | Array\<String (enum)\> | — | — | N | Min 1; see ENUM-32 | Scope of sharing |
| `validFrom` | Date | 8 B | IX | N | — | Consent window start |
| `validUntil` | Date | 8 B | IX | N | > `validFrom` | Consent window end |
| `status` | String (enum) | 8 | IX | N | See ENUM-33; default `active` | Current state |
| `revokedAt` | DateTime | 8 B | — | Y | — | Withdrawal timestamp |

---

## 5.17 `notifications`

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `recipientUserId` | ObjectId | 12 B | FK, IX | N | → `users._id` | Target |
| `channel` | String (enum) | 8 | IX | N | See ENUM-34 | Delivery route |
| `purpose` | String (enum) | 20 | IX | N | See ENUM-35 | Message category |
| `relatedEntityType` | String | 40 | — | Y | Collection name | Polymorphic link |
| `relatedEntityId` | ObjectId | 12 B | — | Y | — | Polymorphic target |
| `language` | String (enum) | 2 | — | N | See ENUM-02 | Rendered language |
| `body` | String | 500 | — | N | — | Message text sent |
| `status` | String (enum) | 10 | IX | N | See ENUM-36; default `queued` | Delivery state |
| `providerMessageId` | String | 100 | — | Y | — | Gateway trace ID |
| `sentAt` | DateTime | 8 B | — | Y | — | Dispatch time |

---

## 5.18 `auditlogs`

Append-only. No update or delete operation is permitted on this collection.

| Field | Data Type | Size | Key | Null | Constraint / Validation | Description |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | 12 B | PK | N | Auto-generated | — |
| `actorUserId` | ObjectId | 12 B | FK, IX | N | → `users._id` | Who performed the action |
| `action` | String (enum) | 10 | IX | N | See ENUM-37 | What was done |
| `resourceType` | String | 40 | IX | N | Collection name | What was touched |
| `resourceId` | ObjectId | 12 B | — | Y | — | Which document |
| `patientId` | ObjectId | 12 B | FK, IX | Y | → `patients._id` | Whose data |
| `ipAddress` | String | 45 | — | Y | IPv4 or IPv6 | Forensic trace |
| `occurredAt` | DateTime | 8 B | IX | N | Immutable | Event time; 7-year retention |

---

## 5.19 Enumeration Reference

| ID | Enumeration | Permitted values |
|---|---|---|
| ENUM-01 | Role | `patient`, `caregiver`, `clinician`, `health_worker` |
| ENUM-02 | Language | `en`, `hi`, `gu` |
| ENUM-03 | Gender | `male`, `female`, `other` |
| ENUM-04 | BloodGroup | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| ENUM-05 | RationCardType | `APL`, `BPL`, `AAY`, `none` |
| ENUM-06 | Relationship | `son`, `daughter`, `spouse`, `parent`, `asha_worker`, `other` |
| ENUM-07 | FollowUpProtocol | `cardiac`, `ckd`, `diabetes`, `post_surgical`, `general` |
| ENUM-08 | PlanStatus | `active`, `completed`, `readmitted`, `lost_to_followup` |
| ENUM-09 | DrugForm | `tablet`, `capsule`, `syrup`, `injection`, `inhaler`, `topical` |
| ENUM-10 | Frequency | `OD`, `BD`, `TDS`, `QID`, `SOS`, `weekly` |
| ENUM-11 | TimingSlot | `morning`, `afternoon`, `evening`, `night` |
| ENUM-12 | WithFood | `before`, `after`, `with`, `any` |
| ENUM-13 | FollowUpType | `teleconsult`, `in_person`, `lab_test`, `phone_check` |
| ENUM-14 | FollowUpStatus | `scheduled`, `completed`, `missed`, `rescheduled`, `cancelled` |
| ENUM-15 | GeneratedBy | `protocol`, `manual` |
| ENUM-16 | AdherenceStatus | `taken`, `missed`, `delayed`, `pending` |
| ENUM-17 | ReportChannel | `app`, `sms`, `ivr`, `caregiver`, `auto_missed` |
| ENUM-18 | ReporterType | `self`, `caregiver`, `health_worker` |
| ENUM-19 | TriageTier | `self_care`, `teleconsult`, `urgent`, `emergency` |
| ENUM-20 | EscalationSource | `symptom_log`, `missed_critical_dose` |
| ENUM-21 | EscalationTier | `teleconsult`, `urgent`, `emergency` |
| ENUM-22 | EscalationStatus | `open`, `acknowledged`, `in_progress`, `resolved`, `escalated_further` |
| ENUM-23 | EscalationOutcome | `resolved_remotely`, `referred_opd`, `admitted`, `false_alarm` |
| ENUM-24 | ModelType | `readmission`, `adherence` |
| ENUM-25 | RiskBand | `low`, `moderate`, `high` |
| ENUM-26 | ContentSource | `curated`, `llm_generated` |
| ENUM-27 | ReviewStatus | `draft`, `clinician_reviewed`, `published` |
| ENUM-28 | SchemeLevel | `central`, `state` |
| ENUM-29 | SyncStatus | `pending`, `synced`, `conflict`, `failed` |
| ENUM-30 | RiskFlag | `green`, `amber`, `red` |
| ENUM-31 | ConsentPurpose | `care_management`, `emergency`, `research` |
| ENUM-32 | DataCategory | `demographics`, `diagnosis`, `medications`, `vitals`, `symptoms`, `risk_scores` |
| ENUM-33 | ConsentStatus | `active`, `revoked`, `expired` |
| ENUM-34 | NotificationChannel | `sms`, `push`, `whatsapp`, `ivr` |
| ENUM-35 | NotificationPurpose | `med_reminder`, `followup_reminder`, `escalation_alert`, `education` |
| ENUM-36 | DeliveryStatus | `queued`, `sent`, `delivered`, `failed` |
| ENUM-37 | AuditAction | `read`, `create`, `update`, `delete`, `export`, `login_fail` |

## 5.20 Composite Type Reference

| ID | Type | Structure |
|---|---|---|
| COMP-01 | Symptom | `{ code: String, label: String, severity: Number 1–5, durationHours: Number }` |
| COMP-02 | ShapFactor | `{ feature: String, shapValue: Number, direction: 'increases' \| 'decreases' }` |
| COMP-03 | EligibilityRule | `{ criterion: String, operator: String, value: Any, description: String }` |
| COMP-04 | CriterionResult | `{ criterion: String, expected: Any, actual: Any, passed: Boolean }` |
| COMP-05 | Address | `{ line: String, district: String, state: String, pincode: String }` |
| COMP-06 | Vitals | `{ temperatureC, systolicBP, diastolicBP, heartRate, spo2, bloodGlucose }` — all Number, all optional |

## 5.21 Index Summary

| Collection | Index | Type | Purpose |
|---|---|---|---|
| `users` | `phone` | Unique | Login lookup |
| `users` | `email` | Unique sparse | Alternate login |
| `users` | `role` | Single | RBAC filtering |
| `patients` | `userId` | Unique | Identity join |
| `patients` | `abhaId` | Unique sparse | ABDM lookup |
| `patients` | `address.district`, `isRural` | Single | Cohort segmentation |
| `caregiverassignments` | `caregiverUserId` + `patientId` | Compound unique | Prevents duplicate assignment |
| `dischargeplans` | `patientId` | Single | Patient history |
| `dischargeplans` | `status`, `dischargeDate` | Single | Active-cohort query |
| `medications` | `genericName` | Unique | Cohort drug query |
| `prescriptions` | `dischargePlanId` + `medicationId` | Compound | Plan expansion |
| `prescriptions` | `isCritical` | Single | Missed-dose sweep |
| `followups` | `scheduledDate`, `status` | Single | Reminder job scan |
| `adherencerecords` | `prescriptionId` + `scheduledAt` | Compound | Dose lookup |
| `adherencerecords` | `patientId`, `status` | Single | Adherence rate rollup |
| `symptomlogs` | `patientId` + `reportedAt` desc | Compound | Patient timeline |
| `symptomlogs` | `triageTier` | Single | False-negative audit |
| `escalations` | `status` + `tier` | Compound | Triaged queue ordering |
| `escalations` | `assignedClinicianId` | Single | Per-clinician queue |
| `riskassessments` | `patientId` + `assessedAt` desc | Compound | Latest score lookup |
| `educationcontents` | `contentKey` + `language` | Compound unique | Localised retrieval |
| `screeningrecords` | `clientUuid` | Unique | **Sync idempotency** |
| `screeningrecords` | `syncStatus` | Single | Conflict queue |
| `consentartefacts` | `patientId` + `status` | Compound | Access-check lookup |
| `auditlogs` | `patientId`, `occurredAt` | Single | Compliance retrieval |

## 5.22 Data Volume Estimates

Assuming 200 discharged patients under active monitoring:

| Collection | Est. documents | Growth driver |
|---|---|---|
| `users` | ~250 | Patients + caregivers + staff |
| `patients` | 200 | — |
| `dischargeplans` | ~220 | Some patients readmitted |
| `prescriptions` | ~1,100 | ~5 medications per plan |
| `adherencerecords` | ~66,000 | 5 meds × 2 doses/day × 30 days × 220 plans |
| `followups` | ~880 | ~4 per plan |
| `symptomlogs` | ~6,600 | ~1 per patient per day |
| `escalations` | ~300 | ~5% of symptom logs escalate |
| `riskassessments` | ~660 | Rescored weekly |
| `auditlogs` | ~150,000 | Every read and write |

`adherencerecords` and `auditlogs` dominate write volume, which is why both carry
targeted compound indexes and `auditlogs` is append-only with a defined retention period.
