# 3. E-R, Use-Case, Activity and Sequence Diagrams

> All diagrams are Mermaid. Paste into <https://mermaid.live> to export PNG/SVG.
> Source of truth for entities and attributes: [`data-model.md`](./data-model.md).

---

# 3.1 Entity-Relationship Diagram

## 3.1.1 Notation

Crow's-foot notation, logical relational view.

| Symbol | Meaning |
|---|---|
| `||--o{` | One-to-many (one mandatory, many optional) |
| `||--||` | One-to-one (both mandatory) |
| `||--o|` | One-to-zero-or-one |
| `}o--||` | Many-to-one |
| PK / FK | Primary key / Foreign key |

**Note on the physical model:** the implementation database is MongoDB, a document
store. This ERD presents the *logical* model. Physically, each entity is its own
collection and foreign keys are `ObjectId` references resolved via `$lookup` or
Mongoose `populate`. Two attributes (`patientId` on `FollowUp`, `AdherenceRecord`
and `Escalation`) are deliberately denormalised for cohort-query performance.

## 3.1.2 Core ERD — Clinical Care Path

```mermaid
erDiagram
    USER ||--o| PATIENT : "is registered as"
    USER ||--o{ DISCHARGE_PLAN : "authors as clinician"
    USER ||--o{ CAREGIVER_ASSIGNMENT : "serves as caregiver in"
    PATIENT ||--o{ CAREGIVER_ASSIGNMENT : "is supported through"

    PATIENT ||--o{ DISCHARGE_PLAN : "receives"
    DISCHARGE_PLAN ||--o{ PRESCRIPTION : "specifies"
    MEDICATION ||--o{ PRESCRIPTION : "is prescribed in"
    DISCHARGE_PLAN ||--o{ FOLLOW_UP : "schedules"
    PRESCRIPTION ||--o{ ADHERENCE_RECORD : "generates dose events"

    PATIENT ||--o{ SYMPTOM_LOG : "reports"
    SYMPTOM_LOG ||--o| ESCALATION : "may trigger"
    ADHERENCE_RECORD ||--o| ESCALATION : "missed critical dose may trigger"
    USER ||--o{ ESCALATION : "is assigned as clinician"

    USER {
        ObjectId _id PK
        string email UK "nullable"
        string phone UK "primary login"
        string passwordHash "bcrypt cost 12"
        enum role "patient caregiver clinician health_worker"
        string fullName
        enum preferredLanguage "en hi gu"
        boolean isActive
        datetime lastLoginAt
    }

    PATIENT {
        ObjectId _id PK
        ObjectId userId FK
        string abhaId UK "14 digit nullable"
        string abhaAddress
        date dateOfBirth
        enum gender
        string addressDistrict
        string addressState
        string addressPincode
        boolean isRural
        array chronicConditions
        array allergies
        boolean hasSmartphone
        number annualIncome
        enum rationCardType "APL BPL AAY none"
    }

    CAREGIVER_ASSIGNMENT {
        ObjectId _id PK
        ObjectId caregiverUserId FK
        ObjectId patientId FK
        enum relationship "son daughter spouse asha_worker other"
        boolean isPrimary
        boolean canViewRecords
        boolean receivesAlerts
        boolean isActive
    }

    DISCHARGE_PLAN {
        ObjectId _id PK
        ObjectId patientId FK
        ObjectId clinicianId FK
        date admissionDate
        date dischargeDate
        string primaryDiagnosis
        string diagnosisCode "ICD-10"
        string dischargeSummary
        array redFlags
        enum followUpProtocol
        enum status "active completed readmitted lost_to_followup"
        number lengthOfStayDays
    }

    MEDICATION {
        ObjectId _id PK
        string genericName UK
        array brandNames
        enum form "tablet capsule syrup injection"
        string strength
        string drugClass
        array contraindications
        boolean requiresRefrigeration
    }

    PRESCRIPTION {
        ObjectId _id PK
        ObjectId dischargePlanId FK
        ObjectId medicationId FK
        string dosage
        enum frequency "OD BD TDS QID SOS"
        array timingSlots
        enum withFood
        number durationDays
        date startDate
        date endDate
        boolean isCritical
    }

    FOLLOW_UP {
        ObjectId _id PK
        ObjectId dischargePlanId FK
        ObjectId patientId FK
        date scheduledDate
        enum type "teleconsult in_person lab_test phone_check"
        string description
        enum status "scheduled completed missed rescheduled"
        date completedDate
        number remindersSentCount
        enum generatedBy "protocol manual"
    }

    ADHERENCE_RECORD {
        ObjectId _id PK
        ObjectId prescriptionId FK
        ObjectId patientId FK
        datetime scheduledAt
        enum status "taken missed delayed pending"
        datetime recordedAt
        number delayMinutes
        enum reportedVia "app sms ivr caregiver auto_missed"
    }

    SYMPTOM_LOG {
        ObjectId _id PK
        ObjectId patientId FK
        ObjectId dischargePlanId FK
        datetime reportedAt
        array symptoms
        object vitals
        string freeText
        string voiceNoteUrl
        enum reportedBy "self caregiver health_worker"
        enum triageTier "self_care teleconsult urgent emergency"
        boolean capturedOffline
    }

    ESCALATION {
        ObjectId _id PK
        enum source "symptom_log missed_critical_dose"
        ObjectId symptomLogId FK "nullable"
        ObjectId adherenceRecordId FK "nullable"
        ObjectId patientId FK
        enum tier "teleconsult urgent emergency"
        array triggeredRules
        ObjectId assignedClinicianId FK
        enum status "open acknowledged in_progress resolved"
        datetime acknowledgedAt
        datetime resolvedAt
        number responseTimeSeconds
        enum outcome
    }
```

