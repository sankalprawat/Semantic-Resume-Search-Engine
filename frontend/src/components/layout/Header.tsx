"use client";

import React, { useEffect, useRef, useState } from "react";
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

interface ModelInfo {
  completion_model: string;
  embedding_model: string;
}

const DEFAULT_MODEL_INFO: ModelInfo = {
  completion_model: "gemini-4-hydrogen",
  embedding_model: "gemini-embedding-2",
};

export function Header() {
  const {
    activePool,
    candidates,
    setIsUploadModalOpen,
    setIsCreatePoolOpen,
  } = useEngine();
  const { theme, toggleTheme } = useTheme();

  const [modelInfo, setModelInfo] = useState<ModelInfo>(DEFAULT_MODEL_INFO);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    fetchHealth()
      .then((data) => {
        if (isMounted && data?.completion_model) {
          setModelInfo({
            completion_model: data.completion_model,
            embedding_model: data.embedding_model,
          });
        }
      })
      .catch(() => {
        // Retain configured defaults
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Dismiss info popover on outside click/tap or Escape (for touch devices)
  useEffect(() => {
    if (!showTooltip) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (
        tooltipContainerRef.current &&
        !tooltipContainerRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTooltip(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showTooltip]);

  const needsPool = !activePool;
  const needsCandidates = Boolean(activePool) && candidates.length === 0;

  const IndexedBadge = ({ compact = false }: { compact?: boolean }) => (
    <div
      className={`inline-flex items-center rounded-full bg-[#F7F6F2] dark:bg-[#262422] border border-[#E6E4DD] dark:border-[#38342F] text-stone-600 dark:text-stone-300 whitespace-nowrap ${
        compact ? "gap-1 text-[11px] px-2.5 py-1" : "gap-1.5 text-xs px-3 py-1.5"
      }`}
      title="Total resumes indexed in active pool"
    >
      <Users
        className={`${
          compact ? "w-3 h-3" : "w-3.5 h-3.5"
        } text-stone-500 dark:text-stone-400`}
      />
      <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
        {candidates.length}
      </span>
      <span
        className={`${
          compact ? "text-[10px]" : "text-[11px]"
        } text-stone-500 dark:text-stone-400`}
      >
        Indexed
      </span>
    </div>
  );

  const UploadButton = ({ mobile = false }: { mobile?: boolean }) => (
    <button
      type="button"
      onClick={() => setIsUploadModalOpen(true)}
      disabled={!activePool}
      title={
        activePool
          ? "Upload candidate PDF resumes"
          : "Select or create a talent pool first"
      }
      className={`inline-flex items-center rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
        mobile ? "gap-1 px-3 py-1.5 min-h-[36px]" : "gap-1.5 px-3.5 py-1.5"
      } ${
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
      <span>{mobile ? "Upload" : "Upload PDFs"}</span>
    </button>
  );

  const ThemeToggleButton = ({ mobile = false }: { mobile?: boolean }) => (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
      className={`rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-[#F7F6F2] dark:bg-[#262422] hover:bg-stone-200/70 dark:hover:bg-stone-700/60 border border-[#E6E4DD] dark:border-[#38342F] transition-all cursor-pointer inline-flex items-center justify-center shrink-0 ${
        mobile ? "p-2 min-h-[40px] min-w-[40px]" : "p-1.5"
      }`}
    >
      {theme === "dark" ? (
        <Sun
          className={`${mobile ? "w-4 h-4" : "w-3.5 h-3.5"} text-amber-400`}
        />
      ) : (
        <Moon
          className={`${mobile ? "w-4 h-4" : "w-3.5 h-3.5"} text-stone-600`}
        />
      )}
    </button>
  );

  return (
    /* Keep backdrop-filter on ::before so <header> never creates a Backdrop Root for child popovers/dropdowns */
    <header className="relative w-full rounded-2xl md:rounded-full h-auto md:h-[52px] p-2.5 md:px-5 border border-[#E6E4DD] dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3 shrink-0 z-20 transition-colors duration-200 before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-white dark:before:bg-[#1E1C1A]/75 dark:before:backdrop-blur-xl before:pointer-events-none">
      {/* Row 1 (Mobile) / Left (Desktop): Brand Logo, Info Popover & Mobile Quick Actions */}
      <div className="flex items-center justify-between w-full md:w-auto gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 md:w-7 md:h-7 rounded-full bg-stone-900 dark:bg-amber-400/10 dark:border dark:border-amber-400/20 flex items-center justify-center shrink-0 shadow-2xs"
            title="Semantic Talent Engine"
          >
            <Briefcase className="w-4 h-4 md:w-3.5 md:h-3.5 text-amber-400" />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="hidden md:block text-xs font-semibold text-stone-900 dark:text-stone-100 tracking-tight leading-none whitespace-nowrap">
              Semantic Talent Engine
            </h1>

            {/* Model Architecture Popover */}
            <div
              ref={tooltipContainerRef}
              className="relative inline-flex items-center"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <button
                type="button"
                onClick={() => setShowTooltip((prev) => !prev)}
                aria-expanded={showTooltip}
                aria-label="AI Model Information"
                className="text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors cursor-pointer inline-flex items-center justify-center p-1.5 md:p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              {showTooltip && (
                <div className="absolute top-full left-0 mt-2.5 w-72 p-4 z-50 text-[11px] text-stone-900 dark:text-stone-100 animate-in fade-in duration-150 before:content-[''] before:absolute before:-top-3 before:left-0 before:w-full before:h-3 frosted-glass-card">
                  <div className="space-y-2.5">
                    <div>
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

        {/* Mobile Quick Actions */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <IndexedBadge compact />
          <UploadButton mobile />
        </div>
      </div>

      {/* Row 2 (Mobile) / Center (Desktop): Pool Selector & New Pool CTA */}
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
              needsPool
                ? "text-amber-400 dark:text-stone-950"
                : "text-stone-600 dark:text-stone-400"
            }`}
          />
          <span className="md:hidden">Pool</span>
          <span className="hidden md:inline">New Pool</span>
        </button>

        <div className="md:hidden">
          <ThemeToggleButton mobile />
        </div>
      </div>

      {/* Desktop Right Actions */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <IndexedBadge />
        <UploadButton />
        <ThemeToggleButton />
      </div>
    </header>
  );
}