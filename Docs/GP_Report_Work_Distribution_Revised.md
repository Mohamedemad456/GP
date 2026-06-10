# GP Report:  Work Distribution

## Goal of This Distribution

This document replaces the earlier draft and redistributes the report based on the **actual project codebase** and the **real team responsibilities**.

## Important Ownership Rules

-  **ML service**, **AI service**, **model training**, **evaluation**, **prediction logic**, **data cleaning**, and **data pipeline inside `ml-service`**, including the **retrain model pipeline**, belong to **Mohamed Seif**.
- The **data engineers did scraping workflow automation for Hatla2ee and Dubizzle, then pushed data to Supabase**.
- The **frontend engineer** should write only what is directly tied to the React frontend and UI flows and integration.
- The **backend engineers** should write what is directly tied to the architecture and logic of the .NET backend, database, APIs, auth, listings, admin workflows, and ML-service integration from the backend side.
- Shared business/report assembly sections should be distributed mainly to the two data engineers to keep the workload fair.

---

# Final Team Distribution

## 1) Mohamed Seif  ML/AI

### Report sections

### Coordination note
Mohamed Seif has one of the heaviest sections in the report. He should start **Chapter 1** and **Chapter 4 ML/AI/Data Pipeline** early, because these sections do not depend on the rest of the team finishing first.

#### Abstract
- Write it **last** after all chapters are complete.
- Summarize the problem, solution, system components, and achieved results.

#### Chapter 1: Introduction
- **1.1 Overview**
- **1.2 Objectives**
- **1.3 Purpose**
- **1.4 Scope**
- **1.5 General Constraints**


#### Chapter 2: Project Planning and Analysis
- **2.3 Need for the New System**
- Lead contribution to **2.4.3 Domain Requirements** for the ML/data/prediction side
- Review contribution to **2.5 Advantages of the New System** so the technical advantages are accurate

What you should cover here
- Why Egyptian used-car pricing needs a dedicated system
- Why static/manual pricing is weak
- Why ML prediction is necessary
- Why an AI assistant adds value
- Why a combined platform is better than using separate tools
- What data attributes were actually needed for prediction
- What the model and AI services require to work correctly

#### Chapter 3: Software Design — Partial
- ML model architecture diagram
- AI service architecture / chatbot flow
- Data cleaning and ML pipeline diagram
- System-level technical diagram for:
  - frontend → backend → ML service
  - frontend → backend/AI route or chatbot route
  - internal ML prediction flow

What you should document:
- Model family and inference pipeline
- Confidence / interval / negotiation-range logic
- Explainability / top factors flow
- Retrain and evaluation workflow if included diagrammatically

#### Chapter 4: Implementation — Full Ownership for ML/AI/Data Pipeline Parts
- ML service implementation
- AI service implementation
- End-to-end prediction pipeline
- Explainability pipeline
- Retraining pipeline
- Data cleaning pipeline and processed dataset generation
- Data versioning and manifests
- Model evaluation/export pipeline

What you should explicitly cover:
- `ml-service` FastAPI service
- prediction endpoint behavior
- model loading, health, metrics, explainability
- data cleaning scripts and versioned pipeline
- production inference flow
- retrain orchestration runner
- `ai-service` FastAPI chatbot service
- provider fallback logic
- grounding / lookup behavior
- in-memory chat memory and current limitations

#### Chapter 5: Testing — ML/AI Ownership
- ML-service tests
- AI-service tests
- prediction validation scenarios
- explainability validation
- model evaluation methodology
- service health and API verification on your services

Important:
Do **not** claim fake tests. Write only what actually exists or what was actually executed.

#### Chapter 6: Results and Discussion — Lead Ownership
- **6.1.1 Expected Results**
- **6.1.2 Actual Results**
- **6.2 Discussion**

What you should include:
- actual model metrics
- interval/confidence behavior
- pricing quality observations
- explainability usefulness
- chatbot behavior quality
- strengths and remaining weaknesses

Coordination rule:
- Mohamed Seif leads and writes Chapter 6 as one unified chapter.
- Every other team member should submit short **expected vs actual** bullet points from their own area.
- Mohamed Seif compiles these contributions into one coherent system-level results and discussion chapter.

#### Chapter 7: Conclusion — Lead Ownership
- Summary paragraph
- Recommendations paragraph

#### Chapter 8: Future Work — Lead Ownership
Only keep items that are **truly not completed yet**.

