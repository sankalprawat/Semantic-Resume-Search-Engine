"use client";

import React, { useRef, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { uploadResumes } from "@/lib/api";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";

export function ResumeDropzoneModal() {
  const {
    activePool,
    isUploadModalOpen,
    setIsUploadModalOpen,
    refreshCandidates,
    refreshPools,
  } = useEngine();

  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!activePool) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const droppedPdfs = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      setFiles((prev) => [...prev, ...droppedPdfs]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !activePool) return;

    setIsUploading(true);
    setError(null);
    setSuccessCount(null);
    setUploadProgressMsg("Sending PDFs to parsing pipeline...");

    try {
      setUploadProgressMsg("Extracting text and chunking with coordinates...");
      const result = await uploadResumes(activePool.id, files);

      setUploadProgressMsg("Refreshing pool metrics and embeddings...");
      await refreshCandidates(activePool.id);
      await refreshPools();

      setSuccessCount(result.total_uploaded);
      setFiles([]);
    } catch (err: any) {
      setError(err.message || "Failed to upload and index resumes.");
    } finally {
      setIsUploading(false);
      setUploadProgressMsg(null);
    }
  };

  return (
    <ModalShell
      isOpen={isUploadModalOpen}
      onClose={() => setIsUploadModalOpen(false)}
      disabled={isUploading}
      maxWidth="max-w-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-stone-900/10 dark:border-white/10">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-800 dark:text-amber-400 shadow-2xs">
            <UploadCloud className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink-primary dark:text-stone-100 flex items-center gap-1.5">
              Upload Resumes to:{" "}
              <span className="font-semibold text-amber-900 dark:text-amber-400">
                {activePool.title}
              </span>
            </h2>
            <p className="text-[11px] text-ink-muted dark:text-stone-400">
              Extracts text coordinates and builds 768-dim embeddings in Supabase
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(false)}
          disabled={isUploading}
          className="p-1 rounded-full text-ink-muted dark:text-stone-400 hover:text-ink-primary dark:hover:text-stone-100 hover:bg-white/50 dark:hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="mt-4 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Successfully indexed <strong>{successCount}</strong> candidate resumes!
            </span>
          </div>
        )}

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-stone-300/80 dark:border-[#38342F] hover:border-amber-700/70 dark:hover:border-amber-400/70 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/40 dark:bg-[#1E1C1A]/60 hover:bg-white/60 dark:hover:bg-[#1E1C1A]/90 shadow-2xs"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept=".pdf"
            className="hidden"
          />
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-800 dark:text-amber-400 mb-2 shadow-2xs">
            <UploadCloud className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          </div>
          <p className="text-xs font-semibold text-ink-primary dark:text-stone-100">
            Click or drag candidate PDF resumes here
          </p>
          <p className="text-[11px] text-ink-muted dark:text-stone-400 mt-1">
            Accepts multiple PDF resumes (up to 15 at once)
          </p>
        </div>

        {/* File Queue List */}
        {files.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            <div className="text-[11px] font-semibold text-ink-muted dark:text-stone-400 uppercase tracking-wide">
              Selected Files ({files.length})
            </div>
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-surface-200 dark:border-white/10 text-xs"
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span className="truncate text-ink-primary dark:text-stone-200">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-ink-muted dark:text-stone-400 shrink-0">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  disabled={isUploading}
                  className="p-1 rounded-md text-ink-muted dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Progress Display */}
        {isUploading && (
          <div className="flex items-center space-x-2.5 text-xs text-amber-900 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-amber-700 dark:text-amber-400" />
            <span>{uploadProgressMsg || "Processing..."}</span>
          </div>
        )}

        {/* Footer Controls */}
        <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-stone-900/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(false)}
            disabled={isUploading}
            className="px-4 py-2 rounded-full text-xs font-medium text-ink-primary dark:text-stone-200 bg-white/60 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 border border-surface-200 dark:border-white/10 transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            className="px-5 py-2 text-xs font-semibold rounded-full bg-stone-900 dark:bg-amber-500 text-stone-50 dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-40 transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>
                Upload & Index {files.length > 0 ? `(${files.length})` : ""}
              </span>
            )}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
