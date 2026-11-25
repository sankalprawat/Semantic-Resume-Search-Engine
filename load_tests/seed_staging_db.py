"""Seeds the isolated local PG18 staging database with:
1. Small sample pool (3 candidates via /api/v1/pools/seed-sample) + 15 evaluations
2. Medium pool (100 candidates x 5 chunks = 500 chunks) for list_candidates stress
3. Scaled vector search pool (1,000 candidates x 5 chunks = 5,000 chunks) for HNSW scan verification
"""

import json
import math
import random
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg2
from psycopg2.extras import execute_values

ROOT_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = ROOT_DIR / "load_tests" / "results"
API_BASE = "http://127.0.0.1:18000/api/v1"
PG_CONN_STR = "host=127.0.0.1 port=55432 user=postgres dbname=talent_engine"

SAMPLE_TEXT = (
    "Senior Distributed Systems Engineer experienced in Apache Kafka, Flink, PostgreSQL, "
    "Kubernetes, Go, Rust, Raft consensus, and high-throughput streaming architectures "
    "handling 500k events per second with sub-5ms P99 latency."
)
BBOX_SAMPLE = [
    {"x0": 0.08, "y0": 0.1 + 0.03 * i, "x1": 0.92, "y1": 0.12 + 0.03 * i}
    for i in range(6)
]


def _rand_unit_vec(seed: int, dim: int = 768) -> str:
    rng = random.Random(seed)
    vals = [rng.gauss(0.0, 1.0) for _ in range(dim)]
    norm = math.sqrt(sum(v * v for v in vals)) or 1.0
    return "[" + ",".join(f"{v / norm:.5f}" for v in vals) + "]"


