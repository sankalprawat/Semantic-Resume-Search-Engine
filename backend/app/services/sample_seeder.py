import logging
import pymupdf
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.pool import TalentPoolResponse
from app.services.chunking import chunker
from app.services.embeddings import embedding_service
from app.services.ingestion import ingestion_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

SAMPLE_POOL_TITLE = "Distributed Systems Infrastructure (Sample)"
SAMPLE_POOL_DESC = "Pre-indexed sample candidates for comparative technical evaluation across streaming, distributed databases, and high-availability platform reliability."

SAMPLE_CANDIDATES = [
    {
        "name": "Alice Vance",
        "filename": "alice_vance_resume.pdf",
        "text": """Alice Vance
Staff Distributed Systems & Event Streaming Architect
Email: alice.vance@infrastructure.io | Location: San Francisco, CA | GitHub: github.com/alicevance

Professional Summary:
Principal systems and platform architect with 9+ years experience designing ultra-high-throughput streaming pipelines, distributed message brokers, and low-latency event-driven architectures.

Work Experience:
Staff Systems Architect | Apex Cloud Systems (2021 - Present)
- Architected enterprise Apache Kafka streaming backbone handling 850,000 events/sec with sub-5ms P99 latency across 3 geo-replicated AWS regions.
- Implemented real-time stateful stream processing with Apache Flink, reducing analytical pipeline lag from 20 minutes to sub-second.
- Designed automated consumer group rebalancing controllers in Go, completely eliminating consumer partition rebalance storms during rolling cluster restarts.
- Engineered multi-cluster disaster recovery with MirrorMaker 2, achieving zero data loss (RPO=0) and recovery time (RTO) under 30 seconds.

Senior Backend Infrastructure Engineer | DataScale Corp (2018 - 2021)
- Built distributed telemetry ingestion pipeline in Go and Apache Pulsar, ingesting 4TB daily audit logs with Snappy compression.
- Tuned Linux kernel page cache, network sockets, and JVM GC parameters for sustained 10Gbps disk I/O throughput.
- Led Sev-1 streaming incident response and instituted blameless post-mortem culture, cutting mean time to recovery (MTTR) by 65%.

Education & Skills:
- B.S. in Computer Science, University of California, Berkeley (2018)
- Core Expertise: Apache Kafka, Apache Flink, Apache Pulsar, Go, Rust, Distributed Systems, Event-Driven Architecture, High-Throughput I/O
""",
    },
    {
        "name": "Bob Chen",
        "filename": "bob_chen_resume.pdf",
        "text": """Bob Chen
Principal Distributed Storage & Consensus Engineer
Email: bob.chen@distributedstorage.org | Location: Seattle, WA | GitHub: github.com/bobchen-systems

Professional Summary:
Specialist in distributed consensus algorithms, multi-version concurrency control (MVCC), lock-free LSM-tree storage engines, and strict serializable transaction coordination.

Work Experience:
Principal Storage Architect | OmniBase Technologies (2020 - Present)
- Led migration of monolithic PostgreSQL databases to distributed CockroachDB clusters across 5 availability zones with zero scheduled customer downtime.
- Implemented custom Multi-Raft consensus replication engine in Rust, fine-tuning heartbeat intervals and leader election timeouts to survive sudden cross-zone network partitions.
- Optimized lock-free LSM-tree storage layer on top of RocksDB, reducing SST compaction write amplification by 42% and doubling sustained write throughput.
- Designed distributed deadlock detection mechanisms and resolved MVCC transaction contention bottlenecks for high-frequency financial ledgers.

Staff Database Systems Engineer | CloudScale DB (2016 - 2020)
- Engineered distributed transaction coordinator implementing two-phase commit (2PC) and hybrid logical clocks (HLC) across geo-distributed nodes.
- Reduced tail P99 read latencies from 120ms to 8ms by introducing distributed read-only replica routing and leaseholders.
- Managed on-call escalation rotation for 200+ enterprise database clusters with five-nines (99.999%) availability SLA.

Education & Skills:
- M.S. in Computer Science, University of Washington (2016)
- Core Expertise: CockroachDB, Raft, Paxos, RocksDB, Rust, C++, Distributed SQL, MVCC, Jepsen Testing, Transaction Isolation, Geo-Replication
""",
    },
    {
        "name": "Carol Rodriguez",
        "filename": "carol_rodriguez_resume.pdf",
        "text": """Carol Rodriguez
Lead Platform Reliability & High-Throughput SRE
Email: carol.rodriguez@sre-ops.net | Location: New York, NY | GitHub: github.com/carol-sre

Professional Summary:
Platform engineering leader with extensive experience scaling large microservice fleets to 120,000+ QPS, zero-downtime service mesh rollouts, and automated chaos engineering.

Work Experience:
Lead Reliability Engineer | HyperGrid Media (2019 - Present)
- Led platform reliability architecture for microservices serving 120,000+ QPS with 99.99% availability during peak global live broadcast events.
- Designed and deployed Envoy service mesh across 450+ microservices on Kubernetes, configuring adaptive rate limiting, circuit breaking, and mTLS security.
- Spearheaded company-wide chaos engineering program using Chaos Mesh, uncovering 14 latent cascade failure modes before production release.
- Automated canary deployments and progressive traffic shifting with Flagger and Prometheus metrics, cutting deployment rollbacks by 80%.

Senior Infrastructure Engineer | NexaPay Gateway (2015 - 2019)
- Architected resilient global payment gateway with automated cross-cloud failover across GCP and AWS, handling $2B annual gross transaction volume.
- Developed custom eBPF network monitoring agents in C to diagnose TCP socket connection stalls and kernel packet drops in real-time.
- Standardized incident post-mortem culture and SLO/SLI error budgets adopted by 180+ software engineers across the organization.

Education & Skills:
- B.S. in Software Engineering, Georgia Institute of Technology (2015)
- Core Expertise: Kubernetes, Envoy, Go, Python, eBPF, Terraform, Prometheus, Chaos Engineering, High-Availability Systems, Incident Command
""",
    },
]