## 3.1.3 Supporting ERD — Intelligence, Education, Schemes, Offline, Compliance

```mermaid
erDiagram
    PATIENT ||--o{ RISK_ASSESSMENT : "is scored in"
    DISCHARGE_PLAN ||--o{ RISK_ASSESSMENT : "provides context for"
    PATIENT ||--o{ SCHEME_ELIGIBILITY_CHECK : "is checked for"
    SCHEME ||--o{ SCHEME_ELIGIBILITY_CHECK : "is evaluated in"
    PATIENT ||--o{ SCREENING_RECORD : "is screened in"
    USER ||--o{ SCREENING_RECORD : "is captured by health worker"
    PATIENT ||--o{ CONSENT_ARTEFACT : "grants"
    USER ||--o{ CONSENT_ARTEFACT : "is granted"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ AUDIT_LOG : "acts in"
    PATIENT ||--o{ AUDIT_LOG : "is subject of"
    USER ||--o{ EDUCATION_CONTENT : "reviews as clinician"

    RISK_ASSESSMENT {
        ObjectId _id PK
        ObjectId patientId FK
        ObjectId dischargePlanId FK
        enum modelType "readmission adherence"
        string modelVersion "semver"
        number riskScore "0.0 to 1.0"
        enum riskBand "low moderate high"
        number thresholdUsed
        array topFactors "SHAP values"
        object featureSnapshot
        datetime assessedAt
    }

    EDUCATION_CONTENT {
        ObjectId _id PK
        string contentKey
        array conditionCodes "ICD-10"
        enum language "en hi gu"
        string title
        string body
        number readingLevel "1 to 12"
        string audioUrl
        enum source "curated llm_generated"
        enum reviewStatus "draft clinician_reviewed published"
        ObjectId reviewedBy FK
    }

    SCHEME {
        ObjectId _id PK
        string schemeCode UK
        string name
        enum level "central state"
        array applicableStates
        number coverageAmount
        array eligibilityRules
        array requiredDocuments
        boolean isActive
    }

    SCHEME_ELIGIBILITY_CHECK {
        ObjectId _id PK
        ObjectId patientId FK
        ObjectId schemeId FK
        boolean isEligible
        array criteriaResults "per-criterion explanation"
        datetime checkedAt
    }

    SCREENING_RECORD {
        ObjectId _id PK
        string clientUuid UK "idempotency key"
        ObjectId healthWorkerId FK
        ObjectId patientId FK "nullable until matched"
        string campLocation
        datetime capturedAt "device time"
        datetime syncedAt "server time"
        enum syncStatus "pending synced conflict failed"
        object screeningData
        enum offlineRiskFlag "green amber red"
        enum conflictResolution "server_wins_flagged"
        ObjectId conflictReviewedBy FK
    }

    CONSENT_ARTEFACT {
        ObjectId _id PK
        ObjectId patientId FK
        ObjectId grantedToUserId FK
        enum purpose "care_management emergency research"
        array dataCategories
        date validFrom
        date validUntil
        enum status "active revoked expired"
        datetime revokedAt
    }

    NOTIFICATION {
        ObjectId _id PK
        ObjectId recipientUserId FK
        enum channel "sms push whatsapp ivr"
        enum purpose "med_reminder followup_reminder escalation_alert"
        string relatedEntityType
        ObjectId relatedEntityId
        enum language "en hi gu"
        string body
        enum status "queued sent delivered failed"
        string providerMessageId
    }

    AUDIT_LOG {
        ObjectId _id PK
        ObjectId actorUserId FK
        enum action "read create update delete export login_fail"
        string resourceType
        ObjectId resourceId
        ObjectId patientId FK
        string ipAddress
        datetime occurredAt "immutable"
    }
```

