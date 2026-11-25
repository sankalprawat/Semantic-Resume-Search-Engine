# Performance Analysis & Load Predictions (`PREDICTIONS.md`)

> **Locked prior to any load test execution.** All architectural mappings, bottleneck identifications, and quantitative capacity estimates below were derived solely from static source inspection before running Phase 2 stress tests.

---

## 1. Architecture Map

### 1.1 Entry Points & Runtime Topology
- **Backend API (`backend/app/main.py`, `backend/Procfile`)**:
  - FastAPI (`0.119.1`) ASGI application launched via single-worker Uvicorn (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
  - Routes are mounted twice in `main.py` (`api_router` under `/api/v1` and root `/`), with `resumes.router` additionally mounted under both `/pools` and `/resumes` in `backend/app/api/v1/api.py`.
  - Health endpoints: `GET /health`, `GET /api/v1/health`, `GET /`.
  - `CORSMiddleware` is enabled globally for configured origins and `https://.*\.vercel\.app`.
  - `lifespan()` only creates `settings.STORAGE_LOCAL_DIR` (`./storage/resumes`); despite its docstring ("pre-warms connections"), it performs **no DB or HTTP client pre-warming**.
- **Frontend (`frontend/src/`)**:
  - Next.js 14 App Router client-rendered workspace (`src/app/page.tsx`, `src/context/PoolDataContext.tsx`, `src/context/SynthesisContext.tsx`, `src/lib/api.ts`) making direct browser `fetch()` calls to `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000/api/v1`) and client-side PDF rendering via `pdfjs-dist` (`GroundedPdfViewer.tsx`).

### 1.2 Request Flows (Key Endpoints)
1. **`GET /health` & `GET /api/v1/health`** (`main.py:47-57`)
   - Returns static config dict; no `get_db` dependency, no DB I/O, no external API calls.
2. **`GET /api/v1/pools`** (`pools.py:49-56` -> `vector_store.list_pools`)
   - `get_db()` -> `SELECT` pools with `LEFT OUTER JOIN candidates` + `GROUP BY talent_pools.id ORDER BY created_at DESC`. No pagination.
3. **`GET /api/v1/pools/{pool_id}/candidates`** (`pools.py:81-93` -> `get_pool` + `list_candidates_for_pool`)
   - Calls `vector_store.get_pool(pool_id)` (loads `TalentPool` + `selectinload(TalentPool.candidates)`), then `list_candidates_for_pool(pool_id)` (loads `Candidate` + `selectinload(Candidate.resumes)` + `selectinload(Candidate.chunks)`). Returns `CandidateListItem` list (no pagination).
4. **`POST /api/v1/resumes/{pool_id}/upload`** (`resumes.py:45-128`)
   - `get_pool(pool_id)` -> sequential loop over uploaded `UploadFile`s:
     1. Reads entire file into RAM (`await file.read()`).
     2. Synchronous blocking `open(file_path, "wb").write(content)` on local filesystem.
     3. Synchronous PyMuPDF extraction (`ingestion_service.extract_from_bytes`) parsing text, images, and every word's normalized bbox.
     4. Synchronous sliding-window chunking (`chunker.chunk_document`) with bounding box sorting/merging (`merge_adjacent_bboxes`).
     5. Async Gemini embedding batch (`embedding_service.embed_texts_batch`) firing 1 HTTPS call per chunk behind process-global `asyncio.Semaphore(8)`.
     6. Per-file transactional DB insert (`save_candidate_and_resume`: `Candidate` + `Resume` + N `ResumeChunk` with `Vector(768)` -> `commit()` + 2x `refresh()`).
5. **`GET /api/v1/resumes/{candidate_id}/file`** (`resumes.py:131-189`)
   - `get_candidate_resume(candidate_id)` -> up to 6 synchronous `Path.exists()`/`is_file()` probes -> `FileResponse` (or synchronous in-memory PyMuPDF single-page fallback PDF synthesis if file missing).
