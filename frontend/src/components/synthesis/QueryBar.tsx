"use client";

import React from "react";
import { usePoolData, useSynthesis } from "@/context/EngineContext";
import { ArrowRight, Loader2, X } from "lucide-react";

export function QueryBar() {
  const { activePool, candidates } = usePoolData();
  const {
    query,
    setQuery,
    runSynthesis,
    clearSynthesis,
    isStreaming,
  } = useSynthesis();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runSynthesis();
    }
  };

  const isSynthesizeDisabled =
    !query.trim() || isStreaming || !activePool || candidates.length === 0;

  return (
    <div className="w-full">
      {/* Sleek Compact Inline Prompt Card */}
      <div className="bg-white dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl border border-[#D6D3C9] dark:border-white/10 rounded-2xl p-2 sm:p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.1)] focus-within:border-stone-900 dark:focus-within:border-amber-400/80 focus-within:ring-2 focus-within:ring-stone-900/10 dark:focus-within:ring-amber-400/10 transition-[border-color,box-shadow] duration-150 flex items-center gap-2">
        <div className="relative flex-1 min-w-0 flex items-center">
          <textarea
            rows={2}
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
            className="w-full appearance-none text-xs font-medium py-1 px-1.5 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none placeholder:text-stone-400 dark:placeholder:text-stone-500 text-stone-900 dark:text-stone-100 leading-relaxed disabled:cursor-not-allowed"
          />
          {query && !isStreaming && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                clearSynthesis();
              }}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 rounded-md transition-colors shrink-0 ml-1 cursor-pointer"
              title="Clear prompt"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Primary CTA: Synthesize Button Inline Beside Input */}
        <button
          type="button"
          onClick={() => runSynthesis()}
          disabled={isSynthesizeDisabled}
          className={`shrink-0 inline-flex items-center justify-center space-x-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer ${
            !isSynthesizeDisabled
              ? "bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400"
              : "bg-[#E5E3DC] dark:bg-[#262422] text-[#8A877E] dark:text-stone-600 cursor-not-allowed shadow-none"
          }`}
        >
          {isStreaming ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 dark:text-stone-950" />
              <span>Evaluating...</span>
            </>
          ) : (
            <>
              <span>Synthesize</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400 dark:text-stone-950" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