### Future work items Mohamed Seif can still keep
- Persistent chat memory instead of current in-memory/session-limited memory
- RAG or richer knowledge base integration for the chatbot
- Better production calibration refinement by segment/tier if not yet fully deployed
- Broader market coverage and more data coverage
- stronger monitoring / deployment hardening if you want to mention operational improvements

### Items that should **not** stay under future work if already implemented
- Retraining runner / retrain orchestration
- Multi-provider LLM fallback
- prediction explainability/top factors
- core data versioning pipeline
- baseline ML service integration and health flow

### Appendix contribution
- ML/AI architecture figures
- sample prediction responses
- sample explainability output
- evaluation plots / metrics tables
- selected pipeline outputs if helpful

---

## 2) Frontend Engineer — React Frontend and UI Documentation

### Main responsibility
The frontend engineer should own everything related to the **user interface**, **page flow**, **state handling**, **frontend architecture**, and **user interaction with the system**.

### Why this is the correct ownership
The frontend codebase includes:
- public pages
- login/signup/onboarding
- buyer pages
- seller dashboard and add-listing flow
- admin dashboard pages
- localization and RTL support
- chatbot UI component
- API integration from the client side

### Report sections assigned to the Frontend Engineer

#### Chapter 3: Software Design — Frontend Part
- **3.4 Activity Diagrams**

Required activity diagrams:
- Visitor flow: Home → about/contact → signup/login
- User flow: Login → feed → car details → profile
- Seller flow: Login → seller dashboard → add listing → checklist → upload photos → generate price → set price → submit
- Admin flow: Login → pending cars/users → review/manage data
- Chatbot flow from UI side: open chat widget → send message → receive response

#### Chapter 4: Implementation — Frontend Part
- **4.1 Client-Side Architecture**
- frontend workflow explanations for **4.2** where relevant

What the frontend engineer should write:
- React + TypeScript + Vite stack
- routing structure
- page grouping by roles
- reusable components and design system usage
- language switching and RTL handling
- how Axios is used for backend communication
- how authentication state is handled in the UI
- how seller/admin/buyer pages are organized
- how chatbot UI is presented to the user

#### Chapter 5: Testing — Frontend Part
- **5.1 Unit Testing — Frontend**
- **5.3 Additional Testing — UI/UX**

Important honesty note:
If there are no real automated frontend tests in the repo, the frontend engineer should **not invent them**.
Instead, they should document:
- manual page testing
- form validation scenarios
- route protection checks
- responsive behavior checks
- localization and RTL checks
- browser/device checks if actually performed

#### Appendix — Frontend
- screenshots of major pages
- seller flow screenshots
- admin screens
- chatbot UI screenshots
- wireframes/mockups if available

### Frontend deliverables
- activity diagrams
- frontend architecture write-up
- page/component structure explanation
- screenshots
- UI testing notes
- frontend references if any docs/framework references are cited

---

## 3) Backend Engineer 1 — Authentication, Users, Database Design, Core Backend Architecture

### Main responsibility
Backend Engineer 1 should take the **identity/auth/database-oriented backend sections**.

### Why this is fair
The backend is a large .NET solution with:
- authentication
- authorization
- users
- controllers
- services
- persistence
- ORM/database mapping

This engineer should take the parts that explain the backbone of the backend platform.

### Report sections assigned to Backend Engineer 1

#### Chapter 2.4: Analysis of the New System — Partial Ownership
- **2.4.1 User Requirements**
- **2.4.2 System Requirements**

What to cover:
- user roles and what each needs
- account/auth requirements
- backend runtime requirements
- server, database, API environment requirements
- security and access-control needs

#### Chapter 3: Software Design — Partial Ownership
- **3.1 Database Design / ERD explanation**
- **3.2 Use Case Diagram**

What to cover:
- entity relationships
- why tables were separated as they are
- role of users, listings, makes, models, conditions, pricing history, status history
- use cases for buyer, seller, admin, visitor

#### Chapter 4: Implementation — Partial Ownership
- Backend architecture for:
  - authentication
  - authorization
  - persistence layer
  - ORM/entity mapping
  - API structure
  - middleware and localization if included

#### Chapter 4.2 Workflow / Pseudocode
Focus on:
- register flow
- login flow
- refresh token / cookie flow
- logout / logout-all flow
- change-password flow
- role-based access flow

#### Chapter 5: Testing — Partial Ownership
Focus on:
- auth endpoint testing
- validation behavior
- role/authorization checks
- database persistence checks related to auth/users
- submit this content to **Backend Engineer 2** for final backend Chapter 5 merging