6. **`POST /api/v1/pools/{pool_id}/search`** (`search.py:15-54`)
   - `get_pool(pool_id)` -> `embedding_service.embed_text(query)` (Gemini `embed_content`) -> `vector_store.semantic_search()` (raw SQL CTE joining `resume_chunks` and `candidates` filtered by `pool_id` and `min_similarity`, windowed by `ROW_NUMBER() OVER (PARTITION BY rc.candidate_id ORDER BY rc.embedding <=> ...)`, sorted and limited to `top_k`) -> Python grouping and re-sorting.
7. **`POST /api/v1/pools/{pool_id}/evaluate/stream`** (`evaluations.py:15-54` -> `rag_orchestrator.stream_comparative_synthesis`)
   - `get_pool(pool_id)` -> returns `StreamingResponse` holding `AsyncSession` open across the entire stream:
     1. `embed_text(query)` + `semantic_search(...)`.
     2. Prompt assembly (`_build_context_and_mapping`, `_build_prompt`).
     3. Streaming Gemini LLM call (`generate_content_stream`) with fallback loop across up to 6 streaming models + 6 non-streaming fallback attempts (`timeout=25_000` ms per attempt + jittered `asyncio.sleep`).
     4. Regex verification (`citation_verifier.verify_synthesis`).
     5. DB persistence (`Evaluation` + N `EvaluationCitation` rows + `commit()`), then emits SSE `done` event.
8. **`GET /api/v1/pools/{pool_id}/evaluations`** (`evaluations.py:57-69`)
   - `get_pool(pool_id)` -> `list_evaluations_for_pool()` loading all `Evaluation` rows + `selectinload(Evaluation.citations)`. No pagination.
9. **`GET /api/v1/pools/{pool_id}/evaluations/{evaluation_id}`** (`evaluations.py:72-85`)
   - `select(Evaluation)` with `selectinload(Evaluation.citations).selectinload(EvaluationCitation.candidate)` and `.selectinload(EvaluationCitation.chunk)`, plus re-parsing citations via `citation_verifier.parse_citations()`.

### 1.3 Database Access, External Calls, Caching & Background Jobs
- **Database Engine (`backend/app/core/database.py`)**:
  - `create_async_engine(..., echo=settings.DEBUG, pool_pre_ping=True, pool_size=10, max_overflow=20, pool_timeout=30)` using `asyncpg`.
  - Max simultaneous connections per Uvicorn process = **30** (`10 + 20`).
  - `AsyncSessionLocal` uses SQLAlchemy 2.0 default `autobegin=True`, so any initial `SELECT` (e.g., `get_pool()`) opens a transaction and pins the underlying `asyncpg` connection until `commit()`, `rollback()`, or `close()`.
  - `backend/.env` points `DATABASE_URL` to Supabase Session Pooler (`aws-0-eu-west-1.pooler.supabase.com:5432`) and sets `DEBUG=True`.
- **External Calls**:
  - **Google Gemini Embeddings** (`embeddings.py`): `google-genai` async `embed_content` (`gemini-embedding-2`, 768-dim). Uses a single process-wide `asyncio.Semaphore(8)`, **no HTTP timeout configured**, and `@retry(stop_after_attempt(4), wait_random_exponential(1..10s))` on `Exception`.
  - **Google Gemini Completions** (`rag_engine.py`): `google-genai` async `generate_content_stream` / `generate_content` (`gemini-3.5-flash-lite` + 5 fallbacks), `timeout=25_000` ms, `HttpRetryOptions(attempts=1)`, manual outer fallback loop up to 12 calls.
- **Caching**: **None**. Zero in-memory, HTTP, or Redis caching for query embeddings, pool/candidate metadata, PDF files, or repeated evaluations.
- **Background Jobs**: **None**. FastAPI `BackgroundTasks`, task queues (Celery/ARQ/Dramatiq), and worker threads/processes are completely absent; PDF parsing, chunking, embedding, and DB writes all execute inline inside HTTP request handlers.

---

## 2. Identified Bottlenecks & Risk Analysis

