"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePoolData, useSynthesis } from "@/context/EngineContext";
import { CitationBadge } from "./CitationBadge";
import {
  CheckCircle2,
  FileCheck2,
  Layers,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

const CITATION_REGEX = /\[Candidate:\s*([^|\]]+)\s*\|\s*Chunk:\s*([A-Za-z0-9_-]+)\]/g;

export function SynthesisStream() {
  const { activePool, candidates } = usePoolData();
  const { streamedContent, isStreaming, doneData, streamError } = useSynthesis();

  // Custom text transformer that converts [Candidate: Name | Chunk: CX] into interactive badges
  const renderTextWithBadges = (children: React.ReactNode) => {
    if (typeof children !== "string") {
      return children;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(CITATION_REGEX);

    while ((match = regex.exec(children)) !== null) {
      const matchStart = match.index;
      const matchEnd = regex.lastIndex;

      if (matchStart > lastIndex) {
        parts.push(children.substring(lastIndex, matchStart));
      }

      const candName = match[1].trim();
      const chunkId = match[2].trim();
      parts.push(
        <CitationBadge
          key={`${candName}-${chunkId}-${matchStart}`}
          candidateName={candName}
          chunkId={chunkId}
        />
      );

      lastIndex = matchEnd;
    }

    if (lastIndex < children.length) {
      parts.push(children.substring(lastIndex));
    }

    return parts;
  };

  const markdownComponents = useMemo(
    () => ({
      p: ({ children }: any) => (
        <p className="text-xs text-ink-primary dark:text-stone-200 leading-relaxed mb-3">
          {React.Children.map(children, (child) => renderTextWithBadges(child))}
        </p>
      ),
      li: ({ children }: any) => (
        <li className="text-xs text-ink-primary dark:text-stone-200 leading-relaxed mb-1.5 list-disc ml-4">
          {React.Children.map(children, (child) => renderTextWithBadges(child))}
        </li>
      ),
      h1: ({ children }: any) => (
        <h1 className="text-sm font-bold text-ink-primary dark:text-stone-100 tracking-tight mt-4 mb-2 pb-1 border-b border-surface-200 dark:border-[#2E2B27]">
          {children}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="text-xs font-semibold text-ink-primary dark:text-stone-100 tracking-tight mt-4 mb-2">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="text-xs font-semibold text-stone-800 dark:text-stone-200 tracking-tight mt-3 mb-1.5">
          {children}
        </h3>
      ),
      table: ({ children }: any) => (
        <div className="overflow-x-auto my-3 border border-surface-200 dark:border-white/10 rounded-xl overflow-hidden shadow-xs dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
          <table className="w-full text-[11px] border-collapse bg-white dark:bg-[#1E1C1A]/50">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: any) => (
        <thead className="bg-surface-100 dark:bg-[#282522]/80 text-ink-primary dark:text-stone-100 font-semibold border-b border-surface-200 dark:border-white/10">
          {children}
        </thead>
      ),
      th: ({ children }: any) => (
        <th className="px-2.5 py-1.5 text-left border-r border-surface-200 dark:border-white/10 last:border-r-0">
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td className="px-2.5 py-1.5 border-t border-surface-200 dark:border-white/10 border-r border-surface-200 dark:border-white/10 last:border-r-0 text-ink-secondary dark:text-stone-300">
          {React.Children.map(children, (child) => renderTextWithBadges(child))}
        </td>
      ),
      strong: ({ children }: any) => (
        <strong className="font-semibold text-ink-primary dark:text-stone-100">{children}</strong>
      ),
    }),
    [doneData, candidates]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl rounded-2xl border border-surface-200 dark:border-white/10 shadow-2xs dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] overflow-hidden">
      {/* Trust & Grounding Status Bar */}
      <div className="px-4 py-2.5 border-b border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-[#25221F]/70 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <FileCheck2 className="w-4 h-4 text-stone-700 dark:text-amber-400" />
          <span className="font-medium text-ink-primary dark:text-stone-100">
            Comparative Synthesis Brief
          </span>
          {isStreaming && (
            <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              <span>Streaming Gemini-4...</span>
            </span>
          )}
        </div>

        {doneData && (
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{doneData.grounding_score.toFixed(0)}% Verifiable</span>
            </span>
            <span className="text-[11px] text-ink-muted dark:text-stone-400">
              {doneData.total_citations} Verified Citations
            </span>
            {doneData.hallucinations_detected > 0 && (
              <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800/40">
                <ShieldAlert className="w-3 h-3 text-red-600 dark:text-red-400" />
                <span>{doneData.hallucinations_detected} Unverified</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-5 overflow-y-auto">
        {streamError && (
          <div className="p-3 mb-4 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300">
            <strong>Evaluation Error:</strong> {streamError}
          </div>
        )}

        {streamedContent ? (
          <div className="prose-xs max-w-none text-ink-primary dark:text-stone-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {streamedContent}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 bg-amber-600 dark:bg-amber-400 animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-ink-muted dark:text-stone-400">
            <div className="w-12 h-12 rounded-full bg-surface-100 dark:bg-[#262422] border border-surface-200 dark:border-[#2E2B27] flex items-center justify-center text-ink-muted dark:text-stone-400 mb-3">
              <Layers className="w-6 h-6 text-stone-500 dark:text-stone-400" />
            </div>
            <h3 className="text-xs font-semibold text-ink-primary dark:text-stone-100">
              No Comparative Evaluation Active
            </h3>
            <p className="text-[11px] text-ink-muted dark:text-stone-400 max-w-sm mt-1">
              Select or type a hiring mandate above and click{" "}
              <strong className="text-ink-secondary dark:text-stone-300">Synthesize</strong> to stream a
              side-by-side comparative brief with clickable PDF evidence badges.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
