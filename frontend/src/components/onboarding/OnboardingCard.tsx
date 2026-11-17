"use client";

import React, { useRef } from "react";
import { useEngine } from "@/context/EngineContext";
import {
  Briefcase,
  CheckCircle2,
  FolderPlus,
  Loader2,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";

export function OnboardingCard() {
  const {
    activePool,
    candidates,
    setIsCreatePoolOpen,
    setIsUploadModalOpen,
    loadSamplePool,
    isSeedingSample,
  } = useEngine();

  return (
    <div className="w-full max-w-[760px] mx-auto bg-white border border-[#E6E4DD] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 transition-all">
      {/* Brand & Introduction */}
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white shadow-2xs mb-4">
          <Briefcase className="w-6 h-6 text-amber-400" />
        </div>

        <h2 className="text-xl font-bold text-ink-primary tracking-tight">
          Semantic Talent Intelligence Console
        </h2>
        <p className="text-xs text-ink-secondary mt-1.5 max-w-lg leading-relaxed">
          Dense semantic vector search and multi-candidate comparative briefs powered by{" "}
          <strong className="text-ink-primary font-semibold">Gemini 2.5 Flash</strong> and{" "}
          <strong className="text-ink-primary font-semibold">gemini-embedding-2</strong> with synchronized PDF bounding-box verification.
        </p>
      </div>

      {/* 3-Step Linear Workflow Steps Bar */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1 */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            activePool
              ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
              : "bg-surface-50 border-surface-200 text-ink-primary"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Step 1
            </span>
            {activePool ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <p className="text-xs font-semibold">Select or Create Pool</p>
          <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-1">
            {activePool ? activePool.title : "Workspace container"}
          </p>
        </div>

        {/* Step 2 */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            candidates.length > 0
              ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
              : activePool
              ? "bg-surface-50 border-amber-300 ring-1 ring-amber-400/30 text-ink-primary"
              : "bg-surface-50/50 border-surface-200/80 text-ink-muted opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Step 2
            </span>
            {candidates.length > 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : activePool ? (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            ) : null}
          </div>
          <p className="text-xs font-semibold">Upload Candidate PDFs</p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            {candidates.length > 0
              ? `${candidates.length} candidate(s) indexed`
              : "0 Indexed"}
          </p>
        </div>

        {/* Step 3 */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            candidates.length > 0
              ? "bg-surface-50 border-surface-200 text-ink-primary"
              : "bg-surface-50/50 border-surface-200/80 text-ink-muted opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Step 3
            </span>
          </div>
          <p className="text-xs font-semibold">Run Technical Mandate</p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Comparative RAG synthesis
          </p>
        </div>
      </div>

      {/* Actionable CTAs */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        {/* Primary CTA: Create Talent Pool or Upload PDFs */}
        {!activePool ? (
          <button
            type="button"
            onClick={() => setIsCreatePoolOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" />
            <span>+ Create Talent Pool</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-amber-400" />
            <span>+ Upload Resumes to &ldquo;{activePool.title}&rdquo;</span>
          </button>
        )}

        {/* Secondary CTA: Try Sample Pool (1-Click Instant Evaluation) */}
        <button
          type="button"
          onClick={loadSamplePool}
          disabled={isSeedingSample}
          className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-surface-50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 text-xs font-semibold text-ink-primary shadow-2xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSeedingSample ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
              <span>Loading Sample Pool...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Try Sample Pool (1-Click)</span>
            </>
          )}
        </button>
      </div>

      {/* Helper Footer Note */}
      <div className="mt-6 pt-4 border-t border-surface-100 flex items-center justify-center space-x-2 text-[11px] text-ink-muted">
        <Users className="w-3.5 h-3.5 text-stone-500" />
        <span>
          Sample pool includes 3 pre-indexed engineering profiles (Kafka Streaming, CockroachDB, and High-Throughput SRE).
        </span>
      </div>
    </div>
  );
}
