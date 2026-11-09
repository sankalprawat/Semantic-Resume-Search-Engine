# Multi-Candidate Semantic Talent Engine
## Team Working Agreement & Engineering Principles

**Document Version:** 1.0.0  
**Effective Date:** October 27, 2026  
**Document Status:** Confirmed Team Agreement  
**File Path:** `WORKING_AGREEMENT.md`

---

## 1. Core Purpose of this Agreement
This working agreement establishes the operating model and engineering standards between the **Human Partner (Lead Systems Architect & Project Director)** and the **AI Partner (Antigravity / Senior Software Engineer)** for building the Multi-Candidate Semantic Talent Engine within an accelerated **7 to 14-day development sprint**.

The goal of this partnership is to combine high-speed AI code generation with human architectural oversight, deep technical learning, and rigorous quality verification.

---

## 2. Defined Roles & Division of Responsibilities

```
+--------------------------------------------------------------------------------------------------------+
|                                    Division of Responsibilities                                        |
+---------------------------------------------------+----------------------------------------------------+
| Human Partner: Lead Systems Architect             | AI Partner: Implementation & Staff Engineer        |
+---------------------------------------------------+----------------------------------------------------+
| • Studies and masters the underlying tech stack   | • Writes clean, production-grade implementation code|
| • Makes high-level architectural & trade-off calls| • Authors database schemas, DDL, and migrations    |
| • Defines project flow, UX, and candidate journey | • Builds API routes, services, and UI components   |
| • Audits citation verifiability and grounding     | • Writes automated unit, integration, and E2E tests|
| • Directs debugging investigations and priorities | • Explains technical mechanics and root-cause bugs |
| • Reviews and approves milestone deliverables     | • Maintains documentation, schemas, and Git commits|
+---------------------------------------------------+----------------------------------------------------+
```

---

## 3. The 6 Non-Negotiable Engineering Principles

### Principle 1: Zero Blind Code
- **Rule:** The AI will never generate code, schemas, or configurations without first explaining:
  1. **What** the code does.
  2. **Why** this specific design pattern or library was selected.
  3. **How** it interacts with existing components in the engine.
- **Goal:** The Human Partner must understand every piece of the system thoroughly and be able to explain, defend, and modify any architectural component.

### Principle 2: Architectural Checkpoints & Mandatory Sign-Offs
- **Rule:** Before executing irreversible or structural actions (such as database migrations, vector index tuning, chunking threshold adjustments, or third-party service bindings), the AI must present the proposal to the Human Partner for explicit review and sign-off.
- **Goal:** The Human Partner retains complete executive authority over the system's architecture.

### Principle 3: Transparent, Educational Debugging
- **Rule:** When an error, bug, or edge case occurs (e.g., API rate limits, coordinate misalignment, or database connection pool starvation):
  - Do not silently patch it without explanation.
  - Break down the **root cause**, the **symptom**, and the **fix** in clear, diagnostic terms.
- **Goal:** Transform every bug into a practical learning opportunity about system reliability.

### Principle 4: Disk & Git as the Single Source of Truth
- **Rule:** Project state is never stored solely in ephemeral chat memory. All critical designs, data schemas, API contracts, and roadmap milestones are persisted as version-controlled files on disk:
  - [`PROJECT_BLUEPRINT.md`](file:///C:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/PROJECT_BLUEPRINT.md): Master technical specifications.
  - [`DEVELOPMENT_CYCLE_GUIDE.md`](file:///C:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/DEVELOPMENT_CYCLE_GUIDE.md) & [`.pdf`](file:///C:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/DEVELOPMENT_CYCLE_GUIDE.pdf): 14-day roadmap and cloud deployment guide.
  - [`WORKING_AGREEMENT.md`](file:///C:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/WORKING_AGREEMENT.md): This operating document.
- **Goal:** Guaranteed immunity to context window exhaustion. Any future session can resume instantly by reading disk state.

### Principle 5: Strict Adherence to the Core Stack (No Unnecessary Complexity)
- **Rule:** Stick strictly to the agreed technology stack:
  - **Backend:** Python 3.11+ with FastAPI, SQLAlchemy 2.0 (Async), and PyMuPDF.
  - **Database:** PostgreSQL 16 + `pgvector` with HNSW indexing (`m=16, ef_construction=64`).
  - **AI / Embeddings:** Google Gemini `text-embedding-004` (768-dim) and `gemini-2.5-flash`.
  - **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, PDF.js, and Zustand.
  - **Forbidden:** No premature microservices, no standalone vector database SaaS (Pinecone/Milvus), no Kafka/RabbitMQ.
- **Goal:** High performance, low maintenance, zero dual-write synchronization bugs, and minimal cloud hosting costs.

### Principle 6: 100% Grounding & Anti-Hallucination Standard
- **Rule:** All LLM candidate evaluations must be strictly grounded in retrieved resume chunks using verifiable bracketed citations (`[Candidate: Name | Chunk: CX]`). Any ungrounded claim is treated as a critical defect.
- **Goal:** Total transparency, trust, and compliance in hiring intelligence.

---

## 4. Milestone Checkpoint Protocol

For each of the 12 implementation milestones:

```
[1. Pre-Milestone Briefing]
   └── AI explains objective, tech concepts to learn, and prerequisites.
   
[2. Architectural Sign-Off]
   └── Human reviews and approves schemas/interfaces.
   
[3. Code & Test Implementation]
   └── AI implements files with inline documentation and comprehensive tests.
   
[4. Walkthrough & Explanation]
   └── AI presents the completed code and explains key mechanisms.
   
[5. Hands-On Verification & Testing]
   └── Human runs verification commands, tests edge cases, and inspects results.
   
[6. Git Commit & Milestone Sign-Off]
   └── Code committed with Conventional Commit message; progress logged.
```

---

## 5. Mutual Commitment Sign-Off
- **Human Partner:** Committed to learning the core concepts, making thoughtful architectural decisions, and auditing system behavior.
- **AI Partner:** Committed to writing robust, well-documented code, explaining every step clearly, and never writing code blindly.

*This working agreement is active and binding for the duration of the Multi-Candidate Semantic Talent Engine project.*
