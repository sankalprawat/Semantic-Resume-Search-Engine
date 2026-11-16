# Milestone 1 In-Depth Explanation: Database Models, pgvector & Migrations

**Milestone Focus:** Environment Baseline, Async SQLAlchemy 2.0 Engine, Supabase PostgreSQL with `pgvector`, and Alembic Versioning  
**Status:** Completed & 100% Verified  
**File Path:** `explanations/MILESTONE_1_EXPLANATION.md`

---

## 1. Why We Did This Milestone First (The Architecture Rationale)

In any Retrieval-Augmented Generation (RAG) system, the **data persistence layer is the anchor contract**. 
If we attempted to write the PDF parser or Gemini API wrappers first, we would have no strongly typed destination for our data. A vector chunk cannot exist in a vacuum:
- A `ResumeChunk` requires a foreign key to a `Resume`.
- A `Resume` requires a foreign key to a `Candidate`.
- A `Candidate` requires a foreign key to a `TalentPool`.

By defining the database schema, foreign keys, and indexes first, every subsequent component (ingestion, embeddings, search, and LLM synthesis) has an exact, validated contract to read from and write to.

---

## 2. Theoretical Foundations Explained

### 2.1 Object-Relational Mapping (ORM) & SQLAlchemy 2.0
An ORM translates between object-oriented Python (classes, instances, attributes) and relational SQL (tables, rows, foreign keys).
We specifically chose **SQLAlchemy 2.0 (Async)** over legacy SQLAlchemy 1.4:
1. **True Async I/O (`asyncpg`):** Legacy SQLAlchemy blocked Python's thread during database operations. In SQLAlchemy 2.0, all queries use `async / await` on top of `asyncpg`, allowing the FastAPI event loop to handle hundreds of concurrent recruiter requests without stalling.
2. **Type Safety (`Mapped[...]` and `mapped_column`):** Uses Python 3.11+ type annotations so IDEs and static linters (`mypy`/`ruff`) catch schema type bugs before runtime.
3. **Cascading Referential Integrity:** All child records use `ondelete="CASCADE"`. Deleting a candidate automatically purges their resume, all vector chunks, and citation links in a single atomic transaction.

### 2.2 Database Version Control with Alembic
Alembic acts as **Git for the database schema**:
- Compares Python model declarations (`Base.metadata`) against the actual tables in PostgreSQL.
- Generates chronological, reproducible migration scripts with `upgrade()` and `downgrade()` steps.
- Tracks migration state in Supabase via an `alembic_version` table.

---

## 3. Authored Files Inventory & Responsibilities

| File Path | Component | Purpose |
| :--- | :--- | :--- |
| [`backend/app/core/config.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/core/config.py) | Pydantic Settings | Reads and validates `.env` variables (`DATABASE_URL`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `COMPLETION_MODEL`). |
| [`backend/app/core/database.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/core/database.py) | Database Engine | Creates the `asyncpg` async connection pool (`create_async_engine`) and FastAPI `get_db()` dependency. |
| [`backend/app/models/pool.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/models/pool.py) | `TalentPool` Model | Workspace grouping candidate profiles and evaluations for a specific job opening. |
| [`backend/app/models/candidate.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/models/candidate.py) | `Candidate` Model | Applicant profile holding candidate identity, contact information, and parsed skills. |
| [`backend/app/models/resume.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/models/resume.py) | `Resume` Model | Document metadata, local file path, page count, raw text, and scanned-PDF flag. |
| [`backend/app/models/chunk.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/models/chunk.py) | `ResumeChunk` Model | Stores 400-token text segments, `JSONB` bounding box coordinates, and `Vector(768)` embedding. |
| [`backend/app/models/evaluation.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/app/models/evaluation.py) | `Evaluation` & Citations | Stores comparative markdown briefs and individual verifiable citation footnotes. |
| [`backend/alembic/versions/0001_initial_schema.py`](file:///c:/Users/sanka/OneDrive/Desktop/Multi-Candidate%20Semantic%20Talent%20Engine/backend/alembic/versions/0001_initial_schema.py) | DDL Migration Script | Applies `CREATE EXTENSION IF NOT EXISTS vector;`, creates all 6 tables, and builds the HNSW index. |

---

## 4. The HNSW Vector Index on Supabase
Inside `resume_chunks`, the 768-dimensional embedding column is indexed using Hierarchical Navigable Small World (HNSW) graphs:
```sql
CREATE INDEX idx_resume_chunks_embedding_hnsw 
ON resume_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```
- **`vector_cosine_ops`:** Optimizes for Cosine Distance (`<=>`), measuring angular similarity between normalized semantic vectors.
- **`m = 16`:** Maintains 16 bidirectional connections per graph node for efficient navigation.
- **`ef_construction = 64`:** Evaluates 64 nearest neighbors during index construction for high recall ($> 98\%$).
