"""Local async Gemini API simulator for isolated staging load tests.

Implements the exact HTTP/SSE wire contracts consumed by google-genai 3.0.0:
- POST /v1/models/{model}:batchEmbedContents
- POST /v1/models/{model}:embedContent
- POST /v1/models/{model}:streamGenerateContent
- POST /v1/models/{model}:generateContent
(and /v1beta/... aliases)
"""

import argparse
import asyncio
import hashlib
import json
import math
import re
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="Local Gemini Staging Simulator")

EMBED_DELAY_SEC = 0.25
STREAM_DURATION_SEC = 2.5
STREAM_CHUNKS = 10


def _deterministic_embedding(text: str, dim: int = 768) -> list[float]:
    """Generate a deterministic normalized 768-dim vector seeded by text tokens."""
    vec = [0.0] * dim
    tokens = re.findall(r"[a-z0-9]+", (text or "empty").lower())
    if not tokens:
        tokens = ["empty"]
    for tok in tokens:
        digest = hashlib.blake2b(tok.encode("utf-8"), digest_size=16).digest()
        for j in range(4):
            idx = int.from_bytes(digest[j * 4 : j * 4 + 2], "little") % dim
            sign = 1.0 if (digest[j * 4 + 2] & 1) == 0 else -1.0
            vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


def _extract_prompt_citations(payload: dict[str, Any]) -> list[tuple[str, str]]:
    """Extract candidate names and chunk labels (C1, C2...) present in prompt context."""
    raw = json.dumps(payload)
    matches = re.findall(r"\[(C\d+)\s*\|\s*Candidate:\s*([^(\n]+?)\s*\(Page", raw)
    seen: list[tuple[str, str]] = []
    for chunk_lbl, cand_name in matches:
        pair = (cand_name.strip(), chunk_lbl.strip())
        if pair not in seen:
            seen.append(pair)
    return seen[:6]


def _build_synthesis_chunks(citations: list[tuple[str, str]]) -> list[str]:
    if not citations:
        citations = [("Alice Vance", "C1"), ("Bob Chen", "C2")]
    c_lines = [
        f"- **{name}** demonstrated relevant distributed systems and cloud infrastructure experience [Candidate: {name} | Chunk: {cid}].\n"
        for name, cid in citations
    ]
    full_md = (
        "### Executive Summary Matrix\n"
        "| Candidate | Stack | Scale Handled | Top Match Reason |\n"
        "|---|---|---|---|\n"
        + "".join(
            f"| {name} | Distributed Systems, Go, Rust | High-throughput | Grounded evidence [Candidate: {name} | Chunk: {cid}] |\n"
            for name, cid in citations[:3]
        )
        + "\n### Comparative Architectural Analysis\n"
        + "".join(c_lines)
        + "\n### Final Hiring Recommendation & Ranking\n"
        + f"1. **{citations[0][0]}** — Strongest overall evidence alignment [Candidate: {citations[0][0]} | Chunk: {citations[0][1]}].\n"
    )
    step = max(1, math.ceil(len(full_md) / STREAM_CHUNKS))
    return [full_md[i : i + step] for i in range(0, len(full_md), step)]


@app.post("/v1/models/{model}:batchEmbedContents")
@app.post("/v1beta/models/{model}:batchEmbedContents")
async def batch_embed_contents(model: str, request: Request) -> JSONResponse:
    body = await request.json()
    if EMBED_DELAY_SEC > 0:
        await asyncio.sleep(EMBED_DELAY_SEC)
    reqs = body.get("requests", [])
    embeddings = []
    for req in reqs:
        parts = req.get("content", {}).get("parts", [])
        text = " ".join(p.get("text", "") for p in parts if isinstance(p, dict))
        dim = int(req.get("outputDimensionality", 768))
        embeddings.append({"values": _deterministic_embedding(text, dim)})
    return JSONResponse({"embeddings": embeddings})


@app.post("/v1/models/{model}:embedContent")
@app.post("/v1beta/models/{model}:embedContent")
async def embed_content(model: str, request: Request) -> JSONResponse:
    body = await request.json()
    if EMBED_DELAY_SEC > 0:
        await asyncio.sleep(EMBED_DELAY_SEC)
    parts = body.get("content", {}).get("parts", [])
    text = " ".join(p.get("text", "") for p in parts if isinstance(p, dict))
    dim = int(body.get("outputDimensionality", 768))
    return JSONResponse({"embedding": {"values": _deterministic_embedding(text, dim)}})


@app.post("/v1/models/{model}:streamGenerateContent")
@app.post("/v1beta/models/{model}:streamGenerateContent")
async def stream_generate_content(model: str, request: Request) -> StreamingResponse:
    body = await request.json()
    citations = _extract_prompt_citations(body)
    chunks = _build_synthesis_chunks(citations)
    per_chunk_sleep = STREAM_DURATION_SEC / max(1, len(chunks))

    async def event_gen():
        for idx, chunk_text in enumerate(chunks):
            if per_chunk_sleep > 0:
                await asyncio.sleep(per_chunk_sleep)
            is_last = idx == len(chunks) - 1
            payload: dict[str, Any] = {
                "candidates": [
                    {
                        "content": {"parts": [{"text": chunk_text}], "role": "model"},
                        "index": 0,
                        **({"finishReason": "STOP"} if is_last else {}),
                    }
                ]
            }
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@app.post("/v1/models/{model}:generateContent")
@app.post("/v1beta/models/{model}:generateContent")
async def generate_content(model: str, request: Request) -> JSONResponse:
    body = await request.json()
    citations = _extract_prompt_citations(body)
    full_text = "".join(_build_synthesis_chunks(citations))
    if STREAM_DURATION_SEC > 0:
        await asyncio.sleep(STREAM_DURATION_SEC)
    return JSONResponse(
        {
            "candidates": [
                {
                    "content": {"parts": [{"text": full_text}], "role": "model"},
                    "finishReason": "STOP",
                    "index": 0,
                }
            ]
        }
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "embed_delay_sec": EMBED_DELAY_SEC,
        "stream_duration_sec": STREAM_DURATION_SEC,
    }


def main() -> None:
    global EMBED_DELAY_SEC, STREAM_DURATION_SEC, STREAM_CHUNKS
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18001)
    parser.add_argument("--embed-ms", type=float, default=250.0)
    parser.add_argument("--stream-ms", type=float, default=2500.0)
    parser.add_argument("--stream-chunks", type=int, default=10)
    args = parser.parse_args()

    EMBED_DELAY_SEC = args.embed_ms / 1000.0
    STREAM_DURATION_SEC = args.stream_ms / 1000.0
    STREAM_CHUNKS = max(1, args.stream_chunks)

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
