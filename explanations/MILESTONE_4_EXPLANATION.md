# Milestone 4 In-Depth Explanation: Grounded RAG Comparative Synthesis & Anti-Hallucination Guardrails

**Milestone Focus:** Multi-Candidate Prompt Engineering, Gemini-4-Hydrogen Reasoning, Anti-Hallucination Regex Verification, Server-Sent Events (SSE) Streaming, and Citation Coordinate Persistence  
**Status:** Approved Architectural Specification & Implementation  
**File Path:** `explanations/MILESTONE_4_EXPLANATION.md`

---

## 1. Executive Summary & Purpose

In Milestone 3, we enabled natural language semantic search over candidate pools. However, raw search returns fragmented chunks of text. A recruiter reviewing 5 candidates still has to manually read 15 separate paragraphs to understand how they compare.

**Milestone 4 builds the analytical brain of the engine:**
1. It feeds retrieved candidate chunks into Google Gemini (`gemini-4-hydrogen`) in a single structured prompt.
2. The LLM performs **comparative architectural synthesis**, critically contrasting candidate backgrounds side-by-side (scale handled, leadership maturity, system design trade-offs).
3. Every factual assertion is strictly enforced to cite retrieved chunks: `[Candidate: Name | Chunk: CX]`.
4. Our **Anti-Hallucination Guardrail (`CitationVerifier`)** extracts and verifies every citation against the database.
5. The synthesis streams token-by-token to the recruiter using **Server-Sent Events (SSE)**.
6. Verified citations are persisted in PostgreSQL with exact PDF page coordinates for instant UI highlighting.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Milestone 4 RAG Architecture                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [Recruiter Natural Query] ──▶ [pgvector Cosine Search] ──▶ [Top Chunks from Pool]   │
│                                                                        │               │
│                                                                        ▼               │
│                                                       [Multi-Candidate Prompt Engine]  │
│                                                       • Delimited candidate chunks     │
│                                                       • Strict bracketed grammar       │
│                                                       • Temperature calibrated (T=0.2) │
│                                                                        │               │
│                                                                        ▼               │
│                                                       [gemini-4-hydrogen Stream]       │
│                                                       • Token-by-token generation      │
│                                                                        │               │
│                      ┌─────────────────────────────────────────────────┴─────────────┐ │
│                      ▼                                                               ▼ │
│   [SSE HTTP Stream: text/event-stream]                           [CitationVerifier]    │
│   data: {"token": "Alice architected..."}                        • Regex parsing       │
│   data: {"token": " [Candidate: Alice...]"}                      • ID matching         │
│                                                                  • Grounding score %   │
│                                                                              │         │
│                                                                              ▼         │
│                                                                 [Supabase Persistence] │
│                                                                 • evaluations          │
│                                                                 • evaluation_citations │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Theoretical Foundations (What the Systems Architect Must Understand)

### 2.1 The Hallucination Danger in Recruitment Intelligence
Large Language Models have a natural tendency to fabricate details ("hallucinations") when answering queries about people's experience (e.g. inventing that a candidate knows Kubernetes when their resume only mentioned Docker).

In hiring, an ungrounded claim is a critical failure. To prevent this, we enforce **Closed-Domain Grounding**:
- The LLM is provided with an explicit delimiter context: `<context_chunks> ... </context_chunks>`.
- The system prompt forbids external world knowledge about candidates: *"If a detail is not explicitly asserted in the provided chunks, you must treat it as unknown."*
- **Temperature Calibration ($T=0.2$):** Lowering temperature from default ($0.7$) to $0.2$ suppresses random creative branching and forces deterministic, grounded reasoning.

### 2.2 Verifiable Bracketed Citation Grammar
We instruct Gemini to use a strict, machine-parseable citation syntax:
```text
[Candidate: <Candidate Name> | Chunk: <Chunk Index>]
```
Example generated sentence:
> *"Alice architected an event-driven payment ledger with Apache Kafka handling 500k events/sec [Candidate: Alice | Chunk: C1], whereas Bob's experience was centered on CockroachDB database clustering [Candidate: Bob | Chunk: C2]."*

### 2.3 The Anti-Hallucination Guardrail (`CitationVerifier`)
Before saving any evaluation to the database, the backend runs the generated markdown through a regular expression verifier:
```python
r"\[Candidate:\s*([^\|\]]+)\s*\|\s*Chunk:\s*([C\d]+|[a-f0-9\-]+)\]"
```
For every match:
1. It checks if the cited candidate name matches a candidate in the retrieval context.
2. It checks if the chunk index matches an actual chunk provided in the prompt.
3. If an LLM invents a citation (e.g. `[Candidate: Alice | Chunk: C99]`), the verifier catches it, logs a warning, and flags the grounding report.
4. It extracts the physical bounding boxes and page number from the verified chunk, storing them in `evaluation_citations`.

### 2.4 Server-Sent Events (SSE) Protocol
Generating a multi-paragraph comparative evaluation takes 3–6 seconds. If recruiters had to stare at a loading spinner for 6 seconds, the user experience would feel sluggish.

We use **Server-Sent Events (`text/event-stream`)**:
- A standardized, one-way HTTP streaming protocol.
- FastAPI yields tokens over an open HTTP connection as fast as Gemini generates them:
  ```http
  HTTP/1.1 200 OK
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive

  data: {"type": "token", "content": "Alice"}

  data: {"type": "token", "content": " has"}

  data: {"type": "citation", "candidate": "Alice", "chunk": "C1"}

  data: {"type": "done", "evaluation_id": "123e4567..."}
  ```
- The frontend recruiter console renders markdown in real time with instant responsiveness.

---

## 3. Authored Files Inventory & Responsibilities

| File Path | Component | Purpose |
| :--- | :--- | :--- |
| [`backend/app/schemas/evaluation.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/schemas/evaluation.py) | Pydantic DTOs | Request and response validation for evaluations, streaming tokens, and citation links. |
| [`backend/app/services/citation_verifier.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/citation_verifier.py) | `CitationVerifier` | Regex parsing engine that extracts bracketed citations, verifies chunk IDs, and computes grounding score. |
| [`backend/app/services/rag_engine.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/rag_engine.py) | `GroundedRAGOrchestrator` | Builds multi-candidate prompts, streams `gemini-4-hydrogen` tokens, runs verification, and persists records. |
| [`backend/app/api/v1/endpoints/evaluations.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/api/v1/endpoints/evaluations.py) | SSE API Endpoints | `POST /pools/{id}/evaluate/stream` (SSE stream), `GET /pools/{id}/evaluations` (evaluation history). |
| [`backend/tests/unit/test_citation_verifier.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/tests/unit/test_citation_verifier.py) | Unit Tests | Validates regex pattern matching, detection of valid vs. hallucinated citations, and grounding score calculation. |
| [`backend/tests/integration/test_rag_synthesis.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/tests/integration/test_rag_synthesis.py) | Integration Tests | End-to-end test streaming live from `gemini-4-hydrogen`, verifying citations, and persisting to Supabase. |
