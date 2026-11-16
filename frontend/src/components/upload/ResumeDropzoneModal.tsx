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
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    setError(null);
    setSuccessCount(null);
    setUploadProgressMsg("Extracting text with PyMuPDF & generating 768-dim embeddings...");

    try {
      const res = await uploadResumes(activePool.id, files);
      setSuccessCount(res.total_uploaded);
      setFiles([]);
      await refreshCandidates(activePool.id);
      await refreshPools();
    } catch (err: any) {
      setError(err.message || "Failed to process and index resumes");
    } finally {
      setIsUploading(false);
      setUploadProgressMsg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-surface-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 bg-surface-50">
          <div>
            <h2 className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-amber-700" />
              Upload Resumes to Pool:{" "}
              <span className="font-normal text-ink-secondary">{activePool.title}</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Upload PDF resumes to extract text, bounding boxes, and HNSW embeddings.
            </p>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(false)}
            disabled={isUploading}
            className="text-ink-muted hover:text-ink-primary transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
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
            className="border-2 border-dashed border-surface-300 hover:border-amber-600/70 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-surface-50/50 hover:bg-surface-50"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".pdf"
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 mb-2">
              <UploadCloud className="w-5 h-5 text-amber-700" />
            </div>
            <p className="text-xs font-medium text-ink-primary">
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
                  className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-surface-50 border border-surface-200"
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
                    className="text-ink-muted hover:text-red-600 transition-colors ml-2"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress Status */}
          {isUploading && (
            <div className="flex items-center space-x-2.5 text-xs text-amber-800 bg-amber-50/80 border border-amber-200 p-2.5 rounded-md animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
              <span>{uploadProgressMsg || "Processing..."}</span>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-surface-100">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              disabled={isUploading}
              className="px-3 py-1.5 text-xs text-ink-secondary hover:text-ink-primary transition-colors disabled:opacity-40"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 transition-colors shadow-xs"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Upload & Index {files.length > 0 ? `(${files.length})` : ""}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
