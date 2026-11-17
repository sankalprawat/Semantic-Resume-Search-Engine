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
    tag: "Microservices Architecture",
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runSynthesis();
    }
  };

  const isSynthesizeDisabled =
    !query.trim() || isStreaming || !activePool || candidates.length === 0;

  return (
    <div className="space-y-3">
      {/* High-Contrast Prompt Input Bar */}
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
          className="w-full text-xs font-medium pl-3.5 pr-28 py-2.5 rounded-xl border border-[#D6D3C9] bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all placeholder:text-ink-muted shadow-[0_1px_2px_rgba(0,0,0,0.03)] disabled:bg-surface-100 disabled:border-surface-200 disabled:cursor-not-allowed"
        />

        <div className="absolute right-1.5 flex items-center space-x-1.5">
          {query && !isStreaming && (
            <button
              onClick={() => {
                setQuery("");
                clearSynthesis();
              }}
              title="Clear input"
              className="p-1 rounded-full text-ink-muted hover:text-ink-primary hover:bg-surface-100 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Primary CTA (Synthesize ->) */}
          <button
            onClick={() => runSynthesis()}
            disabled={isSynthesizeDisabled}
            className={`inline-flex items-center space-x-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all shadow-xs cursor-pointer ${
              !isSynthesizeDisabled
                ? "bg-stone-900 text-white hover:bg-stone-800"
                : "bg-[#E5E3DC] text-[#8A877E] cursor-not-allowed shadow-none"
            }`}
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
                className="w-full text-left p-3 rounded-xl bg-white hover:bg-surface-50 border border-surface-200 hover:border-amber-700/40 transition-all shadow-2xs group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        /* Active Evaluation State: Concise Horizontal Keyword Tags with Hover Tooltips */
        <div className="relative flex items-center space-x-2 pt-0.5">
          <span className="text-[11px] font-medium text-ink-muted flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-amber-600" /> Templates:
          </span>

          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            {TEMPLATE_PROMPTS.map((tmpl, idx) => (
              <div
                key={idx}
                className="relative inline-block"
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
                  className="text-[11px] font-medium text-ink-secondary hover:text-ink-primary bg-white hover:bg-surface-100 border border-surface-200 px-2.5 py-1 rounded-full transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tmpl.tag}
                </button>

                {/* Frosted Glass Tooltip on Hover */}
                {hoveredTag?.tag === tmpl.tag && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 p-3 frosted-glass-card z-50 text-[11px] text-ink-primary pointer-events-none shadow-lg animate-in fade-in zoom-in-95 duration-150">
                    <p className="font-semibold text-xs text-ink-primary mb-1">
                      {tmpl.title}
                    </p>
                    <p className="text-ink-secondary leading-relaxed">
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