## 3.1.4 Relationship Summary

| # | Parent | Child | Cardinality | Participation | Note |
|---|---|---|---|---|---|
| R1 | User | Patient | 1 : 0..1 | Partial | Only role=patient |
| R2 | User | CaregiverAssignment | 1 : 0..N | Partial | M:N leg |
| R3 | Patient | CaregiverAssignment | 1 : 0..N | Partial | M:N leg |
| R4 | Patient | DischargePlan | 1 : 0..N | Partial | Multiple admissions |
| R5 | User (clinician) | DischargePlan | 1 : 0..N | Partial | Authorship |
| R6 | DischargePlan | Prescription | 1 : 0..N | Total on child | M:N leg |
| R7 | Medication | Prescription | 1 : 0..N | Partial | M:N leg |
| R8 | DischargePlan | FollowUp | 1 : 0..N | Total on child | Protocol-generated |
| R9 | Prescription | AdherenceRecord | 1 : 0..N | Total on child | One per due dose |
| R10 | Patient | SymptomLog | 1 : 0..N | Partial | — |
| R11 | SymptomLog | Escalation | 1 : 0..1 | Partial | Only if a rule fires |
| R12 | AdherenceRecord | Escalation | 1 : 0..1 | Partial | Only if `isCritical` missed |
| R13 | User (clinician) | Escalation | 1 : 0..N | Partial | Queue assignment |
| R14 | Patient | RiskAssessment | 1 : 0..N | Partial | Versioned over time |
| R15 | Patient | SchemeEligibilityCheck | 1 : 0..N | Partial | Per scheme, per check |
| R16 | Scheme | SchemeEligibilityCheck | 1 : 0..N | Partial | — |
| R17 | User (health worker) | ScreeningRecord | 1 : 0..N | Total on child | — |
| R18 | Patient | ConsentArtefact | 1 : 0..N | Partial | — |
| R19 | User | Notification | 1 : 0..N | Partial | — |
| R20 | User | AuditLog | 1 : 0..N | Partial | Append-only |

**Many-to-many relationships resolved by junction entities: 2**
- `DischargePlan` ↔ `Medication` via `Prescription`
- `User` (caregiver) ↔ `Patient` via `CaregiverAssignment`

---

# 3.2 Use-Case Diagram

## 3.2.1 Actors

| Actor | Type | Description |
|---|---|---|
| Patient | Primary | Discharged individual under monitoring |
| Caregiver | Primary | Family member or ASHA worker acting for a patient |
| Clinician | Primary | Doctor authoring plans and handling escalations |
| Health Worker | Primary | Field operator conducting village screening |
| System Scheduler | Secondary | Automated cron process (non-human) |
| ML Service | Secondary | Risk scoring subsystem |
| SMS Gateway | Secondary | External notification provider |
| ABDM Gateway | Secondary | External health-identity provider |

## 3.2.2 System-Level Use-Case Diagram

