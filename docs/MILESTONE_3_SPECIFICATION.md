# Milestone 3 Specification: Gemini Embeddings & Vector Search API

**Document Version:** 1.0.0  
**Status:** Approved Architectural Specification  
**Companion Phase:** Days 5–6 of 7–14 Day Rapid Development Lifecycle  
**Primary Modules:** `FEAT-EMBED` (Embeddings) & `FEAT-SEARCH` (Retrieval Engine)  
**File Path:** `docs/MILESTONE_3_SPECIFICATION.md`

---

## 1. Executive Summary

Milestone 3 constructs the mathematical and retrieval core of the **Multi-Candidate Semantic Talent Engine**. 

While Milestones 1 and 2 established the database persistence layer and the coordinate-aware PDF chunker, Milestone 3 transforms extracted text chunks into high-dimensional geometric coordinates using Google Gemini's `gemini-embedding-2` model, indexes them in PostgreSQL using `pgvector` HNSW graph indexing, and exposes high-performance REST APIs for recruiters to query candidate pools using plain English.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Milestone 3 Data Pipeline                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [Candidate PDF] ──▶ [SlidingWindowChunker] ──▶ [400-token Text Chunks]               │
│                                                              │                         │
│                                                              ▼                         │
│                                              [GeminiEmbeddingService]                  │
│                                              • Model: gemini-embedding-2               │
│                                              • Matryoshka Dimension: 768               │
│                                              • Batch Size: 32 chunks / call            │
│                                                              │                         │
│                                                              ▼                         │
│   [Recruiter Natural Query]                        [768-dim Vector Arrays]             │
│   "Distributed systems engineer with Kafka"                  │                         │
│              │                                               ▼                         │
│              ▼                                   [Supabase PostgreSQL]                 │
│   [Query Vectorizer (768-dim)]               INSERT INTO resume_chunks (embedding)     │
│              │                                               │                         │
│              └───────────────┐                               │                         │
│                              ▼                               ▼                         │
│                [pgvector HNSW Cosine Search] (Operator: <=>)                           │
│                • Sub-15ms Approximate Nearest Neighbor (ANN)                           │
│                • Candidate Diversity Filter (Max 3 chunks / candidate)                 │
│                              │                                                         │
│                              ▼                                                         │
│                [Ranked Candidate Matches with PDF Bounding Box Coordinates]            │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Theoretical Foundations (What the Systems Architect Must Understand)

### 2.1 Dense Vector Spaces vs. Sparse Keyword Inverted Indexes

Traditional Applicant Tracking Systems (ATS) rely on **sparse keyword matching** (e.g. BM25, Elasticsearch, or SQL `ILIKE '%Kafka%'`). Sparse search fails in two critical directions:
1. **Vocabulary Mismatch (False Negatives):** A candidate writes: *"Orchestrated high-throughput event streams using publish-subscribe pipelines."* A keyword search for *"Kafka"* or *"Distributed Messaging"* returns zero matches, unfairly dropping an elite engineer.
2. **Keyword Stuffing (False Positives):** A candidate lists 50 buzzwords in a footer. A keyword filter ranks them at the top despite zero verifiable context.

**Dense Vector Embeddings** solve this by mapping natural language concepts into a continuous 768-dimensional geometric manifold $\mathbb{R}^{768}$. Words and phrases with similar semantic meanings are placed close together in vector space:

$$\text{Distance}\left(\vec{v}_{\text{"Kafka event stream"}}, \vec{v}_{\text{"distributed pub-sub pipeline"}}\right) \approx 0$$

### 2.2 Matryoshka Representation Learning (MRL)

`gemini-embedding-2` was trained using **Matryoshka Representation Learning (MRL)** (named after Russian nesting dolls). 

In traditional embedding models, vector dimensions are fixed (e.g. 1536 or 3072). With MRL, the most critical semantic information is packed into the **early dimensions** of the vector:
- **Full Dimension (3072):** Maximum nuance, but high memory and storage footprint.
- **Truncated Dimension (768):** Compresses storage by 75% while retaining $> 98\%$ of retrieval recall.

By setting `output_dimensionality: 768`, Google GenAI truncates and L2-normalizes the vectors before returning them to our backend, matching our Supabase `VECTOR(768)` HNSW index with zero manual slicing.

### 2.3 Vector Distance Operators in pgvector

`pgvector` supports three primary distance operators:

| Operator | Math Formulation | Distance Name | When to Use |
| :---: | :---: | :---: | :--- |
| `<=>` | $1 - \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$ | **Cosine Distance** | **Optimal for text embeddings** (measures angular semantic orientation regardless of document length). |
| `<#>` | $-(\mathbf{u} \cdot \mathbf{v})$ | Negative Inner Product | Used when vectors are pre-normalized to unit length ($\|\mathbf{u}\| = 1$). |
| `<->` | $\sqrt{\sum (u_i - v_i)^2}$ | Euclidean / L2 Distance | Measures absolute geometric distance (sensitive to magnitude). |

