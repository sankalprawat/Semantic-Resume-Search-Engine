"""Locust load test suite targeting all risky endpoints & workflows.

Scenario selection via LOAD_SCENARIO env var:
- baseline: Realistic mixed recruiter workload (reads, search, upload, SSE evaluation)
- read_health: GET /api/v1/health throughput ceiling
- read_pools: GET /api/v1/pools throughput & echo overhead
- read_candidates_small: GET /api/v1/pools/{small_pool_id}/candidates
- read_candidates_large: GET /api/v1/pools/{large_pool_id}/candidates (100 candidates)
- read_file: GET /api/v1/resumes/{candidate_id}/file
- read_evaluations: GET /api/v1/pools/{small_pool_id}/evaluations
- search: POST /api/v1/pools/{pool_id}/search
- upload_plus_health: Concurrent POST /upload alongside 10Hz GET /health event-loop probes
- eval_stream_cascade: Concurrent POST /evaluate/stream SSE + GET /pools health/read probes
- spike: Automated spike shape (5 -> 45 -> 5 VUs) across mixed + SSE workload
- soak: Sustained mixed workload
"""

import json
import os
import random
import time
from pathlib import Path

import requests
from locust import HttpUser, LoadTestShape, between, events, task

SCENARIO = os.environ.get("LOAD_SCENARIO", "baseline")
SMALL_POOL_ID = os.environ.get("SMALL_POOL_ID", "")
LARGE_POOL_ID = os.environ.get("LARGE_POOL_ID", "")
SEARCH_POOL_ID = os.environ.get("SEARCH_POOL_ID", SMALL_POOL_ID)
UPLOAD_POOL_ID = os.environ.get("UPLOAD_POOL_ID", SMALL_POOL_ID)
CANDIDATE_ID = os.environ.get("CANDIDATE_ID", "")

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
PDF_FIXTURES: list[tuple[str, bytes]] = []
DENSE_PDF: tuple[str, bytes] | None = None


@events.init.add_listener
def on_locust_init(environment, **kwargs):
    global DENSE_PDF
    if FIXTURES_DIR.exists():
        for p in sorted(FIXTURES_DIR.glob("sample_resume_*.pdf")):
            PDF_FIXTURES.append((p.name, p.read_bytes()))
        dense = FIXTURES_DIR / "dense_15p_resume.pdf"
        if dense.exists():
            DENSE_PDF = (dense.name, dense.read_bytes())


QUERIES = [
    "Apache Kafka Flink Go Rust distributed streaming pipelines events",
    "CockroachDB Raft RocksDB MVCC distributed storage transaction isolation",
    "Kubernetes Envoy Terraform eBPF Prometheus SRE high availability QPS",
    "Distributed systems architecture Kafka PostgreSQL Kubernetes Go Rust",
]


def _consume_sse_stream(user: HttpUser, pool_id: str, name_prefix: str = "/evaluate/stream") -> None:
    payload = {
        "query": random.choice(QUERIES),
        "top_k": 12,
        "min_similarity": 0.15,
        "temperature": 0.20,
    }
    url = f"{user.host}/api/v1/pools/{pool_id}/evaluate/stream"
    req_name = f"POST /api/v1/pools/[pool]{name_prefix}"
    t0 = time.perf_counter()
    done_ok = False
    err_msg = None
    resp_len = 0

    try:
        with user.sse_session.post(
            url,
            json=payload,
            stream=True,
            timeout=60,
        ) as resp:
            if resp.status_code != 200:
                err_msg = f"HTTP {resp.status_code}: {resp.text[:200]}"
            else:
                for raw_line in resp.iter_lines(decode_unicode=True):
                    if not raw_line:
                        continue
                    resp_len += len(raw_line)
                    if raw_line.startswith("data: "):
                        ev = json.loads(raw_line[6:])
                        ev_type = ev.get("type")
                        if ev_type == "done":
                            done_ok = True
                            break
                        elif ev_type == "error":
                            err_msg = ev.get("message", "SSE error event")
                            break
                if not done_ok and not err_msg:
                    err_msg = "SSE stream ended without done event"
    except Exception as exc:
        err_msg = f"Stream exception: {exc}"

    total_ms = (time.perf_counter() - t0) * 1000.0
    user.environment.events.request.fire(
        request_type="POST",
        name=req_name,
        response_time=total_ms,
        response_length=resp_len,
        exception=None if done_ok else RuntimeError(err_msg or "SSE failure"),
    )


