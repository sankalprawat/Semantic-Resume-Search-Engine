# Multi-Candidate Semantic Talent Engine
## 7–14 Day Rapid Development Lifecycle, Architecture Study & Cloud Hosting Guide

**Document Version:** 1.0.0-PROPOSED  
**Companion PDF Document:** [`DEVELOPMENT_CYCLE_GUIDE.pdf`](file:///C:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/DEVELOPMENT_CYCLE_GUIDE.pdf)  
**Target Duration:** 7 to 14 Calendar Days  
**User Focus:** Lead Systems Architect, Tech Stack Learner, Flow Director & Quality Gatekeeper  
**AI Assistant Focus:** Code Implementation, Schema Authoring, Test Writing & Refactoring  
**Production Hosting Target:** Vercel (Frontend), Render / Railway / Cloud Run (Backend), Supabase / Neon (PostgreSQL + pgvector)

---

## 1. Executive Strategy: 7-Day vs. 14-Day Sprint Tracks

In this accelerated development model, you do not spend hours wrestling with syntax, import errors, or boilerplate code. The AI generates all implementation code, database schemas, API routes, and test suites. 

Your role is to act as the **Lead Systems Architect**:
1. **Learn the Tech Stack:** Understand *why* each technology was chosen and how vector math works.
2. **Make Architectural Decisions:** Balance trade-offs in chunk sizes, similarity thresholds, and indexing.
3. **Direct Project Flow:** Determine how candidates are processed, filtered, and presented.
4. **Audit & Debug:** Ensure zero hallucinations, test coordinate highlights, and verify deployments.

```
+--------------------------------------------------------------------------------------------------------+
|                                7-Day vs. 14-Day Sprint Timelines Comparison                            |
+--------------------------------------------------------------------------------------------------------+
| 7-Day MVP Track:      [Day 1: Setup] -> [Day 2: Ingest & Chunks] -> [Day 3: Vectors & Search]        |
|                       -> [Day 4: RAG Synthesis] -> [Day 5: Next.js UI] -> [Day 6: PDF Highlights]      |
|                       -> [Day 7: Cloud Deploy (Vercel + Supabase + Render)]                            |
+--------------------------------------------------------------------------------------------------------+
| 14-Day Full Track:    [Days 1-2: Foundations, pgvector HNSW, Data Models, Study Vector Spaces]         |
|                       [Days 3-4: PyMuPDF Coordinates, Token Chunking, Scanned PDF Edge Cases]          |
|                       [Days 5-6: Gemini text-embedding-004 Batches, pgvector Cosine Search Tuning]    |
|                       [Days 7-8: gemini-2.5-flash RAG, Citation Regex Verifier, SSE Token Stream]      |
|                       [Days 9-10: Next.js Split-View, PDF.js Highlighting Canvas, Zustand State]       |
|                       [Days 11-12: Full QA Suite, Hallucination Audits, Performance Benchmarking]      |
|                       [Days 13-14: Production Hosting on Vercel + Cloud Run/Render, DNS, Security]     |
+--------------------------------------------------------------------------------------------------------+
```

| Track | Duration | Primary Focus | Ideal For | Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Fast-Track** | **7 Days** | Rapid working prototype, local verification, basic cloud deployment on Vercel + Supabase. | Hackathons, proof-of-concept demos, rapid validation of semantic search. | Fully working RAG recruitment engine with live citations and working web UI. |
| **Production-Track** | **14 Days** | Deep tech stack study, architectural resilience, coordinate precision, full test suites, CI/CD, production-grade cloud infrastructure. | Portfolio centerpiece, enterprise hiring engine, production deployment ready for real candidate pools. | Robust, highly audited enterprise system with complete documentation and automated test gates. |

---

## 2. Developer Tech Stack Study Curriculum (What to Learn Each Day)

Dedicate 1 to 2 hours each day to studying these foundational concepts while the AI builds and debugs the codebase:

| Days | Technology / Topic | Key Concepts to Understand | Recommended Learning Resources |
| :--- | :--- | :--- | :--- |
| **Days 1–2** | **PostgreSQL 16 & pgvector** | • Vector distance operators: `<=>` (Cosine), `<->` (L2), `<#>` (Inner Product).<br>• HNSW (Hierarchical Navigable Small World) graph topology.<br>• Difference between HNSW and IVFFlat indexes.<br>• Parameters: `m` (connections) and `ef_construction` (build depth). | • GitHub: `pgvector/pgvector` documentation.<br>• Supabase guide on vector embeddings.<br>• Pinecone HNSW visual explainer article. |
| **Days 3–4** | **Document Intelligence & Chunking** | • PDF structure: text streams vs. raster scanned images.<br>• PyMuPDF (fitz) bounding box coordinates `(x0, y0, x1, y1)`.<br>• Tokenization vs. character splitting.<br>• Sliding-window overlap math and sentence boundary snapping. | • PyMuPDF official documentation.<br>• Chunking strategies guide by LangChain / LlamaIndex.<br>• Regex sentence tokenization patterns. |
| **Days 5–6** | **Google Gemini Embeddings & Search** | • `text-embedding-004`: 768-dimensional semantic manifolds.<br>• Task types: `RETRIEVAL_DOCUMENT` vs. `RETRIEVAL_QUERY`.<br>• Normalization and cosine similarity calculations.<br>• API batching, rate limits (RPM/TPM), and exponential backoff with jitter. | • Google AI Studio official API guides.<br>• `google-genai` Python SDK documentation.<br>• 3Blue1Brown: "How do embeddings work?". |
| **Days 7–8** | **Gemini-2.5-Flash & Grounded RAG** | • Multi-candidate prompt construction and delimiter injection.<br>• Temperature calibration ($T=0.2$ for deterministic grounding).<br>• Server-Sent Events (SSE) streaming protocol in HTTP.<br>• Anti-hallucination guardrails and regex citation verification. | • Prompt Engineering Guide (DAIR.AI).<br>• FastAPI streaming response documentation.<br>• Google DeepMind papers on grounded generation. |
| **Days 9–10** | **Next.js 14+ & PDF.js Highlighting** | • Next.js App Router, Server Components vs. Client Components.<br>• PDF.js rendering pipeline: Page canvas rendering and text layers.<br>• Scaling PyMuPDF point coordinates to dynamic canvas viewports.<br>• Zustand reactive client-side state management. | • Next.js official App Router documentation.<br>• Mozilla PDF.js architectural overview.<br>• shadcn/ui component documentation. |
| **Days 11–14** | **DevOps, Cloud Hosting & Security** | • Decoupled deployment: Next.js on Vercel Edge + FastAPI on Render/Cloud Run.<br>• Supabase / Neon managed PostgreSQL with pgvector.<br>• CORS (Cross-Origin Resource Sharing) headers and preflight requests.<br>• Environment variables, secret rotation, and SSL/TLS termination. | • Vercel deployment documentation.<br>• Render / Railway FastAPI deployment guides.<br>• OWASP API Security Top 10. |

---

## 3. Phase-by-Phase Day-by-Day Implementation Cycle

### Days 1–2: Environment Baseline, Database & pgvector Schema
- **Your Focus (Architect/Decision-Maker):** Understand the database schema, verify that the 768-dimensional vector column is properly created with HNSW index, get your Google Gemini API key, and choose your local database strategy (Docker container vs. Supabase free tier).
- **AI Assistant's Focus:** Generate folder structure, configure `docker-compose.yml`, write Pydantic config, author SQLAlchemy models, and write Alembic migrations.

#### Action Steps:
1. **Obtain Gemini API Key:** Visit [Google AI Studio](https://aistudio.google.com/), generate a free API key, and store it safely.
2. **Initialize Monorepo:** Create root directories: `backend/`, `frontend/`, `docker/`, `docs/`.
3. **Start PostgreSQL + pgvector:**
   ```bash
   # Start PostgreSQL 16 with pgvector via Docker:
   docker run --name talent_pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=talent_engine -p 5432:5432 -d pgvector/pgvector:pg16

   # Verify vector extension in psql:
   CREATE EXTENSION IF NOT EXISTS vector;
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```
4. **Author Database Schema:** The AI will implement `backend/app/models/`:
   - `talent_pools`: Requisition workspaces.
   - `candidates`: Candidate profiles.
   - `resumes`: Metadata, PDF storage paths, and raw extracted text.
   - `resume_chunks`: `embedding VECTOR(768)` with HNSW index (`m=16, ef_construction=64`).
   - `evaluations` & `evaluation_citations`: Persisted comparative analyses and grounded footnotes.
5. **Run Alembic Migration:** Execute `alembic upgrade head` to create all tables in PostgreSQL.

> **Architectural Checkpoint #1:** Verify HNSW index creation by running `\d resume_chunks` in PostgreSQL and confirming the presence of `idx_resume_chunks_embedding_hnsw USING hnsw (embedding vector_cosine_ops)`.

---

### Days 3–4: PDF Text Parsing, Coordinate Mapping & Sliding-Window Chunking
- **Your Focus (Flow Director/Reviewer):** Inspect sample extracted chunks from real candidate resumes. Verify that candidate achievements are not cut in half across chunk boundaries and that coordinates match the PDF text.
- **AI Assistant's Focus:** Implement `DocumentIngestionService` using PyMuPDF (fitz), implement `SlidingWindowChunker` with sentence snapping, and write unit tests.

#### Action Steps:
1. **Implement PyMuPDF Parser:** The AI writes `backend/app/services/ingestion.py`:
   ```python
   # PyMuPDF extracts text spans with bounding boxes:
   import fitz # PyMuPDF
   doc = fitz.open(stream=pdf_bytes, filetype="pdf")
   for page_num, page in enumerate(doc):
       blocks = page.get_text("blocks") # (x0, y0, x1, y1, text, block_no, block_type)
   ```
2. **Implement Sliding-Window Chunker:** The AI writes `backend/app/services/chunking.py`:
   - Window size: **400 tokens** (~1,600 chars).
   - Overlap: **100 tokens** (25% overlap).
   - Sentence Snapping: Regex scans backward from token 400 for `[.!?\n\n]` to ensure clean sentence endings.
   - Section Header Injection: Automatically prepends `[Section: Experience]` or `[Section: Skills]`.
3. **Scanned Image Detection:** If extracted characters across all pages $< 50$, mark status as `SCANNED_UNSUPPORTED`.
4. **Debug & Verify:** Run the chunker against 3 sample resumes. Check that all chunks have clean beginnings and endings.

---

### Days 5–6: Gemini Embeddings & pgvector Cosine Search API
- **Your Focus (Architecture & Search Tuning):** Test natural language queries in the terminal or Swagger UI. Tune the similarity threshold (e.g., 0.65 vs. 0.70) and verify that semantic concepts are discovered without exact keywords.
- **AI Assistant's Focus:** Implement `EmbeddingVectorService` using `google-genai`, batch chunk embeddings in groups of 32, implement cosine distance query in PostgreSQL, and expose REST endpoints.

#### Action Steps:
1. **Batch Embedding Pipeline:** AI integrates Gemini's `text-embedding-004`:
   ```python
   from google import genai
   client = genai.Client(api_key=settings.GEMINI_API_KEY)
   response = client.models.embed_content(
       model="text-embedding-004",
       contents=[chunk.embedded_text for chunk in batch],
       config={"task_type": "RETRIEVAL_DOCUMENT"}
   )
   # Bulk update resume_chunks.embedding with 768-dim vectors
   ```
2. **Exponential Backoff:** Handle HTTP 429 rate limits gracefully with random jitter retry logic.
3. **Vector Cosine Search Endpoint:** AI implements `POST /api/v1/pools/{id}/search`:
   ```sql
   -- PostgreSQL pgvector Cosine Distance Query:
   SELECT c.full_name, ch.chunk_text, ch.page_number, ch.bounding_boxes,
          1 - (ch.embedding <=> :query_vector) AS cosine_similarity
   FROM resume_chunks ch
   JOIN resumes r ON ch.resume_id = r.id
   JOIN candidates c ON r.candidate_id = c.id
   WHERE r.pool_id = :pool_id AND (1 - (ch.embedding <=> :query_vector)) >= :threshold
   ORDER BY ch.embedding <=> :query_vector ASC
   LIMIT :top_k;
   ```
4. **Test Queries:** Query: *"Find engineers who have designed real-time event-driven systems using WebSockets."* Verify that candidates who mention socket concurrency or pub/sub are retrieved even if they never wrote the word "WebSocket" verbatim.

---

### Days 7–8: Grounded Comparative Synthesis & Anti-Hallucination Citations
- **Your Focus (Prompt & Grounding Auditor):** Inspect generated LLM responses. Ensure every single factual statement contains bracketed citations `[Candidate: Name | Chunk: C3]`, and that the claims are 100% faithful to the source resume.
- **AI Assistant's Focus:** Implement `GroundedRAGOrchestrator` using `gemini-2.5-flash`, build SSE token streaming generator, and build `CitationVerifier` regex validator.

#### Action Steps:
1. **RAG Prompt Assembly:** AI structures the prompt with candidate chunks cleanly demarcated:
   ```
   <context_chunks>
   [Candidate: Alice Smith | Chunk: C1] (Page 1): Designed Kafka event consumers...
   [Candidate: Bob Jones | Chunk: C1] (Page 2): Built WebSocket gateway in Go...
   </context_chunks>

   CRITICAL INSTRUCTION: Analyze candidates comparatively for the query.
   Ground every assertion in citations formatted exactly as [Candidate: Name | Chunk: CX].
   Never extrapolate or assume unstated experience.
   ```
2. **Real-Time SSE Streaming:** AI implements `POST /api/v1/pools/{id}/evaluations/stream` delivering real-time tokens to the client over an HTTP SSE channel.
3. **Citation Integrity Verifier:** Regex parser extracts all `\[(.*?)\|\s*Chunk:\s*(C\d+)\]` tokens, compares them to the prompt chunk manifest, and calculates the **Grounding Score**. Any invalid citation flags an immediate warning.

---

### Days 9–10: Next.js Recruiter Console & Dual-Pane PDF Coordinate Sync
- **Your Focus (UX & Visual Verification):** Click citation pills in the web interface and verify that the right-hand PDF viewer jumps to the right page and accurately highlights the target sentence with zero offset.
- **AI Assistant's Focus:** Build Next.js 14 App Router shell, drag-and-drop batch upload dropzone, query bar, markdown synthesis renderer with custom citation pill component, and PDF.js canvas with SVG highlight overlay.

#### Action Steps:
1. **Bootstrap Next.js 14+:** AI initializes `frontend/` with Tailwind CSS and shadcn/ui.
2. **Batch Upload Zone:** Build drag-and-drop uploader supporting up to 50 PDFs with real-time SSE progress indicators (Parsing $\rightarrow$ Chunking $\rightarrow$ Embedding).
3. **Dual-Pane Split Console:**
   - **Left Pane:** Markdown evaluation streaming live. Citation badges rendered as interactive clickable pills: `<CitationBadge candidateId="A" chunkId="C3" />`.
   - **Right Pane:** PDF.js viewer rendering the active candidate's PDF.
4. **Coordinate Highlighting Engine:**
   ```typescript
   // Client-side citation click handler in Zustand store:
   const onCitationClick = (candidateId: string, pageNumber: number, boundingBoxes: BoundingBox[]) => {
     setActiveCandidate(candidateId);
     pdfViewerRef.current.scrollToPage(pageNumber);
     highlightLayerRef.current.renderBoundingBoxes(boundingBoxes); // Pulsing yellow overlay
   };
   ```

---

### Days 11–12: Integration Testing, Retrieval Tuning & Bug Fixing
- **Your Focus (Tester & Quality Gatekeeper):** Conduct exploratory testing. Upload tricky resumes (tables, graphics, multi-column), test diverse queries, measure query response times, and verify GDPR deletion.
- **AI Assistant's Focus:** Write comprehensive unit and integration tests (pytest), fix coordinate calculation edge cases, optimize pgvector index queries, and harden error handling.

#### Action Steps:
1. **Run Backend Test Suite:** `pytest tests/ -v --cov=app` (Aim for $\ge 85\%$ coverage).
2. **Verify Hallucination Resistance:** Submit an adversarial prompt (e.g. *"Find candidates who have flown to Mars"*). Confirm the system returns zero results or explicitly states no candidates possess this experience, rather than inventing false claims.
3. **Coordinate Scaling Verification:** Test viewing on both 1080p and 4K displays to ensure SVG highlight boxes align exactly over resume text without viewport drift.
4. **Benchmark Latency:** Confirm vector cosine retrieval executes in $< 20$ ms on 1,000+ chunks.

---

## 4. Phase 7: Production Cloud Deployment & Hosting Guide (Days 13–14)

```
+--------------------------------------------------------------------------------------------------------+
|                                    Production Cloud Architecture                                       |
+--------------------------------------------------------------------------------------------------------+
|                                                                                                        |
|      [Recruiter Browser]                                                                               |
|               |                                                                                        |
|               v (HTTPS)                                                                                |
|     +-------------------------+                                                                        |
|     |   Vercel Edge Network   | ----> Hosts Next.js 14+ Frontend (SSR & Static Assets)                 |
|     |   talent-engine.app     |                                                                        |
|     +-------------------------+                                                                        |
|               |                                                                                        |
|               v (REST & SSE Stream over HTTPS)                                                         |
|     +-------------------------+                                                                        |
|     |  Render / Railway / GCP | ----> Hosts FastAPI Python Backend (Docker Container)                 |
|     |  api.talent-engine.app  |       - PyMuPDF C-Extensions                                           |
|     +-------------------------+       - SSE Token Streaming                                            |
|          |                |                                                                            |
|          | (Async SQL)    | (HTTPS / TLS 1.3)                                                          |
|          v                v                                                                            |
|  +----------------+   +------------------------------------+                                           |
|  | Supabase/Neon  |   | Google Gemini AI Platform          |                                           |
|  | PostgreSQL 16  |   | - text-embedding-004 (Embeddings)  |                                           |
|  | + pgvector HNSW|   | - gemini-2.5-flash (Synthesis)     |                                           |
|  +----------------+   +------------------------------------+                                           |
+--------------------------------------------------------------------------------------------------------+
```

### Step 1: Database Hosting on Supabase or Neon (PostgreSQL + pgvector)
1. **Create Project:** Sign up at [Supabase](https://supabase.com/) or [Neon](https://neon.tech/) and create a new project named `talent-engine-db`.
2. **Enable pgvector Extension:** In the SQL Editor, execute:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```
3. **Obtain Connection String:** Copy the pooled connection string (with `asyncpg` driver format):
   ```env
   DATABASE_URL="postgresql+asyncpg://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
   ```
4. **Execute Production Migrations:** From your local terminal, run:
   ```bash
   cd backend
   DATABASE_URL="your-supabase-connection-string" alembic upgrade head
   ```

### Step 2: Backend API Hosting on Render, Railway, or Google Cloud Run
Deploying on **Render**:
1. **Push Code to GitHub:** Ensure backend code and `docker/Dockerfile.backend` are pushed.
2. **Create New Web Service:** On Render, click **New** $\rightarrow$ **Web Service** $\rightarrow$ connect repository.
3. **Configure Build Settings:**
   - **Environment:** Docker
   - **Dockerfile Path:** `./docker/Dockerfile.backend`
   - **Docker Context:** `./backend`
   - **Instance Type:** Starter ($7/mo for zero spin-down latency)
4. **Configure Environment Variables:**
   - `DATABASE_URL`: Your Supabase/Neon PostgreSQL connection URL
   - `GEMINI_API_KEY`: Your Google Gemini API Key
   - `ENVIRONMENT`: `production`
   - `CORS_ORIGINS`: `https://your-frontend.vercel.app`
   - `STORAGE_LOCAL_DIR`: `/tmp/resumes` (or attached persistent disk)
5. **Verify Deployment:** Visit `https://talent-engine-backend.onrender.com/docs` to verify Swagger UI.

### Step 3: Frontend Hosting on Vercel
1. **Push Frontend to GitHub:** Ensure `frontend/` is in your repository.
2. **Import Project in Vercel:**
   - Click **Add New Project** $\rightarrow$ import GitHub repository.
   - Set **Root Directory** to `frontend`.
   - Framework Preset automatically detects **Next.js**.
3. **Configure Environment Variables:**
   - `NEXT_PUBLIC_API_URL`: `https://talent-engine-backend.onrender.com/api/v1`
4. **Deploy:** Click **Deploy**. Vercel compiles and assigns production URL: `https://talent-engine.vercel.app`.

### Step 4: DNS, Custom Domains, CORS & Health Verification
1. **Backend CORS:** Set `CORS_ORIGINS="https://talent-engine.vercel.app"`.
2. **End-to-End Live Verification:**
   - Create talent pool.
   - Upload 5 PDF resumes.
   - Run semantic query: *"Engineers experienced with high-concurrency microservices"*.
   - Verify comparative brief streaming and click citation badges to verify PDF highlights.

---

## 5. Emergency Debugging & Verification Cheat Sheet

| Issue / Symptom | Root Cause | Immediate Diagnostic & Fix |
| :--- | :--- | :--- |
| **Google API HTTP 429**<br>*Rate limit exceeded* | Too many chunk embedding requests sent too quickly to Gemini. | Verify batch size is 32 chunks. Ensure exponential backoff with jitter is active in `embeddings.py`. Add a 0.5s pause between batches during bulk uploads. |
| **CORS Error in Browser**<br>*Blocked by CORS policy* | Next.js frontend URL is missing from backend `CORS_ORIGINS`. | In backend `.env` or Render dashboard, add the frontend origin (including protocol without trailing slash): `CORS_ORIGINS="https://talent-engine.vercel.app"`. |
| **Coordinate Highlight Drift**<br>*Box misaligned on PDF* | Viewport scale factor mismatch between PyMuPDF points (72 DPI) and PDF.js canvas scale. | Ensure coordinates are normalized to fractional ratios: `x_norm = x / page_width`. In PDF.js, multiply normalized ratio by actual rendered canvas dimensions. |
| **Scanned PDF Error**<br>*0 characters extracted* | PDF contains scanned images rather than digital text stream. | Verify that `detect_scanned_pdf()` caught the file. Scanned PDFs require OCR (Phase 2). For MVP, use digital PDFs with selectable text. |
| **PostgreSQL HNSW Slow**<br>*Query > 100ms* | Index not being used; falling back to sequential scan. | Run `EXPLAIN ANALYZE SELECT ...` in psql. Verify `SET hnsw.ef_search = 40;`. Ensure pgvector extension and HNSW index are active on `resume_chunks.embedding`. |
| **LLM Hallucinated Chunk**<br>*Citation pill unclickable* | LLM generated a chunk index that was not in prompt context. | Check `CitationVerifier` logs. Lower temperature to $T=0.15$. Reinforce prompt instruction: *"Only cite chunk identifiers provided in &lt;context_chunks&gt;."* |

---

### Deliverable Files in Workspace
- 📄 **[`DEVELOPMENT_CYCLE_GUIDE.pdf`](file:///C:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/DEVELOPMENT_CYCLE_GUIDE.pdf)** — High-resolution 13-page print-ready PDF guide.
- 📝 **[`DEVELOPMENT_CYCLE_GUIDE.md`](file:///C:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/DEVELOPMENT_CYCLE_GUIDE.md)** — In-IDE Markdown version.
- 📐 **[`PROJECT_BLUEPRINT.md`](file:///C:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/PROJECT_BLUEPRINT.md)** — Complete 28-section technical architectural blueprint.
