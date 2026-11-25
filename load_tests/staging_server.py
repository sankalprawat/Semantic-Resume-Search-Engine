"""Instrumented local staging server launcher for the unmodified FastAPI app.

Runs the real backend (`app.main:app`) against:
1. Local PostgreSQL 18 + pgvector staging database (never production/Supabase).
2. Local Gemini simulator URL (`--gemini-url`) injected via official HttpOptions.
3. Passive SQLAlchemy PoolEvents & Engine cursor timing hooks.
4. Optional cProfile capture (`--profile-out`) and 1s metrics JSONL (`--metrics-out`).
"""

import argparse
import cProfile
import json
import os
import pstats
import sys
import threading
import time
from collections import defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18000)
    parser.add_argument(
        "--db-url",
        default="postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/talent_engine",
    )
    parser.add_argument("--gemini-url", default="http://127.0.0.1:18001")
    parser.add_argument("--storage-dir", default=str(ROOT_DIR / "load_tests" / "_staging_storage"))
    parser.add_argument("--debug", default="True", choices=["True", "False"])
    parser.add_argument("--metrics-out", default="")
    parser.add_argument("--profile-out", default="")
    parser.add_argument("--stop-file", default="")
    parser.add_argument("--pg-port", type=int, default=55432)
    args = parser.parse_args()

    if "127.0.0.1" not in args.db_url and "localhost" not in args.db_url:
        raise RuntimeError(f"Refusing non-local DATABASE_URL in load tests: {args.db_url}")

    # Inject environment BEFORE importing backend settings/engine
    os.environ["DATABASE_URL"] = args.db_url
    os.environ["STORAGE_LOCAL_DIR"] = args.storage_dir
    os.environ["DEBUG"] = args.debug
    os.environ["ENVIRONMENT"] = "staging-loadtest"
    os.environ["GEMINI_API_KEY"] = "staging-local-key"

    sys.path.insert(0, str(BACKEND_DIR))

    import uvicorn  # noqa: PLC0415
    from google import genai  # noqa: PLC0415
    from google.genai import types  # noqa: PLC0415
    from sqlalchemy import event  # noqa: PLC0415

    from app.core.config import settings  # noqa: PLC0415
    from app.core.database import engine  # noqa: PLC0415
    from app.main import app  # noqa: PLC0415
    from app.services.embeddings import embedding_service  # noqa: PLC0415
    from app.services.rag_engine import rag_orchestrator  # noqa: PLC0415

    assert "127.0.0.1" in settings.DATABASE_URL or "localhost" in settings.DATABASE_URL

    # Route Gemini clients to local simulator while preserving all app retry/semaphore/timeout logic
    embedding_service._client = genai.Client(
        api_key="staging-local-key",
        http_options=types.HttpOptions(base_url=args.gemini_url),
    )
    rag_orchestrator._client = genai.Client(
        api_key="staging-local-key",
        http_options=types.HttpOptions(
            base_url=args.gemini_url,
            timeout=25_000,
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )

    # Passive SQLAlchemy pool & query instrumentation
    metrics_lock = threading.Lock()
    stats = {
        "checkouts": 0,
        "checkins": 0,
        "connects": 0,
        "queries": 0,
        "query_total_ms": 0.0,
        "max_checkedout": 0,
        "max_overflow": 0,
        "query_buckets": defaultdict(lambda: {"count": 0, "total_ms": 0.0, "max_ms": 0.0}),
    }

    sync_engine = engine.sync_engine

    @event.listens_for(sync_engine, "connect")
    def on_connect(dbapi_conn, conn_record):
        with metrics_lock:
            stats["connects"] += 1

    @event.listens_for(sync_engine, "checkout")
    def on_checkout(dbapi_conn, conn_record, conn_proxy):
        pool = sync_engine.pool
        checked = pool.checkedout()
        ovf = max(0, pool.overflow())
        with metrics_lock:
            stats["checkouts"] += 1
            if checked > stats["max_checkedout"]:
                stats["max_checkedout"] = checked
            if ovf > stats["max_overflow"]:
                stats["max_overflow"] = ovf

    @event.listens_for(sync_engine, "checkin")
    def on_checkin(dbapi_conn, conn_record):
        with metrics_lock:
            stats["checkins"] += 1

    @event.listens_for(sync_engine, "before_cursor_execute")
    def before_exec(conn, cursor, statement, parameters, context, executemany):
        context._query_start_ns = time.perf_counter_ns()

    @event.listens_for(sync_engine, "after_cursor_execute")
    def after_exec(conn, cursor, statement, parameters, context, executemany):
        elapsed_ms = (time.perf_counter_ns() - getattr(context, "_query_start_ns", time.perf_counter_ns())) / 1e6
        first_word = (statement or "").strip().split(None, 1)[0].upper() if statement else "SQL"
        if "WITH ranked_chunks" in statement:
            tag = "SEMANTIC_SEARCH_CTE"
        elif "FROM resume_chunks" in statement:
            tag = "SELECT_RESUME_CHUNKS"
        elif "FROM resumes" in statement:
            tag = "SELECT_RESUMES"
        elif "FROM candidates" in statement:
            tag = "SELECT_CANDIDATES"
        elif "FROM talent_pools" in statement:
            tag = "SELECT_TALENT_POOLS"
        elif "FROM evaluation_citations" in statement:
            tag = "SELECT_EVAL_CITATIONS"
        elif "FROM evaluations" in statement:
            tag = "SELECT_EVALUATIONS"
        elif statement.strip().upper().startswith("SELECT 1"):
            tag = "POOL_PRE_PING"
        else:
            tag = first_word

        with metrics_lock:
            stats["queries"] += 1
            stats["query_total_ms"] += elapsed_ms
            b = stats["query_buckets"][tag]
            b["count"] += 1
            b["total_ms"] += elapsed_ms
            if elapsed_ms > b["max_ms"]:
                b["max_ms"] = elapsed_ms

    stop_event = threading.Event()
    config = uvicorn.Config(app, host=args.host, port=args.port, log_level="warning")
    server = uvicorn.Server(config)

    def telemetry_loop() -> None:
        out_path = Path(args.metrics_out) if args.metrics_out else None
        if out_path:
            out_path.parent.mkdir(parents=True, exist_ok=True)
        stop_file = Path(args.stop_file) if args.stop_file else None
        f = out_path.open("w", encoding="utf-8") if out_path else None
        last_write = 0.0
        try:
            while not stop_event.is_set():
                if stop_file and stop_file.exists():
                    server.should_exit = True
                    break
                now = time.time()
                if f and (now - last_write >= 1.0):
                    last_write = now
                    try:
                        pool = sync_engine.pool
                        with metrics_lock:
                            snap = {
                                "ts": now,
                                "pool_size": pool.size(),
                                "pool_checkedout": pool.checkedout(),
                                "pool_overflow": pool.overflow(),
                                "pool_checkedin": pool.checkedin(),
                                "total_checkouts": stats["checkouts"],
                                "total_queries": stats["queries"],
                                "max_checkedout": stats["max_checkedout"],
                                "max_overflow": stats["max_overflow"],
                            }
                        f.write(json.dumps(snap) + "\n")
                        f.flush()
                    except Exception:
                        pass
                time.sleep(0.2)
        finally:
            if f:
                f.close()

    t = threading.Thread(target=telemetry_loop, daemon=True)
    t.start()

    profiler = cProfile.Profile() if args.profile_out else None
    if profiler:
        profiler.enable()

    try:
        server.run()
    finally:
        stop_event.set()
        t.join(timeout=2.0)
        if profiler and args.profile_out:
            profiler.disable()
            prof_path = Path(args.profile_out)
            prof_path.parent.mkdir(parents=True, exist_ok=True)
            profiler.dump_stats(str(prof_path))
            txt_path = prof_path.with_suffix(".txt")
            with txt_path.open("w", encoding="utf-8") as pf:
                ps = pstats.Stats(profiler, stream=pf).sort_stats("cumtime")
                pf.write("=== TOP 50 BY CUMULATIVE TIME ===\n")
                ps.print_stats(50)
                ps2 = pstats.Stats(profiler, stream=pf).sort_stats("tottime")
                pf.write("\n=== TOP 50 BY SELF TIME (TOTTIME) ===\n")
                ps2.print_stats(50)

        if args.metrics_out:
            summary_path = Path(args.metrics_out).with_suffix(".summary.json")
            with metrics_lock:
                summary = {
                    "checkouts": stats["checkouts"],
                    "checkins": stats["checkins"],
                    "connects": stats["connects"],
                    "queries": stats["queries"],
                    "avg_query_ms": round(
                        stats["query_total_ms"] / max(1, stats["queries"]), 3
                    ),
                    "max_checkedout": stats["max_checkedout"],
                    "max_overflow": stats["max_overflow"],
                    "query_buckets": {
                        k: {
                            "count": v["count"],
                            "total_ms": round(v["total_ms"], 2),
                            "avg_ms": round(v["total_ms"] / max(1, v["count"]), 3),
                            "max_ms": round(v["max_ms"], 3),
                        }
                        for k, v in stats["query_buckets"].items()
                    },
                }
            summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