```mermaid
flowchart LR
    P(("Patient"))
    C(("Caregiver"))
    D(("Clinician"))
    H(("Health<br/>Worker"))
    S(("System<br/>Scheduler"))
    ML(("ML<br/>Service"))
    SMS(("SMS<br/>Gateway"))
    AB(("ABDM<br/>Gateway"))

    subgraph SYS["DisCharge+ System"]
        direction TB
        U1["UC1 Register / Login"]
        U2["UC2 View Discharge Plan"]
        U3["UC3 Record Medication Dose"]
        U4["UC4 Report Symptoms"]
        U5["UC5 View Education Content"]
        U6["UC6 Check Scheme Eligibility"]
        U7["UC7 Create Discharge Plan"]
        U8["UC8 Generate Follow-up Calendar"]
        U9["UC9 Evaluate Red-Flag Rules"]
        U10["UC10 Manage Escalation Queue"]
        U11["UC11 View Cohort Dashboard"]
        U12["UC12 Request Risk Assessment"]
        U13["UC13 Conduct Offline Screening"]
        U14["UC14 Sync Offline Records"]
        U15["UC15 Resolve Sync Conflict"]
        U16["UC16 Send Reminder"]
        U17["UC17 Export FHIR Record"]
        U18["UC18 Manage Consent"]
        U19["UC19 Review Education Content"]
    end

    P --- U1
    P --- U2
    P --- U3
    P --- U4
    P --- U5
    P --- U6
    P --- U18

    C --- U1
    C --- U3
    C --- U4
    C --- U5

    D --- U1
    D --- U7
    D --- U10
    D --- U11
    D --- U17
    D --- U19

    H --- U1
    H --- U13
    H --- U14
    H --- U15

    S --- U16
    S --- U8

    U7 -.->|include| U8
    U4 -.->|include| U9
    U9 -.->|extend| U10
    U3 -.->|extend| U10
    U7 -.->|include| U12
    U13 -.->|include| U14
    U14 -.->|extend| U15
    U11 -.->|include| U12

    U12 --- ML
    U16 --- SMS
    U1 --- AB
    U17 --- AB
```

## 3.2.3 Use-Case Specifications (key cases)

### UC4 — Report Symptoms

| Element | Detail |
|---|---|
| **Actors** | Patient (primary), Caregiver (alternate) |
| **Precondition** | Authenticated; an active DischargePlan exists |
| **Trigger** | Patient feels unwell, or responds to a scheduled check-in |
| **Main flow** | 1. Select symptoms from icon grid. 2. Set severity 1–5. 3. Optionally enter vitals. 4. Optionally record a voice note. 5. Submit. 6. System evaluates red-flag rules (UC9). 7. System stores `triageTier`. 8. Guidance shown in the patient's language. |
| **Alternate A1** | Patient is offline → record queued locally, on-device rules give provisional guidance |
| **Alternate A2** | Caregiver reports on behalf → `reportedBy = caregiver` |
| **Extension** | If tier ≥ `urgent`, UC10 is invoked |
| **Postcondition** | `SymptomLog` persisted; `Escalation` created if triggered |
| **Outcome served** | 2 — Automated Escalation |

### UC9 — Evaluate Red-Flag Rules

| Element | Detail |
|---|---|
| **Actors** | System (invoked by UC4) |
| **Precondition** | A SymptomLog has been submitted |
| **Main flow** | 1. Load `redFlags` from the patient's DischargePlan. 2. Load protocol rule set by `followUpProtocol`. 3. Evaluate each rule against symptoms and vitals. 4. Collect all matching rule IDs. 5. Assign tier = highest severity matched. 6. Record `triggeredRules` for explainability. |
| **Business rule** | Where rules conflict, the **highest** severity always wins — false positives are preferred to false negatives |
| **Postcondition** | `triageTier` set; `Escalation` created when tier ≥ teleconsult |

### UC14 — Sync Offline Records

| Element | Detail |
|---|---|
| **Actors** | Health Worker, System |
| **Precondition** | Records exist locally with `syncStatus = pending`; connectivity restored |
| **Main flow** | 1. Detect connectivity. 2. Read outbox. 3. POST batch to `/api/sync/screenings`. 4. Server upserts on `clientUuid`. 5. Server returns per-record status. 6. Client marks synced and clears outbox. |
| **Alternate A1** | Record exists and has diverged → server value retained, `syncStatus = conflict` (UC15) |
| **Alternate A2** | Network drops mid-sync → exponential backoff retry; idempotency prevents duplicates |
| **Postcondition** | All records either synced or flagged; no duplicates created |
| **Outcome served** | 6 — Offline Field Capabilities |

---

# 3.3 Activity Diagrams

## 3.3.1 Discharge Plan Creation and Follow-up Generation