def _create_sample_pdf_bytes(text: str) -> bytes:
    """Create a formatted single-page PDF in memory using PyMuPDF."""
    with pymupdf.open() as doc:
        page = doc.new_page(width=595, height=842)  # A4 dimensions
        rect = pymupdf.Rect(45, 45, 550, 800)
        page.insert_textbox(rect, text, fontsize=9.5, fontname="helv", lineheight=1.25)
        return doc.tobytes()


async def seed_or_get_sample_pool(session: AsyncSession) -> TalentPoolResponse:
    """
    Idempotently retrieve or generate the 'Distributed Systems Infrastructure (Sample)' pool
    with 3 pre-indexed, fully embedded candidate resumes.
    """
    # 1. Check if the sample pool already exists
    pools = await vector_store.list_pools(session=session)
    for p in pools:
        if p["title"] == SAMPLE_POOL_TITLE and p["candidate_count"] >= 3:
            logger.info(f"Sample pool already exists with id {p['id']}. Returning cached pool.")
            return TalentPoolResponse(**p)

    # 2. Create the new sample pool
    logger.info("Creating fresh sample talent pool...")
    pool = await vector_store.create_pool(
        session=session,
        title=SAMPLE_POOL_TITLE,
        description=SAMPLE_POOL_DESC,
    )

    pool_storage = settings.STORAGE_LOCAL_DIR / str(pool.id)
    pool_storage.mkdir(parents=True, exist_ok=True)

    # 3. Generate, chunk, embed, and store each candidate
    for cand in SAMPLE_CANDIDATES:
        pdf_bytes = _create_sample_pdf_bytes(cand["text"])
        file_path = pool_storage / cand["filename"]
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)

        # PyMuPDF ingestion & extraction
        extracted_doc = ingestion_service.extract_from_bytes(pdf_bytes, filename=cand["filename"])

        # Sliding-window chunking
        chunks = chunker.chunk_document(extracted_doc)

        # Gemini 768-dim embeddings
        chunk_texts = [c.text_content for c in chunks]
        embeddings = await embedding_service.embed_texts_batch(chunk_texts)

        # Vector store persistence
        await vector_store.save_candidate_and_resume(
            session=session,
            pool_id=pool.id,
            candidate_name=cand["name"],
            filename=cand["filename"],
            file_path=file_path.as_posix(),
            file_size_bytes=len(pdf_bytes),
            page_count=extracted_doc.page_count,
            raw_text=extracted_doc.raw_text,
            is_scanned=False,
            chunks=chunks,
            embeddings=embeddings,
        )

    # 4. Return the populated sample pool
    return TalentPoolResponse(
        id=pool.id,
        title=pool.title,
        description=pool.description,
        candidate_count=len(SAMPLE_CANDIDATES),
        created_at=pool.created_at,
        updated_at=pool.updated_at,
    )
