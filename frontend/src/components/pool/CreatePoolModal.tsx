"use client";

import React, { useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { createPool } from "@/lib/api";
import { FolderPlus, Loader2, X } from "lucide-react";

export function CreatePoolModal() {
  const { isCreatePoolOpen, setIsCreatePoolOpen, refreshPools, setActivePool } =
    useEngine();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCreatePoolOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const newPool = await createPool(
        title.trim(),
        description.trim() || undefined
      );
      await refreshPools();
      setActivePool(newPool);
      setIsCreatePoolOpen(false);
      setTitle("");
      setDescription("");
    } catch (err: any) {
      setError(err.message || "Failed to create pool");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 frosted-glass-overlay animate-in fade-in duration-200"
      onClick={() => {
        if (!loading) setIsCreatePoolOpen(false);
      }}
    >
      <div
        className="w-full max-w-md p-6 frosted-glass-modal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-900/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-800 shadow-2xs">
              <FolderPlus className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">
                Create New Talent Pool
              </h2>
              <p className="text-[11px] text-ink-muted">
                Group candidates for targeted semantic evaluation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatePoolOpen(false)}
            disabled={loading}
            className="p-1 rounded-full text-ink-muted hover:text-ink-primary hover:bg-white/50 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              Pool Title (Requisition Name)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Staff Distributed Systems Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200/90 focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 bg-white/70 focus:bg-white transition-all placeholder:text-ink-muted shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              Role Hiring Mandate & Requirements
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Looking for engineers with 6+ years experience in Kafka streaming, Raft consensus, or distributed SQL engines."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200/90 focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 bg-white/70 focus:bg-white transition-all placeholder:text-ink-muted resize-none shadow-2xs"
            />
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-stone-900/10">
            <button
              type="button"
              onClick={() => setIsCreatePoolOpen(false)}
              disabled={loading}
              className="px-4 py-2 rounded-full text-xs font-medium text-ink-primary bg-white/60 hover:bg-white/90 border border-surface-200 transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-5 py-2 text-xs font-semibold rounded-full bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Pool</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
