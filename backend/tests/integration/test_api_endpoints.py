import io

import pymupdf
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


def create_sample_pdf_bytes(name: str, skills: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text(pymupdf.Point(50, 72), f"{name}\nSenior Staff Engineer\n{skills}", fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.mark.asyncio
async def test_health_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["embedding_model"] == "gemini-embedding-2"
        assert data["completion_model"] == "gemini-4-hydrogen"


@pytest.mark.asyncio
async def test_pool_and_upload_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Create Pool
        pool_res = await ac.post(
            "/api/v1/pools/",
            json={
                "title": "Cloud Platform Infrastructure Team",
                "description": "Hiring senior Kubernetes and Cloud engineers",
            },
        )
        assert pool_res.status_code == 201
        pool_data = pool_res.json()
        pool_id = pool_data["id"]

        try:
            # 2. Upload sample PDF resume
            pdf_bytes = create_sample_pdf_bytes(
                name="Carol Cloud",
                skills=(
                    "Expert in Kubernetes clusters, Terraform infrastructure, and AWS"
                    " multi-region VPC design."
                ),
            )
            files = [("files", ("carol_resume.pdf", io.BytesIO(pdf_bytes), "application/pdf"))]
            upload_res = await ac.post(f"/api/v1/pools/{pool_id}/upload", files=files)
            assert upload_res.status_code == 200
            upload_data = upload_res.json()
            assert upload_data["total_uploaded"] == 1
            assert upload_data["resumes"][0]["chunks_created"] >= 1

            # 3. Query the pool
            search_res = await ac.post(
                f"/api/v1/pools/{pool_id}/search",
                json={
                    "query": "Kubernetes cluster orchestration and Terraform",
                    "top_k": 5,
                    "min_similarity": 0.20,
                },
            )
            assert search_res.status_code == 200
            search_data = search_res.json()
            assert search_data["total_candidates"] >= 1
            assert search_data["matches"][0]["top_similarity"] > 0.30

        finally:
            # Cleanup pool
            del_res = await ac.delete(f"/api/v1/pools/{pool_id}")
            assert del_res.status_code == 204