def _upload_sample_pdf(user: HttpUser, pool_id: str, use_dense: bool = False) -> None:
    if use_dense and DENSE_PDF:
        fname, content = DENSE_PDF
    elif PDF_FIXTURES:
        fname, content = random.choice(PDF_FIXTURES)
    else:
        return
    unique_name = f"load_{int(time.time() * 1000)}_{random.randint(1000, 9999)}_{fname}"
    with user.client.post(
        f"/api/v1/resumes/{pool_id}/upload",
        files=[("files", (unique_name, content, "application/pdf"))],
        name="POST /api/v1/resumes/[pool]/upload",
        catch_response=True,
        timeout=60,
    ) as resp:
        if resp.status_code != 200:
            resp.failure(f"HTTP {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            if data.get("total_uploaded", 0) < 1:
                resp.failure("total_uploaded < 1")


class RecruiterUser(HttpUser):
    wait_time = between(0.2, 0.8) if SCENARIO in ("baseline", "soak", "spike") else between(0.0, 0.05)

    def on_start(self):
        self.sse_session = requests.Session()

    def on_stop(self):
        self.sse_session.close()

    @task
    def execute_scenario(self):
        if SCENARIO == "read_health":
            self.client.get("/api/v1/health", name="GET /api/v1/health")

        elif SCENARIO == "read_pools":
            self.client.get("/api/v1/pools/", name="GET /api/v1/pools/")

        elif SCENARIO == "read_candidates_small":
            self.client.get(
                f"/api/v1/pools/{SMALL_POOL_ID}/candidates",
                name="GET /api/v1/pools/[small]/candidates",
            )

        elif SCENARIO == "read_candidates_large":
            self.client.get(
                f"/api/v1/pools/{LARGE_POOL_ID}/candidates",
                name="GET /api/v1/pools/[large]/candidates",
            )

        elif SCENARIO == "read_file":
            self.client.get(
                f"/api/v1/resumes/{CANDIDATE_ID}/file",
                name="GET /api/v1/resumes/[id]/file",
            )

        elif SCENARIO == "read_evaluations":
            self.client.get(
                f"/api/v1/pools/{SMALL_POOL_ID}/evaluations",
                name="GET /api/v1/pools/[pool]/evaluations",
            )

        elif SCENARIO == "search":
            self.client.post(
                f"/api/v1/pools/{SEARCH_POOL_ID}/search",
                json={"query": random.choice(QUERIES), "top_k": 15, "min_similarity": 0.20},
                name="POST /api/v1/pools/[pool]/search",
                timeout=60,
            )

        elif SCENARIO == "upload_only":
            _upload_sample_pdf(self, UPLOAD_POOL_ID)

        elif SCENARIO == "upload_plus_health":
            # 70% uploads, 30% health probes to detect event-loop stalls
            if random.random() < 0.7:
                _upload_sample_pdf(self, UPLOAD_POOL_ID)
            else:
                self.client.get("/api/v1/health", name="GET /api/v1/health [probe]")

        elif SCENARIO == "upload_dense_plus_health":
            if random.random() < 0.5:
                _upload_sample_pdf(self, UPLOAD_POOL_ID, use_dense=True)
            else:
                self.client.get("/api/v1/health", name="GET /api/v1/health [dense-probe]")

        elif SCENARIO == "eval_stream_cascade":
            # 85% heavy SSE evaluations, 15% lightweight DB reads to observe cross-endpoint starvation
            if random.random() < 0.85:
                _consume_sse_stream(self, SMALL_POOL_ID)
            else:
                self.client.get("/api/v1/pools/", name="GET /api/v1/pools/ [probe]", timeout=45)

        else:
            # baseline / soak / spike mixed recruiter workflow
            r = random.random()
            if r < 0.25:
                self.client.get("/api/v1/pools/", name="GET /api/v1/pools/", timeout=45)
            elif r < 0.45:
                self.client.get(
                    f"/api/v1/pools/{SMALL_POOL_ID}/candidates",
                    name="GET /api/v1/pools/[small]/candidates",
                    timeout=45,
                )
            elif r < 0.58:
                self.client.get(
                    f"/api/v1/resumes/{CANDIDATE_ID}/file",
                    name="GET /api/v1/resumes/[id]/file",
                    timeout=45,
                )
            elif r < 0.72:
                self.client.post(
                    f"/api/v1/pools/{SMALL_POOL_ID}/search",
                    json={"query": random.choice(QUERIES), "top_k": 15, "min_similarity": 0.20},
                    name="POST /api/v1/pools/[pool]/search",
                    timeout=45,
                )
            elif r < 0.80:
                self.client.get(
                    f"/api/v1/pools/{SMALL_POOL_ID}/evaluations",
                    name="GET /api/v1/pools/[pool]/evaluations",
                    timeout=45,
                )
            elif r < 0.95:
                _consume_sse_stream(self, SMALL_POOL_ID)
            else:
                _upload_sample_pdf(self, UPLOAD_POOL_ID)


if SCENARIO == "spike":

    class SpikeShape(LoadTestShape):
        """Baseline 5 VUs (25s) -> Sudden Spike 45 VUs (45s) -> Recovery 5 VUs (35s)."""

        stages = [
            {"duration": 25, "users": 5, "spawn_rate": 5},
            {"duration": 70, "users": 45, "spawn_rate": 40},
            {"duration": 105, "users": 5, "spawn_rate": 40},
        ]

        def tick(self):
            run_time = self.get_run_time()
            for stage in self.stages:
                if run_time < stage["duration"]:
                    return (stage["users"], stage["spawn_rate"])
            return None
