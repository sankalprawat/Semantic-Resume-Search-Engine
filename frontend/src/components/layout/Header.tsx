"use client";

import React, { useEffect, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { fetchHealth } from "@/lib/api";
import { PoolDropdown } from "@/components/pool/PoolDropdown";
import {
  Briefcase,
  FolderPlus,
  Info,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";

export function Header() {
  const {
    activePool,
    candidates,
    setIsUploadModalOpen,
    setIsCreatePoolOpen,
  } = useEngine();

  const [modelInfo, setModelInfo] = useState<{
    completion_model: string;
    embedding_model: string;
  }>({
    completion_model: "gemini-4-hydrogen",
    embedding_model: "gemini-embedding-2",
  });
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        if (data.completion_model) {
          setModelInfo({
            completion_model: data.completion_model,
            embedding_model: data.embedding_model,
          });
        }
      })
      .catch(() => {
        // Fallback to configured defaults
      });
  }, []);

  const needsPool = !activePool;
  const needsCandidates = Boolean(activePool) && candidates.length === 0;

  return (
    <header className="w-full rounded-2xl md:rounded-full h-auto md:h-[52px] p-2.5 md:px-5 bg-white border border-[#E6E4DD] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3 shrink-0 z-20">
      {/* Row 1 on Mobile / Left on Desktop: Brand Logo, Popover, & Mobile Quick Actions */}
      <div className="flex items-center justify-between w-full md:w-auto gap-2">
        {/* Brand & AI Architecture Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 md:w-7 md:h-7 rounded-full bg-stone-900 flex items-center justify-center shrink-0 shadow-2xs">
            <Briefcase className="w-4 h-4 md:w-3.5 md:h-3.5 text-amber-400" />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="hidden md:block text-xs font-semibold text-stone-900 tracking-tight leading-none truncate">
              Semantic Talent Engine
            </h1>

            {/* Model Information Popover */}
            <div
              className="relative inline-flex items-center"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <button
                type="button"
                onClick={() => setShowTooltip((prev) => !prev)}
                className="text-stone-400 hover:text-stone-800 transition-colors cursor-pointer inline-flex items-center justify-center p-1 rounded-full hover:bg-stone-100"
                aria-label="AI Model Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              {showTooltip && (
                <div className="absolute top-full left-0 mt-2.5 w-72 p-4 z-50 text-[11px] text-stone-900 bg-white/95 backdrop-blur-md border border-[#E6E4DD] rounded-2xl shadow-lg animate-in fade-in zoom-in-95 duration-150 before:absolute before:-top-3 before:left-0 before:w-full before:h-3 frosted-glass-card">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-stone-200/80">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span className="font-semibold text-xs text-stone-900">
                        AI Architecture & Models
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[10px] font-medium tracking-wide">
                        Synthesis & Comparative RAG
                      </span>
                      <span className="font-semibold text-stone-900 text-xs">
                        {modelInfo.completion_model}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[10px] font-medium tracking-wide">
                        Dense Semantic Embeddings
                      </span>
                      <span className="font-semibold text-stone-900">
                        {modelInfo.embedding_model}{" "}
                        <span className="text-[10px] font-normal text-stone-500">
                          (768-dim)
                        </span>
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[10px] font-medium tracking-wide">
                        Vector Indexing
                      </span>
                      <span className="font-medium text-stone-800">
                        Supabase PostgreSQL 17 + pgvector HNSW
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Quick Actions (Right of Row 1) */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <div
            className="inline-flex items-center gap-1 text-[11px] text-stone-600 px-2.5 py-1 rounded-full bg-[#F7F6F2] border border-[#E6E4DD] whitespace-nowrap"
            title="Total resumes indexed in active pool"
          >
            <Users className="w-3 h-3 text-stone-500" />
            <span className="font-semibold text-stone-900 tabular-nums">
              {candidates.length}
            </span>
            <span className="text-[10px] text-stone-500">Indexed</span>
          </div>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            disabled={!activePool}
            title={
              activePool
                ? "Upload candidate PDF resumes"
                : "Select or create a talent pool first"
            }
            className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              needsCandidates
                ? "bg-stone-900 text-white hover:bg-stone-800 border border-stone-900 shadow-xs"
                : "bg-white hover:bg-stone-50 text-stone-900 border border-[#E6E4DD] hover:border-stone-300 disabled:bg-stone-100 disabled:text-stone-400 disabled:border-stone-200 disabled:cursor-not-allowed"
            }`}
          >
            <Plus
              className={`w-3.5 h-3.5 ${
                needsCandidates ? "text-amber-400" : "text-current"
              }`}
            />
            <span>+ Upload</span>
          </button>
        </div>
      </div>

      {/* Row 2 on Mobile / Center on Desktop: Full-Width Pool Selector & Compact + Pool Button */}
      <div className="flex items-center gap-2 w-full md:w-auto">
        <div className="flex-1 min-w-0 md:w-64 md:flex-initial">
          <PoolDropdown />
        </div>

        <button
          type="button"
          onClick={() => setIsCreatePoolOpen(true)}
          title="Create New Talent Pool"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] md:min-h-[34px] rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            needsPool
              ? "bg-stone-900 text-white hover:bg-stone-800 border border-stone-900 shadow-xs"
              : "bg-white hover:bg-stone-50 text-stone-800 border border-[#E6E4DD] hover:border-stone-300"
          }`}
        >
          <FolderPlus
            className={`w-3.5 h-3.5 ${
              needsPool ? "text-amber-400" : "text-stone-600"
            }`}
          />
          <span>+ Pool</span>
        </button>
      </div>

      {/* Desktop-Only Right Actions (Indexed badge & Upload PDFs button) */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <div
          className="inline-flex items-center gap-1.5 text-xs text-stone-600 px-3 py-1.5 rounded-full bg-[#F7F6F2] border border-[#E6E4DD] whitespace-nowrap"
          title="Total resumes indexed in active pool"
        >
          <Users className="w-3.5 h-3.5 text-stone-500" />
          <span className="font-semibold text-stone-900 tabular-nums">
            {candidates.length}
          </span>
          <span className="text-[11px] text-stone-500">Indexed</span>
        </div>

        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          disabled={!activePool}
          title={
            activePool
              ? "Upload candidate PDF resumes"
              : "Select or create a talent pool first"
          }
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            needsCandidates
              ? "bg-stone-900 text-white hover:bg-stone-800 border border-stone-900 shadow-xs cursor-pointer"
              : "bg-white hover:bg-stone-50 text-stone-900 border border-[#E6E4DD] hover:border-stone-300 cursor-pointer disabled:bg-stone-100 disabled:text-stone-400 disabled:border-stone-200 disabled:cursor-not-allowed"
          }`}
        >
          <Plus
            className={`w-3.5 h-3.5 ${
              needsCandidates ? "text-amber-400" : "text-current"
            }`}
          />
          <span>Upload PDFs</span>
        </button>
      </div>
    </header>
  );
}