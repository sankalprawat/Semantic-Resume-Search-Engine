"use client";

import React from "react";
import { useEngine } from "@/context/EngineContext";
import {
  Briefcase,
  ChevronDown,
  FolderPlus,
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

  return (
    <header className="h-16 border-b border-surface-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Brand & Mandate */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-md bg-stone-900 flex items-center justify-center text-white shadow-xs">
          <Briefcase className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-ink-primary tracking-tight flex items-center gap-2">
            Semantic Talent Engine
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-grounded-surface border border-grounded-border text-grounded-text flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" /> Gemini-4 Grounded
            </span>
          </h1>
          <p className="text-xs text-ink-secondary">
            Multi-Candidate Verifiable ATS & Comparative Evaluation
          </p>
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
            className="appearance-none bg-surface-50 border border-surface-200 hover:border-surface-300 text-ink-primary text-xs font-medium rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors shadow-2xs cursor-pointer min-w-[200px]"
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
          <ChevronDown className="w-3.5 h-3.5 text-ink-secondary absolute right-2.5 pointer-events-none" />
        </div>

        <button
          onClick={() => setIsCreatePoolOpen(true)}
          title="Create New Talent Pool"
          className="p-1.5 rounded-md hover:bg-surface-100 border border-surface-200 text-ink-secondary hover:text-ink-primary transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Actions & Vitals */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 text-xs text-ink-secondary px-2.5 py-1 rounded-md bg-surface-100 border border-surface-200">
          <Users className="w-3.5 h-3.5 text-stone-600" />
          <span className="font-semibold text-ink-primary">{candidates.length}</span>
          <span>Indexed</span>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          disabled={!activePool}
          className="inline-flex items-center space-x-1.5 text-xs font-medium px-3.5 py-1.5 rounded-md bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
        >
          <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Upload Resumes</span>
        </button>
      </div>
    </header>
  );
}
