"use client";

import React, { useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";

interface TemplatePrompt {
  tag: string;
  title: string;
  text: string;
}

const TEMPLATE_PROMPTS: TemplatePrompt[] = [
  {
    tag: "Event Streaming",
    title: "Event Streaming Scale",
    text: "Compare candidates with high-throughput event streaming and distributed messaging experience.",
  },
  {
    tag: "Microservices Scale",
    title: "Microservices Architecture",
    text: "Who has direct experience scaling distributed microservices in high-availability environments?",
  },
  {
    tag: "Production Maturity",
    title: "Production & System Maturity",
    text: "Evaluate candidate production maturity, architectural ownership, and operational rigor.",
  },
];

export function QueryBar() {
  const {
    query,
    setQuery,
    runSynthesis,
    clearSynthesis,
    isStreaming,
    streamedContent,
    doneData,
    activePool,
    candidates,
  } = useEngine();

  const [hoveredTag, setHoveredTag] = useState<TemplatePrompt | null>(null);

  const hasActiveEvaluation = isStreaming || !!streamedContent || !!doneData;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runSynthesis();
    }
  };

  const isSynthesizeDisabled =
    !query.trim() || isStreaming || !activePool || candidates.length === 0;

  return (
    <div className="space-y-2.5">
      {/* High-Contrast Thumb-Friendly Prompt Input Card */}
      <div className="bg-white border border-[#D6D3C9] rounded-2xl p-2.5 md:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:ring-1 focus-within:ring-stone-900 focus-within:border-stone-900 transition-all">
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
          className="w-full text-base md:text-xs font-medium p-1 bg-transparent border-0 focus:outline-none resize-none placeholder:text-stone-400 text-stone-900 leading-relaxed disabled:cursor-not-allowed"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-stone-100 gap-2">
          {/* Left: Input Helpers & Clear */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            {query && !isStreaming ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  clearSynthesis();
                }}
                className="text-stone-500 hover:text-stone-800 text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear prompt</span>
              </button>
            ) : (
              <span className="text-[11px] text-stone-400 hidden sm:inline">
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
                ? "bg-stone-900 text-white hover:bg-stone-800"
                : "bg-[#E5E3DC] text-[#8A877E] cursor-not-allowed shadow-none"
            }`}
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <span>Synthesize</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Templates Display: Adaptive Layout */}
      {!hasActiveEvaluation ? (
        /* Empty Workspace State: Full-Width Clickable Prompt Cards */
        <div className="space-y-2 pt-1">
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-ink-secondary">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Select a Technical Evaluation Mandate:</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {TEMPLATE_PROMPTS.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(tmpl.text);
                  runSynthesis(tmpl.text);
                }}
                disabled={isStreaming || !activePool || candidates.length === 0}
                className="w-full text-left p-3.5 rounded-xl bg-white hover:bg-surface-50 border border-surface-200 hover:border-amber-700/40 transition-all shadow-2xs group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-primary group-hover:text-amber-900 transition-colors">
                    {tmpl.title}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-ink-secondary mt-1 leading-relaxed">
                  {tmpl.text}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Active Evaluation State: Snap-Scrolling Horizontal Row of Concise Keyword Pills */
        <div className="relative flex items-center gap-2 pt-0.5">
          <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-amber-600" /> Templates:
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto snap-x no-scrollbar py-1">
            {TEMPLATE_PROMPTS.map((tmpl, idx) => (
              <div
                key={idx}
                className="relative inline-block shrink-0 snap-start"
                onMouseEnter={() => setHoveredTag(tmpl)}
                onMouseLeave={() => setHoveredTag(null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setQuery(tmpl.text);
                    runSynthesis(tmpl.text);
                  }}
                  disabled={isStreaming || !activePool || candidates.length === 0}
                  className="text-[11px] font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 px-3 py-1.5 min-h-[36px] sm:min-h-0 rounded-full transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {tmpl.tag}
                </button>

                {/* Frosted Glass Tooltip on Hover */}
                {hoveredTag?.tag === tmpl.tag && (
                  <div className="hidden sm:block absolute bottom-full left-0 mb-2 w-64 p-3 frosted-glass-card z-50 text-[11px] text-stone-900 pointer-events-none shadow-lg animate-in fade-in zoom-in-95 duration-150">
                    <p className="font-semibold text-xs text-stone-900 mb-1">
                      {tmpl.title}
                    </p>
                    <p className="text-stone-600 leading-relaxed">
                      {tmpl.text}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