| Rank (Predicted) | Component / File | Bottleneck Class | Mechanism & Impact |
|---|---|---|---|
| **1** | `database.py`, `evaluations.py`, `rag_engine.py`, `search.py`, `resumes.py` | **Connection Pool Exhaustion (`IDLE IN TRANSACTION`)** | `get_db()` holds one `AsyncSession` across the entire handler/SSE stream. Calling `get_pool()` upfront executes a `SELECT`, starting a DB transaction and pinning a connection (`max 30`) during external Gemini embedding calls (`/search`, `/upload`), sync PDF CPU work (`/upload`), and the entire multi-second Gemini SSE stream (`/evaluate/stream`). >30 concurrent slow/streaming requests starve **every** DB endpoint, queuing up to `DB_POOL_TIMEOUT=30s` before `TimeoutError`. |
| **2** | `vector_store.py:67-114`, `rag_engine.py:392-475` | **Severe Over-Fetching via `selectinload` & Missing Projections** | `get_pool()` unconditionally `selectinload`s all `candidates` on 7 endpoints just to check existence. `list_candidates_for_pool()` additionally `selectinload`s all `resumes` (full `raw_text`) AND all `chunks` (full `text_content`, `bounding_boxes` JSONB, and `Vector(768)` embeddings) solely to compute `len(c.chunks)`. `list_evaluations_for_pool()` loads full `synthesis_markdown` and all `EvaluationCitation` JSONB rows just to slice `[:200]` and count citations. `get_evaluation()` loads `ResumeChunk` (including `Vector(768)`) just for `chunk_index`. |
| **3** | `vector_store.py:222-249`, `config.py:61` | **HNSW Vector Index Bypass (`O(N)` Exact Scan + WindowAgg)** | `semantic_search` joins `resume_chunks` to `candidates` (`pool_id` not on `resume_chunks`), filters by `(1 - (rc.embedding <=> ...)) >= :min_similarity`, and partitions by `ROW_NUMBER() OVER (PARTITION BY rc.candidate_id ORDER BY ...)` without an inner `ORDER BY ... LIMIT`. PostgreSQL cannot use `idx_resume_chunks_embedding_hnsw` and must scan all chunks in the pool, compute cosine distance repeatedly, and run two sorts/WindowAgg. Also `HNSW_EF_SEARCH=40` is dead config (never applied via `SET LOCAL`), and `query_vec` is passed as ~12 KB decimal text + `CAST`. |
| **4** | `embeddings.py:27-77`, `rag_engine.py:232-301` | **External API Contention, Global `Semaphore(8)` & Retry Amplification** | `embed_texts_batch` sends 1 HTTP request per chunk instead of batch payloads, throttled by a global `Semaphore(8)` shared across uploads, searches, and evaluations. Uploads saturate all 8 slots and starve interactive search/eval queries (while blocked requests hold pinned DB connections!). Missing timeout on `embedding_service.client` + retry-on-`Exception` (4 attempts) and 12-attempt LLM fallback loop amplify tail latency and connection hold times under 429/503s. |
| **5** | `resumes.py:77-123, 147-175`, `ingestion.py`, `chunking.py` | **Event-Loop-Blocking Synchronous CPU & File I/O + Unchecked Upload Size** | `open(..., "wb").write()` (`aiofiles` unused), PyMuPDF text/word/image extraction, `SlidingWindowChunker` + `merge_adjacent_bboxes`, and fallback PDF rendering run synchronously on the single Uvicorn asyncio event loop, freezing concurrent requests. `MAX_UPLOAD_SIZE_MB` (25 MB) is never enforced, allowing unbounded RAM buffering (`await file.read()`). Batch uploads commit per file in sequence. |
| **6** | `database.py:24`, `.env:2`, `config.py:17` | **SQLAlchemy `echo=True` Synchronous Stdout Logging & `pool_pre_ping`** | `DEBUG=True` sets `echo=True`, formatting every SQL query and large parameters (768-dim vector literals, JSONB bboxes, `raw_text`) synchronously to stdout on the event loop. `pool_pre_ping=True` adds an extra `SELECT 1` network RTT per session checkout. |
| **7** | `pools.py`, `evaluations.py`, `0001_initial_schema.py` | **Unbounded Lists & Missing Migration Indexes** | `GET /pools`, `GET /pools/{id}/candidates`, and `GET /pools/{id}/evaluations` lack `LIMIT`/`OFFSET` pagination. `0001_initial_schema.py` omits `ix_evaluation_citations_candidate_id` and `ix_evaluation_citations_chunk_id` declared in ORM (`evaluation.py:80,86`), causing sequential scans on cascade deletes. |
| **8** | `PoolDataContext.tsx`, `SynthesisStream.tsx`, `GroundedPdfViewer.tsx` | **Frontend Redundant Fetches & Streaming Re-parse** | `setActivePool()` triggers duplicate `fetchCandidates` calls (`refreshCandidates` + `useEffect([activePool?.id])`). `SynthesisStream` re-parses full accumulated markdown in `<ReactMarkdown>` on every SSE token ($O(T^2)$). |

