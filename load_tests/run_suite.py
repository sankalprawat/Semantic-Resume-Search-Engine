"""Orchestrates local staging services and executes all Phase 2 & 3 tests."""

import argparse
import csv
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import httpx
import psutil
import psycopg2

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_PY = ROOT_DIR / "backend" / ".venv" / "Scripts" / "python.exe"
SCRATCH_DIR = Path(
    r"C:\Users\sanka\.gemini\antigravity\brain\bf6b9f04-5131-468a-b16e-b3e795e52a0a\scratch"
)
LOADTEST_PY = SCRATCH_DIR / "loadtest_venv" / "Scripts" / "python.exe"
LOCUST_EXE = SCRATCH_DIR / "loadtest_venv" / "Scripts" / "locust.exe"
PG_BIN = Path(r"C:\Program Files\PostgreSQL\18\bin")
PG_DATA = SCRATCH_DIR / "pg18_data"
RESULTS_DIR = ROOT_DIR / "load_tests" / "results"
STAGING_STORAGE = SCRATCH_DIR / "staging_storage"

PG_PORT = 55432
API_PORT = 18000
GEMINI_PORT = 18001


def wait_http(url: str, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = httpx.get(url, timeout=1.0)
            if r.status_code == 200:
                return
        except Exception:
            pass
        time.sleep(0.25)
    raise RuntimeError(f"Service did not become healthy: {url}")


def start_postgres() -> None:
    subprocess.run(
        [str(PG_BIN / "pg_ctl.exe"), "-D", str(PG_DATA), "-l", str(SCRATCH_DIR / "pg18.log"), "-w", "start"],
        check=True,
    )


def stop_postgres() -> None:
    subprocess.run(
        [str(PG_BIN / "pg_ctl.exe"), "-D", str(PG_DATA), "-w", "stop"],
        check=False,
    )


def start_mock_gemini(embed_ms: float, stream_ms: float) -> subprocess.Popen:
    log_f = (SCRATCH_DIR / "mock_gemini.log").open("w", encoding="utf-8")
    proc = subprocess.Popen(
        [
            str(BACKEND_PY),
            str(ROOT_DIR / "load_tests" / "mock_gemini.py"),
            "--port",
            str(GEMINI_PORT),
            "--embed-ms",
            str(embed_ms),
            "--stream-ms",
            str(stream_ms),
        ],
        stdout=log_f,
        stderr=subprocess.STDOUT,
    )
    wait_http(f"http://127.0.0.1:{GEMINI_PORT}/health")
    return proc


def start_staging_backend(
    run_name: str,
    debug_flag: str = "True",
    profile_out: str = "",
) -> tuple[subprocess.Popen, Path, Path]:
    metrics_path = RESULTS_DIR / f"{run_name}_sa_metrics.jsonl"
    stop_file = SCRATCH_DIR / f"{run_name}.stop"
    if stop_file.exists():
        stop_file.unlink()
    log_path = SCRATCH_DIR / f"{run_name}_backend.log"
    log_f = log_path.open("w", encoding="utf-8")
    cmd = [
        str(BACKEND_PY),
        str(ROOT_DIR / "load_tests" / "staging_server.py"),
        "--port",
        str(API_PORT),
        "--pg-port",
        str(PG_PORT),
        "--gemini-url",
        f"http://127.0.0.1:{GEMINI_PORT}",
        "--storage-dir",
        str(STAGING_STORAGE),
        "--debug",
        debug_flag,
        "--metrics-out",
        str(metrics_path),
        "--stop-file",
        str(stop_file),
    ]
    if profile_out:
        cmd.extend(["--profile-out", profile_out])
    proc = subprocess.Popen(cmd, stdout=log_f, stderr=subprocess.STDOUT)
    wait_http(f"http://127.0.0.1:{API_PORT}/api/v1/health")
    return proc, metrics_path, stop_file


def terminate_proc(proc: subprocess.Popen | None, stop_file: Path | None = None) -> None:
    if proc is None or proc.poll() is not None:
        return
    try:
        if stop_file is not None:
            stop_file.write_text("stop", encoding="utf-8")
            proc.wait(timeout=12)
            return
        proc.terminate()
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def monitor_system_and_db(app_pid: int, out_jsonl: Path, stop_ev: threading.Event) -> None:
    root_proc = psutil.Process(app_pid)
    tracked_app_procs: dict[int, psutil.Process] = {root_proc.pid: root_proc}
    root_proc.cpu_percent(interval=None)
    for ch in root_proc.children(recursive=True):
        try:
            ch.cpu_percent(interval=None)
            tracked_app_procs[ch.pid] = ch
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    pg_procs = []
    for p in psutil.process_iter(["name", "cmdline"]):
        try:
            if (p.info["name"] or "").lower() == "postgres.exe":
                p.cpu_percent(interval=None)
                pg_procs.append(p)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    pg_conn = psycopg2.connect(host="127.0.0.1", port=PG_PORT, user="postgres", dbname="talent_engine")
    pg_conn.autocommit = True

    with out_jsonl.open("w", encoding="utf-8") as f:
        while not stop_ev.is_set():
            time.sleep(1.0)
            if stop_ev.is_set():
                break
            try:
                # Refresh child list in case launcher spawned child python.exe
                try:
                    for ch in root_proc.children(recursive=True):
                        if ch.pid not in tracked_app_procs:
                            ch.cpu_percent(interval=None)
                            tracked_app_procs[ch.pid] = ch
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

                app_cpu = 0.0
                app_rss = 0.0
                for pid, ap in list(tracked_app_procs.items()):
                    try:
                        app_cpu += ap.cpu_percent(interval=None)
                        app_rss += ap.memory_info().rss / (1024 * 1024)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        tracked_app_procs.pop(pid, None)
                pg_cpu = 0.0
                pg_rss = 0.0
                for pp in pg_procs:
                    try:
                        pg_cpu += pp.cpu_percent(interval=None)
                        pg_rss += pp.memory_info().rss / (1024 * 1024)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass

                pg_states = {}
                pg_waiting = 0
                with pg_conn.cursor() as cur:
                    cur.execute(
                        "SELECT COALESCE(state, 'bg'), COUNT(*), "
                        "COUNT(*) FILTER (WHERE wait_event_type = 'Lock') "
                        "FROM pg_stat_activity WHERE datname = 'talent_engine' GROUP BY 1;"
                    )
                    for st, cnt, wc in cur.fetchall():
                        pg_states[st] = cnt
                        pg_waiting += wc

                snap = {
                    "ts": time.time(),
                    "app_cpu_pct": round(app_cpu, 2),
                    "app_rss_mb": round(app_rss, 2),
                    "pg_cpu_pct": round(pg_cpu, 2),
                    "pg_rss_mb": round(pg_rss, 2),
                    "sys_cpu_pct": round(psutil.cpu_percent(interval=None), 2),
                    "sys_mem_avail_mb": round(psutil.virtual_memory().available / (1024 * 1024), 1),
                    "pg_states": pg_states,
                    "pg_waiting": pg_waiting,
                }
                f.write(json.dumps(snap) + "\n")
                f.flush()
            except Exception:
                pass
    pg_conn.close()


def summarize_run(run_name: str) -> dict:
    stats_csv = RESULTS_DIR / f"{run_name}_stats.csv"
    sys_jsonl = RESULTS_DIR / f"{run_name}_sys_metrics.jsonl"
    sa_jsonl = RESULTS_DIR / f"{run_name}_sa_metrics.jsonl"
    sa_summary = RESULTS_DIR / f"{run_name}_sa_metrics.summary.json"

    def _num(val: str) -> float:
        try:
            return float(val)
        except Exception:
            return 0.0

    endpoints = []
    if stats_csv.exists():
        with stats_csv.open("r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                req_cnt = int(row["Request Count"])
                fail_cnt = int(row["Failure Count"])
                endpoints.append(
                    {
                        "type": row.get("Type", ""),
                        "name": row["Name"],
                        "requests": req_cnt,
                        "failures": fail_cnt,
                        "error_pct": round((fail_cnt / max(1, req_cnt)) * 100.0, 2),
                        "rps": round(_num(row["Requests/s"]), 2),
                        "p50_ms": _num(row["50%"]),
                        "p95_ms": _num(row["95%"]),
                        "p99_ms": _num(row["99%"]),
                        "max_ms": round(_num(row["Max Response Time"]), 2),
                    }
                )

    sys_rows = []
    if sys_jsonl.exists():
        sys_rows = [json.loads(line) for line in sys_jsonl.read_text(encoding="utf-8").splitlines() if line.strip()]

    sa_rows = []
    if sa_jsonl.exists():
        sa_rows = [json.loads(line) for line in sa_jsonl.read_text(encoding="utf-8").splitlines() if line.strip()]

    summary = {
        "run": run_name,
        "endpoints": endpoints,
        "system": {
            "samples": len(sys_rows),
            "app_cpu_avg": round(sum(r["app_cpu_pct"] for r in sys_rows) / max(1, len(sys_rows)), 1),
            "app_cpu_max": max((r["app_cpu_pct"] for r in sys_rows), default=0.0),
            "app_rss_start_mb": sys_rows[0]["app_rss_mb"] if sys_rows else 0.0,
            "app_rss_max_mb": max((r["app_rss_mb"] for r in sys_rows), default=0.0),
            "app_rss_end_mb": sys_rows[-1]["app_rss_mb"] if sys_rows else 0.0,
            "pg_cpu_avg": round(sum(r["pg_cpu_pct"] for r in sys_rows) / max(1, len(sys_rows)), 1),
            "pg_cpu_max": max((r["pg_cpu_pct"] for r in sys_rows), default=0.0),
            "pg_rss_max_mb": max((r["pg_rss_mb"] for r in sys_rows), default=0.0),
            "max_idle_in_tx": max((r["pg_states"].get("idle in transaction", 0) for r in sys_rows), default=0),
            "max_pg_active": max((r["pg_states"].get("active", 0) for r in sys_rows), default=0),
        },
        "sqlalchemy": {
            "max_checkedout_obs": max((r["pool_checkedout"] for r in sa_rows), default=0),
            "max_overflow_obs": max((r["pool_overflow"] for r in sa_rows), default=0),
            "summary": json.loads(sa_summary.read_text(encoding="utf-8")) if sa_summary.exists() else {},
        },
    }
    out_file = RESULTS_DIR / f"{run_name}_report.json"
    out_file.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def run_locust_test(
    run_name: str,
    scenario: str,
    users: int | None,
    spawn_rate: int | None,
    run_time_s: int | None,
    ids: dict,
    embed_ms: float = 250.0,
    stream_ms: float = 2500.0,
    debug_flag: str = "True",
    profile: bool = False,
    search_pool_override: str = "",
) -> dict:
    print(f"\n=== Running {run_name} (scenario={scenario}, users={users}, time={run_time_s}s, debug={debug_flag}) ===")
    mock_proc = start_mock_gemini(embed_ms=embed_ms, stream_ms=stream_ms)
    prof_path = str(RESULTS_DIR / f"{run_name}.prof") if profile else ""
    app_proc, _, stop_file = start_staging_backend(run_name, debug_flag=debug_flag, profile_out=prof_path)

    stop_ev = threading.Event()
    sys_jsonl = RESULTS_DIR / f"{run_name}_sys_metrics.jsonl"
    mon_thread = threading.Thread(target=monitor_system_and_db, args=(app_proc.pid, sys_jsonl, stop_ev), daemon=True)
    mon_thread.start()

    env = os.environ.copy()
    env["LOAD_SCENARIO"] = scenario
    env["SMALL_POOL_ID"] = ids["small_pool_id"]
    env["LARGE_POOL_ID"] = ids["large_pool_id"]
    env["SEARCH_POOL_ID"] = search_pool_override or ids["search_pool_id"]
    env["UPLOAD_POOL_ID"] = ids.get("upload_pool_id", ids["small_pool_id"])
    env["CANDIDATE_ID"] = ids["candidate_id"]

    csv_prefix = str(RESULTS_DIR / run_name)
    cmd = [
        str(LOCUST_EXE),
        "-f",
        str(ROOT_DIR / "load_tests" / "locustfile.py"),
        "--host",
        f"http://127.0.0.1:{API_PORT}",
        "--headless",
        "--only-summary",
        "--csv",
        csv_prefix,
        "--csv-full-history",
        "--stop-timeout",
        "10",
    ]
    if users is not None and spawn_rate is not None and run_time_s is not None:
        cmd.extend(["-u", str(users), "-r", str(spawn_rate), "-t", f"{run_time_s}s"])

    try:
        res = subprocess.run(cmd, env=env, capture_output=True, text=True, check=False)
        (RESULTS_DIR / f"{run_name}_locust.log").write_text(res.stdout + "\n" + res.stderr, encoding="utf-8")
    finally:
        stop_ev.set()
        mon_thread.join(timeout=3.0)
        terminate_proc(app_proc, stop_file=stop_file)
        terminate_proc(mock_proc)

    summary = summarize_run(run_name)
    agg = next((e for e in summary["endpoints"] if e["name"] == "Aggregated"), None)
    print(f"Result {run_name}: Aggregated={agg} | System={summary['system']} | PoolMax={summary['sqlalchemy']['max_checkedout_obs']}")
    return summary


def run_db_explain(ids: dict) -> None:
    """Capture actual PostgreSQL EXPLAIN (ANALYZE, BUFFERS) for critical queries."""
    conn = psycopg2.connect(host="127.0.0.1", port=PG_PORT, user="postgres", dbname="talent_engine")
    conn.autocommit = True
    vec_str = "[" + ",".join(["0.036"] * 768) + "]"
    outputs = []
    with conn.cursor() as cur:
        cur.execute("SET hnsw.ef_search = 40;")
        # 1. Exact current semantic_search SQL (from vector_store.py)
        cur.execute(
            """
            EXPLAIN (ANALYZE, BUFFERS)
            WITH ranked_chunks AS (
                SELECT
                    rc.id AS chunk_id, rc.candidate_id, rc.resume_id, rc.chunk_index,
                    rc.page_number, rc.text_content, rc.bounding_boxes,
                    c.full_name AS candidate_name, c.headline AS candidate_headline,
                    (1 - (rc.embedding <=> CAST(%s AS vector))) AS similarity_score,
                    ROW_NUMBER() OVER (
                        PARTITION BY rc.candidate_id
                        ORDER BY rc.embedding <=> CAST(%s AS vector) ASC
                    ) AS candidate_rank
                FROM resume_chunks rc
                JOIN candidates c ON rc.candidate_id = c.id
                WHERE c.pool_id = %s::uuid
                  AND (1 - (rc.embedding <=> CAST(%s AS vector))) >= 0.20
            )
            SELECT * FROM ranked_chunks WHERE candidate_rank <= 3 ORDER BY similarity_score DESC LIMIT 15;
            """,
            (vec_str, vec_str, ids["search_pool_id"], vec_str),
        )
        outputs.append("=== CURRENT SEMANTIC SEARCH SQL (1000 candidates / 5000 chunks) ===\n" + "\n".join(r[0] for r in cur.fetchall()))

        # 2. Pure global HNSW index plan for comparison (default & enable_seqscan=off)
        cur.execute(
            """
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT rc.id, rc.candidate_id, 1 - (rc.embedding <=> CAST(%s AS vector)) AS sim
            FROM resume_chunks rc
            ORDER BY rc.embedding <=> CAST(%s AS vector) ASC
            LIMIT 45;
            """,
            (vec_str, vec_str),
        )
        outputs.append("\n=== GLOBAL HNSW INDEX SCAN REFERENCE (ORDER BY <=> LIMIT 45) ===\n" + "\n".join(r[0] for r in cur.fetchall()))

        cur.execute("SET enable_seqscan = off;")
        cur.execute(
            """
            EXPLAIN (ANALYZE, BUFFERS)
            WITH ranked_chunks AS (
                SELECT rc.id AS chunk_id, rc.candidate_id,
                    (1 - (rc.embedding <=> CAST(%s AS vector))) AS similarity_score,
                    ROW_NUMBER() OVER (PARTITION BY rc.candidate_id ORDER BY rc.embedding <=> CAST(%s AS vector) ASC) AS candidate_rank
                FROM resume_chunks rc
                JOIN candidates c ON rc.candidate_id = c.id
                WHERE c.pool_id = %s::uuid
                  AND (1 - (rc.embedding <=> CAST(%s AS vector))) >= 0.20
            )
            SELECT * FROM ranked_chunks WHERE candidate_rank <= 3 ORDER BY similarity_score DESC LIMIT 15;
            """,
            (vec_str, vec_str, ids["search_pool_id"], vec_str),
        )
        outputs.append("\n=== SEMANTIC SEARCH WITH enable_seqscan=off (STILL CANNOT USE HNSW) ===\n" + "\n".join(r[0] for r in cur.fetchall()))

        cur.execute(
            """
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT rc.id, rc.candidate_id, 1 - (rc.embedding <=> CAST(%s AS vector)) AS sim
            FROM resume_chunks rc
            ORDER BY rc.embedding <=> CAST(%s AS vector) ASC
            LIMIT 45;
            """,
            (vec_str, vec_str),
        )
        outputs.append("\n=== GLOBAL HNSW WITH enable_seqscan=off (USES HNSW) ===\n" + "\n".join(r[0] for r in cur.fetchall()))
        cur.execute("RESET enable_seqscan;")

        # 3. Current list_candidates_for_pool N+1/selectinload queries
        cur.execute("EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM candidates WHERE pool_id = %s::uuid;", (ids["large_pool_id"],))
        outputs.append("\n=== CANDIDATES SELECT (100 candidates) ===\n" + "\n".join(r[0] for r in cur.fetchall()))
        cur.execute(
            "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM resume_chunks WHERE candidate_id IN (SELECT id FROM candidates WHERE pool_id = %s::uuid);",
            (ids["large_pool_id"],),
        )
        outputs.append("\n=== RESUME_CHUNKS OVER-FETCH FOR LEN() (100 candidates / 500 chunks) ===\n" + "\n".join(r[0] for r in cur.fetchall()))

    conn.close()
    (RESULTS_DIR / "db_explain_plans.txt").write_text("\n".join(outputs), encoding="utf-8")
    print("Saved DB EXPLAIN ANALYZE plans to load_tests/results/db_explain_plans.txt")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--phase",
        default="all",
        choices=["seed", "baseline", "ramps", "breaking", "soak", "spike", "profile", "all"],
    )
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    STAGING_STORAGE.mkdir(parents=True, exist_ok=True)

    # Generate PDF fixtures first
    subprocess.run([str(BACKEND_PY), str(ROOT_DIR / "load_tests" / "generate_fixtures.py")], check=True)

    start_postgres()
    try:
        # Ensure seeded
        ids_file = RESULTS_DIR / "staging_ids.json"
        if args.phase == "seed" or not ids_file.exists():
            mock_proc = start_mock_gemini(embed_ms=5.0, stream_ms=50.0)
            app_proc, _, seed_stop = start_staging_backend("seed_init", debug_flag="False")
            try:
                subprocess.run([str(LOADTEST_PY), str(ROOT_DIR / "load_tests" / "seed_staging_db.py")], check=True)
            finally:
                terminate_proc(app_proc, stop_file=seed_stop)
                terminate_proc(mock_proc)
            run_db_explain(json.loads(ids_file.read_text(encoding="utf-8")))
            if args.phase == "seed":
                return

        ids = json.loads(ids_file.read_text(encoding="utf-8"))
        all_summaries = []

        if args.phase in ("baseline", "all"):
            all_summaries.append(run_locust_test("01_baseline_mixed", "baseline", users=8, spawn_rate=4, run_time_s=45, ids=ids))

        if args.phase in ("ramps", "all"):
            # Health ceiling
            all_summaries.append(run_locust_test("02a_health_200vu", "read_health", users=200, spawn_rate=50, run_time_s=20, ids=ids, embed_ms=5, stream_ms=50))
            # Pools DEBUG=True vs DEBUG=False
            all_summaries.append(run_locust_test("02b_pools_debug_true_60vu", "read_pools", users=60, spawn_rate=20, run_time_s=20, ids=ids, debug_flag="True"))
            all_summaries.append(run_locust_test("02c_pools_debug_false_60vu", "read_pools", users=60, spawn_rate=20, run_time_s=20, ids=ids, debug_flag="False"))
            # Candidates small vs large (100 candidates x 5 chunks)
            all_summaries.append(run_locust_test("02d_candidates_small_40vu", "read_candidates_small", users=40, spawn_rate=20, run_time_s=20, ids=ids))
            all_summaries.append(run_locust_test("02e_candidates_large_25vu", "read_candidates_large", users=25, spawn_rate=10, run_time_s=25, ids=ids))
            # File serving + Evaluations list
            all_summaries.append(run_locust_test("02f_file_serve_40vu", "read_file", users=40, spawn_rate=20, run_time_s=20, ids=ids))
            all_summaries.append(run_locust_test("02g_eval_list_25vu", "read_evaluations", users=25, spawn_rate=10, run_time_s=20, ids=ids))
            # Search ramp: 15 -> 35 VUs with 250ms embed latency + 5k chunks, plus DB-isolated 5ms embed comparison (3 cands vs 1000 cands)
            all_summaries.append(run_locust_test("02h_search_db_small_25vu", "search", users=25, spawn_rate=25, run_time_s=20, ids=ids, embed_ms=5, search_pool_override=ids["small_pool_id"]))
            all_summaries.append(run_locust_test("02h_search_db_5k_25vu", "search", users=25, spawn_rate=25, run_time_s=20, ids=ids, embed_ms=5, search_pool_override=ids["search_pool_id"]))
            all_summaries.append(run_locust_test("02h_search_15vu", "search", users=15, spawn_rate=15, run_time_s=25, ids=ids, embed_ms=250))
            all_summaries.append(run_locust_test("02i_search_35vu", "search", users=35, spawn_rate=35, run_time_s=55, ids=ids, embed_ms=250))
            # Upload event-loop blocking probe
            all_summaries.append(run_locust_test("02j_upload_health_12vu", "upload_plus_health", users=12, spawn_rate=6, run_time_s=25, ids=ids, embed_ms=250))
            # SSE DB Pool Exhaustion Cascade ramp: 15 -> 25 -> 40 VUs
            all_summaries.append(run_locust_test("02k_sse_cascade_15vu", "eval_stream_cascade", users=15, spawn_rate=15, run_time_s=30, ids=ids, embed_ms=250, stream_ms=2500))
            all_summaries.append(run_locust_test("02l_sse_cascade_25vu", "eval_stream_cascade", users=25, spawn_rate=25, run_time_s=35, ids=ids, embed_ms=250, stream_ms=2500))
            all_summaries.append(run_locust_test("02m_sse_cascade_40vu", "eval_stream_cascade", users=40, spawn_rate=40, run_time_s=65, ids=ids, embed_ms=250, stream_ms=2500))

        if args.phase in ("breaking", "all"):
            all_summaries.append(run_locust_test("02j2_upload_dense_health_8vu", "upload_dense_plus_health", users=8, spawn_rate=4, run_time_s=25, ids=ids, embed_ms=25))
            all_summaries.append(run_locust_test("02n_sse_pool_timeout_130vu", "eval_stream_cascade", users=130, spawn_rate=130, run_time_s=55, ids=ids, embed_ms=250, stream_ms=10000))

        if args.phase in ("soak", "all"):
            all_summaries.append(run_locust_test("03_soak_18vu_180s", "soak", users=18, spawn_rate=6, run_time_s=180, ids=ids, embed_ms=250, stream_ms=2500))

        if args.phase in ("spike", "all"):
            all_summaries.append(run_locust_test("04_spike_5_to_45_to_5", "spike", users=None, spawn_rate=None, run_time_s=None, ids=ids, embed_ms=250, stream_ms=2500))

        if args.phase in ("profile", "all"):
            all_summaries.append(run_locust_test("05_profile_mixed_20vu", "baseline", users=20, spawn_rate=10, run_time_s=35, ids=ids, embed_ms=250, stream_ms=2500, profile=True))
            all_summaries.append(run_locust_test("05b_profile_candidates_large", "read_candidates_large", users=15, spawn_rate=15, run_time_s=20, ids=ids, debug_flag="True", profile=True))

        master = RESULTS_DIR / f"summary_{args.phase}.json"
        master.write_text(json.dumps(all_summaries, indent=2), encoding="utf-8")
        print(f"\nCompleted phase={args.phase}. Summary saved to {master}")
    finally:
        stop_postgres()


if __name__ == "__main__":
    main()