Important honesty note:
If backend automated test projects are not present, document the real verification method honestly, such as Postman/manual endpoint testing, validator checks, and DB verification.

### Backend Engineer 1 deliverables
- user/system requirements text
- ERD explanation
- use case diagram
- auth pseudocode/flowcharts
- backend auth testing section

---

## 4) Backend Engineer 2 — Listings, Admin, ML Integration, Functional and Non-Functional Behavior

### Main responsibility
Backend Engineer 2 should take the **business logic side of the backend**, especially listings, admin flows, and the backend-side integration with the ML pricing service.

### Why this is fair
The backend code clearly contains:
- listings controller/service
- admin management
- checklist and defects
- make/model management
- ML price generation call from backend
- pricing history and status history

### Report sections assigned to Backend Engineer 2

#### Chapter 2.4: Analysis of the New System — Partial Ownership
- **2.4.4 Functional Requirements**
- **2.4.5 Non-Functional Requirements**

What to cover:
- listing creation/update/delete
- photo upload
- checklist management
- admin approval/rejection flows
- price generation flow via ML service
- performance, scalability, response-time, availability, and security expectations

#### Chapter 3: Software Design — Partial Ownership
- **3.3 Sequence Diagram**

Required sequence diagrams:
- seller creates listing
- seller requests generated price
- backend calls ML service and stores prediction
- seller submits listing for review
- admin reviews listing and changes status
- user browses approved listings

#### Chapter 4: Implementation — Partial Ownership
- listing workflow implementation
- admin workflow implementation
- backend-to-ML-service communication
- pricing history and status history handling
- makes/models/conditions management from API side

#### Chapter 4.2 Workflow / Pseudocode
Focus on:
- add listing flow
- submit listing flow
- generate price flow
- set seller price flow
- admin approve/reject flow
- fetch approved listings flow

#### Chapter 5: Testing — Partial Ownership
- listing endpoint testing
- admin workflow testing
- ML-service integration testing from backend side
- pricing generation validation
- database verification for status and pricing history
- act as the **backend Chapter 5 coordinator** and merge both backend testing contributions into one unified backend section

### Backend Engineer 2 deliverables
- functional/non-functional requirements
- sequence diagrams
- listings/admin/backend integration implementation section
- backend integration testing section
- final merged backend Chapter 5 section

---

## 5) Data Engineer 1 — Full Report Integration, Planning/Business Sections, Final Assembly

### Main responsibility
This data engineer should become the **report integration owner**.

Because this member currently has lighter technical ownership, this is the fairest place to put the heavy report-coordination work.

### Report sections assigned to Data Engineer 1

#### Chapter 2.1: Project Planning

- **2.1.1 Feasibility Study**
- **2.1.2 Estimated Cost**
- **2.1.3 Gantt Chart**

Important:
These are planning/business/report-management sections, not service-implementation sections.
They fit well with the person handling full documentation integration.

#### Front Matter / Back Matter / Final Assembly

- **Acknowledgements**
- **Table of Contents** generation at the end
- **List of Tables** collection
- **List of Figures** collection
- Help unify **Bibliography** formatting
- Final formatting pass on the full report
- Page numbering, headings, spacing, figure captions, consistency pass

#### Chapter 2.6: Risk and Risk Management — Coordination Ownership

This engineer can own the final written section, but should collect risks from:

- Mohamed Seif for ML/AI/data risks
- Backend team for backend/security/API risks
- Frontend engineer for usability/client risks

#### Chapter 2.4.3 and 2.5 — Merge and Coordination Ownership

- merge Mohamed Seif's **ML/data/prediction-side** contribution and Data Engineer 2's **raw data acquisition** contribution into one coherent **2.4.3 Domain Requirements** subsection
- draft the overall-system part of **2.5 Advantages of the New System**
- send the final 2.5 draft to Mohamed Seif and the backend team for technical review

### Data Engineer 1 deliverables
- feasibility study
- cost estimation
- Gantt chart
- risk section final assembly
- merge final Chapter 2.4.3
- draft the overall-system part of Chapter 2.5
- acknowledgements draft
- final table/figure collection
- final document merge and formatting

---

## 6) Data Engineer 2 — Scraping, Data Source Documentation, Existing Systems, Raw Data Acquisition

### Main responsibility
This data engineer should own the **data acquisition and scraping documentation**.

### Report sections assigned to Data Engineer 2

#### Chapter 2.2: Analysis and Limitation of Existing Systems
- limitations of Egyptian car marketplaces
- absence of fair pricing support
- unstructured listing data
- lack of valuation intelligence
- limitations of manual price estimation