```mermaid
flowchart TD
    A(["Start — clinician initiates discharge"]) --> B["Select patient"]
    B --> C{"Patient has<br/>ABHA ID?"}
    C -->|No| D["Prompt ABHA creation / linking"]
    C -->|Yes| E["Enter admission and discharge dates"]
    D --> E
    E --> F["Enter diagnosis — ICD-10 coded"]
    F --> G["Add prescriptions"]

    G --> H{"Medication in<br/>master list?"}
    H -->|No| I["Create Medication master record"]
    H -->|Yes| J["Select medication"]
    I --> J
    J --> K{"Contraindicated<br/>against allergies?"}
    K -->|Yes| L["Warn clinician"]
    L --> M{"Override?"}
    M -->|No| J
    M -->|Yes| N["Set dosage, frequency, duration"]
    K -->|No| N
    N --> O["Mark isCritical if applicable"]
    O --> P{"More<br/>medications?"}
    P -->|Yes| H

    P -->|No| Q["Define red flags for condition"]
    Q --> R["Select follow-up protocol"]
    R --> S["Save DischargePlan"]

    S --> T["AUTO: generate FollowUp records<br/>from protocol + dischargeDate"]
    S --> U["AUTO: generate AdherenceRecord schedule<br/>from prescription timing slots"]
    S --> V["AUTO: request risk assessment<br/>from ml-svc"]

    T --> W["Assemble patient care package"]
    U --> W
    V --> W

    W --> X["Resolve education content<br/>by diagnosisCode + preferredLanguage"]
    X --> Y["Send discharge summary SMS<br/>in patient's language"]
    Y --> Z["Write audit log entry"]
    Z --> AA(["End — plan active, monitoring begins"])
```

## 3.3.2 Symptom Reporting and Escalation

```mermaid
flowchart TD
    A(["Start — patient opens symptom form"]) --> B{"Online?"}

    B -->|No| C["Load cached form"]
    C --> D["Capture symptoms"]
    D --> E["Run on-device rule subset"]
    E --> F["Show provisional guidance"]
    F --> G[("Queue in IndexedDB")]
    G --> H["Sync on reconnect"]
    H --> I

    B -->|Yes| J["Capture symptoms via icon grid"]
    J --> K["Set severity per symptom 1-5"]
    K --> L{"Vitals<br/>available?"}
    L -->|Yes| M["Enter BP, HR, SpO2, temp, glucose"]
    L -->|No| N["Skip"]
    M --> O{"Voice note?"}
    N --> O
    O -->|Yes| P["Record audio in local language"]
    O -->|No| Q["Submit"]
    P --> Q
    Q --> I["Persist SymptomLog"]

    I --> R["Load patient redFlags + protocol rules"]
    R --> S["Evaluate every rule"]
    S --> T{"Any rule<br/>matched?"}

    T -->|No| U["triageTier = self_care"]
    U --> V["Show self-care guidance<br/>in preferred language"]
    V --> END1(["End — logged, no escalation"])

    T -->|Yes| W["Take HIGHEST matched severity"]
    W --> X["Record triggeredRules list"]
    X --> Y["Create Escalation<br/>source = symptom_log"]
    Y --> Z{"Which<br/>tier?"}

    Z -->|teleconsult| AA["Add to clinician queue — normal priority"]
    Z -->|urgent| AB["Add to queue — high priority"]
    Z -->|emergency| AC["Add to queue — TOP priority"]

    AA --> AD["Notify assigned clinician — push"]
    AB --> AE["Notify clinician — push + SMS"]
    AC --> AF["Notify clinician — push + SMS + call"]
    AC --> AG["Alert all caregivers where receivesAlerts"]
    AC --> AH["Display emergency instructions<br/>+ nearest facility"]

    AD --> AI["Await acknowledgement"]
    AE --> AI
    AF --> AI
    AG --> AI
    AH --> AI

    AI --> AJ{"Acknowledged<br/>within SLA?"}
    AJ -->|No| AK["Escalate to on-call clinician"]
    AK --> AI
    AJ -->|Yes| AL["Record acknowledgedAt<br/>compute responseTimeSeconds"]
    AL --> AM["Clinician acts and records outcome"]
    AM --> AN["status = resolved"]
    AN --> END2(["End — escalation closed"])
```

## 3.3.3 Offline Screening and Conflict Resolution

