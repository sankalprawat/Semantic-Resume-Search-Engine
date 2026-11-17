"use client";

import React, { useEffect, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { fetchHealth } from "@/lib/api";
import { PoolDropdown } from "@/components/pool/PoolDropdown";
import {
  Briefcase,
  ChevronDown,
  FolderPlus,
  Info,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";

export function Header() {
  const {
    pools,
    activePool,
    setActivePool,
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

  return (
    <header className="w-full h-[52px] bg-white border border-[#E6E4DD] rounded-full px-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center justify-between shrink-0 z-20">
      {/* Brand & Mandate */}
      <div className="flex items-center space-x-3">
        <div className="w-7 h-7 rounded-full bg-stone-900 flex items-center justify-center text-white shadow-2xs">
          <Briefcase className="w-3.5 h-3.5 text-amber-400" />
        </div>

        <div className="flex items-center gap-1.5">
          <h1 className="text-xs font-semibold text-ink-primary tracking-tight leading-none">
            Semantic Talent Engine
          </h1>

          {/* Model Information Icon with Frosted Glass Hover/Click Popover */}
          <div
            className="relative inline-flex items-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <button
              type="button"
              onClick={() => setShowTooltip((prev) => !prev)}
              className="text-ink-muted hover:text-ink-primary transition-colors cursor-pointer inline-flex items-center justify-center p-0.5 rounded"
              aria-label="AI Model Information"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {showTooltip && (
              <div
                className="absolute top-full left-0 mt-3 w-72 p-4 z-50 text-[11px] text-ink-primary font-sans animate-in fade-in zoom-in-95 duration-150 before:absolute before:-top-3 before:left-0 before:w-full before:h-3 frosted-glass-card"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-stone-900/10">
                    <Sparkles className="w-3.5 h-3.5 text-stone-700" />
                    <span className="font-semibold text-xs text-ink-primary">
                      AI Architecture & Models
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-secondary block text-[10px] font-medium tracking-wide">
                      Synthesis & Comparative RAG
                    </span>
                    <span className="font-semibold text-ink-primary text-xs">
                      {modelInfo.completion_model}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-secondary block text-[10px] font-medium tracking-wide">
                      Dense Semantic Embeddings
                    </span>
                    <span className="font-semibold text-ink-primary">
                      {modelInfo.embedding_model}{" "}
                      <span className="text-[10px] font-normal text-ink-muted">
                        (768-dim)
                      </span>
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-secondary block text-[10px] font-medium tracking-wide">
                      Vector Indexing
                    </span>
                    <span className="font-medium text-ink-primary">
                      Supabase PostgreSQL 17 + pgvector HNSW
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center: Custom Pool Selector & Labeled New Pool Action */}
      <div className="flex items-center space-x-2">
        <PoolDropdown />

        <button
          type="button"
          onClick={() => setIsCreatePoolOpen(true)}
          title="Create New Talent Pool"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-surface-100 border border-surface-200 hover:border-surface-300 text-xs font-medium text-ink-primary transition-all shadow-2xs cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5 text-stone-700" />
          <span>New Pool</span>
        </button>
      </div>

      {/* Right: Actions & Vitals */}
      <div className="flex items-center space-x-2.5">
        {/* Candidates Indexed Badge */}
        <div className="flex items-center space-x-1.5 text-xs text-ink-secondary px-3 py-1.5 rounded-full bg-surface-50 border border-surface-200">
          <Users className="w-3.5 h-3.5 text-stone-600" />
          <span className="font-semibold text-ink-primary">
            {candidates.length}
          </span>
          <span className="text-[11px] text-ink-muted">Indexed</span>
        </div>

        {/* Explicitly Labeled "+ Upload PDFs" Button */}
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          disabled={!activePool}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-surface-100 border border-surface-200 hover:border-surface-300 text-xs font-semibold text-ink-primary transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-stone-800" />
          <span>+ Upload PDFs</span>
        </button>
      </div>
    </header>
  );
}
