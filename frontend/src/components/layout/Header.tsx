"use client";

import React, { useEffect, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { useTheme } from "@/context/ThemeContext";
import { fetchHealth } from "@/lib/api";
import { PoolDropdown } from "@/components/pool/PoolDropdown";
import {
  Briefcase,
  FolderPlus,
  Info,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";

export function Header() {
  const {
    activePool,
    candidates,
    setIsUploadModalOpen,
    setIsCreatePoolOpen,
  } = useEngine();
  const { theme, toggleTheme } = useTheme();

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
    <header className="w-full rounded-2xl md:rounded-full h-auto md:h-[52px] p-2.5 md:px-5 bg-white dark:bg-[#1C1A18] border border-[#E6E4DD] dark:border-[#2E2B27] shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.4)] flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3 shrink-0 z-20 transition-colors duration-200">
      {/* Row 1 on Mobile / Left on Desktop: Brand Logo, Popover, & Mobile Quick Actions */}
      <div className="flex items-center justify-between w-full md:w-auto gap-2">
        {/* Brand & AI Architecture Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 md:w-7 md:h-7 rounded-full bg-stone-900 dark:bg-amber-400/10 dark:border dark:border-amber-400/20 flex items-center justify-center shrink-0 shadow-2xs">
            <Briefcase className="w-4 h-4 md:w-3.5 md:h-3.5 text-amber-400" />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-xs font-semibold text-stone-900 dark:text-stone-100 tracking-tight leading-none whitespace-nowrap">
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
                className="text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors cursor-pointer inline-flex items-center justify-center p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
                aria-label="AI Model Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              {showTooltip && (
                <div className="absolute top-full left-0 mt-2.5 w-72 p-4 z-50 text-[11px] text-stone-900 dark:text-stone-100 bg-white/95 dark:bg-[#1C1A18]/95 backdrop-blur-md border border-[#E6E4DD] dark:border-[#2E2B27] rounded-2xl shadow-lg animate-in fade-in zoom-in-95 duration-150 before:absolute before:-top-3 before:left-0 before:w-full before:h-3 frosted-glass-card">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-stone-200/80 dark:border-stone-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                        AI Architecture & Models
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 dark:text-stone-400 block text-[10px] font-medium tracking-wide">
                        Synthesis & Comparative RAG
                      </span>
                      <span className="font-semibold text-stone-900 dark:text-stone-100 text-xs">
                        {modelInfo.completion_model}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 dark:text-stone-400 block text-[10px] font-medium tracking-wide">
                        Dense Semantic Embeddings
                      </span>
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {modelInfo.embedding_model}{" "}
                        <span className="text-[10px] font-normal text-stone-500 dark:text-stone-400">
                          (768-dim)
                        </span>
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 dark:text-stone-400 block text-[10px] font-medium tracking-wide">
                        Vector Indexing
                      </span>
                      <span className="font-medium text-stone-800 dark:text-stone-200">
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
            className="inline-flex items-center gap-1 text-[11px] text-stone-600 dark:text-stone-300 px-2.5 py-1 rounded-full bg-[#F7F6F2] dark:bg-[#262422] border border-[#E6E4DD] dark:border-[#38342F] whitespace-nowrap"
            title="Total resumes indexed in active pool"
          >
            <Users className="w-3 h-3 text-stone-500 dark:text-stone-400" />
            <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
              {candidates.length}
            </span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400">Indexed</span>
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
                ? "bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 border border-stone-900 dark:border-amber-500 shadow-xs"
                : "bg-white dark:bg-[#262422] hover:bg-stone-50 dark:hover:bg-[#2F2C29] text-stone-900 dark:text-stone-100 border border-[#E6E4DD] dark:border-[#38342F] hover:border-stone-300 disabled:bg-stone-100 dark:disabled:bg-stone-800 disabled:text-stone-400 dark:disabled:text-stone-600 disabled:border-stone-200 dark:disabled:border-stone-800 disabled:cursor-not-allowed"
            }`}
          >
            <Plus
              className={`w-3.5 h-3.5 ${
                needsCandidates ? "text-amber-400 dark:text-stone-950" : "text-current"
              }`}
            />
            <span>Upload</span>
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
              ? "bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 border border-stone-900 dark:border-amber-500 shadow-xs"
              : "bg-white dark:bg-[#262422] hover:bg-stone-50 dark:hover:bg-[#2F2C29] text-stone-800 dark:text-stone-200 border border-[#E6E4DD] dark:border-[#38342F] hover:border-stone-300"
          }`}
        >
          <FolderPlus
            className={`w-3.5 h-3.5 ${
              needsPool ? "text-amber-400 dark:text-stone-950" : "text-stone-600 dark:text-stone-400"
            }`}
          />
          <span>+ Pool</span>
        </button>

        {/* Mobile-Only Theme Toggle on Row 2 */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle color theme"
          className="md:hidden p-2 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-[#F7F6F2] dark:bg-[#262422] hover:bg-stone-200/70 dark:hover:bg-stone-700/60 border border-[#E6E4DD] dark:border-[#38342F] transition-all cursor-pointer inline-flex items-center justify-center shrink-0 min-h-[40px] min-w-[40px]"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-stone-600" />
          )}
        </button>
      </div>

      {/* Desktop-Only Right Actions (Indexed badge, Upload PDFs button & Theme Toggle) */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <div
          className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 px-3 py-1.5 rounded-full bg-[#F7F6F2] dark:bg-[#262422] border border-[#E6E4DD] dark:border-[#38342F] whitespace-nowrap"
          title="Total resumes indexed in active pool"
        >
          <Users className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
          <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
            {candidates.length}
          </span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400">Indexed</span>
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
              ? "bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 border border-stone-900 dark:border-amber-500 shadow-xs cursor-pointer"
              : "bg-white dark:bg-[#262422] hover:bg-stone-50 dark:hover:bg-[#2F2C29] text-stone-900 dark:text-stone-100 border border-[#E6E4DD] dark:border-[#38342F] hover:border-stone-300 cursor-pointer disabled:bg-stone-100 dark:disabled:bg-stone-800 disabled:text-stone-400 dark:disabled:text-stone-600 disabled:border-stone-200 dark:disabled:border-stone-800 disabled:cursor-not-allowed"
          }`}
        >
          <Plus
            className={`w-3.5 h-3.5 ${
              needsCandidates ? "text-amber-400 dark:text-stone-950" : "text-current"
            }`}
          />
          <span>Upload PDFs</span>
        </button>

        {/* Desktop Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle color theme"
          className="p-1.5 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-[#F7F6F2] dark:bg-[#262422] hover:bg-stone-200/70 dark:hover:bg-stone-700/60 border border-[#E6E4DD] dark:border-[#38342F] transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
        >
          {theme === "dark" ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-stone-600" />
          )}
        </button>
      </div>
    </header>
  );
}