```mermaid
flowchart TD
    A(["Start — health worker arrives at camp"]) --> B["Open installed PWA"]
    B --> C{"Network?"}
    C -->|Yes| D["Normal online mode"]
    C -->|No| E["Service Worker serves cached shell"]

    E --> F["Enter patient screening data"]
    F --> G["Generate clientUuid — UUID v4 on device"]
    G --> H["Capture vitals + questionnaire"]
    H --> I["Run lightweight on-device rules"]
    I --> J{"Risk<br/>flag?"}
    J -->|green| K["Advise routine follow-up"]
    J -->|amber| L["Advise PHC visit within 7 days"]
    J -->|red| M["Advise immediate referral"]
    K --> N[("Write to IndexedDB<br/>syncStatus = pending")]
    L --> N
    M --> N
    N --> O{"More<br/>patients?"}
    O -->|Yes| F
    O -->|No| P["Camp complete — await connectivity"]

    P --> Q{"Network<br/>restored?"}
    Q -->|No| R["Retry with exponential backoff"]
    R --> Q
    Q -->|Yes| S["Read pending outbox"]
    S --> T["POST batch to /api/sync/screenings"]

    T --> U{"Server: clientUuid<br/>already present?"}
    U -->|No| V["INSERT new ScreeningRecord"]
    U -->|"Yes, identical"| W["No-op — idempotent acknowledge"]
    U -->|"Yes, diverged"| X["SERVER WINS — retain server value"]

    V --> Y["Queue ML risk scoring"]
    X --> Z["Set syncStatus = conflict"]
    Z --> AA["Add to conflict review queue"]

    Y --> AB["Return per-record status"]
    W --> AB
    AA --> AB

    AB --> AC["Client marks records synced"]
    AC --> AD["Clear local outbox"]
    AD --> AE{"Conflicts<br/>flagged?"}
    AE -->|No| END1(["End — clean sync"])
    AE -->|Yes| AF["Health worker opens conflict queue"]
    AF --> AG["Compare device vs server values side by side"]
    AG --> AH["Worker chooses correct value"]
    AH --> AI["Record conflictReviewedBy + conflictReviewedAt"]
    AI --> END2(["End — conflicts resolved"])
```

## 3.3.4 Scheme Eligibility Check

```mermaid
flowchart TD
    A(["Start — patient requests eligibility check"]) --> B["Load patient profile"]
    B --> C{"Required fields<br/>present?"}
    C -->|No| D["Prompt for income, ration card, address"]
    D --> B
    C -->|Yes| E["Load active schemes for patient's state"]
    E --> F["Select next scheme"]
    F --> G["Load its eligibilityRules"]
    G --> H["Evaluate next criterion"]
    H --> I["Record expected vs actual vs passed"]
    I --> J{"More<br/>criteria?"}
    J -->|Yes| H
    J -->|No| K{"All criteria<br/>passed?"}
    K -->|Yes| L["isEligible = true"]
    K -->|No| M["isEligible = false"]
    L --> N["Attach required document checklist"]
    M --> O["List exactly which criteria failed"]
    N --> P["Persist SchemeEligibilityCheck"]
    O --> P
    P --> Q{"More<br/>schemes?"}
    Q -->|Yes| F
    Q -->|No| R["Present verdicts with per-criterion reasoning"]
    R --> S["Show nearest empanelled hospitals"]
    S --> T(["End"])
```

---

# 3.4 Sequence Diagrams

## 3.4.1 Authentication

```mermaid
sequenceDiagram
    actor U as User
    participant C as React Client
    participant A as Express API
    participant M as Auth Middleware
    participant DB as MongoDB

    U->>C: Enter phone + password
    C->>C: Client-side format validation
    C->>+A: POST /api/auth/login
    A->>A: Rate-limit check
    alt Limit exceeded
        A-->>C: 429 Too Many Requests
    else Within limit
        A->>+DB: findOne({ phone })
        DB-->>-A: User document
        alt User not found
            A->>DB: Write AuditLog (login_fail)
            A-->>C: 401 Invalid credentials
        else Found
            A->>A: bcrypt.compare(password, passwordHash)
            alt Mismatch
                A->>DB: Write AuditLog (login_fail)
                A-->>C: 401 Invalid credentials
            else Match
                A->>A: Sign access JWT (15 min)
                A->>A: Sign refresh token (7 days)
                A->>DB: Store refreshTokenHash, update lastLoginAt
                A->>DB: Write AuditLog (login success)
                A-->>-C: 200 { accessToken, refreshToken, role }
            end
        end
    end
    C->>C: Store tokens; route by role
    C-->>U: Render role-appropriate dashboard

    Note over C,A: Subsequent requests carry Authorization: Bearer <token>
    C->>+A: GET /api/patients/:id
    A->>+M: Verify JWT
    M->>M: Check signature and expiry
    M->>M: Check role permits resource
    M->>M: Check caller owns / is consented to record
    M-->>-A: Attach req.user
    A->>DB: Fetch record
    A->>DB: Write AuditLog (read)
    A-->>-C: 200 Patient record
```

## 3.4.2 Symptom Report to Clinician Escalation

