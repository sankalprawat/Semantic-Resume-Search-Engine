"use client";

import React from "react";
import { useEngine } from "@/context/EngineContext";
import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";

const SUGGESTED_MANDATES = [
  "Compare candidates with high-throughput event streaming (Kafka/Pulsar) vs distributed database clustering.",
  "Who has direct experience scaling distributed microservices to 100k+ QPS with zero downtime?",
  "Evaluate candidate production maturity, architectural trade-offs, and incident response leadership.",
];

export function QueryBar() {
  const {
    query,
    setQuery,
    runSynthesis,
    clearSynthesis,
    isStreaming,
    activePool,
    candidates,
  } = useEngine();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runSynthesis();
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Input box */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming || !activePool}
          placeholder={
            !activePool
              ? "Select or create a talent pool to begin..."
              : candidates.length === 0
              ? "Upload candidate resumes first to enable evaluation..."
              : "Enter technical hiring mandate (e.g. Compare candidates with Kafka vs Raft consensus)..."
          }
          className="w-full text-xs font-medium pl-3.5 pr-24 py-2.5 rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-colors placeholder:text-ink-muted shadow-2xs disabled:bg-surface-100 disabled:cursor-not-allowed"
        />

        <div className="absolute right-1.5 flex items-center space-x-1">
          {query && !isStreaming && (
            <button
              onClick={() => {
                setQuery("");
                clearSynthesis();
              }}
              title="Clear input"
              className="p-1 rounded text-ink-muted hover:text-ink-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => runSynthesis()}
            disabled={!query.trim() || isStreaming || !activePool || candidates.length === 0}
            className="inline-flex items-center space-x-1 text-xs font-medium px-3 py-1.5 rounded-md bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <span>Synthesize</span>
                <ArrowRight className="w-3 h-3 text-amber-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] font-medium text-ink-muted flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-amber-600" /> Templates:
        </span>
        {SUGGESTED_MANDATES.map((mandate, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuery(mandate);
              runSynthesis(mandate);
            }}
            disabled={isStreaming || !activePool || candidates.length === 0}
            className="text-[11px] text-ink-secondary hover:text-ink-primary bg-surface-100 hover:bg-surface-200/80 border border-surface-200 px-2 py-0.5 rounded-full transition-colors truncate max-w-[280px] disabled:opacity-40 text-left"
          >
            {mandate}
          </button>
        ))}
      </div>
    </div>
  );
}
