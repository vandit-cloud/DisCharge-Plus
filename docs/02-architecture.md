# 2. Architecture Diagram

> Diagrams are written in Mermaid. Paste any block into <https://mermaid.live> to
> export PNG/SVG for the report, or view directly on GitHub.

## 2.1 Architectural Style

DisCharge+ follows a **three-tier, service-oriented architecture** with an
**offline-first presentation tier**.

| Tier | Responsibility | Technology |
|---|---|---|
| Presentation | UI, local persistence, sync queue | React PWA + IndexedDB |
| Application | Business logic, auth, orchestration | Node.js + Express |
| Intelligence | Risk models, explanations | Python + FastAPI |
| Data | Persistence | MongoDB Atlas |

The Application tier is the only component that talks to the database. The
Intelligence tier is stateless — it receives features and returns scores, holding no
patient records of its own. This keeps the ML service independently deployable and
means a failure there degrades risk scoring without affecting core care delivery.

## 2.2 High-Level Architecture

```mermaid
flowchart TB
    subgraph CLIENT["PRESENTATION TIER — React PWA (Vercel)"]
        direction LR
        PA["Patient App<br/>multilingual, low-literacy UI"]
        CD["Clinician Dashboard<br/>cohort + triage queue"]
        FW["Field Worker Module<br/>OFFLINE CAPABLE"]
        IDB[("IndexedDB / Dexie<br/>local store + sync outbox")]
        SW["Service Worker<br/>asset + shell cache"]
        FW --- IDB
        PA --- IDB
        SW -.-> PA
        SW -.-> FW
    end

    subgraph SERVER["APPLICATION TIER — Node.js + Express (Render)"]
        direction TB
        MW["Middleware<br/>JWT auth · RBAC · validation · rate limit · audit"]
        subgraph SVC["Service Layer"]
            direction LR
            S1["Discharge &<br/>Follow-up"]
            S2["Escalation<br/>Rule Engine"]
            S3["Scheme<br/>Matcher"]
            S4["Sync<br/>Handler"]
            S5["FHIR<br/>Exporter"]
            S6["ML<br/>Client"]
        end
        JOBS["Scheduled Jobs — node-cron<br/>dose reminders · follow-up alerts · missed-dose sweep"]
        MW --> SVC
        JOBS --> SVC
    end

    subgraph ML["INTELLIGENCE TIER — FastAPI (Render)"]
        direction TB
        API["POST /predict/readmission<br/>POST /predict/adherence"]
        FE["Feature Pipeline"]
        MDL["Trained Models<br/>LogReg · Gradient Boosting"]
        SHAP["SHAP Explainer"]
        API --> FE --> MDL --> SHAP
    end

    DB[("MongoDB Atlas<br/>18 collections<br/>ABDM-shaped records")]

    subgraph EXT["EXTERNAL SERVICES"]
        direction LR
        SMS["Twilio / MSG91<br/>SMS gateway"]
        ABDM["ABDM Sandbox<br/>ABHA / consent"]
        TTS["TTS Service<br/>hi / gu audio"]
    end

    CLIENT -->|"HTTPS · REST · JWT"| SERVER
    IDB -.->|"bulk sync on reconnect"| SERVER
    SERVER <-->|"Mongoose ODM"| DB
    SERVER -->|"REST · internal"| ML
    SERVER --> SMS
    SERVER <--> ABDM
    SERVER --> TTS
```

## 2.3 Request Flow — Online Path

```mermaid
flowchart LR
    U(["User"]) --> R["React component"]
    R --> Q["TanStack Query<br/>cache layer"]
    Q -->|"cache miss"| AX["Axios + JWT header"]
    AX --> RT["Express route"]
    RT --> AU{"JWT valid?"}
    AU -->|no| E401["401 Unauthorized"]
    AU -->|yes| RB{"Role permitted?"}
    RB -->|no| E403["403 Forbidden"]
    RB -->|yes| VAL{"Payload valid?"}
    VAL -->|no| E400["400 Bad Request"]
    VAL -->|yes| CTL["Controller"]
    CTL --> SVCL["Service layer<br/>business logic"]
    SVCL --> MOD["Mongoose model"]
    MOD --> DB[("MongoDB")]
    SVCL -.->|"if risk needed"| MLS["ml-svc"]
    CTL --> AUD["Audit log write"]
    CTL --> RES["JSON response"]
    RES --> Q
```

Every request passes authentication, authorisation and validation before reaching
business logic, and every record access is written to the audit log. This ordering is
deliberate: validation after authorisation means an unauthenticated caller learns
nothing about the expected payload shape.

## 2.4 Offline Flow — Field Worker Path