```mermaid
sequenceDiagram
    actor P as Patient
    participant C as React Client
    participant A as Express API
    participant RE as Escalation Rule Engine
    participant DB as MongoDB
    participant N as Notification Service
    participant SMS as SMS Gateway
    actor D as Clinician

    P->>C: Select symptoms + severity
    C->>+A: POST /api/symptoms
    A->>A: Validate payload (Zod)
    A->>+DB: Insert SymptomLog
    DB-->>-A: symptomLogId

    A->>+DB: Fetch active DischargePlan (redFlags, protocol)
    DB-->>-A: Plan document
    A->>+RE: evaluate(symptoms, vitals, redFlags, protocol)
    RE->>RE: Match every rule
    RE->>RE: Select HIGHEST matched severity
    RE-->>-A: { tier, triggeredRules[] }

    A->>DB: Update SymptomLog.triageTier

    alt tier = self_care
        A-->>C: 200 { tier, guidance, educationContent }
        C-->>P: Show self-care advice in preferred language
    else tier >= teleconsult
        A->>+DB: Create Escalation (source = symptom_log)
        DB-->>-A: escalationId
        A->>+DB: Find available clinician
        DB-->>-A: clinicianId
        A->>DB: Assign escalation

        A->>+N: dispatch(escalation)
        alt tier = emergency
            N->>SMS: SMS to clinician
            N->>SMS: SMS to all alerting caregivers
            N->>D: Push notification (top priority)
            N->>C: Emergency instructions + nearest facility
        else tier = urgent
            N->>SMS: SMS to clinician
            N->>D: Push notification (high priority)
        else tier = teleconsult
            N->>D: Push notification (normal)
        end
        N->>DB: Log Notification records
        N-->>-A: Dispatch acknowledged

        A-->>-C: 200 { tier, escalated: true, guidance }
        C-->>P: Show urgency guidance

        D->>+A: GET /api/escalations/queue
        A->>DB: Fetch open escalations sorted by tier, then age
        A-->>-D: Triaged queue
        D->>+A: PATCH /api/escalations/:id/acknowledge
        A->>A: Compute responseTimeSeconds
        A->>DB: Update status, acknowledgedAt
        A->>DB: Write AuditLog
        A-->>-D: 200 Acknowledged
    end
```

## 3.4.3 Risk Assessment via ML Service

```mermaid
sequenceDiagram
    actor D as Clinician
    participant C as React Client
    participant A as Express API
    participant MC as ML Client (Node)
    participant F as FastAPI ml-svc
    participant FP as Feature Pipeline
    participant M as Trained Model
    participant S as SHAP Explainer
    participant DB as MongoDB

    D->>C: Open cohort dashboard
    C->>+A: GET /api/dashboard/cohort
    A->>+DB: Aggregate discharged patients
    DB-->>-A: Patient cohort
    A->>+DB: Fetch latest RiskAssessment per patient
    DB-->>-A: Cached assessments

    alt Assessment stale or absent
        A->>+DB: Gather features (plan, adherence, symptoms, demographics)
        DB-->>-A: Raw feature inputs
        A->>+MC: requestRisk(featurePayload)
        MC->>+F: POST /predict/readmission
        F->>F: Validate schema (Pydantic)
        F->>+FP: transform(rawFeatures)
        FP->>FP: Impute missing, encode categoricals, scale
        FP-->>-F: Feature vector
        F->>+M: predict_proba(vector)
        M-->>-F: riskScore 0.0-1.0
        F->>F: Apply operating threshold -> riskBand
        F->>+S: explain(vector)
        S->>S: Compute SHAP values
        S-->>-F: Top 5 contributing factors
        F-->>-MC: { riskScore, riskBand, thresholdUsed, topFactors, modelVersion }
        MC-->>-A: Risk response

        alt ml-svc unavailable
            MC-->>A: Timeout / 503
            A->>A: Degrade gracefully — serve last known assessment
            Note over A: Core care delivery continues without risk scores
        end

        A->>DB: Persist RiskAssessment with featureSnapshot
    end

    A-->>-C: 200 Cohort with risk bands
    C-->>D: Render stratified patient list

    D->>C: Click a high-risk patient
    C->>+A: GET /api/patients/:id/risk
    A->>DB: Fetch RiskAssessment
    A->>DB: Write AuditLog (read)
    A-->>-C: Score + SHAP factors + modelVersion
    C-->>D: Show "why" panel — factor-by-factor attribution
```

## 3.4.4 Offline Capture and Bulk Sync

