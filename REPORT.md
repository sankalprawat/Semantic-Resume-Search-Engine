# Performance Limits & Bottleneck Diagnosis Report (`REPORT.md`)

## 1. Executive Summary

Load testing and profiling of the **Multi-Candidate Semantic Talent Engine (SemanticPin)** against an isolated local staging environment (PostgreSQL 18.6 + pgvector 0.8.6, single-worker Uvicorn on Python 3.13.13, and a local Gemini HTTP/SSE latency simulator preserving all `google-genai` SDK, `asyncio.Semaphore(8)`, and retry paths) confirmed that **the application's primary bottlenecks are architectural rather than hardware-bound**:

1. **DB Connection Pinning (`IDLE IN TRANSACTION`) Across External AI Calls & SSE Streams**: Holding one SQLAlchemy `AsyncSession` (`DB_POOL_SIZE=10`, `DB_MAX_OVERFLOW=20`, total **30 connections**) open from initial pool check through external Gemini streaming causes `GET /pools/` tail latency to jump **266x** (`9 ms -> 2,400 ms` p95) at 40 concurrent users and produces **25.95% HTTP 500 `sqlalchemy.exc.TimeoutError` failures** at 130 VUs under slow-LLM (`10 s`) conditions—while application CPU sits at just **5.9%**.
2. **Severe Over-Fetching via `selectinload` & Unbounded List Queries**: Loading full `ResumeChunk` (`Vector(768)` + JSONB `bounding_boxes`), `Resume.raw_text`, and `EvaluationCitation` payloads solely to compute `.length` in Python causes `GET /pools/{id}/candidates` (100 candidates) to collapse **15.3x** (`135.9 -> 8.88 RPS`, `p50 = 2,700 ms`) and `GET /pools/{id}/evaluations` to balloon RSS to **726.36 MB** and `p50 = 4,500 ms` during a 45-VU spike. `cProfile` confirmed **`73,000` calls to `pgvector.utils.vector.from_text` (`13.44 s`)** and **`456,084` `json.loads` calls (`10.59 s` in `_jsonb_decoder`)** decoding discarded data.
3. **Structural HNSW Vector Index Bypass & `get_pool()` Hydration Tax**: PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` proved that the `semantic_search` CTE + `WindowAgg` cannot use `idx_resume_chunks_embedding_hnsw` even with `SET enable_seqscan = off`. Worse, at 1,000 candidates, `get_pool()`'s `selectinload(TalentPool.candidates)` spent **`74.2 ms` avg** loading 1,000 unused `Candidate` ORM objects on every `/search` request—more than double the `33.9 ms` vector scan itself.

---

## 2. Test Environment & Methodology

- **Staging Stack (Zero Production / Supabase Impact)**:
  - **Application Server**: Single-worker `uvicorn` running unmodified `app.main:app` via [`load_tests/staging_server.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/staging_server.py) (`DEBUG=True`, `DB_POOL_SIZE=10`, `DB_MAX_OVERFLOW=20`, `DB_POOL_TIMEOUT=30`, `HNSW_EF_SEARCH=40`, `MAX_CHUNKS_PER_CANDIDATE=3`).
  - **Database**: Isolated local PostgreSQL 18.6 + pgvector 0.8.6 on `127.0.0.1:55432` migrated via Alembic (`0001_initial_schema.py`) and seeded with:
    - `small_pool`: 3 sample candidates (`Alice Vance`, `Bob Chen`, `Carol Rodriguez`) + 20 initial evaluations (`6` citations each).
    - `large_pool`: 100 candidates x 5 chunks = 500 chunks for list-hydration benchmarking.
    - `search_pool`: 1,000 candidates x 5 chunks = 5,000 chunks (`5,674` total chunks in `resume_chunks` across pools during `EXPLAIN`) with active `idx_resume_chunks_embedding_hnsw`.
    - `upload_pool`: Dedicated target pool for PDF ingestion tests so `small_pool` candidate counts stayed constant.
  - **External AI Simulator**: [`load_tests/mock_gemini.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/mock_gemini.py) routed via `google.genai.types.HttpOptions(base_url=...)` simulating `250 ms` embedding latency (`5 ms` in DB-isolated search runs) and `2,500 ms` (`10,000 ms` in timeout-cliff test) SSE token streaming with verifiable citations.
- **Load Generator & Telemetry**: Locust 2.47.0 ([`load_tests/locustfile.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/locustfile.py)), orchestrated by [`load_tests/run_suite.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/run_suite.py), recording per-second process CPU/RSS (`psutil`), `pg_stat_activity`, SQLAlchemy pool checkout/overflow/query timings, `EXPLAIN (ANALYZE, BUFFERS)`, and `cProfile` dumps.
- **Hardware**: Windows host, 12 logical CPUs, 7.4 GB total physical RAM.

---

## 3. Stress Test Results Summary (Phase 2)

| Run ID | Scenario / Target | VUs | Total Reqs | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Error % | App CPU (Avg/Max %) | App RSS Max (MB) | PG CPU Max % | DB Pool Max (`idle_in_tx`) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `01_baseline_mixed` | Mixed recruiter baseline (45s) | 8 | 333 | 7.47 | 12 | 2,900 | 2,900 | 0.00% | 8.9 / 20.3 | 152.58 | 4.8 | 7 / 30 (`6`) |
| `02a_health_200vu` | `GET /api/v1/health` ceiling | 200 | 31,636 | 1,694.37 | 54 | 66 | 84 | 0.00% | 33.7 / 40.5 | 149.49 | 0.0 | 0 / 30 (`0`) |
| `02b_pools_debug_true_60vu` | `GET /pools/` (`DEBUG=True`) | 60 | 5,442 | 285.48 | 160 | 310 | 390 | 0.00% | 89.3 / 101.1 | 146.66 | 9.3 | 30 / 30 (`27`) |
| `02c_pools_debug_false_60vu` | `GET /pools/` (`DEBUG=False`) | 60 | 7,659 | 401.82 | 92 | 260 | 370 | 0.00% | 88.3 / 102.5 | 146.09 | 12.4 | 30 / 30 (`25`) |
| `02d_candidates_small_40vu` | `GET /candidates` (3 cands) | 40 | 2,592 | 135.90 | 240 | 400 | 600 | 0.00% | 90.2 / 101.1 | 149.29 | 7.7 | 30 / 30 (`29`) |
| `02e_candidates_large_25vu` | `GET /candidates` (100 cands) | 25 | 225 | 8.88 | 2,700 | 2,900 | 3,900 | 0.00% | 93.2 / 101.3 | 246.23 | 4.7 | 25 / 30 (`19`) |
| `02f_file_serve_40vu` | `GET /resumes/{id}/file` | 40 | 6,009 | 315.41 | 91 | 140 | 260 | 0.00% | 117.8 / 149.5 | 147.08 | 9.3 | 30 / 30 (`30`) |
| `02g_eval_list_25vu` | `GET /evaluations` (20 evals) | 25 | 634 | 33.21 | 700 | 800 | 870 | 0.00% | 91.4 / 102.8 | 184.72 | 4.7 | 25 / 30 (`19`) |
| `02h_search_db_small_25vu` | `/search` 5ms embed (3 cands) | 25 | 2,897 | 152.14 | 120 | 190 | 360 | 0.00% | 91.0 / 101.3 | 145.94 | 9.3 | 24 / 30 (`19`) |
| `02h_search_db_5k_25vu` | `/search` 5ms embed (5k chunks) | 25 | 629 | 33.11 | 680 | 1,200 | 1,400 | 0.00% | 89.0 / 101.2 | 194.29 | 9.3 | 25 / 30 (`25`) |
| `02h_search_15vu` | `/search` 250ms embed (5k) | 15 | 654 | 27.09 | 520 | 650 | 1,000 | 0.00% | 69.8 / 87.2 | 172.87 | 6.2 | 15 / 30 (`15`) |
| `02i_search_35vu` | `/search` 250ms embed (5k) | 35 | 1,376 | 24.86 | 1,300 | 1,600 | 2,000 | 0.00% | 80.2 / 98.1 | 206.26 | 7.7 | 30 / 30 (`30`) |
| `02j_upload_health_12vu` | 2p PDF upload + `/health` probe | 12 | 275 | 10.88 | 1,500 | 1,600 | 1,600 | 0.00% | 20.0 / 29.6 | 153.97 | 3.1 | 12 / 30 (`12`) |
| `02j2_upload_dense_health_8vu` | 15p PDF upload + `/health` probe | 8 | 215 | 8.61 | 640 | 1,900 | 2,100 | 0.00% | 54.4 / 81.0 | 173.08 | 3.0 | 8 / 30 (`8`) |
| `02k_sse_cascade_15vu` | SSE (2.5s) + `GET /pools/` probe | 15 | 158 | 5.83 | 2,900 | 3,200 | 3,500 | 0.00% | 8.2 / 26.5 | 155.87 | 3.1 | 15 / 30 (`15`) |
| `02l_sse_cascade_25vu` | SSE (2.5s) + `GET /pools/` probe | 25 | 341 | 9.41 | 2,900 | 3,300 | 3,800 | 0.00% | 12.7 / 35.8 | 165.41 | 7.7 | 25 / 30 (`25`) |
| `02m_sse_cascade_40vu` | SSE (2.5s) + `GET /pools/` probe | 40 | 774 | 11.77 | 3,200 | 5,200 | 5,400 | 0.00% | 13.7 / 34.3 | 184.10 | 6.2 | 30 / 30 (`30`) |
| `02n_sse_pool_timeout_130vu` | SSE (10s) + `GET /pools/` breaking point | 130 | 289 | 4.56 | 30,000 | 32,000 | 33,000 | **25.95%** | 5.9 / 28.0 | 183.43 | 12.5 | **30 / 30 (`30`)** |
| `03_soak_18vu_180s` | Sustained mixed soak (180s) | 18 | 2,655 | 14.74 | 190 | 3,100 | 3,400 | 0.00% | 72.8 / 102.8 | **477.86** | 1.6 | 17 / 30 (`15`) |
| `04_spike_5_to_45_to_5` | Spike 5 -> 45 -> 5 VUs (105s) | 5–45 | 1,198 | 11.33 | 760 | 4,900 | 8,500 | **0.42%** | 61.5 / 102.8 | **726.36** | 9.3 | 30 / 30 (`29`) |
| `05_profile_mixed_20vu` | `cProfile` mixed workload (35s) | 20 | 457 | 12.30 | 390 | 3,700 | 5,200 | 0.00% | 95.9 / 101.3 | 482.58 | 6.2 | 16 / 30 (`13`) |
| `05b_profile_candidates_large` | `cProfile` 100-cand list (20s) | 15 | 145 | 6.88 | 2,100 | 2,300 | 2,300 | 0.00% | 92.7 / 104.4 | 217.56 | 4.6 | 15 / 30 (`10`) |

### Key Per-Endpoint Breakdown Highlights
- **Baseline (`01_baseline_mixed`, 8 VUs, 0% errors)**: `GET /pools/` p50 `4 ms` / p95 `9 ms`; `GET /candidates` p50 `9 ms` / p95 `27 ms`; `GET /resumes/{id}/file` p50 `5 ms` / p95 `12 ms`; `GET /evaluations` p50 `22 ms` / p95 `100 ms`; `POST /search` p50 `270 ms` / p95 `390 ms`; `POST /upload` p50 `310 ms` / p95 `460 ms`; `POST /evaluate/stream` p50 `2,900 ms` / p95 `2,900 ms`.
- **Upload Event-Loop Blocking (`02j` vs `02j2`)**:
  - `02j` (2-page `2.6 KB` PDF, 12 VUs): `/upload` ran at `7.36 RPS` (`p50 = 1,600 ms` due to 4 chunks/PDF queuing behind `Semaphore(8)`), while `/health [probe]` stayed `p50 = 2 ms`, `p95 = 3 ms`, `max = 11.75 ms`.
  - `02j2` (15-page `15.9 KB` dense PDF, 8 VUs, `embed_ms = 25`): `/upload` ran at `4.33 RPS` (`p50 = 1,700 ms`), while `/health [dense-probe]` degraded to **`p95 = 20 ms`, `p99 = 56 ms`, `max = 185.18 ms`**. Standalone timing confirmed `dense_15p_resume.pdf` blocks the event loop synchronously for **`51.32 ms`** (`47.03 ms` PyMuPDF + `4.29 ms` chunker) vs `6.49 ms` for `sample_resume_1.pdf`.
- **Cross-Endpoint SSE Starvation (`02k` -> `02m` -> `02n`)**:
  - `GET /api/v1/pools/ [probe]` degraded from `p50 = 7 ms, p95 = 220 ms` (15 VUs) -> `p50 = 9 ms, p95 = 320 ms` (25 VUs) -> **`p50 = 310 ms, p95 = 2,400 ms, max = 3,376 ms`** (40 VUs, `PoolMax = 30/30`) -> **`p50 = 21,000 ms, p95 = 30,000 ms, 9.43% HTTP 500`** (`02n`, 130 VUs @ 10s SSE, where SSE itself hit **`29.66%` errors, `p50 = 31,000 ms`**).
- **Sustained Soak Drift (`03_soak_18vu_180s`, 18 VUs, 0% errors)**:
  - RSS climbed steadily across the 3-minute run: **`134.51 MB` (start) -> `296.0 MB` avg (0–30s) -> `331.5 MB` avg (75–105s) -> `436.2 MB` avg / `477.86 MB` peak (150–180s)**, ending at `419.45 MB` (+285 MB retained!).
  - `GET /evaluations` consumed **`204,445.67 ms`** cumulative query decode time across `748` `SELECT_EVAL_CITATIONS` batches (`p50 = 1,200 ms`, `p95 = 3,600 ms`, `max = 4,331.35 ms`), driving average single-core CPU from `66.5%` -> `80.3%`.
- **Spike & Recovery (`04_spike_5_to_45_to_5`)**:
  - Pre-spike (5 VUs, t=0–25s): `app_rss ~ 240 MB`, `idle_in_tx = 1–5`, `p50 = 27–170 ms`, 0% errors.
  - Spike (45 VUs, t=27–72s): `idle_in_tx` hit `29/30`, app CPU pegged at **`98–102.8%`**, `app_rss` surged **`245 MB -> 726.36 MB`**, `GET /evaluations` hit **`p50 = 4,500 ms, max = 9,041.45 ms`**, and `5` requests failed (`ConnectionResetError(10054)` / `RemoteDisconnected` on `/file` and `/search`).
  - Recovery (5 VUs, t=73–108s): `p50` recovered to `23–130 ms` and `idle_in_tx` returned to `1–4`, **but `app_rss` remained elevated at `598.60 MB`** (+464 MB above start) due to retained heap arenas from unbounded citation hydration.

---

## 4. Predicted vs. Actual Comparison & Gap Explanations

| Endpoint / Flow | Predicted Sustainable Load (`PREDICTIONS.md`) | Actual Observed Result | Gap Explanation |
|---|---|---|---|
| `GET /api/v1/health` | 1,200–2,500 RPS, 50–150 VUs, p95 15–40 ms | **1,694.37 RPS @ 200 VUs**, p50 54 ms, p95 66 ms, 0% err | **Within predicted RPS band.** Slightly higher p95 (66 ms vs 40 ms) because 200 VUs > 150 VUs and Locust shared the Windows host with Uvicorn. |
| `GET /api/v1/pools` (`DEBUG=True` vs `False`) | 220–450 RPS, 30–60 VUs, p95 < 250 ms | **285.48 RPS** (`DEBUG=True`, p95 310 ms) / **401.82 RPS** (`DEBUG=False`, p95 260 ms) @ 60 VUs | **Exact match.** Confirmed `echo=True` synchronous stdout logging costs **29% throughput** (`-116 RPS`) and +74% p50 latency (`92 -> 160 ms`). |
| `GET /pools/{id}/candidates` (small, 3 cands) | 80–160 RPS, 20–40 VUs | **135.90 RPS @ 40 VUs**, p50 240 ms, p95 400 ms | **Exact match.** |
| `GET /pools/{id}/candidates` (100 cands) | 8–20 RPS, 10–20 VUs, p95 > 2,000 ms, high GC/RSS | **8.88 RPS @ 25 VUs**, p50 2,700 ms, p95 2,900 ms, RSS 246 MB | **Exact match.** Postgres ran the chunk query in `1.5 ms`, while SQLAlchemy/pgvector spent `1,513 ms` avg per call decoding 500 `Vector(768)` text strings & JSONB in Python. |
| `GET /resumes/{id}/file` | 150–300 RPS, 25–50 VUs | **315.41 RPS @ 40 VUs**, p50 91 ms, p95 140 ms | **Slightly exceeded (+5%)** because the `2.6 KB` PDF stayed hot in OS page cache and `FileResponse` used multiple anyio threads (`117.8%` CPU). |
| `GET /pools/{id}/evaluations` | 15–80 RPS, 10–25 VUs | **33.21 RPS @ 25 VUs** (20 evals); collapsed to **1.05 RPS, p50 4,500 ms** in spike | **Worst surprise growth bottleneck.** As prior runs appended evaluations to `small_pool`, unpaginated `selectinload(Evaluation.citations)` turned `GET /evaluations` into the #1 CPU & memory hog (`726 MB` RSS spike). |
| `POST /pools/{id}/search` (250 ms embed) | 15–25 RPS, 15–25 VUs; `TimeoutError` > 30 VUs | **27.09 RPS @ 15 VUs**; **24.86 RPS @ 35 VUs** (`PoolMax=30/30`, p50 1,300 ms, 0% err) | **Throughput match; error cliff gap explained:** At 35 VUs, `Semaphore(8)` drained at ~25 RPS so requests 31–35 queued only ~200 ms (<30 s `DB_POOL_TIMEOUT`), raising p50 2.5x without timing out. |
| `POST /pools/{id}/search` (5 ms embed, 5k chunks) | 90–160 RPS (small) / 15–40 RPS (5k chunks) | **152.14 RPS** (small) / **33.11 RPS** (5k chunks) @ 25 VUs | **Exact match, surprising internal split:** At 1,000 cands, `get_pool()`'s `selectinload(candidates)` (`102.1 ms` in `02h` / `74.2 ms` in `02i`) cost **more than 2x** the vector search SQL (`33.9 ms` in `02i`)! |
| `POST /resumes/{id}/upload` | 4–9 RPS, 6–12 VUs; event-loop freeze on `/health` | **7.36 RPS @ 12 VUs** (2p PDF); **4.33 RPS @ 8 VUs** (15p PDF, `/health` p95 3 -> 20 ms, max 185 ms) | **Matched RPS.** Small 2p PDFs only blocked for `6.5 ms` (`Semaphore(8)` dominated at `1.6 s`), whereas 15p PDFs blocked `51.3 ms` synchronously, exposing the `/health` p99/max latency spikes. |
| `POST /pools/{id}/evaluate/stream` | 4–7 RPS, 15–22 VUs; pool wall at 31+ VUs -> 30s `TimeoutError` | **5.83 / 9.41 / 11.77 RPS** @ 15/25/40 VUs (`GET /pools/` p95 **2,400 ms** at 40 VUs); **25.95% errors** @ 130 VUs (10s SSE) | **Threshold mechanism 100% confirmed.** At 40 VUs with 2.5 s streams, queue drain was ~2.5 s (<30 s timeout) so cross-endpoint latency spiked 266x without HTTP 500s; at 130 VUs (10 s SSE), queue exceeded 30 s and triggered `TimeoutError` HTTP 500s. |

---

## 5. Ranked Bottlenecks & Remediation Roadmap (Phase 3)

### Rank 1 (Critical): DB Connection Pinning (`IDLE IN TRANSACTION`) Across External Gemini I/O & SSE Streams
- **Evidence**:
  - `02m_sse_cascade_40vu`: `PoolMax = 30/30`, `max_idle_in_tx = 30`; concurrent `GET /api/v1/pools/ [probe]` latency spiked from `9 ms` p95 (`01_baseline`) to **`2,400 ms` p95 / `3,376 ms` max**.
  - `02n_sse_pool_timeout_130vu`: `PoolMax = 30/30`, `max_idle_in_tx = 30`; **75 failures (25.95% error rate)** with `sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 20 reached, connection timed out, timeout 30.00` in backend logs while app CPU averaged **`5.9%`**.
- **Root Cause**: [`get_db`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/core/database.py#L40-L52) injects a single `AsyncSession` (`autobegin=True`) for the entire handler/generator lifecycle. [`stream_candidate_evaluation`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/api/v1/endpoints/evaluations.py#L16-L54), [`semantic_search_pool`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/api/v1/endpoints/search.py#L16-L54), and [`upload_resumes`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/api/v1/endpoints/resumes.py#L46-L128) immediately call `get_pool()`, checking out a DB connection and opening an implicit transaction *before* calling Gemini embeddings or streaming tokens for seconds/minutes.
- **Recommended Fix**: Remove `Depends(get_db)` from long-lived handlers/SSE generators; instead open short-lived `async with AsyncSessionLocal() as db:` blocks strictly around individual DB reads/writes (check pool -> release conn; call Gemini embed -> acquire conn for vector search -> release conn; stream LLM tokens with **zero DB connections held**; acquire conn briefly to commit `Evaluation` + citations).
- **Expected Improvement**: Per-request DB connection hold time drops from `~3,000–10,000 ms` to `<15 ms` (**>200x reduction**). Eliminates cross-endpoint pool starvation (`GET /pools/` p95 stays `<15 ms` under heavy SSE load) and raises single-worker SSE concurrency from **30 -> 500+ concurrent streams**.

### Rank 2 (Critical): Over-Fetching via `selectinload`, Missing Projections & Unbounded Lists
- **Evidence**:
  - `05_profile_mixed_20vu.prof`: `456,084` `json.loads` / `raw_decode` calls (`10.59 s` in `_jsonb_decoder`) and `455,185` ORM `_instance` constructions driven by `list_pool_evaluations` (`24.30 s` cumtime).
  - `05b_profile_candidates_large.prof` (`02e`, 100 cands): `73,000` calls to `pgvector.utils.vector.from_text` (**`13.44 s` CPU**), `102,200` `json.decoder.raw_decode` calls, and `116,946` ORM instances—causing `SELECT_RESUME_CHUNKS` to average **`1,513.49 ms`** in Python (`1.5 ms` in Postgres `EXPLAIN`) and collapsing throughput to **8.88 RPS (`p50 = 2,700 ms`)**.
  - `04_spike_5_to_45_to_5`: `SELECT_EVAL_CITATIONS` averaged **`1,060.65 ms`** (`382.9 s` cumulative), pushing `app_rss` to **`726.36 MB`** (`598.60 MB` retained post-spike).
  - `02i_search_35vu` (1,000-cand pool): `get_pool()`'s `SELECT_CANDIDATES` took **`74.19 ms` avg**—more than double `SEMANTIC_SEARCH_CTE` (`33.86 ms`).
- **Root Cause**:
  - [`get_pool`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/vector_store.py#L67-L78) forces `selectinload(TalentPool.candidates)` on 7 endpoints just to verify existence.
  - [`list_candidates_for_pool`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/vector_store.py#L80-L114) loads all `Resume` (`raw_text`) and `ResumeChunk` (`Vector(768)` + `bounding_boxes`) rows purely to compute `len(c.chunks)`.
  - [`list_evaluations_for_pool`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/rag_engine.py#L447-L475) loads full `synthesis_markdown` and all `EvaluationCitation` JSONB rows purely for a 200-char preview and `len(e.citations)`, with no `LIMIT`/`OFFSET`.
  - [`get_evaluation`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/rag_engine.py#L392-L445) `selectinload`s full `ResumeChunk` (including `Vector(768)`) just to read `chunk_index`.
- **Recommended Fix**: Add `pool_exists(pool_id)` using `SELECT 1 FROM talent_pools WHERE id = :id`; replace `selectinload` count queries with SQL `COUNT()` + `GROUP BY` + `LEFT(synthesis_markdown, 200)` projections; enforce `limit`/`offset` pagination across `/pools`, `/candidates`, and `/evaluations`.
- **Expected Improvement**: `GET /candidates` (100 cands) latency drops from **`2,700 ms` -> `<30 ms`** (**~90x faster**, **200+ RPS**); `GET /evaluations` drops from **`4,500 ms` -> `<15 ms`** (**~300x faster**); eliminates the `134 -> 726 MB` RSS bloat and soak drift.

### Rank 3 (High): HNSW Index Bypass (`O(N)` Vector Scan) & Unused `HNSW_EF_SEARCH`
- **Evidence**:
  - [`db_explain_plans.txt`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/results/db_explain_plans.txt): Current query runs `Seq Scan on resume_chunks` (`31.39 ms`, `17,153` buffers at 5,506 rows). With `SET enable_seqscan = off`, Postgres STILL cannot use `idx_resume_chunks_embedding_hnsw` (falls back to `Index Scan using ix_resume_chunks_candidate_id` + `Incremental Sort` + `WindowAgg`, `18,700` buffers), whereas `ORDER BY embedding <=> ... LIMIT 45` uses `Index Scan using idx_resume_chunks_embedding_hnsw` (`1,696` buffers).
  - `02h_search_db_small_25vu` -> `02h_search_db_5k_25vu`: Throughput dropped **4.6x** (`152.14 -> 33.11 RPS`) and p95 rose **6.3x** (`190 -> 1,200 ms`).
- **Root Cause**: [`semantic_search`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/vector_store.py#L206-L261) joins `candidates` (because `resume_chunks` lacks `pool_id`), applies `>= min_similarity`, and evaluates an un-limited `ROW_NUMBER() OVER (PARTITION BY rc.candidate_id ORDER BY ...)`, blocking pgvector's HNSW `ORDER BY <=> LIMIT` access path. `settings.HNSW_EF_SEARCH` (`40`) is never applied.
- **Recommended Fix**: Denormalize `pool_id` onto `resume_chunks`, use an HNSW-eligible inner top-K query (`ORDER BY embedding <=> :q LIMIT :oversample_k` with `SET LOCAL hnsw.ef_search = :ef` and binary `pgvector` binding instead of text `CAST`), and apply `min_similarity` + diversity windowing (`<= 3` per candidate) in an outer CTE or Python over the bounded candidate set (or iterative scan in pgvector 0.8+).
- **Expected Improvement**: Converts vector retrieval from $O(N_{\text{pool}})$ scan to $O(\log N)$ HNSW lookup (`<10 ms` DB time at 100k+ chunks), lifting DB-isolated `/search` from `33 RPS` to `150+ RPS` at scale.

### Rank 4 (High): `DEBUG=True` (`echo=True`) Synchronous SQL Stdout Logging
- **Evidence**: Direct A/B benchmark at 60 VUs on `GET /api/v1/pools/`: `DEBUG=True` (`02b`) delivered **285.48 RPS (`p50 = 160 ms`)** vs `DEBUG=False` (`02c`) **401.82 RPS (`p50 = 92 ms`)**—a **29% throughput loss** and **74% p50 latency tax**. In `01_baseline_mixed`, `echo=True` emitted `7,785` log lines (including truncated 768-d vectors and JSONB payloads) in 45 seconds.
- **Root Cause**: [`database.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/core/database.py#L24) sets `echo=settings.DEBUG`, and `backend/.env` defaults to `DEBUG=True`.
- **Recommended Fix**: Decouple SQL echoing into `SQL_ECHO: bool = False`, set `DEBUG=False` in staging/production `.env`, and disable `pool_pre_ping=True` in favor of `pool_recycle=1800` when running against high-RTT remote DBs (saves 1 RTT/checkout).
- **Expected Improvement**: Instant **+35–41% throughput** on DB-bound read endpoints and reduced event-loop/GIL jitter.

### Rank 5 (High): Global `Semaphore(8)` Contention, Unbatched Embedding Calls, Missing Timeouts & Double Retries
- **Evidence**:
  - `02h_search_15vu` -> `02i_search_35vu`: Throughput hit a ceiling and slipped (`27.09 -> 24.86 RPS`) while `p50` more than doubled (`520 -> 1,300 ms`) queuing behind `Semaphore(8)`.
  - `02j_upload_health_12vu`: Uploading 4-chunk PDFs hit `p50 = 1,600 ms` at just `7.36 RPS` due to per-chunk HTTP calls through `Semaphore(8)`.
  - Running `tests/unit/test_embeddings.py` offline triggered >10s stalls on `ConnectError` because `@retry(stop_after_attempt(4))` in [`embeddings.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/embeddings.py#L40-L57) wraps `google-genai`'s own internal `_async_retry`, multiplying retry delays with **no `HttpOptions(timeout=...)`**.
- **Root Cause**: [`embed_texts_batch`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/embeddings.py#L66-L77) dispatches N separate `embed_single` HTTP requests behind one process-wide `Semaphore(8)` shared by uploads, search, and synthesis; no query embedding cache exists; [`rag_engine.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/services/rag_engine.py#L232-L301) can chain up to 12 LLM attempts x 25 s timeout.
- **Recommended Fix**: Pass batch `contents=chunk_texts` to `embed_content`; isolate query embedding concurrency from background batch uploads; add a bounded TTL/LRU cache for query vectors; configure `HttpOptions(timeout=8_000, retry_options=HttpRetryOptions(attempts=1))` on `embedding_service.client` and restrict `tenacity` retries strictly to transient `429`/`503`/timeout exceptions.
- **Expected Improvement**: Cuts upload embedding latency ~4x (`1,600 -> ~350 ms` under concurrency), stops uploads from starving `/search`, and drops cached search latency from `~270 ms` to `<15 ms`.

### Rank 6 (Medium-High): Synchronous PyMuPDF / Disk I/O Blocking the Event Loop & Unenforced Upload Limit
- **Evidence**: Micro-benchmark measured `51.32 ms` synchronous event-loop block per `dense_15p_resume.pdf` (`47.03 ms` PyMuPDF + `4.29 ms` chunker). During `02j2_upload_dense_health_8vu`, `/health` probe p95 jumped **6.7x (`3 -> 20 ms`, `p99 = 56 ms`, `max = 185.18 ms`)** at only 8 VUs.
- **Root Cause**: [`upload_resumes`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/api/v1/endpoints/resumes.py#L71-L123) runs `open(..., "wb").write()`, PyMuPDF extraction, `chunk_document()`, and `merge_adjacent_bboxes()` inline on the event loop; `MAX_UPLOAD_SIZE_MB` (`25 MB`) is never enforced before `await file.read()`, and `aiofiles` (in `requirements.txt`) is unused.
- **Recommended Fix**: Offload PyMuPDF + chunking to `asyncio.to_thread` or a `ProcessPoolExecutor`; stream multipart chunks with a hard `MAX_UPLOAD_SIZE_MB` guard; use `aiofiles`; persist batch uploads via a single transaction or async background job (`202 Accepted` + status polling).
- **Expected Improvement**: Restores `/health` and SSE frame delivery to `<5 ms` p99 during concurrent heavy PDF ingestion and bounds RAM usage under large uploads.

### Rank 7 (Low-Medium): Missing `evaluation_citations` Migration Indexes & Single-Worker GIL Ceiling
- **Evidence**: `\di` on PostgreSQL confirmed `ix_evaluation_citations_candidate_id` and `ix_evaluation_citations_chunk_id` are missing in [`0001_initial_schema.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/alembic/versions/0001_initial_schema.py#L186-L224) despite `index=True` in [`evaluation.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/models/evaluation.py#L76-L87). Single-worker Uvicorn ([`Procfile`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/Procfile)) pegged 1 logical CPU core at `90–102.8%` across tests `02b`–`02e`, `02g`, `04`, and `05`.
- **Recommended Fix**: Add Alembic migration for the two missing FK indexes; after fixing Rank 1 (connection pinning), deploy 2–4 Uvicorn workers with right-sized `DB_POOL_SIZE` (e.g., `pool_size=5, max_overflow=5` per worker -> max 20–40 total DB connections, compatible with Supabase transaction pooler port `6543` + `statement_cache_size=0`).
- **Expected Improvement**: Prevents sequential scans on `evaluation_citations` during candidate/pool deletes and scales Python JSON/ORM throughput ~2–4x linearly across CPU cores.

---

## 6. Artifacts Index
- Predictions (locked pre-test): [`PREDICTIONS.md`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/PREDICTIONS.md)
- Test Suite & Staging Harness:
  - [`load_tests/locustfile.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/locustfile.py)
  - [`load_tests/run_suite.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/run_suite.py)
  - [`load_tests/staging_server.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/staging_server.py)
  - [`load_tests/mock_gemini.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/mock_gemini.py)
  - [`load_tests/seed_staging_db.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/seed_staging_db.py)
  - [`load_tests/generate_fixtures.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/generate_fixtures.py)
- Raw Results & Profiler Outputs (`load_tests/results/`):
  - Summary reports: `*_report.json`, `summary_*.json`, `*_stats.csv`, `*_stats_history.csv`, `*_sys_metrics.jsonl`, `*_sa_metrics.summary.json`
  - Query plans: [`load_tests/results/db_explain_plans.txt`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/results/db_explain_plans.txt)
  - CPU/Allocation Profiles: [`load_tests/results/05_profile_mixed_20vu.txt`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/results/05_profile_mixed_20vu.txt), [`load_tests/results/05b_profile_candidates_large.txt`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/load_tests/results/05b_profile_candidates_large.txt)
