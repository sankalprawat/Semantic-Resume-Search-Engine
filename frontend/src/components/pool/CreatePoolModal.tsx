"use client";

import React, { useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { createPool } from "@/lib/api";
import { FolderPlus, X } from "lucide-react";

export function CreatePoolModal() {
  const { isCreatePoolOpen, setIsCreatePoolOpen, refreshPools, setActivePool } = useEngine();
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
      const newPool = await createPool(title.trim(), description.trim() || undefined);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-surface-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 bg-surface-50">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-semibold text-ink-primary">
              Create New Talent Pool
            </h2>
          </div>
          <button
            onClick={() => setIsCreatePoolOpen(false)}
            className="text-ink-muted hover:text-ink-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Pool Title (Requisition Name)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Staff Distributed Systems Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-surface-200 focus:outline-none focus:ring-1 focus:ring-amber-600 bg-surface-50 placeholder:text-ink-muted"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Role Hiring Mandate & Requirements
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Looking for engineers with 6+ years experience in Kafka streaming, Raft consensus, or distributed SQL engines."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-surface-200 focus:outline-none focus:ring-1 focus:ring-amber-600 bg-surface-50 placeholder:text-ink-muted resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-surface-100">
            <button
              type="button"
              onClick={() => setIsCreatePoolOpen(false)}
              className="px-3 py-1.5 text-xs text-ink-secondary hover:text-ink-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 transition-colors shadow-xs"
            >
              {loading ? "Creating..." : "Create Pool"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
