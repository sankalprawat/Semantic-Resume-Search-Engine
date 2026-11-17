"use client";

import React from "react";
import { useEngine } from "@/context/EngineContext";
import { QueryBar } from "@/components/synthesis/QueryBar";
import { SynthesisStream } from "@/components/synthesis/SynthesisStream";
import { CandidateTabs } from "@/components/viewer/CandidateTabs";
import { GroundedPdfViewer } from "@/components/viewer/GroundedPdfViewer";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { FileText } from "lucide-react";

export function SplitPane() {
  const { candidates, activeCandidate, activeCitation } = useEngine();

  // State 1 (Progressive Disclosure): 0 Candidates Indexed -> Focused Centered Onboarding
  if (candidates.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-y-auto py-6 animate-in fade-in duration-300">
        <OnboardingCard />
      </div>
    );
  }

  // State 2: Candidates Indexed -> 50/50 Dual-Pane Recruiter Console
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden gap-3.5 w-full animate-in fade-in duration-300">
      {/* Left Pane: Recruiter Command & Comparative Synthesis Console */}
      <section className="flex-1 md:w-1/2 flex flex-col min-h-0 gap-3">
        <QueryBar />
        <SynthesisStream />
      </section>

      {/* Right Pane: Interactive Grounded PDF Evidence Inspector */}
      <section className="flex-1 md:w-1/2 flex flex-col min-h-0 rounded-2xl border border-surface-200 bg-white shadow-2xs overflow-hidden">
        {/* Persistent Top Header Bar Matching Left Pane Header */}
        <div className="px-4 py-2.5 border-b border-surface-200 bg-surface-50 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-stone-700" />
            <span className="font-semibold text-ink-primary">
              Original PDF Inspector
            </span>
            {activeCandidate && (
              <span className="text-[11px] text-ink-muted hidden sm:inline">
                · {activeCandidate.filename} ({activeCandidate.page_count}{" "}
                {activeCandidate.page_count === 1 ? "page" : "pages"})
              </span>
            )}
          </div>

          {activeCitation && (
            <span className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              <span>Highlight Synced</span>
            </span>
          )}
        </div>

        {/* Candidate Tabs Strip */}
        <CandidateTabs />

        {/* PDF Canvas Viewport with Synchronized Bounding Box Overlays */}
        <GroundedPdfViewer />
      </section>
    </div>
  );
}
