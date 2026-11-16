"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { deletePool } from "@/lib/api";
import { Check, ChevronDown, FolderPlus, Layers, Plus, Trash2 } from "lucide-react";

export function PoolDropdown() {
  const {
    pools,
    activePool,
    setActivePool,
    refreshPools,
    setIsCreatePoolOpen,
  } = useEngine();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-64" ref={dropdownRef}>
      {/* Pill Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between space-x-2 bg-surface-50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 text-ink-primary text-xs font-medium rounded-full pl-3.5 pr-3 py-1.5 transition-all shadow-2xs cursor-pointer"
      >
        <div className="flex items-center space-x-2 truncate flex-1 mr-1">
          <Layers className="w-3.5 h-3.5 text-stone-700 shrink-0" />
          <span className="truncate text-left">
            {activePool ? activePool.title : "Select Talent Pool"}
          </span>
          {activePool && (
            <span className="text-[10px] text-ink-muted bg-surface-200/60 px-1.5 py-0.5 rounded-full shrink-0">
              {activePool.candidate_count}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-ink-secondary transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Custom Dropdown Menu (Matches Button Width Exactly) */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-surface-200/90 z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Talent Pools ({pools.length})
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {pools.length === 0 ? (
              <div className="px-3 py-3 text-xs text-ink-muted text-center">
                No pools available yet.
              </div>
            ) : (
              pools.map((pool) => {
                const isSelected = activePool?.id === pool.id;
                return (
                  <div
                    key={pool.id}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-xl transition-colors group/item ${
                      isSelected
                        ? "bg-surface-100 font-semibold text-ink-primary"
                        : "text-ink-secondary hover:text-ink-primary hover:bg-surface-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActivePool(pool);
                        setIsOpen(false);
                      }}
                      className="flex items-center space-x-2 truncate flex-1 text-left py-0.5"
                    >
                      <div className="w-4 flex items-center justify-center shrink-0">
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-stone-900" />
                        )}
                      </div>
                      <span className="truncate">{pool.title}</span>
                    </button>

                    <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                      <span className="text-[10px] text-ink-muted px-2 py-0.5 rounded-full bg-white/80 border border-surface-200/60">
                        {pool.candidate_count} {pool.candidate_count === 1 ? "cand" : "cands"}
                      </span>

                      <button
                        type="button"
                        title={`Delete pool "${pool.title}"`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            confirm(
                              `Delete talent pool "${pool.title}" and all its candidate resumes?`
                            )
                          ) {
                            try {
                              await deletePool(pool.id);
                              await refreshPools();
                              if (activePool?.id === pool.id) {
                                setActivePool(null);
                              }
                            } catch (err) {
                              alert(`Failed to delete pool: ${err}`);
                            }
                          }
                        }}
                        className="p-1 rounded-md text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors opacity-70 group-hover/item:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Create New Pool Action */}
          <div className="border-t border-surface-100 mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreatePoolOpen(true);
              }}
              className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-ink-primary hover:bg-surface-50 rounded-xl transition-colors font-medium"
            >
              <div className="w-5 h-5 rounded-md bg-surface-100 flex items-center justify-center text-stone-700">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span>Create New Talent Pool</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