def _bulk_seed_pool(conn, title: str, description: str, num_candidates: int, chunks_per_cand: int) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT id::text FROM talent_pools WHERE title = %s;", (title,))
        row = cur.fetchone()
        if row:
            pool_id = row[0]
            cur.execute("SELECT COUNT(*) FROM candidates WHERE pool_id = %s::uuid;", (pool_id,))
            if cur.fetchone()[0] >= num_candidates:
                return pool_id
            cur.execute("DELETE FROM talent_pools WHERE id = %s::uuid;", (pool_id,))
        pool_id = str(uuid4())
        cur.execute(
            "INSERT INTO talent_pools (id, title, description) VALUES (%s::uuid, %s, %s);",
            (pool_id, title, description),
        )

        cand_rows = []
        resume_rows = []
        chunk_rows = []
        raw_text_big = (SAMPLE_TEXT + "\n") * 20
        bbox_json = json.dumps(BBOX_SAMPLE)

        for i in range(num_candidates):
            cid = str(uuid4())
            rid = str(uuid4())
            cand_rows.append((cid, pool_id, f"Candidate {i:04d}", f"cand{i}@example.com", "[]"))
            resume_rows.append(
                (rid, cid, f"resume_{i:04d}.pdf", f"storage/resumes/{pool_id}/resume_{i:04d}.pdf", 42000, 2, raw_text_big, False)
            )
            for k in range(chunks_per_cand):
                chunk_rows.append(
                    (
                        str(uuid4()),
                        rid,
                        cid,
                        k,
                        (k // 3) + 1,
                        f"Chunk {k} for Candidate {i}: {SAMPLE_TEXT}",
                        120,
                        bbox_json,
                        _rand_unit_vec(i * 10 + k),
                    )
                )

        execute_values(
            cur,
            "INSERT INTO candidates (id, pool_id, full_name, email, raw_skills) VALUES %s",
            cand_rows,
            template="(%s::uuid, %s::uuid, %s, %s, %s::jsonb)",
        )
        execute_values(
            cur,
            "INSERT INTO resumes (id, candidate_id, filename, file_path, file_size_bytes, page_count, raw_text, is_scanned) VALUES %s",
            resume_rows,
            template="(%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s)",
        )
        execute_values(
            cur,
            "INSERT INTO resume_chunks (id, resume_id, candidate_id, chunk_index, page_number, text_content, token_count, bounding_boxes, embedding) VALUES %s",
            chunk_rows,
            template="(%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s::jsonb, %s::vector)",
            page_size=500,
        )
    conn.commit()
    return pool_id


def _seed_evaluations(conn, pool_id: str, count: int = 20) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM evaluations WHERE pool_id = %s::uuid;", (pool_id,))
        existing = cur.fetchone()[0]
        if existing >= count:
            return
        cur.execute(
            "SELECT rc.candidate_id::text, rc.id::text, rc.page_number, rc.text_content, rc.bounding_boxes "
            "FROM resume_chunks rc JOIN candidates c ON rc.candidate_id = c.id "
            "WHERE c.pool_id = %s::uuid LIMIT 6;",
            (pool_id,),
        )
        chunks = cur.fetchall()
        if not chunks:
            return

        md = ("### Executive Summary\n" + ("Grounded evaluation paragraph [Candidate: Alice Vance | Chunk: C1].\n" * 20))
        cand_ids_json = json.dumps(list({c[0] for c in chunks}))
        for _ in range(count - existing):
            eid = str(uuid4())
            cur.execute(
                "INSERT INTO evaluations (id, pool_id, query_text, synthesis_markdown, candidate_ids) VALUES (%s::uuid, %s::uuid, %s, %s, %s::jsonb);",
                (eid, pool_id, "Compare distributed systems candidates", md, cand_ids_json),
            )
            cit_rows = [
                (str(uuid4()), eid, c[0], c[1], idx + 1, c[3], c[2], json.dumps(c[4]))
                for idx, c in enumerate(chunks)
            ]
            execute_values(
                cur,
                "INSERT INTO evaluation_citations (id, evaluation_id, candidate_id, chunk_id, citation_index, source_text, page_number, bounding_boxes) VALUES %s",
                cit_rows,
                template="(%s::uuid, %s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s::jsonb)",
            )
    conn.commit()


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=30.0) as client:
        r = client.post(f"{API_BASE}/pools/seed-sample")
        r.raise_for_status()
        small_pool = r.json()
        small_pool_id = small_pool["id"]

        c_resp = client.get(f"{API_BASE}/pools/{small_pool_id}/candidates")
        c_resp.raise_for_status()
        cands = c_resp.json()
        candidate_id = cands[0]["id"]

    conn = psycopg2.connect(PG_CONN_STR)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM candidates WHERE pool_id = %s::uuid AND full_name NOT IN ('Alice Vance', 'Bob Chen', 'Carol Rodriguez');",
                (small_pool_id,),
            )
            cur.execute("DELETE FROM evaluations WHERE pool_id = %s::uuid;", (small_pool_id,))
        conn.commit()
        _seed_evaluations(conn, small_pool_id, count=20)
        large_pool_id = _bulk_seed_pool(
            conn,
            "Medium List Load Pool (100 Candidates)",
            "100 candidates x 5 chunks for list_candidates hydration benchmark",
            num_candidates=100,
            chunks_per_cand=5,
        )
        search_pool_id = _bulk_seed_pool(
            conn,
            "Scaled Vector Search Pool (1000 Candidates)",
            "1000 candidates x 5 chunks = 5000 chunks for vector index benchmark",
            num_candidates=1000,
            chunks_per_cand=5,
        )
        conn.commit()
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("VACUUM ANALYZE;")
    finally:
        conn.close()

    ids = {
        "small_pool_id": small_pool_id,
        "large_pool_id": large_pool_id,
        "search_pool_id": search_pool_id,
        "upload_pool_id": None,
        "candidate_id": candidate_id,
    }
    with httpx.Client(timeout=30.0) as client:
        up_resp = client.post(
            f"{API_BASE}/pools/",
            json={"title": "Upload Benchmark Pool", "description": "Dedicated pool for upload stress tests"},
        )
        up_resp.raise_for_status()
        ids["upload_pool_id"] = up_resp.json()["id"]
    out = RESULTS_DIR / "staging_ids.json"
    out.write_text(json.dumps(ids, indent=2), encoding="utf-8")
    print("Seeded staging DB:", json.dumps(ids, indent=2))


if __name__ == "__main__":
    main()