For our recruitment engine, we use the **Cosine Distance Operator (`<=>`)**.  
Similarity score is computed as:
$$\text{Similarity}(\mathbf{u}, \mathbf{v}) = 1 - (\mathbf{u} \Leftrightarrow \mathbf{v}) \in [0.0, 1.0]$$

### 2.4 Hierarchical Navigable Small World (HNSW) Graphs

A naive vector search compares the query vector against every single chunk in the database (Exact Nearest Neighbor / Flat Scan), running in linear time $O(N)$. At 100,000 chunks, queries take 500ms–2000ms.

**HNSW** constructs a multi-layer graph where:
- The top layers have sparse, long-range links (like an express highway) for rapid navigation across the semantic space.
- The bottom layers have dense, local clusters for pinpoint nearest-neighbor search.

```
Layer 2 (Express):    [•] -------------------------> [•]
                       |                              |
Layer 1 (Regional):   [•] -------------> [•] ------> [•] ------> [•]
                       |                  |           |          |
Layer 0 (Local/All):  [•]-[•]-[•]-[•]-[•]-[•]-[•]-[•]-[•]-[•]-[•]-[•]
```

- **Query Complexity:** Sub-linear $O(\log N)$, executing nearest-neighbor search over 100,000 chunks in $< 15$ ms.
- **Parameters:**
  - `m = 16`: Number of bidirectional links established per node (balances index size and graph connectivity).
  - `ef_construction = 64`: Size of the dynamic candidate list evaluated during index build (higher = higher recall accuracy).
  - `ef_search = 40`: Size of the dynamic candidate list evaluated during query execution.

---

## 3. The Candidate Diversity Problem & The Top-3 Cap

### The Problem: Single-Candidate Monopolization
In a candidate pool, one candidate may have a comprehensive 5-page resume with extensive experience in the searched topic (e.g. Kubernetes), resulting in 12 relevant chunks. Other candidates might have 2 or 3 highly relevant chunks.

If the search engine naively takes the global `LIMIT 15`, Candidate A would consume 12 of the 15 slots, effectively hiding Candidates B, C, and D from the recruiter.

### The Solution: Candidate Diversity Windowing
We enforce a **Candidate Diversity Balancing Rule**:
1. Retrieve candidate chunks ordered by cosine similarity distance.
2. Group chunks by `candidate_id`.
3. Cap each individual candidate at a maximum of **3 chunks** (`MAX_CHUNKS_PER_CANDIDATE = 3`).
4. Rank candidates by their single highest-scoring chunk, while providing up to 3 distinct evidence passages per candidate.

This ensures multi-candidate comparative fairness: recruiters see the best 5–10 candidates side-by-side, each backed by their top 3 strongest accomplishments.

---

## 4. Component Architecture & File Inventory

```
backend/
├── app/
│   ├── schemas/
│   │   ├── pool.py              # Talent pool request & response DTOs
│   │   ├── resume.py            # Resume upload & ingestion status DTOs
│   │   └── search.py            # Semantic query & candidate ranking DTOs
│   ├── services/
│   │   ├── embeddings.py        # Gemini client with batching & backoff
│   │   └── vector_store.py      # pgvector HNSW query repository & diversity ranker
│   ├── api/
│   │   └── v1/
│   │       ├── api.py           # Master v1 router aggregating all endpoints
│   │       └── endpoints/
│   │           ├── pools.py     # Talent pool CRUD endpoints
│   │           ├── resumes.py   # Batch PDF upload & processing endpoint
│   │           └── search.py    # Natural language semantic query endpoint
│   └── main.py                  # FastAPI application entrypoint with CORS & lifespan
└── tests/
    ├── unit/
    │   └── test_embeddings.py   # Unit tests for batching & retry logic
    └── integration/
        └── test_vector_search.py# Integration tests for live pgvector cosine search
```

---

## 5. Detailed Component Specifications

### 5.1 `app/services/embeddings.py` (`GeminiEmbeddingService`)
- **SDK:** `google-genai` (v3.0).
- **Target Model:** `settings.EMBEDDING_MODEL` (`gemini-embedding-2`).
- **Configuration:** `{"output_dimensionality": 768}`.
- **Batching Engine:**
  - Method: `embed_texts_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]`
  - Chunks larger candidate batches into slices of $\le 32$ strings per API call.
- **Resilience & Retry:**
  - Employs exponential backoff with jitter on HTTP 429 (Resource Exhausted) and HTTP 503 (Unavailable).
  - Initial delay: 1.0s, backoff multiplier: 2.0x, maximum attempts: 4.

### 5.2 `app/services/vector_store.py` (`VectorStoreService`)
- **Database Access:** Async SQLAlchemy 2.0 using `asyncpg`.
- **Primary Methods:**
  1. `save_resume_chunks(session, chunks: list[ChunkResult], embeddings: list[list[float]], resume_id: UUID, candidate_id: UUID)`:
     Performs batch bulk insert into `resume_chunks`.
  2. `semantic_search(session, pool_id: UUID, query_vector: list[float], top_k: int = 15, max_per_candidate: int = 3)`:
     Executes the optimized cosine distance query with diversity capping.