```mermaid
sequenceDiagram
    actor H as Health Worker
    participant PWA as PWA Client
    participant SW as Service Worker
    participant IDB as IndexedDB
    participant A as Express API
    participant DB as MongoDB
    participant ML as ml-svc

    Note over H,SW: Village camp — no connectivity

    H->>PWA: Open app
    PWA->>SW: Request app shell
    SW-->>PWA: Serve cached shell
    PWA-->>H: Form renders offline

    loop For each patient screened
        H->>PWA: Enter screening data
        PWA->>PWA: Generate clientUuid (UUID v4)
        PWA->>PWA: Run on-device rule set
        PWA->>+IDB: put(record, syncStatus = pending)
        IDB-->>-PWA: Stored locally
        PWA-->>H: Show risk flag immediately
    end

    Note over PWA,A: Connectivity restored

    PWA->>PWA: online event fires
    PWA->>+IDB: getAll(syncStatus = pending)
    IDB-->>-PWA: 10 pending records
    PWA->>+A: POST /api/sync/screenings (batch)
    A->>A: Verify JWT, role = health_worker
    A->>A: Validate batch schema

    loop For each record in batch
        A->>+DB: findOne({ clientUuid })
        DB-->>-A: Existing record or null
        alt Not found
            A->>DB: Insert ScreeningRecord (syncStatus = synced)
            A->>ML: Queue risk scoring
        else Found and identical
            A->>A: Idempotent no-op
        else Found and diverged
            A->>DB: Retain server value, set syncStatus = conflict
            A->>DB: Add to conflict review queue
        end
    end

    A->>DB: Write AuditLog (bulk create)
    A-->>-PWA: 200 { synced: 9, conflicts: 1, failed: 0 }

    PWA->>+IDB: Update statuses from server response
    IDB-->>-PWA: Outbox cleared
    PWA-->>H: "9 synced, 1 needs review"

    alt Network fails mid-sync
        A--xPWA: Connection lost
        PWA->>PWA: Exponential backoff, retry
        PWA->>A: POST /api/sync/screenings (same clientUuids)
        A->>DB: Upsert on clientUuid — no duplicates created
        A-->>PWA: 200 Idempotent success
    end

    H->>PWA: Open conflict review
    PWA->>A: GET /api/sync/conflicts
    A-->>PWA: Device value vs server value
    H->>PWA: Select correct value
    PWA->>A: PATCH /api/sync/conflicts/:id/resolve
    A->>DB: Apply resolution, set conflictReviewedBy/At
    A-->>PWA: 200 Resolved
```

## 3.4.5 Medication Reminder and Missed-Dose Escalation

```mermaid
sequenceDiagram
    participant CR as node-cron Scheduler
    participant A as Express API
    participant DB as MongoDB
    participant N as Notification Service
    participant SMS as SMS Gateway
    actor P as Patient
    actor D as Clinician

    Note over CR: Runs every 15 minutes

    CR->>+A: triggerDoseReminders()
    A->>+DB: Find AdherenceRecord where status=pending<br/>and scheduledAt within window
    DB-->>-A: Due doses
    loop For each due dose
        A->>DB: Fetch patient preferredLanguage, hasSmartphone
        A->>+N: sendReminder(dose, language)
        alt hasSmartphone
            N->>P: Push notification in preferred language
        else No smartphone
            N->>SMS: SMS in preferred language
            SMS->>P: Text message
        end
        N->>DB: Insert Notification record
        N-->>-A: Dispatched
    end
    A-->>-CR: Reminders sent

    alt Patient responds
        P->>A: POST /api/adherence/:id { status: taken }
        A->>A: Compute delayMinutes
        A->>DB: Update AdherenceRecord
    else No response past grace period
        Note over CR: Missed-dose sweep job
        CR->>+A: sweepMissedDoses()
        A->>+DB: Find pending doses past grace window
        DB-->>-A: Missed doses
        loop For each missed dose
            A->>DB: Set status = missed, reportedVia = auto_missed
            A->>+DB: Fetch parent Prescription
            DB-->>-A: Prescription
            alt isCritical = true
                A->>DB: Create Escalation (source = missed_critical_dose)
                A->>+N: alertClinician(escalation)
                N->>D: Push + SMS — critical medication missed
                N->>DB: Log Notification
                N-->>-A: Dispatched
            else isCritical = false
                A->>DB: Record miss — feeds adherence risk model only
            end
        end
        A-->>-CR: Sweep complete
    end
```
