from dataclasses import dataclass, field
from typing import Any

from app.services.ingestion import ExtractedDocument, ExtractedPage, ExtractedWord
from app.utils.coordinates import merge_adjacent_bboxes


@dataclass
class ChunkResult:
    """Represents a generated semantic chunk ready for vector embedding and persistence."""

    chunk_index: int
    page_number: int
    text_content: str
    token_count: int
    bounding_boxes: list[dict[str, Any]] = field(default_factory=list)


class SlidingWindowChunker:
    """
    Zero-dependency sliding-window chunking engine designed for technical resumes.
    Features:
    - 400-token target window (~1,600 chars) with 100-token overlap (~400 chars).
    - Sentence & bullet boundary snapping to prevent cutting achievements in half.
    - Word-to-coordinate mapping that aggregates and merges bounding boxes per chunk.
    """

    def __init__(
        self,
        target_tokens: int = 400,
        overlap_tokens: int = 100,
        chars_per_token: float = 4.0,
    ) -> None:
        self.target_tokens = target_tokens
        self.overlap_tokens = overlap_tokens
        self.chars_per_token = chars_per_token

        self.target_chars = int(target_tokens * chars_per_token)
        self.overlap_chars = int(overlap_tokens * chars_per_token)
        self.step_chars = max(100, self.target_chars - self.overlap_chars)

    def chunk_document(self, document: ExtractedDocument) -> list[ChunkResult]:
        """
        Processes an ExtractedDocument page by page, chunking text and aggregating
        bounding boxes for each chunk.
        """
        all_chunks: list[ChunkResult] = []
        global_chunk_idx = 0

        for page in document.pages:
            page_chunks = self.chunk_page(page, start_chunk_index=global_chunk_idx)
            all_chunks.extend(page_chunks)
            global_chunk_idx += len(page_chunks)

        return all_chunks

    def chunk_page(
        self,
        page: ExtractedPage,
        start_chunk_index: int = 0,
    ) -> list[ChunkResult]:
        """
        Chunks an individual page, ensuring words and bounding boxes remain
        strictly synchronized to the page viewport.
        """
        words = page.words
        if not words:
            # If no words extracted, fallback to raw text if present
            if page.text.strip():
                token_count = max(1, int(len(page.text) / self.chars_per_token))
                return [
                    ChunkResult(
                        chunk_index=start_chunk_index,
                        page_number=page.page_number,
                        text_content=page.text.strip(),
                        token_count=token_count,
                        bounding_boxes=[],
                    )
                ]
            return []

        # If page total text is smaller than our target window, keep it as 1 complete chunk
        total_page_chars = sum(len(w.text) + 1 for w in words)
        if total_page_chars <= (self.target_chars + 100):
            chunk_text = " ".join(w.text for w in words)
            raw_boxes = [w.bbox for w in words]
            merged_boxes = merge_adjacent_bboxes(raw_boxes)
            token_count = max(1, int(len(chunk_text) / self.chars_per_token))

            return [
                ChunkResult(
                    chunk_index=start_chunk_index,
                    page_number=page.page_number,
                    text_content=chunk_text,
                    token_count=token_count,
                    bounding_boxes=merged_boxes,
                )
            ]

        chunks: list[ChunkResult] = []
        word_count = len(words)
        curr_word_idx = 0
        current_chunk_idx = start_chunk_index

        while curr_word_idx < word_count:
            # Accumulate words until target_chars is reached
            end_word_idx = curr_word_idx
            char_accum = 0

            while end_word_idx < word_count and char_accum < self.target_chars:
                char_accum += len(words[end_word_idx].text) + 1
                end_word_idx += 1

            # Sentence Boundary Snapping:
            # 1. If a sentence completes within a few words ahead, extend slightly to complete it.
            # 2. Otherwise, look backwards up to 50% of the window to snap to sentence end.
            if end_word_idx < word_count:
                snapped_idx = self._find_sentence_boundary(
                    words,
                    start_idx=curr_word_idx,
                    target_end_idx=end_word_idx,
                )
                if snapped_idx > curr_word_idx:
                    end_word_idx = snapped_idx

            selected_words = words[curr_word_idx:end_word_idx]
            chunk_text = " ".join(w.text for w in selected_words)
            raw_boxes = [w.bbox for w in selected_words]
            merged_boxes = merge_adjacent_bboxes(raw_boxes)
            token_count = max(1, int(len(chunk_text) / self.chars_per_token))

            chunks.append(
                ChunkResult(
                    chunk_index=current_chunk_idx,
                    page_number=page.page_number,
                    text_content=chunk_text,
                    token_count=token_count,
                    bounding_boxes=merged_boxes,
                )
            )
            current_chunk_idx += 1

            # If we've reached the end of the words, we are done
            if end_word_idx >= word_count:
                break

            # Advance with overlap:
            # Slide forward by step_chars, snapping to the next sentence start
            avg_word_len = sum(len(w.text) + 1 for w in selected_words) / len(selected_words)
            overlap_target_words = max(1, int(self.overlap_chars / avg_word_len))
            next_start_idx = max(curr_word_idx + 1, end_word_idx - overlap_target_words)

            curr_word_idx = next_start_idx

        return chunks

    def _find_sentence_boundary(
        self,
        words: list[ExtractedWord],
        start_idx: int,
        target_end_idx: int,
        max_lookforward_words: int = 8,
        max_lookback_ratio: float = 0.5,
    ) -> int:
        """
        Dynamically snaps the chunk boundary to the nearest grammatical completion:
        1. Checks up to `max_lookforward_words` ahead: if a sentence finishes shortly,
           extends slightly to avoid cutting off the last 2-3 words.
        2. Otherwise scans backwards up to 50% of the window to find the prior sentence boundary.
        """
        word_count = len(words)

        # 1. Look forward slightly to complete sentence if near the end
        lookahead_limit = min(word_count, target_end_idx + max_lookforward_words)
        for i in range(target_end_idx - 1, lookahead_limit):
            w = words[i].text.strip()
            if w.endswith((".", "!", "?", ":", ";")):
                return i + 1

        # 2. Look backward up to 50% of the window to snap to previous sentence end
        lookback_limit = max(
            start_idx + 1,
            int(target_end_idx - (target_end_idx - start_idx) * max_lookback_ratio),
        )
        for i in range(target_end_idx - 1, lookback_limit - 1, -1):
            w = words[i].text.strip()
            if w.endswith((".", "!", "?", ":", ";")):
                return i + 1
            if w in ("•", "-", "*", "–") and i > start_idx:
                return i

        return target_end_idx


chunker = SlidingWindowChunker()
