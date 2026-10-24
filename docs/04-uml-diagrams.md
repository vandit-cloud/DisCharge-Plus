# 4. UML Diagrams

> Mermaid source. Paste into <https://mermaid.live> to export PNG/SVG.

---

# 4.1 Class Diagram — Domain Model

Where the ERD (§3.1) shows *data at rest*, the class diagram adds **behaviour** —
the operations each entity is responsible for.

```mermaid
classDiagram
    direction TB

    class User {
        -ObjectId _id
        -String email
        -String phone
        -String passwordHash
        -Role role
        -String fullName
        -Language preferredLanguage
        -Boolean isActive
        -Date lastLoginAt
        +register(dto) User
        +authenticate(password) Boolean
        +hashPassword(plain) String
        +issueAccessToken() String
        +issueRefreshToken() String
        +revokeTokens() void
        +hasPermission(resource, action) Boolean
    }

    class Patient {
        -ObjectId _id
        -ObjectId userId
        -String abhaId
        -Date dateOfBirth
        -Gender gender
        -Address address
        -Boolean isRural
        -String[] chronicConditions
        -String[] allergies
        -Number annualIncome
        -RationCardType rationCardType
        +getAge() Number
        +validateAbhaId() Boolean
        +getActiveDischargePlan() DischargePlan
        +getActiveCaregivers() CaregiverAssignment[]
        +toFhirResource() FhirPatient
        +hasAllergyTo(medication) Boolean
    }

    class CaregiverAssignment {
        -ObjectId _id
        -ObjectId caregiverUserId
        -ObjectId patientId
        -Relationship relationship
        -Boolean isPrimary
        -Boolean canViewRecords
        -Boolean receivesAlerts
        -Boolean isActive
        +grantRecordAccess() void
        +revokeRecordAccess() void
        +shouldReceiveAlert(tier) Boolean
    }

    class DischargePlan {
        -ObjectId _id
        -ObjectId patientId
        -ObjectId clinicianId
        -Date admissionDate
        -Date dischargeDate
        -String primaryDiagnosis
        -String diagnosisCode
        -String[] redFlags
        -Protocol followUpProtocol
        -PlanStatus status
        -Number lengthOfStayDays
        +generateFollowUpSchedule() FollowUp[]
        +generateDoseSchedule() AdherenceRecord[]
        +calculateLengthOfStay() Number
        +getAdherenceRate() Number
        +markReadmitted() void
        +toFhirEncounter() FhirEncounter
    }

    class Medication {
        -ObjectId _id
        -String genericName
        -String[] brandNames
        -DrugForm form
        -String strength
        -String drugClass
        -String[] contraindications
        -Boolean requiresRefrigeration
        +isContraindicatedFor(patient) Boolean
        +getLocalisedName(language) String
    }

    class Prescription {
        -ObjectId _id
        -ObjectId dischargePlanId
        -ObjectId medicationId
        -String dosage
        -Frequency frequency
        -TimingSlot[] timingSlots
        -Number durationDays
        -Date startDate
        -Date endDate
        -Boolean isCritical
        +expandToDoseEvents() AdherenceRecord[]
        +calculateEndDate() Date
        +isActiveOn(date) Boolean
        +getAdherenceRate() Number
    }

    class FollowUp {
        -ObjectId _id
        -ObjectId dischargePlanId
        -ObjectId patientId
        -Date scheduledDate
        -FollowUpType type
        -FollowUpStatus status
        -Date completedDate
        -Number remindersSentCount
        +markCompleted(notes) void
        +markMissed() void
        +reschedule(newDate) FollowUp
        +isOverdue() Boolean
        +getDelayDays() Number
    }

    class AdherenceRecord {
        -ObjectId _id
        -ObjectId prescriptionId
        -ObjectId patientId
        -DateTime scheduledAt
        -AdherenceStatus status
        -DateTime recordedAt
        -Number delayMinutes
        -Channel reportedVia
        +markTaken(channel) void
        +markMissed() void
        +calculateDelay() Number
        +isWithinGracePeriod() Boolean
        +shouldEscalate() Boolean
    }

    class SymptomLog {
        -ObjectId _id
        -ObjectId patientId
        -ObjectId dischargePlanId
        -DateTime reportedAt
        -Symptom[] symptoms
        -Vitals vitals
        -String freeText
        -String voiceNoteUrl
        -ReporterType reportedBy
        -TriageTier triageTier
        -Boolean capturedOffline
        +getMaxSeverity() Number
        +hasVitalsOutOfRange() Boolean
        +assignTriageTier(tier) void
    }

    class Escalation {
        -ObjectId _id
        -EscalationSource source
        -ObjectId symptomLogId
        -ObjectId adherenceRecordId
        -ObjectId patientId
        -TriageTier tier
        -String[] triggeredRules
        -ObjectId assignedClinicianId
        -EscalationStatus status
        -DateTime acknowledgedAt
        -Number responseTimeSeconds
        +assignTo(clinician) void
        +acknowledge(clinician) void
        +resolve(outcome, notes) void
        +escalateFurther() void
        +calculateResponseTime() Number
        +getPriorityWeight() Number
        +explainTrigger() String[]
    }

    class RiskAssessment {
        -ObjectId _id
        -ObjectId patientId
        -ModelType modelType
        -String modelVersion
        -Number riskScore
        -RiskBand riskBand
        -Number thresholdUsed
        -ShapFactor[] topFactors
        -Object featureSnapshot
        -DateTime assessedAt
        +applyThreshold(score) RiskBand
        +getTopFactors(n) ShapFactor[]
        +isStale(maxAgeHours) Boolean
        +explain() String
    }

    class ScreeningRecord {
        -ObjectId _id
        -String clientUuid
        -ObjectId healthWorkerId
        -ObjectId patientId
        -String campLocation
        -DateTime capturedAt
        -DateTime syncedAt
        -SyncStatus syncStatus
        -Object screeningData
        -RiskFlag offlineRiskFlag
        -ConflictStrategy conflictResolution
        +generateClientUuid() String
        +evaluateOfflineRules() RiskFlag
        +markSynced() void
        +flagConflict() void
        +resolveConflict(userId, value) void
    }

    class EducationContent {
        -ObjectId _id
        -String contentKey
        -String[] conditionCodes
        -Language language
        -String title
        -String body
        -Number readingLevel
        -String audioUrl
        -ContentSource source
        -ReviewStatus reviewStatus
        +matchesCondition(icdCode) Boolean
        +isPublishable() Boolean
        +requiresClinicianReview() Boolean
        +generateAudio() String
    }

    class Scheme {
        -ObjectId _id
        -String schemeCode
        -String name
        -SchemeLevel level
        -String[] applicableStates
        -Number coverageAmount
        -EligibilityRule[] eligibilityRules
        -String[] requiredDocuments
        +appliesToState(state) Boolean
        +evaluate(patient) SchemeEligibilityCheck
        +getDocumentChecklist() String[]
    }

    class SchemeEligibilityCheck {
        -ObjectId _id
        -ObjectId patientId
        -ObjectId schemeId
        -Boolean isEligible
        -CriterionResult[] criteriaResults
        -DateTime checkedAt
        +getFailedCriteria() CriterionResult[]
        +explain() String
        +isExpired() Boolean
    }

    class ConsentArtefact {
        -ObjectId _id
        -ObjectId patientId
        -ObjectId grantedToUserId
        -ConsentPurpose purpose
        -String[] dataCategories
        -Date validFrom
        -Date validUntil
        -ConsentStatus status
        +isValidNow() Boolean
        +revoke() void
        +covers(dataCategory) Boolean
    }

    class Notification {
        -ObjectId _id
        -ObjectId recipientUserId
        -Channel channel
        -NotificationPurpose purpose
        -Language language
        -String body
        -DeliveryStatus status
        -String providerMessageId
        +send() Boolean
        +markDelivered(providerId) void
        +markFailed(reason) void
        +selectChannel(user) Channel
    }

    class AuditLog {
        -ObjectId _id
        -ObjectId actorUserId
        -AuditAction action
        -String resourceType
        -ObjectId resourceId
        -ObjectId patientId
        -String ipAddress
        -DateTime occurredAt
        +record(actor, action, resource) AuditLog
    }

    User "1" -- "0..1" Patient : registers as
    User "1" -- "0..*" CaregiverAssignment : cares through
    Patient "1" -- "0..*" CaregiverAssignment : supported through
    User "1" -- "0..*" DischargePlan : authors
    Patient "1" -- "0..*" DischargePlan : receives
    DischargePlan "1" *-- "0..*" Prescription : contains
    Medication "1" -- "0..*" Prescription : prescribed as
    DischargePlan "1" *-- "0..*" FollowUp : schedules
    Prescription "1" *-- "0..*" AdherenceRecord : expands to
    Patient "1" -- "0..*" SymptomLog : reports
    SymptomLog "1" -- "0..1" Escalation : triggers
    AdherenceRecord "1" -- "0..1" Escalation : triggers
    User "1" -- "0..*" Escalation : handles
    Patient "1" -- "0..*" RiskAssessment : scored by
    Patient "1" -- "0..*" ScreeningRecord : screened in
    Patient "1" -- "0..*" SchemeEligibilityCheck : checked in
    Scheme "1" -- "0..*" SchemeEligibilityCheck : evaluated in
    Patient "1" -- "0..*" ConsentArtefact : grants
    User "1" -- "0..*" Notification : receives
    User "1" -- "0..*" AuditLog : generates
```

