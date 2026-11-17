"use client";

import React from "react";
import { TalentPool } from "@/types";
import { ModalShell } from "@/components/ui/ModalShell";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

interface DeletePoolModalProps {
  pool: TalentPool | null;
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  error?: string | null;
}

export function DeletePoolModal({
  pool,
  isOpen,
  isDeleting,
  onClose,
  onConfirm,
  error,
}: DeletePoolModalProps) {
  if (!pool) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      disabled={isDeleting}
    >
      {/* Header with Icon */}
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 shadow-2xs">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="p-1 rounded-full text-ink-muted dark:text-stone-400 hover:text-ink-primary dark:hover:text-stone-100 hover:bg-white/50 dark:hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="mt-4 space-y-2">
        <h3 className="text-sm font-semibold text-ink-primary dark:text-stone-100 tracking-tight">
          Delete Talent Pool?
        </h3>
        <p className="text-xs text-ink-secondary dark:text-stone-300 leading-relaxed">
          Are you sure you want to permanently delete{" "}
          <span className="font-semibold text-ink-primary dark:text-stone-100">
            &ldquo;{pool.title}&rdquo;
          </span>
          ? All {pool.candidate_count}{" "}
          {pool.candidate_count === 1 ? "candidate resume" : "candidate resumes"},
          extracted text chunks, and vector embeddings in Supabase will be removed.
        </p>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-300 mt-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
          <span>This action is immediate and cannot be undone.</span>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end space-x-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="px-4 py-2 rounded-full text-xs font-medium text-ink-primary dark:text-stone-200 bg-white/60 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 border border-surface-200 dark:border-white/10 transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Deleting...</span>
            </>
          ) : (
            <>
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Pool</span>
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
}