#### The Core SQL Query:
```sql
WITH ranked_chunks AS (
    SELECT 
        rc.id AS chunk_id,
        rc.candidate_id,
        rc.resume_id,
        rc.chunk_index,
        rc.page_number,
        rc.text_content,
        rc.bounding_boxes,
        1 - (rc.embedding <=> :query_vector) AS similarity_score,
        ROW_NUMBER() OVER (
            PARTITION BY rc.candidate_id 
            ORDER BY rc.embedding <=> :query_vector ASC
        ) AS candidate_rank
    FROM resume_chunks rc
    JOIN candidates c ON rc.candidate_id = c.id
    WHERE c.pool_id = :pool_id
      AND 1 - (rc.embedding <=> :query_vector) >= :min_similarity
)
SELECT * 
FROM ranked_chunks
WHERE candidate_rank <= :max_per_candidate
ORDER BY similarity_score DESC
LIMIT :top_k;
```

### 5.3 `app/schemas/` (Data Transfer Objects)
- **`schemas/pool.py`**:
  - `TalentPoolCreate`: `title: str`, `description: str | None`
  - `TalentPoolResponse`: `id: UUID`, `title: str`, `description: str | None`, `candidate_count: int`, `created_at: datetime`
- **`schemas/resume.py`**:
  - `ResumeUploadResponse`: `candidate_id: UUID`, `candidate_name: str`, `resume_id: UUID`, `filename: str`, `chunks_created: int`, `is_scanned: bool`
- **`schemas/search.py`**:
  - `SearchQueryRequest`: `query: str`, `top_k: int = 15`, `min_similarity: float = 0.35`
  - `SearchChunkResult`: `chunk_id: UUID`, `chunk_index: int`, `page_number: int`, `text_content: str`, `similarity_score: float`, `bounding_boxes: list[dict]`
  - `CandidateSearchResult`: `candidate_id: UUID`, `full_name: str`, `headline: str | None`, `top_similarity: float`, `matching_chunks: list[SearchChunkResult]`
  - `SearchResponse`: `pool_id: UUID`, `query: str`, `total_candidates: int`, `matches: list[CandidateSearchResult]`

### 5.4 `app/api/v1/endpoints/` (FastAPI REST Routes)
1. **Talent Pools:**
   - `POST /api/v1/pools`: Create new pool.
   - `GET /api/v1/pools`: List all pools with candidate counts.
   - `GET /api/v1/pools/{id}`: Get pool details and registered candidates.
2. **Batch Resume Upload:**
   - `POST /api/v1/pools/{id}/resumes/upload`:
     Accepts `files: list[UploadFile]`.
     For each file:
     - Extracts candidate name from filename / header.
     - Runs `DocumentIngestionService` $\rightarrow$ parses text and bounding boxes.
     - Runs `SlidingWindowChunker` $\rightarrow$ creates 400-token chunks.
     - Runs `GeminiEmbeddingService` $\rightarrow$ batches text into 768-dim embeddings.
     - Persists `Candidate`, `Resume`, and `ResumeChunk`s in a single database transaction.
3. **Semantic Query Search:**
   - `POST /api/v1/pools/{id}/search`:
     Vectorizes `query` string using `gemini-embedding-2`.
     Executes vector similarity search on Supabase with diversity filter.
     Returns ranked candidate profiles with citation highlights.

---

## 6. Verification and Testing Gates

| Gate ID | Target Component | Success Criteria | Verification Command |
| :---: | :--- | :--- | :--- |
| **G-01** | Embedding Batcher | Batches 64 texts into 2 API calls of 32; returns 768-dim floats. | `pytest backend/tests/unit/test_embeddings.py` |
| **G-02** | Vector Cosine Search | Cosine query returns within $< 15$ ms; groups by candidate. | `pytest backend/tests/integration/test_vector_search.py` |
| **G-03** | Diversity Cap | No single candidate has $> 3$ chunks in search results. | Integration test assertion on candidate chunk counts. |
| **G-04** | End-to-End Ingestion | Uploading sample PDF produces Candidate, Resume, and Chunks with valid embeddings. | Live upload test via FastAPI `TestClient`. |
| **G-05** | Static Linting | Zero errors in `ruff check backend`. | `ruff check backend` |

---

## 7. Deliverables & Next Steps

Upon approval of this specification:
1. Implement Pydantic DTOs in `app/schemas/`.
2. Implement `GeminiEmbeddingService` in `app/services/embeddings.py`.
3. Implement `VectorStoreService` in `app/services/vector_store.py`.
4. Implement API routes in `app/api/v1/endpoints/` and mount them in `app/main.py`.
5. Execute unit and integration test gates.