---

## 3. Assumptions & Capacity Estimation Methodology

### 3.1 System & Environment Assumptions
- **Application Host (Observed Local Hardware)**: 12 logical CPUs (Windows), **7.4 GB total physical RAM** (~1.4 GB available free RAM before test load), Python 3.11.6, single-worker `uvicorn app.main:app` (`--workers 1`, matching `Procfile`), `DEBUG=True` (`echo=True`), `DB_POOL_SIZE=10`, `DB_MAX_OVERFLOW=20` (max **30** DB connections), `DB_POOL_TIMEOUT=30` s.
- **Two Reference Deployment/Staging Profiles**:
  - **Profile L (Local Staging — Loopback DB + Local/Mocked AI Latency for Safe Stress Testing)**:
    - Local PostgreSQL 16/18 + pgvector (or isolated local staging DB) on `127.0.0.1`, network RTT **~0.5–1.5 ms**.
    - Load generator running on same host (competes with backend & DB for 12 logical CPUs and 7.4 GB RAM).
    - For Gemini-dependent endpoints under safe local stress testing without burning API quota or hitting external 429 bans: we separate **(L1) App + DB + PyMuPDF capacity** (with stubbed/simulated embedding & LLM latencies: e.g., 150 ms embed, 2.5 s LLM stream) vs **(L2) Live Gemini API path** (250–400 ms embed, 2.5–5.0 s LLM stream, bounded by external RPM/TPM).
  - **Profile R (Configured `.env` Remote Supabase `eu-west-1` Session Pooler + Live Gemini)**:
    - Remote PostgreSQL RTT **~80–150 ms** per SQL statement (`pool_pre_ping` + queries + implicit close `ROLLBACK`).
    - Supabase Session Pooler connection cap typically 15–60 connections.

### 3.2 First-Principles Math & Predictions by Endpoint

> **Little's Law Baseline**: $L = \lambda \cdot W \implies \lambda_{\max} = \frac{C}{W}$, where $C$ is the bottleneck concurrency limit (e.g., `30` DB pool connections, `8` embedding semaphore slots, or `1` Python event loop) and $W$ is the resource hold time per request.

#### A. `GET /api/v1/health` (No DB, No External I/O)
- **Bottleneck**: Single Windows Python asyncio event loop (`h11`/HTTP parsing + JSON serialization, ~0.4–0.8 ms CPU/req; shared host CPU with load generator).
- **Predicted Max Sustainable Load**:
  - Throughput: **1,200 – 2,500 req/s**
  - Concurrent Users: **50 – 150 concurrent VUs**
  - Expected Latency at sustainable load: p50 **2–8 ms**, p95 **15–40 ms**, p99 **40–100 ms**, 0% errors.
  - Breaking point: Event loop queue saturation / socket exhaustion above ~250–400 concurrent VUs.

