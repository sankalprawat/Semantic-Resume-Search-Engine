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
    <header className="w-full h-14 bg-white/95 border border-surface-200/90 rounded-full px-5 shadow-xs flex items-center justify-between shrink-0 z-20">
      {/* Brand & Mandate */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center text-white shadow-2xs">
          <Briefcase className="w-4 h-4 text-amber-400" />
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

        {/* Center: Custom Pool Selector & Switcher */}
        <div className="flex items-center space-x-2">
          <PoolDropdown />

          <button
            onClick={() => setIsCreatePoolOpen(true)}
            title="Create New Talent Pool"
            className="p-1.5 rounded-full hover:bg-surface-100 border border-surface-200 text-ink-secondary hover:text-ink-primary transition-colors shadow-2xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-stone-700" />
          </button>
        </div>

        {/* Right: Actions & Vitals */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs text-ink-secondary px-3 py-1.5 rounded-full bg-surface-50 border border-surface-200">
            <Users className="w-3.5 h-3.5 text-stone-600" />
            <span className="font-semibold text-ink-primary">
              {candidates.length}
            </span>
            <span className="text-[11px] text-ink-muted">Indexed</span>
          </div>

          {/* Expanding "+" to "+ Upload Resumes" Pill Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            disabled={!activePool}
            aria-label="Upload Resumes"
            className="group h-8 rounded-full bg-surface-50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 text-stone-700 hover:text-stone-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center transition-all duration-300 ease-in-out shadow-2xs cursor-pointer overflow-hidden"
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-stone-700 transition-transform duration-300 group-hover:rotate-90" />
            </div>
            <div className="max-w-0 group-hover:max-w-[140px] opacity-0 group-hover:opacity-100 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out pr-0 group-hover:pr-3.5 text-xs font-medium text-ink-primary">
              Upload Resumes
            </div>
          </button>
        </div>
      </header>
  );
}
