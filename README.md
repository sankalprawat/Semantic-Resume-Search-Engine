# Multi-Candidate Semantic Talent Engine

> An enterprise-grade Retrieval-Augmented Generation (RAG) recruitment intelligence system replacing keyword-based ATS filtering with high-dimensional vector search (`text-embedding-004`, `pgvector` HNSW) and verifiable comparative candidate evaluations (`gemini-2.5-flash`).

---

## 📖 Master Documentation
- [**`PROJECT_BLUEPRINT.md`**](./PROJECT_BLUEPRINT.md): 28-section comprehensive technical architecture specification.
- [**`DEVELOPMENT_CYCLE_GUIDE.md`**](./DEVELOPMENT_CYCLE_GUIDE.md): 7–14 day sprint schedule, daily curriculum, and cloud deployment guide.
- [**`WORKING_AGREEMENT.md`**](./WORKING_AGREEMENT.md): Team engineering agreement, zero blind code protocol, and architectural checkpoints.

---

## 🏛️ Monorepo Structure

```
multi-candidate-semantic-talent-engine/
├── backend/                  # FastAPI Python 3.11+ backend service
│   ├── app/
│   │   ├── api/              # Versioned API routes (v1 endpoints)
│   │   ├── core/             # Settings, DB session, exception handlers
│   │   ├── models/           # SQLAlchemy 2.0 async models
│   │   ├── schemas/          # Pydantic v2 validation DTOs
│   │   ├── services/         # Ingestion, chunking, embeddings, RAG
│   │   └── utils/            # Logging and coordinate math
│   ├── alembic/              # Database migration scripts
│   ├── tests/                # Unit, integration, and evaluation suites
│   ├── requirements.txt      # Production backend dependencies
│   └── .env.example          # Environment variable template
├── frontend/                 # Next.js 14+ App Router recruiter console
├── docker/                   # Local container orchestration (pgvector)
├── docs/                     # Additional architectural diagrams & API specs
└── .gitignore                # Root git ignore rules
```

---

## 🚀 Quickstart: Backend Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ / 20+
- PostgreSQL 16 with `pgvector` extension (Local Docker container, Supabase, or Neon)
- Google Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### 2. Configure Environment
```bash
cd backend
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY and DATABASE_URL
```

### 3. Create Python Virtual Environment & Install Dependencies
```bash
cd backend
python -m venv .venv

# Activate virtual environment:
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux / macOS:
source .venv/bin/activate

pip install -r requirements-dev.txt
```

---

## 🛡️ Engineering Principles
1. **Zero Blind Code:** Every component and design decision is explained with its technical rationale.
2. **Deterministic Citations:** Every AI evaluation statement must be grounded with verifiable chunk references: `[Candidate: Name | Chunk: CX]`.
3. **Unified Relational & Vector Persistence:** Powered by PostgreSQL + `pgvector` to eliminate dual-write drift and reduce operational complexity.
