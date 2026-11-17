"use client";

import React, { useRef } from "react";
import { usePoolData, useWorkspaceUi } from "@/context/EngineContext";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  CheckCircle2,
  FolderPlus,
  Loader2,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";

export function OnboardingCard() {
  const { activePool, candidates, loadSamplePool, isSeedingSample } = usePoolData();
  const { setIsCreatePoolOpen, setIsUploadModalOpen } = useWorkspaceUi();

  return (
    <div className="w-full max-w-xl mx-auto bg-white dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl border border-[#E6E4DD] dark:border-white/12 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.18)] p-5 sm:p-8 transition-all">
      {/* Brand & Introduction */}
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-200/60 dark:bg-white/[0.06] border border-stone-200/70 dark:border-white/10 flex items-center justify-center shadow-2xs mb-3.5 p-1">
          <BrandLogo size="lg" className="w-full h-full" />
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-ink-primary dark:text-stone-100 tracking-tight">
          SemanticPin Intelligence Console
        </h2>
        <p className="text-xs text-ink-secondary dark:text-stone-400 mt-1.5 max-w-md leading-relaxed">
          Dense semantic vector search and multi-candidate comparative briefs powered by{" "}
          <strong className="text-ink-primary dark:text-stone-200 font-semibold">Gemini</strong> and{" "}
          <strong className="text-ink-primary dark:text-stone-200 font-semibold">gemini-embedding-2</strong> with synchronized PDF bounding-box verification.
        </p>
      </div>

      {/* 3-Step Linear Workflow Steps Bar */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1 */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            activePool
              ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-300"
              : "bg-surface-50 dark:bg-[#25221F]/60 dark:backdrop-blur-md border-surface-200 dark:border-white/10 text-ink-primary dark:text-stone-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-stone-400">
              Step 1
            </span>
            {activePool ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <p className="text-xs font-semibold">Select or Create Pool</p>
          <p className="text-[11px] text-ink-muted dark:text-stone-400 mt-0.5 line-clamp-1">
            {activePool ? activePool.title : "Workspace container"}
          </p>
        </div>

        {/* Step 2 */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            candidates.length > 0
              ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-300"
              : activePool
              ? "bg-surface-50 dark:bg-[#25221F]/60 dark:backdrop-blur-md border-amber-300 dark:border-amber-500/50 ring-1 ring-amber-400/30 text-ink-primary dark:text-stone-200"
              : "bg-surface-50/50 dark:bg-[#1E1C1A]/40 border-surface-200/80 dark:border-white/[0.06] text-ink-muted dark:text-stone-500 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-stone-400">
              Step 2
            </span>
            {candidates.length > 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : activePool ? (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            ) : null}
          </div>
          <p className="text-xs font-semibold">Upload Candidate PDFs</p>
          <p className="text-[11px] text-ink-muted dark:text-stone-400 mt-0.5">
            {candidates.length > 0
              ? `${candidates.length} candidate(s) indexed`
              : "0 Indexed"}
          </p>
        </div>

        {/* Step 3 */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            candidates.length > 0
              ? "bg-surface-50 dark:bg-[#25221F]/60 dark:backdrop-blur-md border-surface-200 dark:border-white/10 text-ink-primary dark:text-stone-200"
              : "bg-surface-50/50 dark:bg-[#1E1C1A]/40 border-surface-200/80 dark:border-white/[0.06] text-ink-muted dark:text-stone-500 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-stone-400">
              Step 3
            </span>
          </div>
          <p className="text-xs font-semibold">Run Technical Mandate</p>
          <p className="text-[11px] text-ink-muted dark:text-stone-400 mt-0.5">
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
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-amber-400 dark:text-stone-950" />
            <span>+ Create Talent Pool</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-amber-400 dark:text-stone-950" />
            <span>+ Upload Resumes to &ldquo;{activePool.title}&rdquo;</span>
          </button>
        )}

        {/* Secondary CTA: Try Sample Pool (1-Click Instant Evaluation) */}
        <button
          type="button"
          onClick={loadSamplePool}
          disabled={isSeedingSample}
          className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-surface-50 dark:bg-[#262422]/80 dark:backdrop-blur-md hover:bg-surface-100 dark:hover:bg-[#2F2C29] border border-surface-200 dark:border-white/10 hover:border-surface-300 text-xs font-semibold text-ink-primary dark:text-stone-200 shadow-2xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSeedingSample ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
              <span>Loading Sample Pool...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Try Sample Pool (1-Click)</span>
            </>
          )}
        </button>
      </div>

      {/* Helper Footer Note */}
      <div className="mt-6 pt-4 border-t border-surface-100 dark:border-white/10 flex items-center justify-center space-x-2 text-[11px] text-ink-muted dark:text-stone-400">
        <Users className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
        <span>
          Sample pool includes 3 pre-indexed engineering profiles (Kafka Streaming, CockroachDB, and High-Throughput SRE).
        </span>
      </div>
    </div>
  );
}
