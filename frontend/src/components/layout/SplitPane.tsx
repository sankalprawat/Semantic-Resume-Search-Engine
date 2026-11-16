"use client";

import React from "react";
import { QueryBar } from "@/components/synthesis/QueryBar";
import { SynthesisStream } from "@/components/synthesis/SynthesisStream";
import { CandidateTabs } from "@/components/viewer/CandidateTabs";
import { GroundedPdfViewer } from "@/components/viewer/GroundedPdfViewer";

export function SplitPane() {
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden gap-3.5 w-full">
      {/* Left Pane: Recruiter Command & Comparative Synthesis Console */}
      <section className="flex-1 md:w-1/2 flex flex-col min-h-0 gap-3.5">
        <QueryBar />
        <SynthesisStream />
      </section>

      {/* Right Pane: Interactive Grounded PDF Evidence Inspector */}
      <section className="flex-1 md:w-1/2 flex flex-col min-h-0 rounded-lg border border-surface-200 bg-white shadow-2xs overflow-hidden">
        <CandidateTabs />
        <GroundedPdfViewer />
      </section>
    </div>
  );
}
