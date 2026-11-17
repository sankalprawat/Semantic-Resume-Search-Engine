"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { deletePool } from "@/lib/api";
import { TalentPool } from "@/types";
import { DeletePoolModal } from "@/components/pool/DeletePoolModal";
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
  const [poolToDelete, setPoolToDelete] = useState<TalentPool | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const handleDeleteConfirm = async () => {
    if (!poolToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deletePool(poolToDelete.id);
      await refreshPools();
      if (activePool?.id === poolToDelete.id) {
        setActivePool(null);
      }
      setPoolToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete pool");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="relative w-full md:w-64" ref={dropdownRef}>
        {/* Pill Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full flex items-center justify-between space-x-2 bg-surface-50 dark:bg-[#262422] hover:bg-surface-100 dark:hover:bg-[#2F2C29] border border-surface-200 dark:border-[#38342F] hover:border-surface-300 text-ink-primary dark:text-stone-100 text-xs font-medium rounded-full pl-3.5 pr-3 py-1.5 min-h-[40px] md:min-h-[34px] transition-all shadow-2xs cursor-pointer"
        >
          <div className="flex items-center space-x-2 truncate flex-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-stone-700 dark:text-amber-400 shrink-0" />
            <span className="truncate text-left">
              {activePool ? activePool.title : "Select Talent Pool"}
            </span>
            {activePool && (
              <span className="text-[10px] text-ink-muted dark:text-stone-400 bg-surface-200/60 dark:bg-[#1C1A18] px-1.5 py-0.5 rounded-full shrink-0">
                {activePool.candidate_count}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-ink-secondary dark:text-stone-400 transition-transform duration-200 shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Custom Frosted Glass Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 w-full mt-2 frosted-glass-dropdown z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted dark:text-stone-400">
              Talent Pools ({pools.length})
            </div>

            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {pools.length === 0 ? (
                <div className="px-3 py-3 text-xs text-ink-muted dark:text-stone-400 text-center">
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
                          ? "bg-white/75 dark:bg-white/10 font-semibold text-ink-primary dark:text-stone-100 shadow-2xs"
                          : "text-ink-secondary dark:text-stone-300 hover:text-ink-primary dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActivePool(pool);
                          setIsOpen(false);
                        }}
                        className="flex items-center space-x-2 truncate flex-1 text-left py-0.5 cursor-pointer"
                      >
                        <div className="w-4 flex items-center justify-center shrink-0">
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-stone-900 dark:text-amber-400" />
                          )}
                        </div>
                        <span className="truncate">{pool.title}</span>
                      </button>

                      <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                        <span className="text-[10px] text-ink-muted dark:text-stone-400 px-2 py-0.5 rounded-full bg-white/60 dark:bg-white/5 border border-white/80 dark:border-white/10">
                          {pool.candidate_count}{" "}
                          {pool.candidate_count === 1 ? "cand" : "cands"}
                        </span>

                        <button
                          type="button"
                          title={`Delete pool "${pool.title}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteError(null);
                            setPoolToDelete(pool);
                          }}
                          className="p-1 rounded-md text-ink-muted dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-70 group-hover/item:opacity-100 cursor-pointer"
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
            <div className="border-t border-stone-900/10 dark:border-white/10 mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsCreatePoolOpen(true);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-ink-primary dark:text-stone-100 hover:bg-white/50 dark:hover:bg-white/5 rounded-xl transition-colors font-medium cursor-pointer"
              >
                <div className="w-5 h-5 rounded-md bg-white/70 dark:bg-white/10 border border-white/80 dark:border-white/10 flex items-center justify-center text-stone-700 dark:text-amber-400">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span>Create New Talent Pool</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Frosted Glass Delete Confirmation Modal */}
      <DeletePoolModal
        pool={poolToDelete}
        isOpen={!!poolToDelete}
        isDeleting={isDeleting}
        onClose={() => {
          if (!isDeleting) setPoolToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        error={deleteError}
      />
    </>
  );
}