```mermaid
flowchart TB
    START(["Health worker opens<br/>screening form in village"]) --> NET{"Network<br/>available?"}

    NET -->|No| L1["Render cached app shell<br/>from Service Worker"]
    L1 --> L2["Capture screening record"]
    L2 --> L3["Generate clientUuid<br/>UUID v4, on device"]
    L3 --> L4["Run on-device rule set<br/>→ green / amber / red"]
    L4 --> L5[("Write to IndexedDB<br/>syncStatus = pending")]
    L5 --> L6["Show result to worker<br/>immediately"]
    L6 --> MORE{"More<br/>patients?"}
    MORE -->|Yes| L2
    MORE -->|No| WAIT["Await connectivity"]

    NET -->|Yes| O1["Normal online submit"]

    WAIT --> DET{"Connectivity<br/>restored?"}
    DET -->|No| WAIT
    DET -->|Yes| SY1["Read pending queue<br/>from outbox"]
    SY1 --> SY2["POST /api/sync/screenings<br/>batched payload"]
    SY2 --> SY3{"Server: does<br/>clientUuid exist?"}
    SY3 -->|No| SY4["Insert record"]
    SY3 -->|"Yes, unchanged"| SY5["Idempotent no-op<br/>→ acknowledge"]
    SY3 -->|"Yes, diverged"| SY6["SERVER WINS<br/>flag syncStatus = conflict"]
    SY4 --> SY7["Queue ML risk scoring"]
    SY5 --> ACK["Mark local record synced"]
    SY6 --> RQ["Add to conflict review queue"]
    SY7 --> ACK
    RQ --> HR["Health worker reviews<br/>flagged conflict manually"]
    ACK --> DONE(["Local outbox cleared"])
    HR --> DONE
```

The `clientUuid` is the load-bearing element. Because it is generated on the device
before the record ever reaches the network, a retried request resolves to the same
key and the server upserts rather than inserts — so a flaky connection produces one
record, not several.

## 2.5 Deployment Architecture

```mermaid
flowchart TB
    subgraph EDGE["Client Devices"]
        PH["Patient phone<br/>browser / installed PWA"]
        TAB["Health worker tablet<br/>installed PWA, offline"]
        DESK["Clinician desktop<br/>browser"]
    end

    subgraph CLOUD["Cloud Infrastructure"]
        subgraph V["Vercel — Global CDN"]
            ST["Static React build<br/>+ Service Worker"]
        end
        subgraph RN["Render"]
            N["Node API container<br/>Express"]
            P["Python ML container<br/>FastAPI + Uvicorn"]
        end
        subgraph AT["MongoDB Atlas"]
            PRI[("Primary")]
            SEC[("Secondary replica")]
            PRI -.->|replication| SEC
        end
    end

    subgraph TP["Third Party"]
        T["Twilio / MSG91"]
        A["ABDM Sandbox"]
    end

    PH -->|HTTPS| ST
    TAB -->|HTTPS| ST
    DESK -->|HTTPS| ST
    ST -->|"REST / JWT"| N
    N -->|"internal REST"| P
    N -->|"TLS"| PRI
    N --> T
    N <--> A
```

## 2.6 Security Architecture

```mermaid
flowchart TB
    REQ(["Incoming request"]) --> L1["Layer 1 — Transport<br/>HTTPS / TLS 1.3, HSTS"]
    L1 --> L2["Layer 2 — Rate limiting<br/>strict on auth routes"]
    L2 --> L3["Layer 3 — Authentication<br/>JWT signature + expiry"]
    L3 --> L4["Layer 4 — Authorisation<br/>RBAC: 4 roles"]
    L4 --> L5["Layer 5 — Ownership check<br/>is this record yours?"]
    L5 --> L6["Layer 6 — Consent check<br/>active ConsentArtefact?"]
    L6 --> L7["Layer 7 — Input validation<br/>Zod schema"]
    L7 --> BL["Business logic"]
    BL --> L8["Layer 8 — Audit log<br/>append-only, immutable"]
    L8 --> RESP(["Response"])
```

Layer 5 is the one that matters most and is easiest to omit. A valid JWT for a
`patient` proves *who* the caller is, not *which records* they may read — without an
explicit ownership check, any authenticated patient could request any other patient's
record by changing an ID in the URL.

## 2.7 Design Decisions

| # | Decision | Alternative rejected | Rationale |
|---|---|---|---|
| A1 | Three separate services | Single Node monolith | ML requires the Python scientific stack; separation gives independent deployment and an explicit contract |
| A2 | Stateless ML service | ML service with its own DB | Avoids a second source of truth for patient data; simplifies consent enforcement |
| A3 | MongoDB | PostgreSQL | Clinical records are heterogeneous and sparsely populated; schema evolves across build stages |
| A4 | JWT | Server-side sessions | Stateless auth across two backend services without shared session storage |
| A5 | Offline-first PWA | Native mobile app | One codebase, no app-store barrier, installable; sufficient for the field use case |
| A6 | Rule engine for escalation, ML for risk | ML for both | Escalation must be auditable and explainable per rule; a missed red flag is not an acceptable model error |
| A7 | Server-wins conflict resolution | Last-write-wins | Device clocks are unreliable; clinical data must never be silently overwritten |
