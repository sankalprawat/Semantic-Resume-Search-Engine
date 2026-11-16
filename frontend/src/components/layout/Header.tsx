"use client";

import React, { useEffect, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { fetchHealth } from "@/lib/api";
import {
  Briefcase,
  ChevronDown,
  FolderPlus,
  Info,
  PlusCircle,
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
    <div className="pt-3 px-4 shrink-0 z-20">
      <header className="max-w-7xl mx-auto h-13 bg-white/95 backdrop-blur-md border border-surface-200/90 rounded-full px-5 shadow-xs flex items-center justify-between transition-all">
        {/* Brand & Mandate */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center text-white shadow-2xs">
            <Briefcase className="w-4 h-4 text-amber-400" />
          </div>

          <div className="flex items-center space-x-2">
            <h1 className="text-xs font-semibold text-ink-primary tracking-tight">
              Semantic Talent Engine
            </h1>

            {/* Model Information Icon with Hover Tooltip */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <button
                type="button"
                className="text-ink-muted hover:text-stone-800 p-1 rounded-full transition-colors cursor-help"
                aria-label="AI Model Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              {showTooltip && (
                <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-stone-900 text-stone-100 text-[11px] rounded-lg shadow-lg border border-stone-800 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-400 mb-1.5 pb-1 border-b border-stone-800">
                    <Sparkles className="w-3 h-3" />
                    <span>AI Engine Architecture</span>
                  </div>
                  <div className="space-y-1.5 text-stone-300">
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase tracking-wider">
                        Synthesis Model
                      </span>
                      <span className="font-mono text-amber-200">
                        {modelInfo.completion_model}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase tracking-wider">
                        Dense Embeddings
                      </span>
                      <span className="font-mono text-stone-200">
                        {modelInfo.embedding_model} (768-dim)
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase tracking-wider">
                        Vector Database
                      </span>
                      <span className="text-stone-200">
                        Supabase PostgreSQL 17 + pgvector HNSW
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Pool Selector & Switcher */}
        <div className="flex items-center space-x-2">
          <div className="relative flex items-center">
            <label htmlFor="pool-select" className="sr-only">
              Select Talent Pool
            </label>
            <select
              id="pool-select"
              value={activePool?.id || ""}
              onChange={(e) => {
                const selected = pools.find((p) => p.id === e.target.value);
                if (selected) setActivePool(selected);
              }}
              className="appearance-none bg-surface-50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 text-ink-primary text-xs font-medium rounded-full pl-3.5 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors shadow-2xs cursor-pointer min-w-[200px]"
            >
              {pools.length === 0 ? (
                <option value="" disabled>
                  No Talent Pools Found
                </option>
              ) : (
                pools.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.candidate_count} candidates)
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-ink-secondary absolute right-3 pointer-events-none" />
          </div>

          <button
            onClick={() => setIsCreatePoolOpen(true)}
            title="Create New Talent Pool"
            className="p-1.5 rounded-full hover:bg-surface-100 border border-surface-200 text-ink-secondary hover:text-ink-primary transition-colors shadow-2xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-stone-700" />
          </button>
        </div>

        {/* Right: Actions & Vitals */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 text-xs text-ink-secondary px-3 py-1 rounded-full bg-surface-100 border border-surface-200">
            <Users className="w-3.5 h-3.5 text-stone-600" />
            <span className="font-semibold text-ink-primary">
              {candidates.length}
            </span>
            <span className="text-[11px] text-ink-muted">Indexed</span>
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            disabled={!activePool}
            className="inline-flex items-center space-x-1.5 text-xs font-medium px-4 py-1.5 rounded-full bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Upload Resumes</span>
          </button>
        </div>
      </header>
    </div>
  );
}
