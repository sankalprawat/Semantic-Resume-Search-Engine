"use client";

import React, { useEffect } from "react";
import { TalentPool } from "@/types";
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !pool) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 frosted-glass-overlay animate-in fade-in duration-200"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div
        className="w-full max-w-md p-6 frosted-glass-modal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
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
            className="p-1 rounded-full text-ink-muted hover:text-ink-primary hover:bg-white/50 transition-colors disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-ink-primary tracking-tight">
            Delete Talent Pool?
          </h3>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-ink-primary">
              &ldquo;{pool.title}&rdquo;
            </span>
            ? All {pool.candidate_count}{" "}
            {pool.candidate_count === 1 ? "candidate resume" : "candidate resumes"},
            extracted text chunks, and vector embeddings in Supabase will be removed.
          </p>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 mt-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>This action is immediate and cannot be undone.</span>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700">
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
            className="px-4 py-2 rounded-full text-xs font-medium text-ink-primary bg-white/60 hover:bg-white/90 border border-surface-200 transition-all shadow-2xs disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
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
      </div>
    </div>
  );
}
