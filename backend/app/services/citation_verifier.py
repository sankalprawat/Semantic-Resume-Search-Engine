import logging
import re
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

# Matches [Candidate: Name | Chunk: CX], [Candidate: Name | Chunk: C1, C2], or UUID
CITATION_REGEX = re.compile(
    r"\[(?:Candidate:\s*)?([^\|\]]+?)\s*\|\s*(?:Chunk:\s*)?([C\d]+(?:\s*,\s*[C\d]+)*|[a-f0-9\-]+)\]",
    re.IGNORECASE,
)


@dataclass
class VerifiedCitation:
    """Represents a verified citation linked to an actual source resume chunk."""

    citation_index: int
    raw_citation: str
    candidate_name: str
    candidate_id: UUID
    chunk_id: UUID
    chunk_index: int
    page_number: int
    source_text: str
    bounding_boxes: list[dict[str, Any]]
    is_valid: bool = True


@dataclass
class GroundingReport:
    """Anti-hallucination verification audit report."""

    total_citations: int
    valid_citations: list[VerifiedCitation] = field(default_factory=list)
    hallucinated_citations: list[dict[str, Any]] = field(default_factory=list)
    grounding_score: float = 100.0


class CitationVerifier:
    """
    Anti-hallucination guardrail engine.
    Extracts bracketed citations from LLM markdown, verifies that every cited chunk
    physically existed in the retrieval context, and extracts page coordinates.
    """

    def parse_citations(self, text: str) -> list[tuple[str, str, str]]:
        """
        Extracts all citation occurrences from markdown text.
        Returns list of (full_match, candidate_name, chunk_key).
        """
        matches = []
        for match in CITATION_REGEX.finditer(text):
            full_match = match.group(0)
            candidate_name = match.group(1).strip()
            raw_chunk_keys = match.group(2).strip()
            for chunk_key in (k.strip() for k in raw_chunk_keys.split(",") if k.strip()):
                matches.append((full_match, candidate_name, chunk_key))
        return matches

    def verify_synthesis(
        self,
        synthesis_markdown: str,
        retrieved_context: dict[str, dict[str, Any]],
    ) -> GroundingReport:
        """
        Verifies all citations in synthesis_markdown against retrieved_context.

        retrieved_context key format:
        Can be looked up by:
        - "c1", "c2", ...
        - "<candidate_name_lower>:c1", "<candidate_name_lower>:0"
        - str(chunk_id)
        """
        raw_matches = self.parse_citations(synthesis_markdown)
        if not raw_matches:
            # If no citations were generated at all, grounding is 0.0
            return GroundingReport(
                total_citations=0,
                valid_citations=[],
                hallucinated_citations=[],
                grounding_score=0.0,
            )

        valid_citations: list[VerifiedCitation] = []
        hallucinated_citations: list[dict[str, Any]] = []

        for idx, (raw_str, cand_name, chunk_key) in enumerate(raw_matches, start=1):
            normalized_cand = cand_name.lower()
            normalized_key = chunk_key.lower()

            # Attempt lookup by various candidate/chunk compound keys
            chunk_data = None
            candidate_compound_key = f"{normalized_cand}:{normalized_key}"

            if candidate_compound_key in retrieved_context:
                chunk_data = retrieved_context[candidate_compound_key]
            elif normalized_key in retrieved_context:
                chunk_data = retrieved_context[normalized_key]
            else:
                # Fuzzy match: check if candidate name is a substring of retrieved candidates
                for k, data in retrieved_context.items():
                    if (
                        normalized_key in k
                        and normalized_cand in data.get("candidate_name", "").lower()
                    ):
                        chunk_data = data
                        break

            if chunk_data:
                valid_citations.append(
                    VerifiedCitation(
                        citation_index=idx,
                        raw_citation=raw_str,
                        candidate_name=chunk_data["candidate_name"],
                        candidate_id=chunk_data["candidate_id"],
                        chunk_id=chunk_data["chunk_id"],
                        chunk_index=chunk_data["chunk_index"],
                        page_number=chunk_data["page_number"],
                        source_text=chunk_data["text_content"],
                        bounding_boxes=chunk_data.get("bounding_boxes", []),
                        is_valid=True,
                    )
                )
            else:
                logger.warning(
                    f"HALLUCINATION DETECTED: Cited '{raw_str}' was not found in retrieved context!"
                )
                hallucinated_citations.append(
                    {
                        "citation_index": idx,
                        "raw_citation": raw_str,
                        "candidate_name": cand_name,
                        "chunk_key": chunk_key,
                    }
                )

        total = len(raw_matches)
        valid_count = len(valid_citations)
        score = round((valid_count / total) * 100.0, 1) if total > 0 else 0.0

        return GroundingReport(
            total_citations=total,
            valid_citations=valid_citations,
            hallucinated_citations=hallucinated_citations,
            grounding_score=score,
        )


citation_verifier = CitationVerifier()
