"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePoolData, useSynthesis } from "@/context/EngineContext";
import { QueryBar } from "@/components/synthesis/QueryBar";
import { SynthesisStream } from "@/components/synthesis/SynthesisStream";
import { ArrowLeft, FileText, Loader2, Sparkles, X } from "lucide-react";

const GroundedPdfViewer = dynamic(
  () =>
    import("@/components/viewer/GroundedPdfViewer").then(
      (m) => m.GroundedPdfViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-stone-500 dark:text-stone-400">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600 dark:text-amber-400 mb-2" />
        <span className="text-xs font-medium">Loading PDF Inspector...</span>
      </div>
    ),
  }
);

export function SplitPane() {
  const { candidates, activeCandidate } = usePoolData();
  const { activeCitation } = useSynthesis();
  const [mobileView, setMobileView] = useState<"brief" | "inspector">("brief");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // When a citation badge is clicked on mobile/tablet (< 1024px), open the slide-up drawer
  useEffect(() => {
    if (activeCitation) {
      // Check if we are on mobile/tablet viewport
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setIsDrawerOpen(true);
      }
    }
  }, [activeCitation]);

  // Right pane inspector component (reusable for desktop pane & mobile drawer)
  const renderPdfInspector = () => (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl overflow-hidden">
      <GroundedPdfViewer />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden animate-in fade-in duration-300">
      {/* Segmented Tab Bar on Mobile & Tablet (< 1024px) */}
      <div className="lg:hidden flex items-center p-1 bg-surface-100 dark:bg-[#1E1C1A]/60 dark:backdrop-blur-md border border-surface-200 dark:border-white/10 rounded-xl mb-2 shrink-0">
        <button
          type="button"
          onClick={() => setMobileView("brief")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5 ${
            mobileView === "brief"
              ? "bg-white dark:bg-[#262422] text-ink-primary dark:text-stone-100 shadow-xs"
              : "text-ink-secondary dark:text-stone-400 hover:text-ink-primary dark:hover:text-stone-100"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Comparative Brief</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileView("inspector")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5 ${
            mobileView === "inspector"
              ? "bg-white dark:bg-[#262422] text-ink-primary dark:text-stone-100 shadow-xs"
              : "text-ink-secondary dark:text-stone-400 hover:text-ink-primary dark:hover:text-stone-100"
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
          <span>PDF Inspector ({candidates.length})</span>
        </button>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden gap-3 w-full">
        {/* Left Pane (Comparative Synthesis Brief) */}
        <section
          className={`flex-1 lg:w-1/2 flex flex-col min-h-0 gap-2.5 ${
            mobileView === "brief" ? "flex" : "hidden lg:flex"
          }`}
        >
          <QueryBar />
          <SynthesisStream />
        </section>

        {/* Right Pane (Desktop Dual-Pane / Mobile Active View) */}
        <section
          className={`flex-1 lg:w-1/2 flex flex-col min-h-0 rounded-2xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl shadow-2xs dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] overflow-hidden ${
            mobileView === "inspector" ? "flex" : "hidden lg:flex"
          }`}
        >
          {renderPdfInspector()}
        </section>
      </div>

      {/* Slide-Up PDF Evidence Drawer on Mobile (< 1024px) */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 frosted-glass-overlay cursor-pointer"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Slide-Up Sheet */}
          <div className="relative w-full h-[86dvh] max-h-[86dvh] bg-white dark:bg-[#1E1C1A]/85 dark:backdrop-blur-2xl rounded-t-3xl border-t border-[#E6E4DD] dark:border-white/15 shadow-2xl overflow-hidden flex flex-col z-10 animate-in slide-in-from-bottom duration-300">
            {/* Sticky Header with Back to Brief Action */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-surface-50 dark:bg-[#25221F]/80 border-b border-surface-200 dark:border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 bg-white dark:bg-[#2A2724] hover:bg-stone-50 dark:hover:bg-[#332F2B] border border-surface-200 dark:border-[#38342F] px-3.5 py-1.5 rounded-full shadow-2xs cursor-pointer min-h-[36px]"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>← Back to Brief</span>
              </button>

              {activeCitation && (
                <div className="flex items-center space-x-1.5 text-[11px] font-medium text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-full truncate max-w-[180px] sm:max-w-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse shrink-0" />
                  <span className="truncate">
                    {activeCitation.candidateName} · p.{activeCitation.pageNumber}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content within drawer */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <GroundedPdfViewer />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