**Composition vs association:** `DischargePlan *-- Prescription`, `*-- FollowUp`
and `Prescription *-- AdherenceRecord` are **compositions** (filled diamond) — the
child cannot exist without its parent and is deleted with it. Everything else is a
plain association: a `Medication` outlives any prescription referencing it, and a
`Patient` outlives any individual plan.

---

# 4.2 Class Diagram — Service Layer

```mermaid
classDiagram
    direction LR

    class AuthService {
        -UserRepository userRepo
        -TokenService tokenService
        +register(dto) AuthResult
        +login(phone, password) AuthResult
        +refresh(refreshToken) AuthResult
        +logout(userId) void
        -verifyPassword(plain, hash) Boolean
    }

    class RbacMiddleware {
        -Object policy
        +requireAuth(req, res, next) void
        +requireRole(roles) Function
        +requireOwnership(resource) Function
        +requireConsent(category) Function
    }

    class DischargeService {
        -DischargePlanRepository planRepo
        -FollowUpGenerator generator
        -MlClient mlClient
        +createPlan(dto) DischargePlan
        +addPrescription(planId, dto) Prescription
        +closePlan(planId, status) void
        -validateContraindications(planId) Warning[]
    }

    class FollowUpGenerator {
        -Object templates
        +generate(plan) FollowUp[]
        +generateDoseEvents(prescription) AdherenceRecord[]
        -applyTemplate(template, anchorDate) Date[]
    }

    class EscalationRuleEngine {
        -RuleSet[] ruleSets
        +evaluate(symptomLog, plan) TriageResult
        +evaluateMissedDose(record) TriageResult
        -loadRulesFor(protocol) RuleSet
        -matchRule(rule, symptoms, vitals) Boolean
        -selectHighestTier(matches) TriageTier
    }

    class EscalationService {
        -EscalationRepository repo
        -NotificationService notifier
        -ClinicianAssigner assigner
        +createFromSymptom(log, result) Escalation
        +createFromMissedDose(record) Escalation
        +getQueue(clinicianId) Escalation[]
        +acknowledge(id, clinicianId) void
        +resolve(id, outcome) void
    }

    class MlClient {
        -String baseUrl
        -Number timeoutMs
        +predictReadmission(features) RiskResponse
        +predictAdherence(features) RiskResponse
        -buildFeaturePayload(patient, plan) Object
        -handleUnavailable() RiskResponse
    }

    class SchemeMatcher {
        -SchemeRepository schemeRepo
        +checkAll(patient) SchemeEligibilityCheck[]
        +check(patient, scheme) SchemeEligibilityCheck
        -evaluateCriterion(rule, patient) CriterionResult
    }

    class SyncService {
        -ScreeningRepository repo
        +bulkSync(records, workerId) SyncResult
        -upsertByClientUuid(record) UpsertOutcome
        -detectConflict(incoming, existing) Boolean
        -applyServerWins(incoming, existing) void
        +getConflicts(workerId) ScreeningRecord[]
        +resolveConflict(id, userId, value) void
    }

    class NotificationService {
        -SmsProvider smsProvider
        -PushProvider pushProvider
        +dispatch(escalation) void
        +sendReminder(dose, language) void
        -selectChannel(user) Channel
        -localise(templateKey, language) String
    }

    class FhirExportService {
        +exportPatient(patientId) FhirBundle
        -mapPatient(patient) FhirPatient
        -mapEncounter(plan) FhirEncounter
        -mapMedicationRequest(rx) FhirMedicationRequest
    }

    class AuditService {
        +record(actor, action, resource, ip) void
        +queryByPatient(patientId) AuditLog[]
    }

    class ReminderJob {
        -NotificationService notifier
        +runDoseReminders() void
        +runFollowUpReminders() void
        +sweepMissedDoses() void
    }

    AuthService --> RbacMiddleware : issues tokens for
    DischargeService --> FollowUpGenerator : uses
    DischargeService --> MlClient : requests risk
    EscalationService --> EscalationRuleEngine : uses
    EscalationService --> NotificationService : notifies via
    ReminderJob --> NotificationService : sends via
    ReminderJob --> EscalationService : escalates missed critical doses
    SyncService --> MlClient : queues scoring
    DischargeService --> AuditService : logs
    EscalationService --> AuditService : logs
    FhirExportService --> AuditService : logs export
```

