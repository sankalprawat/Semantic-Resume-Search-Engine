"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEngine } from "@/context/EngineContext";
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
  const {
    streamedContent,
    isStreaming,
    doneData,
    streamError,
    activePool,
    candidates,
  } = useEngine();

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
        <p className="text-xs text-ink-primary leading-relaxed mb-3">
          {React.Children.map(children, (child) => renderTextWithBadges(child))}
        </p>
      ),
      li: ({ children }: any) => (
        <li className="text-xs text-ink-primary leading-relaxed mb-1.5 list-disc ml-4">
          {React.Children.map(children, (child) => renderTextWithBadges(child))}
        </li>
      ),
      h1: ({ children }: any) => (
        <h1 className="text-sm font-bold text-ink-primary tracking-tight mt-4 mb-2 pb-1 border-b border-surface-200">
          {children}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="text-xs font-semibold text-ink-primary tracking-tight mt-4 mb-2">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="text-xs font-semibold text-stone-800 tracking-tight mt-3 mb-1.5">
          {children}
        </h3>
      ),
      table: ({ children }: any) => (
        <div className="overflow-x-auto my-3 border border-surface-200 rounded-md">
          <table className="w-full text-[11px] border-collapse bg-white">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: any) => (
        <thead className="bg-surface-100 text-ink-primary font-semibold border-b border-surface-200">
          {children}
        </thead>
      ),
      th: ({ children }: any) => (
        <th className="px-2.5 py-1.5 text-left border-r border-surface-200 last:border-r-0">
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td className="px-2.5 py-1.5 border-t border-surface-200 border-r border-surface-200 last:border-r-0 text-ink-secondary">
          {React.Children.map(children, (child) => renderTextWithBadges(child))}
        </td>
      ),
      strong: ({ children }: any) => (
        <strong className="font-semibold text-ink-primary">{children}</strong>
      ),
    }),
    [doneData, candidates]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border border-surface-200 shadow-2xs overflow-hidden">
      {/* Trust & Grounding Status Bar */}
      <div className="px-4 py-2.5 border-b border-surface-200 bg-surface-50 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <FileCheck2 className="w-4 h-4 text-stone-700" />
          <span className="font-medium text-ink-primary">
            Comparative Synthesis Brief
          </span>
          {isStreaming && (
            <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              <span>Streaming Gemini-4...</span>
            </span>
          )}
        </div>

        {doneData && (
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{doneData.grounding_score.toFixed(0)}% Verifiable</span>
            </span>
            <span className="text-[11px] text-ink-muted">
              {doneData.total_citations} Verified Citations
            </span>
            {doneData.hallucinations_detected > 0 && (
              <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                <ShieldAlert className="w-3 h-3 text-red-600" />
                <span>{doneData.hallucinations_detected} Unverified</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-5 overflow-y-auto">
        {streamError && (
          <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
            <strong>Evaluation Error:</strong> {streamError}
          </div>
        )}

        {streamedContent ? (
          <div className="prose-xs max-w-none text-ink-primary">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {streamedContent}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 bg-amber-600 animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-ink-muted">
            <div className="w-12 h-12 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center text-ink-muted mb-3">
              <Layers className="w-6 h-6 text-stone-500" />
            </div>
            <h3 className="text-xs font-semibold text-ink-primary">
              No Comparative Evaluation Active
            </h3>
            <p className="text-[11px] text-ink-muted max-w-sm mt-1">
              Select or type a hiring mandate above and click{" "}
              <strong className="text-ink-secondary">Synthesize</strong> to stream a
              side-by-side comparative brief with clickable PDF evidence badges.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