#### B. `GET /api/v1/pools` (`list_talent_pools`)
- **DB work**: `pool_pre_ping` (`SELECT 1`) + 1 `GROUP BY` query + `echo=True` stdout logging + session close `ROLLBACK`.
- **Profile L (Local DB, <50 pools)**:
  - Service/hold time $W \approx 3\text{–}6\text{ ms}$ (DB pool of 30 is not the limit: $30 / 0.005 = 6{,}000\text{ RPS}$ theoretical; instead single Python event loop + SQLAlchemy ORM + `echo=True` stdout logging caps throughput).
  - Sustainable Throughput: **220 – 450 req/s** at **30 – 60 concurrent users** (p50 ~40–90 ms, p95 < 250 ms).
- **Profile R (Remote Supabase ~100 ms RTT)**:
  - 2–3 sequential DB round-trips $\implies W \approx 220\text{–}320\text{ ms}$.
  - DB pool of 30 saturates at $\lambda_{\max} = 30 / 0.25 \approx \mathbf{100\text{–}135\text{ req/s}}$ and **30 concurrent users**.

#### C. `GET /api/v1/pools/{pool_id}/candidates` (`list_pool_candidates`)
- **DB work**: 7 round-trips (`SELECT 1` ping + `get_pool` [2 queries] + `list_candidates` [3 queries loading `raw_text`, `bounding_boxes`, and `Vector(768)`] + `ROLLBACK`).
- **Predicted Max Sustainable Load (Profile L, Local DB)**:
  - **Small pool (3–10 candidates, ~15 chunks, ~100 KB hydration)**: $W \approx 10\text{–}20\text{ ms}$. Sustainable: **80 – 160 req/s** at **20 – 40 concurrent users** (p95 < 350 ms).
  - **Medium/Large pool (100 candidates, ~400 chunks, ~3–5 MB vectors+JSONB+raw_text hydrated per request!)**:
    - Heavy asyncpg wire decode + Python ORM object construction + `echo=True` + GC pressure: $W \approx 80\text{–}180\text{ ms}$ CPU/memory bound.
    - Sustainable: **8 – 20 req/s** at **10 – 20 concurrent users**; beyond ~25 concurrent users, memory allocation (~100+ MB transient ORM objects) and GC stalls push p95 > 2 s and threaten OOM on the 7.4 GB host (~1.4 GB free RAM).
- **Profile R (Remote Supabase ~100 ms RTT)**:
  - Small pool: 7 round-trips $\implies W \approx 650\text{–}800\text{ ms} \implies$ max **35 – 45 req/s** at **30 concurrent users**.

#### D. `GET /api/v1/resumes/{candidate_id}/file`
- **Work**: `pool_pre_ping` + 1 `SELECT resumes` + up to 6 sync `stat()` calls + `FileResponse` (~50–250 KB PDF).
- **Predicted Max Sustainable Load (Profile L, Local DB + cached disk file)**:
  - Throughput: **150 – 300 req/s** at **25 – 50 concurrent users** (bounded by anyio threadpool for `FileResponse` + DB query; p95 < 300 ms).
  - *Fallback path (missing file -> PyMuPDF synthesis on event loop)*: drops to **30 – 70 req/s** at **10 – 20 concurrent users** and blocks concurrent event-loop tasks.

#### E. `POST /api/v1/pools/{pool_id}/search` (`semantic_search_pool`)
- **Work**: `get_pool()` (pins DB conn) -> `embed_text()` (external HTTPS, global `Semaphore(8)`) -> `semantic_search()` (full-pool join + 768-d cosine scan + `WindowAgg` bypassing HNSW).
- **Predicted Max Sustainable Load**:
  - **With simulated/real Gemini embedding latency ($W_{\text{embed}} \approx 250\text{ ms}$)**:
    - Throughput capped by `Semaphore(8)`: $\lambda_{\max} = 8 / 0.25\text{ s} \approx \mathbf{20\text{–}32\text{ req/s}}$ (or ~15–25 req/s with DB + JSON overhead).
    - **Concurrency wall at 30 VUs**: Because `get_pool()` pins a DB connection *before* `await self.semaphore` queues requests 9..30, **>30 concurrent search requests exhaust the 30-connection DB pool**, causing `DB_POOL_TIMEOUT=30s` errors once wait queues exceed 30 s! Safe concurrency: **15 – 25 concurrent users**.
  - **Vector SQL scaling (isolating DB search with fast/cached embedding, ~2 ms)**:
    - Small pool (10 candidates / 40 chunks): **90 – 160 req/s** at **20 – 30 concurrent users**.
    - Scaled pool (500–1,000 candidates / 2,500–5,000 chunks, HNSW bypassed): exact scan + double sort takes ~50–150 ms PostgreSQL CPU $\implies$ drops to **15 – 40 req/s** at **15 – 30 concurrent users**.