#### Chapter 2.4.3: Domain Requirements — Raw Data Acquisition
- **data collection side**:
- what raw fields were scraped
- where data came from
- how data was pushed/stored in Supabase
- what source-side issues existed
- challenges in raw collection


#### Chapter 2.5: Advantages of the New System — Data Collection Contribution
Focus only on:
- structured raw data acquisition compared to public websites
- better centralization of raw listing data
- reusable scraping rounds / source capture
- better availability of raw fields for later processing

#### Chapter 2.6: Risk and Risk Management — Data Collection Risks Contribution
Focus on:
- scraping breakage due to website changes
- missing/inconsistent seller-provided data
- legal/ethical/data-source concerns
- sparse coverage for rare models

#### Chapter 3: Software Design — Data Acquisition Diagram Contribution
- marketplaces → scraping → raw capture/storage → Supabase/raw handoff

#### Appendix — Data Collection Appendix
Suggested appendix material:
- raw field examples
- source schema examples
- raw scraping snapshots
- Supabase ingestion screenshots if available
- source coverage summary
- any related work flow diagram

### Data Engineer 2 deliverables
- existing systems limitation section
- raw data acquisition/domain requirements section
- data-source risks section contribution
- raw acquisition diagram
- raw data appendix material

# Sections That Do Not Belong Naturally to One Track

These sections are not purely frontend/backend/ML, so they should be assigned intentionally:

## Best assignment for shared/non-track sections
- **Abstract** — Mohamed Seif
- **Feasibility / Cost / Gantt** — Data Engineer 1
- **Acknowledgements** — Data Engineer 1
- **Table of Contents / List of Tables / List of Figures** — Data Engineer 1
- **Bibliography formatting and consolidation** — Data Engineer 1, with references submitted by everyone
- **Risk section final merge** — Data Engineer 1, with inputs from all tracks
- **Chapter 2.4.3 final merge** — Data Engineer 1, with contributions from Mohamed Seif and Data Engineer 2
- **Chapter 2.5 overall-system draft** — Data Engineer 1, reviewed by Mohamed Seif and backend team
- **Chapter 5 backend merge** — Backend Engineer 2, with Backend Engineer 1 contributing auth testing
- **Chapter 6 final compiled chapter** — Mohamed Seif, with expected-vs-actual inputs from all tracks
- **Conclusion and Future Work** — Mohamed Seif
- **Final consistency review** — Mohamed Seif + Data Engineer 1

---

# What Each Person Must Submit

## Mohamed Seif
- Chapter 1 full draft
- Chapter 2.3
- ML/AI/domain technical parts of Chapter 2.4.3 and 2.5 review
- ML/AI/data pipeline diagrams
- Chapter 4 ML/AI/data pipeline implementation
- Chapter 5 ML/AI testing
- Chapter 6, 7, 8
- compile Chapter 6 using inputs from all tracks
- appendix figures/tables for ML and AI

## Frontend Engineer
- activity diagrams
- frontend implementation chapter
- frontend testing section
- UI appendix screenshots
- frontend references if used

## Backend Engineer 1
- user/system requirements
- ERD explanation
- use case diagram
- auth/backend architecture section
- auth testing section submitted to Backend Engineer 2 for backend Chapter 5 merging

## Backend Engineer 2
- functional/non-functional requirements
- sequence diagrams
- listings/admin/ML integration implementation section
- backend integration testing section
- final merged backend Chapter 5 section

## Data Engineer 1
- feasibility study
- estimated cost
- Gantt chart
- risk section final assembly
- merge final Chapter 2.4.3
- draft the overall-system part of Chapter 2.5
- acknowledgements
- tables/figures collection
- bibliography merge
- final formatting and integration

## Data Engineer 2
- existing systems analysis
- raw data acquisition/domain section
- data-source risk contribution
- raw acquisition diagram
- raw-data appendix material

---


# Final Recommendation

If you want the cleanest and fairest final report ownership, use this simplified rule:

- **Mohamed Seif** owns the project meaning, ML, AI, results, and anything tied to the core idea.
- **Frontend Engineer** owns the client-side design, implementation, UI flow, and frontend testing.
- **Backend Engineer 1** owns auth, users, ERD, and core backend architecture.
- **Backend Engineer 2** owns listings, admin logic, backend workflows, and ML integration from the backend side.
- **Data Engineer 1** owns planning/business/report integration.
- **Data Engineer 2** owns scraping/data-source documentation.

This is the most accurate distribution for the current codebase and your real team contributions.
