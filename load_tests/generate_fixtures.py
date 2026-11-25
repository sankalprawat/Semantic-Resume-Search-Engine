"""Generates realistic 2-page PDF resume fixtures for load testing."""

from pathlib import Path
import pymupdf

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

SAMPLE_PROFILES = [
    ("Elena Rostova", "Staff Distributed Systems Engineer", "Apache Kafka, Flink, Go, Rust, Kubernetes"),
    ("Marcus Thorne", "Principal Storage Architect", "PostgreSQL, RocksDB, Raft, C++, MVCC"),
    ("Priya Nair", "Senior Platform Reliability Engineer", "Terraform, AWS, Envoy, eBPF, Prometheus"),
]

BODY_PARAGRAPH = (
    "Architected high-throughput distributed event pipelines handling 500,000 events per second "
    "across multi-region AWS clusters with strict sub-10ms P99 SLA targets. Implemented automated "
    "failover controllers, partitioned consumer rebalancing, transactional outbox replication, and "
    "fine-grained observability dashboards with OpenTelemetry and Prometheus. Led architecture design "
    "reviews, incident post-mortems, and capacity modeling for 40+ production microservices. "
)


def main() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    for idx, (name, title, skills) in enumerate(SAMPLE_PROFILES, start=1):
        doc = pymupdf.open()
        for page_num in (1, 2):
            page = doc.new_page(width=595, height=842)
            text = (
                f"{name}\n{title}\nCore Skills: {skills}\n\n"
                if page_num == 1
                else f"{name} - Page 2 Projects & Publications\n\n"
            )
            text += "\n\n".join(
                f"Project Experience Block {b + (page_num - 1) * 5}: {BODY_PARAGRAPH}"
                for b in range(1, 6)
            )
            page.insert_textbox(pymupdf.Rect(45, 45, 550, 795), text, fontsize=10, lineheight=1.25)
        out_file = FIXTURES_DIR / f"sample_resume_{idx}.pdf"
        out_file.write_bytes(doc.tobytes())
        doc.close()
        print(f"Generated {out_file} ({out_file.stat().st_size} bytes)")

    # Generate 15-page dense PDF for CPU/event-loop blocking stress test
    dense_doc = pymupdf.open()
    for page_num in range(1, 16):
        page = dense_doc.new_page(width=595, height=842)
        text = f"Dense Candidate Profile - Page {page_num}\n\n" + "\n\n".join(
            f"Section {b} (p.{page_num}): {BODY_PARAGRAPH}" for b in range(1, 7)
        )
        page.insert_textbox(pymupdf.Rect(40, 40, 555, 800), text, fontsize=9, lineheight=1.2)
    dense_file = FIXTURES_DIR / "dense_15p_resume.pdf"
    dense_file.write_bytes(dense_doc.tobytes())
    dense_doc.close()
    print(f"Generated {dense_file} ({dense_file.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
