"use client";

import React from "react";
import { useEngine } from "@/context/EngineContext";
import { User } from "lucide-react";

export function CandidateTabs() {
  const { candidates, activeCandidate, setActiveCandidate, activeCitation } =
    useEngine();

  if (candidates.length === 0) {
    return (
      <div className="flex items-center space-x-1 border-b border-surface-200 bg-surface-100/70 px-3 py-1.5 overflow-x-auto text-xs text-ink-muted shrink-0">
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-white/70 border border-dashed border-surface-300 text-[11px]">
          <User className="w-3 h-3 text-stone-400" />
          <span>No candidate tabs loaded yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1 border-b border-surface-200 bg-surface-100 px-3 pt-1.5 overflow-x-auto whitespace-nowrap no-scrollbar shrink-0">
      {candidates.map((cand) => {
        const isActive = activeCandidate?.id === cand.id;
        const hasActiveCitation =
          activeCitation &&
          (activeCitation.candidateId === cand.id ||
            activeCitation.candidateName
              .toLowerCase()
              .includes(cand.full_name.toLowerCase()));

        return (
          <button
            key={cand.id}
            type="button"
            onClick={() => setActiveCandidate(cand)}
            className={`flex items-center space-x-2 px-3.5 py-2 min-h-[44px] md:min-h-[38px] text-xs font-medium rounded-t-lg transition-all border-t border-l border-r truncate max-w-[220px] cursor-pointer shrink-0 ${
              isActive
                ? "bg-white text-ink-primary border-surface-200 shadow-2xs font-semibold"
                : "bg-surface-100 hover:bg-surface-200/70 text-ink-secondary border-transparent"
            }`}
          >
            <User
              className={`w-3.5 h-3.5 shrink-0 ${
                isActive ? "text-amber-700" : "text-stone-500"
              }`}
            />
            <span className="truncate">{cand.full_name}</span>
            {hasActiveCitation && (
              <span
                title="Active citation evidence on this candidate"
                className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-300 animate-ping shrink-0 ml-1"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
