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
      {/* High-Contrast Thumb-Friendly Prompt Input Card */}
      <div className="bg-white dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl border border-[#D6D3C9] dark:border-white/10 rounded-2xl p-2.5 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.1)] focus-within:border-stone-900 dark:focus-within:border-amber-400/80 focus-within:ring-2 focus-within:ring-stone-900/10 dark:focus-within:ring-amber-400/10 transition-[border-color,box-shadow] duration-150">
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
          className="w-full appearance-none text-base md:text-xs font-medium p-1 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none placeholder:text-stone-400 dark:placeholder:text-stone-500 text-stone-900 dark:text-stone-100 leading-relaxed disabled:cursor-not-allowed"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-stone-100 dark:border-white/10 gap-2">
          {/* Left: Input Helpers & Clear */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            {query && !isStreaming ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  clearSynthesis();
                }}
                className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear prompt</span>
              </button>
            ) : (
              <span className="text-[11px] text-stone-400 dark:text-stone-500 hidden sm:inline">
                Press Enter to run
              </span>
            )}
          </div>

          {/* Primary CTA: Stacked Full-Width on Mobile, Inline on Desktop */}
          <button
            type="button"
            onClick={() => runSynthesis()}
            disabled={isSynthesizeDisabled}
            className={`w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 text-xs font-semibold px-4 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-lg transition-all shadow-xs cursor-pointer ${
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
    </div>
  );
}