---

# 4.3 Component Diagram

```mermaid
flowchart TB
    subgraph CL["client — React PWA"]
        direction TB
        C1["Pages<br/>patient · clinician · field"]
        C2["Components<br/>shared UI"]
        C3["Hooks<br/>TanStack Query"]
        C4["db/<br/>Dexie + sync queue"]
        C5["locales/<br/>en · hi · gu"]
        C6["lib/<br/>api client, auth"]
        C1 --> C2
        C1 --> C3
        C3 --> C6
        C1 --> C4
        C1 --> C5
    end

    subgraph SV["server — Node + Express"]
        direction TB
        S1["routes/"]
        S2["middleware/<br/>auth · rbac · validate · audit"]
        S3["controllers/"]
        S4["services/<br/>escalation · scheme · sync · ml client · fhir"]
        S5["models/<br/>18 Mongoose schemas"]
        S6["jobs/<br/>node-cron"]
        S1 --> S2 --> S3 --> S4 --> S5
        S6 --> S4
    end

    subgraph MLS["ml-svc — FastAPI"]
        direction TB
        M1["main.py<br/>routes"]
        M2["features/<br/>preprocessing pipeline"]
        M3["models/<br/>serialised + versioned"]
        M4["explain/<br/>SHAP"]
        M1 --> M2 --> M3 --> M4
    end

    DB[("MongoDB Atlas")]
    EXT["External<br/>SMS · ABDM · TTS"]

    C6 -->|"REST / JWT"| S1
    C4 -.->|"bulk sync"| S1
    S5 --> DB
    S4 -->|"REST"| M1
    S4 --> EXT
```

