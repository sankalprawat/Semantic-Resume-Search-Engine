"use client";

import React from "react";
import { useEngine } from "@/context/EngineContext";
import { CheckCircle2, FileSearch } from "lucide-react";

interface CitationBadgeProps {
  candidateName: string;
  chunkId: string;
}

export function CitationBadge({ candidateName, chunkId }: CitationBadgeProps) {
  const { doneData, candidates, setActiveCandidate, setActiveCitation, activeCitation } =
    useEngine();

  // Find corresponding verified citation record
  const citation = doneData?.citations.find((c) => {
    const nameMatch =
      c.candidate_name.toLowerCase().includes(candidateName.toLowerCase()) ||
      candidateName.toLowerCase().includes(c.candidate_name.toLowerCase());
    const chunkMatch =
      c.chunk_id === chunkId ||
      c.citation_index.toString() === chunkId ||
      chunkId.toUpperCase().includes(c.citation_index.toString());
    return nameMatch || chunkMatch;
  });

  const isSelected =
    activeCitation &&
    (activeCitation.candidateName.toLowerCase().includes(candidateName.toLowerCase()) ||
      candidateName.toLowerCase().includes(activeCitation.candidateName.toLowerCase()));

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Locate candidate object
    const targetCandidate = candidates.find(
      (cand) =>
        cand.full_name.toLowerCase().includes(candidateName.toLowerCase()) ||
        candidateName.toLowerCase().includes(cand.full_name.toLowerCase())
    );

    if (targetCandidate) {
      setActiveCandidate(targetCandidate);
    }

    // 2. Set active citation for PDF highlighting
    if (citation) {
      setActiveCitation({
        candidateId: citation.candidate_id,
        candidateName: citation.candidate_name,
        pageNumber: citation.page_number,
        boundingBoxes: citation.bounding_boxes || [],
        sourceText: citation.source_text,
      });
    } else if (targetCandidate) {
      // Fallback if citation index is partial
      setActiveCitation({
        candidateId: targetCandidate.id,
        candidateName: targetCandidate.full_name,
        pageNumber: 1,
        boundingBoxes: [],
        sourceText: candidateName,
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      title={`Click to inspect evidence in ${candidateName}'s PDF resume`}
      className={`inline-flex items-center space-x-1 px-2.5 py-1 sm:py-0.5 my-0.5 mx-1 min-h-[36px] sm:min-h-0 rounded-md text-xs sm:text-[11px] font-medium transition-all cursor-pointer border ${
        isSelected
          ? "bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-300/50 shadow-xs scale-102"
          : "bg-surface-100 hover:bg-amber-50 text-ink-primary hover:text-amber-900 border-surface-200 hover:border-amber-300 shadow-2xs"
      }`}
    >
      <FileSearch
        className={`w-3 h-3 ${isSelected ? "text-amber-700" : "text-amber-600"}`}
      />
      <span className="font-semibold">{candidateName}</span>
      <span className="text-[10px] text-ink-muted">({chunkId})</span>
      {citation && (
        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 ml-0.5" />
      )}
    </button>
  );
}