#### F. `POST /api/v1/resumes/{pool_id}/upload` (`upload_resumes`)
- **Work**: Sync `open().write()`, sync PyMuPDF extraction + chunking + bbox merge (~25–60 ms event-loop freeze per 2-page PDF), `embed_texts_batch` (4–6 chunks per PDF through global `Semaphore(8)`), per-file DB commit + 2x refresh.
- **Predicted Max Sustainable Load (1 PDF ~2 pages / 4 chunks per request, ~250 ms/embed call)**:
  - Each file takes ~125–200 ms embedding wall time (4 calls across 8 semaphore slots) + ~40 ms blocking CPU + ~10 ms DB = ~200–300 ms solo, or **~4 – 9 uploads/sec** (single-file) / **1.5 – 3 batches/sec** (5-file batches) across concurrent users.
  - Sustainable concurrency: **6 – 12 concurrent users**. Above ~12–15 concurrent uploaders (or large multi-file PDFs), event-loop blocking stalls `/health` and all other routes (>500 ms p99), and `Semaphore(8)` backpressure pins DB connections until pool exhaustion at 30 concurrent requests.

#### G. `POST /api/v1/pools/{pool_id}/evaluate/stream` (SSE Comparative Synthesis)
- **Work**: `get_pool()` (pins DB conn in `IDLE IN TRANSACTION`) -> `embed_text()` -> `semantic_search()` -> Gemini SSE stream (assumed $W_{\text{stream}} \approx 2.5\text{–}4.0\text{ s}$) -> `citation_verifier` -> DB `Evaluation` + `EvaluationCitation` inserts + `commit()`.
- **Hard Architectural Ceiling**: **30 concurrent SSE streams** (`DB_POOL_SIZE=10 + DB_MAX_OVERFLOW=20`), regardless of CPU headroom!
- **Predicted Max Sustainable Load (assuming $W_{\text{stream}} \approx 3.0\text{ s}$)**:
  - Theoretical max throughput: $30 / 3.0\text{ s} = \mathbf{10\text{ req/s}}$ (assuming Gemini API does not 429 below 600 RPM).
  - Sustainable throughput: **4 – 7 req/s** at **15 – 22 concurrent users** (keeping <75% DB pool utilization so reads don't starve).
  - **Breaking point**: At **31+ concurrent users**, new `/evaluate/stream` requests AND unrelated read requests (`GET /pools`, `GET /candidates`) immediately queue for DB connections, driving p95 latency >30 s and throwing HTTP 500 `sqlalchemy.exc.TimeoutError`.

#### H. `GET /api/v1/pools/{pool_id}/evaluations` (`list_pool_evaluations`)
- **Work**: `get_pool()` + `SELECT evaluations` + `selectinload(citations)` (full markdown + full citation JSONB).
- **Predicted Max Sustainable Load (Profile L)**:
  - Small history (5 evaluations, ~50 citations): $W \approx 15\text{–}30\text{ ms} \implies$ **50 – 100 req/s** at **15 – 30 concurrent users**.
  - Large history (50+ evaluations, ~1,000 citations): $W \approx 120\text{–}300\text{ ms} \implies$ **5 – 15 req/s** at **5 – 15 concurrent users**.

---

## 4. Summary Prediction Matrix (Target Staging Baseline: Profile L — Local DB + Single Uvicorn Worker)

| Endpoint | Bottleneck Resource | Predicted Max Sustainable RPS | Predicted Max Concurrent Users | Expected Breaking Point & Failure Mode |
|---|---|---|---|---|
| `GET /api/v1/health` | Single asyncio event loop + shared host CPU | **1,200 – 2,500 RPS** | **50 – 150 VUs** | >250 VUs: event-loop queuing, p99 > 100 ms |
| `GET /api/v1/pools` | Event loop + `echo=True` + `pool_pre_ping` | **220 – 450 RPS** | **30 – 60 VUs** | >80 VUs: CPU/logging saturation, p95 > 500 ms |
| `GET /api/v1/pools/{id}/candidates` (small, 3–10 cands) | 7 queries + ORM chunk/vector hydration + `echo=True` | **80 – 160 RPS** | **20 – 40 VUs** | >50 VUs: ORM deserialization CPU, p95 > 500 ms |
| `GET /api/v1/pools/{id}/candidates` (medium, 100 cands) | Megabyte `Vector(768)` + `raw_text` ORM hydration & GC | **8 – 20 RPS** | **10 – 20 VUs** | >25 VUs: multi-second GC pauses / RAM exhaustion |
| `GET /api/v1/resumes/{id}/file` | Anyio file threadpool + sync `stat()` probes | **150 – 300 RPS** | **25 – 50 VUs** | >60 VUs: threadpool/disk queuing (worse if PyMuPDF fallback runs) |
| `POST /api/v1/pools/{id}/search` (250 ms embed / DB scaled) | `Semaphore(8)` + pinned DB conn + non-HNSW scan | **15 – 25 RPS** (embed-bound) / **15 – 40 RPS** (5k chunks) | **15 – 25 VUs** | **>30 VUs**: DB pool (`30`) exhausted by coroutines awaiting `Semaphore(8)` -> `TimeoutError` after 30 s |
| `POST /api/v1/resumes/{id}/upload` (2-page PDF) | Sync PyMuPDF + sync disk write + `Semaphore(8)` | **4 – 9 RPS** (1 file) | **6 – 12 VUs** | >12–15 VUs: event loop freezes all routes + DB pool exhaustion at 30 VUs |
| `POST /api/v1/pools/{id}/evaluate/stream` (3 s SSE) | **DB pool (`30`) pinned for full SSE duration** | **4 – 7 RPS** | **15 – 22 VUs** | **31+ VUs**: 100% DB pool exhaustion -> HTTP 500 `TimeoutError` across **all** DB endpoints after 30 s |
| `GET /api/v1/pools/{id}/evaluations` (5–50 evals) | `selectinload(citations)` + full markdown load | **15 – 80 RPS** | **10 – 25 VUs** | >30 VUs with large history: ORM/JSONB bloat |

---

## 5. Planned Phase 2 Verification Tests (Locked Before Execution)
1. **Baseline Run**: Moderate concurrency (5–10 VUs) across mixed read/search/upload/stream workflows against an isolated local environment to capture clean p50/p95/p99 and resource baseline.
2. **Ramp-Up (Step Stress) Runs**:
   - Read-heavy endpoints (`/health`, `/pools`, `/candidates` at small vs scaled candidate counts, `/evaluations`).
   - Vector search scaling (`/search` across larger chunk counts to confirm HNSW index bypass via `EXPLAIN ANALYZE`).
   - Upload CPU/event-loop blocking (`/upload` concurrent PDFs while probing `/health` latency).
   - SSE DB pool exhaustion ramp (`/evaluate/stream` ramping from 5 -> 15 -> 25 -> 35 -> 45 VUs while running concurrent `GET /pools` probes to verify cross-endpoint cascade failure at 30+ VUs).
3. **Sustained Load (Soak) Test**: 3–5 minutes at ~70–80% of predicted sustainable capacity (~15–20 VUs mixed workload) monitoring memory drift, connection pool stability, and latency degradation.
4. **Spike Test**: Sudden jump from 5 VUs -> 45 VUs (exceeding `DB_POOL_SIZE + DB_MAX_OVERFLOW = 30`) -> drop back to 5 VUs to observe pool exhaustion cascade, 30 s `DB_POOL_TIMEOUT` failures, and recovery behavior.