---

# 4.4 State Diagrams

## 4.4.1 Escalation Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Open : rule fires (symptom or missed critical dose)

    Open --> Acknowledged : clinician acknowledges
    Open --> EscalatedFurther : SLA breached, no acknowledgement

    EscalatedFurther --> Acknowledged : on-call clinician acknowledges

    Acknowledged --> InProgress : clinician begins intervention
    InProgress --> Resolved : outcome recorded

    Resolved --> [*]

    note right of Open
        responseTimeSeconds clock
        starts here
    end note

    note right of Resolved
        outcome: resolved_remotely,
        referred_opd, admitted,
        or false_alarm
    end note
```

## 4.4.2 Screening Record Sync Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending : captured offline, clientUuid assigned

    Pending --> Synced : upserted, no divergence
    Pending --> Conflict : server copy diverged
    Pending --> Failed : validation or auth error

    Failed --> Pending : retry with backoff
    Conflict --> Synced : health worker resolves

    Synced --> [*]

    note right of Pending
        Lives in IndexedDB outbox.
        Retry is safe — clientUuid
        makes the write idempotent.
    end note
```

## 4.4.3 Discharge Plan Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active : clinician creates plan

    Active --> Completed : all follow-ups done, duration elapsed
    Active --> Readmitted : patient readmitted to hospital
    Active --> LostToFollowUp : no contact past threshold

    Completed --> [*]
    Readmitted --> [*]
    LostToFollowUp --> [*]

    note right of Readmitted
        This transition is the
        outcome label for the
        readmission risk model.
    end note
```

## 4.4.4 Adherence Record Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending : dose scheduled from prescription

    Pending --> Taken : patient confirms within window
    Pending --> Delayed : confirmed after grace period
    Pending --> Missed : grace period elapsed, no confirmation

    Delayed --> [*]
    Taken --> [*]
    Missed --> MissedCritical : parent prescription isCritical
    Missed --> [*] : non-critical, feeds risk model only
    MissedCritical --> [*] : Escalation created
```

---

# 4.5 Package Diagram

```mermaid
flowchart TB
    subgraph ROOT["DisCharge+"]
        direction TB
        subgraph P1["client"]
            direction LR
            PA1["pages"]
            PA2["components"]
            PA3["hooks"]
            PA4["db"]
            PA5["locales"]
            PA6["lib"]
        end
        subgraph P2["server"]
            direction LR
            PB1["routes"]
            PB2["controllers"]
            PB3["services"]
            PB4["models"]
            PB5["middleware"]
            PB6["jobs"]
        end
        subgraph P3["ml-svc"]
            direction LR
            PC1["app"]
            PC2["features"]
            PC3["models"]
            PC4["explain"]
            PC5["notebooks"]
        end
        subgraph P4["docs"]
            direction LR
            PD1["diagrams"]
            PD2["DECISIONS.md"]
            PD3["LEARNING_LOG.md"]
        end
        subgraph P5["data"]
            PE1["synthetic + public datasets"]
        end
    end

    P1 -->|"HTTP"| P2
    P2 -->|"HTTP"| P3
    P3 -.->|"trained on"| P5
```
