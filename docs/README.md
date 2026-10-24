# DisCharge+ — Design Documentation

Submission set for TetraTHON 2026, Track A — HealthTech, Problem Statement 2.

| # | Document | Contents |
|---|---|---|
| 1 | [Project Profile](./01-project-profile.md) | Identification, problem context, objectives, scope, stakeholders, tech stack, modules, constraints |
| 2 | [Architecture Diagram](./02-architecture.md) | High-level architecture, request flow, offline flow, deployment, security layers, design decisions |
| 3 | [E-R / Use-Case / Activity / Sequence](./03-er-usecase-activity-sequence.md) | ERD (core + supporting), relationship summary, use-case diagram + specifications, 4 activity diagrams, 5 sequence diagrams |
| 4 | [UML Diagrams](./04-uml-diagrams.md) | Domain class diagram, service class diagram, component diagram, 4 state diagrams, package diagram |
| 5 | [Data Dictionary](./05-data-dictionary.md) | All 18 collections field-by-field, 37 enumerations, 6 composite types, index summary, volume estimates |
| 6 | Personas, Workflows & Pages (`06-personas-workflows-pages.docx`) | 4 personas, 30-day journey, 7 workflows, 28-page inventory, access matrix |
| 7 | [MVP Scope](./07-mvp-scope.md) | **What is actually built:** 2 roles, 9 entities, 13 pages, 10-week plan; ML and offline deferred |
| 8 | [Phase-1 Data Dictionary](./08-phase1-data-dictionary.md) | MVP 9 collections, field level; decks in `presentation/`, diagrams in `diagrams/*.puml` |
| 9 | [Project Guide](./09-project-guide.md) | Plain-language walkthrough of the whole project + likely viva questions |
| 10 | [PRD](./10-prd.md) | MVP requirements: goals, user stories, FR-1…FR-10 with acceptance tests, NFRs, open decisions D1–D12 |
| 11 | [Build Layout](./11-build-layout.md) | Repo tree, API contract (26 endpoints), server internals, 13 page wireframes, week-by-week checklist |
| — | [Data Model](./data-model.md) | **Source of truth.** Regenerate 3, 4 and 5 from this if it changes. |

## Rendering the diagrams

All diagrams are written in Mermaid. To export images for a report:

1. Open <https://mermaid.live>
2. Paste the contents of any ```mermaid block
3. Export as PNG or SVG

GitHub renders Mermaid natively, so the `.md` files display correctly there as-is.

## Design decisions of record

| # | Decision | Rationale |
|---|---|---|
| 1 | `Medication` referenced, not embedded | Enables cohort queries ("all patients on metformin") required by the clinician dashboard |
| 2 | Caregiver ↔ Patient is M:N | One ASHA worker covers a village; one patient may have several family carers |
| 3 | Missed critical dose auto-escalates | False negatives cost more than false positives in post-discharge care |
| 4 | `triageTier` stored on both SymptomLog and Escalation | Preserves non-escalated verdicts so the rule engine's false-negative rate can be measured |
| 5 | Offline conflicts: server wins, flagged for review | Device clocks are unreliable; clinical data is never silently overwritten |
| 6 | ERD drawn as logical relational | Standard notation; physical MongoDB embedding noted per entity |
| 7 | Rule engine for escalation, ML for risk | Escalation must be auditable rule by rule; risk tolerates probabilistic output |

**Entity count:** 18, including 2 junction entities (`Prescription`, `CaregiverAssignment`).
