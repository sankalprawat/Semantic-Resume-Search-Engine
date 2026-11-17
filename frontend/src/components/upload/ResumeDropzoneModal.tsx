"use client";

import React, { useRef, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { uploadResumes } from "@/lib/api";
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

  if (!isUploadModalOpen || !activePool) return null;

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
    if (files.length === 0 || !activePool || isUploading) return;

    setIsUploading(true);
    setError(null);
    setSuccessCount(null);
    setUploadProgressMsg(`Ingesting ${files.length} resume(s)...`);

    try {
      const result = await uploadResumes(activePool.id, files);
      setSuccessCount(result.total_uploaded);
      setFiles([]);
      await refreshCandidates(activePool.id);
      await refreshPools();
    } catch (err: any) {
      setError(err.message || "Failed to process resume files.");
    } finally {
      setIsUploading(false);
      setUploadProgressMsg(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 frosted-glass-overlay animate-in fade-in duration-200"
      onClick={() => {
        if (!isUploading) setIsUploadModalOpen(false);
      }}
    >
      <div
        className="w-full max-w-lg p-6 frosted-glass-modal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-900/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-800 shadow-2xs">
              <UploadCloud className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
                Upload Resumes to:{" "}
                <span className="font-semibold text-amber-900">
                  {activePool.title}
                </span>
              </h2>
              <p className="text-[11px] text-ink-muted">
                Extracts text coordinates and builds 768-dim embeddings in Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(false)}
            disabled={isUploading}
            className="p-1 rounded-full text-ink-muted hover:text-ink-primary hover:bg-white/50 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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
            className="border-2 border-dashed border-stone-300/80 hover:border-amber-700/70 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/40 hover:bg-white/60 shadow-2xs"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".pdf"
              className="hidden"
            />
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-800 mb-2 shadow-2xs">
              <UploadCloud className="w-5 h-5 text-amber-700" />
            </div>
            <p className="text-xs font-semibold text-ink-primary">
              Click or drag candidate PDF resumes here
            </p>
            <p className="text-[11px] text-ink-muted mt-1">
              Supports multiple PDF resumes (up to 25MB each)
            </p>
          </div>

          {/* File Queue */}
          {files.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              <p className="text-[11px] font-semibold text-ink-secondary">
                Selected for Ingestion ({files.length}):
              </p>
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-white/70 border border-white/90 shadow-2xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                    <span className="truncate text-ink-primary font-medium">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-ink-muted">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="p-1 rounded text-ink-muted hover:text-red-600 transition-colors ml-2 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress Status */}
          {isUploading && (
            <div className="flex items-center space-x-2.5 text-xs text-amber-900 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
              <span>{uploadProgressMsg || "Processing..."}</span>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-stone-900/10">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              disabled={isUploading}
              className="px-4 py-2 rounded-full text-xs font-medium text-ink-primary bg-white/60 hover:bg-white/90 border border-surface-200 transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
              className="px-5 py-2 text-xs font-semibold rounded-full bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
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
      </div>
    </div>
  );
}
