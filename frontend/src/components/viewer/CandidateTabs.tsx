"use client";

import React from "react";
import { useEngine } from "@/context/EngineContext";
import { FileText, Sparkles, User } from "lucide-react";

export function CandidateTabs() {
  const { candidates, activeCandidate, setActiveCandidate, activeCitation } = useEngine();

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center space-x-1 border-b border-surface-200 bg-surface-100 px-3 pt-2 overflow-x-auto">
      {candidates.map((cand) => {
        const isActive = activeCandidate?.id === cand.id;
        const hasActiveCitation =
          activeCitation &&
          (activeCitation.candidateId === cand.id ||
            activeCitation.candidateName.toLowerCase().includes(cand.full_name.toLowerCase()));

        return (
          <button
            key={cand.id}
            onClick={() => setActiveCandidate(cand)}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-t-md transition-all border-t border-l border-r truncate max-w-[200px] ${
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
                className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-300 animate-ping shrink-0"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
