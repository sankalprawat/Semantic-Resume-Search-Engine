"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePoolData, useSynthesis } from "@/context/EngineContext";
import { getCandidateResumeUrl } from "@/lib/api";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  FileText,
  List,
  Loader2,
  Maximize2,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface CandidateRecord {
  id: string;
  full_name: string;
  file_name?: string;
  filename?: string;
  email?: string;
  page_count?: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.2;

export function GroundedPdfViewer() {
  const {
    activeCandidate,
    setActiveCandidate,
    candidates = [],
  } = usePoolData() as unknown as {
    activeCandidate: CandidateRecord | null;
    setActiveCandidate?: (candidate: CandidateRecord | null) => void;
    candidates?: CandidateRecord[];
  };

  const { activeCitation } = useSynthesis() as unknown as {
    activeCitation?: {
      candidateId?: string;
      candidateName?: string;
      pageNumber?: number;
      boundingBoxes: BoundingBox[];
    } | null;
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pdfjsModuleRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [isListViewOpen, setIsListViewOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Compute ideal "Fit to Width" scale based on container width
  const computeFitScale = useCallback(async (doc: any) => {
    try {
      const page = await doc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const containerWidth = scrollContainerRef.current?.clientWidth ?? 640;
      const availableWidth = Math.max(280, containerWidth - 48); // 24px padding each side
      const fitted = availableWidth / baseViewport.width;
      return Math.min(1.25, Math.max(0.65, Number(fitted.toFixed(2))));
    } catch {
      return 1.0;
    }
  }, []);

  // 1. Load PDF whenever active candidate changes
  useEffect(() => {
    if (!activeCandidate) {
      setPdfDoc(null);
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setCurrentPage(1);
    setIsListViewOpen(false);

    const loadPdf = async () => {
      try {
        if (!pdfjsModuleRef.current) {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
          pdfjsModuleRef.current = pdfjs;
        }

        const pdfUrl = getCandidateResumeUrl(activeCandidate.id);
        const loadingTask = pdfjsModuleRef.current.getDocument(pdfUrl);
        const doc = await loadingTask.promise;

        if (isCancelled) return;

        const initialScale = await computeFitScale(doc);
        if (isCancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setScale(initialScale);
        setLoading(false);
      } catch (err) {
        console.error("Error loading candidate PDF:", err);
        if (!isCancelled) {
          setLoading(false);
          setPdfDoc(null);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [activeCandidate?.id, computeFitScale]);

  // 2. Synchronize candidate & page when an evidence citation is clicked
  useEffect(() => {
    if (!activeCitation?.pageNumber) return;

    const matchesActive =
      activeCandidate &&
      (activeCitation.candidateId === activeCandidate.id ||
        activeCitation.candidateName
          ?.toLowerCase()
          .includes(activeCandidate.full_name.toLowerCase()));

    if (matchesActive) {
      setIsListViewOpen(false);
      setCurrentPage(activeCitation.pageNumber);
    } else if (setActiveCandidate && candidates.length > 0) {
      const targetCandidate = candidates.find(
        (c) =>
          c.id === activeCitation.candidateId ||
          activeCitation.candidateName
            ?.toLowerCase()
            .includes(c.full_name.toLowerCase())
      );
      if (targetCandidate) {
        setActiveCandidate(targetCandidate);
        setIsListViewOpen(false);
        setCurrentPage(activeCitation.pageNumber);
      }
    }
  }, [activeCitation, activeCandidate, candidates, setActiveCandidate]);

  // 3. Render current PDF page with HiDPI sharpness & exact CSS zoom dimensions
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || isListViewOpen) return;

    let isRenderCancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isRenderCancelled) return;

        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const cssViewport = page.getViewport({ scale });
        const renderViewport = page.getViewport({ scale: scale * dpr });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const cssWidth = Math.floor(cssViewport.width);
        const cssHeight = Math.floor(cssViewport.height);

        // Backing store resolution (sharp on Retina/HiDPI displays)
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);

        // Explicit CSS layout size so zoom-in scales beyond container bounds cleanly
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        if (canvas.parentElement) {
          canvas.parentElement.style.width = `${cssWidth}px`;
          canvas.parentElement.style.height = `${cssHeight}px`;
        }

        renderTask = page.render({
          canvasContext: ctx,
          viewport: renderViewport,
        });

        await renderTask.promise;
        if (isRenderCancelled) return;

        // Auto-scroll smoothly to active citation bounding box
        if (
          activeCitation &&
          activeCitation.pageNumber === currentPage &&
          activeCitation.boundingBoxes?.length > 0 &&
          scrollContainerRef.current
        ) {
          const firstBox = activeCitation.boundingBoxes[0];
          const targetY = firstBox.y0 * cssHeight;
          const targetX = firstBox.x0 * cssWidth;

          scrollContainerRef.current.scrollTo({
            top: Math.max(0, targetY - 120),
            left: Math.max(0, targetX - 40),
            behavior: "smooth",
          });
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Page render error:", err);
        }
      }
    };

    renderPage();

    return () => {
      isRenderCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale, activeCitation, isListViewOpen]);

  const isCurrentCitationTarget = useMemo(() => {
    if (!activeCitation || !activeCandidate) return false;
    const candidateMatches =
      activeCitation.candidateId === activeCandidate.id ||
      activeCitation.candidateName
        ?.toLowerCase()
        .includes(activeCandidate.full_name.toLowerCase());
    return Boolean(candidateMatches && activeCitation.pageNumber === currentPage);
  }, [activeCitation, activeCandidate, currentPage]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.file_name || c.filename || "").toLowerCase().includes(q)
    );
  }, [candidates, searchQuery]);

  const handleZoomOut = () =>
    setScale((s) => Math.max(MIN_SCALE, Number((s - SCALE_STEP).toFixed(2))));

  const handleZoomIn = () =>
    setScale((s) => Math.min(MAX_SCALE, Number((s + SCALE_STEP).toFixed(2))));

  const handleFitWidth = async () => {
    if (!pdfDoc) return;
    const fitted = await computeFitScale(pdfDoc);
    setScale(fitted);
  };

  const handleSelectCandidate = (candidate: CandidateRecord) => {
    if (setActiveCandidate) {
      setActiveCandidate(candidate);
    }
    setIsListViewOpen(false);
  };

  // Empty state when no resumes exist in the pool
  if (!activeCandidate && candidates.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#F7F6F2]/50 dark:bg-[#141312]">
        <div className="w-12 h-12 rounded-full bg-white dark:bg-[#1C1A18] border border-[#E6E4DD] dark:border-[#2E2B27] shadow-2xs flex items-center justify-center mb-3">
          <FileQuestion className="w-5 h-5 text-stone-500 dark:text-stone-400" />
        </div>
        <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
          No Candidate Resumes Indexed
        </h3>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-xs mt-1 leading-relaxed">
          Upload PDF resumes to inspect original documents with synchronized
          evidence bounding boxes.
        </p>
      </div>
    );
  }

  // List View (shown when no candidate is active yet, or when user toggles "All PDFs")
  if (!activeCandidate || isListViewOpen) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#F7F6F2]/60 dark:bg-[#121110]/60 dark:backdrop-blur-xl overflow-hidden">
        {/* List View Header */}
        <div className="px-4 py-2.5 border-b border-[#E6E4DD] dark:border-white/10 bg-white dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <List className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
              Candidate Resumes
            </span>
            <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 bg-[#F7F6F2] dark:bg-[#262422] border border-[#E6E4DD] dark:border-[#38342F] px-2 py-0.5 rounded-full tabular-nums">
              {candidates.length}
            </span>
          </div>

          {activeCandidate && (
            <button
              type="button"
              onClick={() => setIsListViewOpen(false)}
              className="text-[11px] font-medium text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white px-2.5 py-1 rounded-full bg-[#F7F6F2] dark:bg-[#262422] hover:bg-stone-200/70 dark:hover:bg-[#2F2C29] border border-[#E6E4DD] dark:border-[#38342F] transition-colors cursor-pointer"
            >
              Back to PDF
            </button>
          )}
        </div>

        {/* Optional Quick Search when pool has > 4 candidates */}
        {candidates.length > 4 && (
          <div className="px-4 py-2 border-b border-[#E6E4DD] dark:border-white/10 bg-white/80 dark:bg-[#1E1C1A]/60 dark:backdrop-blur-lg shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter candidates by name or filename..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7F6F2] dark:bg-[#262422] border border-[#E6E4DD] dark:border-[#38342F] rounded-lg text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:bg-white dark:focus:bg-[#2A2724] focus:border-stone-400 dark:focus:border-amber-400/80"
              />
            </div>
          </div>
        )}

        {/* Vertical Candidate PDF List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {filteredCandidates.map((candidate, index) => {
            const isSelected = activeCandidate?.id === candidate.id;
            const isCited =
              activeCitation?.candidateId === candidate.id ||
              activeCitation?.candidateName
                ?.toLowerCase()
                .includes(candidate.full_name.toLowerCase());
            const fileName =
              candidate.file_name || candidate.filename || "Resume.pdf";

            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => handleSelectCandidate(candidate)}
                className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-[#282522]/80 dark:backdrop-blur-md border-stone-900 dark:border-amber-400 shadow-xs ring-1 ring-stone-900/5 dark:ring-amber-400/20"
                    : "bg-white dark:bg-[#1E1C1A]/60 dark:backdrop-blur-md hover:bg-stone-50/90 dark:hover:bg-[#25221F]/80 border-[#E6E4DD] dark:border-white/[0.08] hover:border-stone-300 dark:hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? "bg-stone-900 dark:bg-amber-400 border-stone-900 dark:border-amber-400 text-amber-400 dark:text-stone-950"
                        : "bg-[#F7F6F2] dark:bg-[#262422] border-[#E6E4DD] dark:border-[#38342F] text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-stone-400 dark:text-stone-500">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {candidate.full_name}
                      </p>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                      {fileName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCited && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      Cited
                    </span>
                  )}

                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-700 dark:text-amber-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-stone-900 dark:text-amber-400" />
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                  )}
                </div>
              </button>
            );
          })}

          {filteredCandidates.length === 0 && (
            <div className="text-center py-8 text-xs text-stone-500 dark:text-stone-400">
              No candidates match &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F7F6F2]/70 dark:bg-[#121110]/60 dark:backdrop-blur-xl overflow-hidden">
      {/* Active Candidate Header Bar (Replaces Horizontal Tabs) */}
      <div className="px-3 sm:px-4 py-2 border-b border-[#E6E4DD] dark:border-white/10 bg-white dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {candidates.length > 1 && (
            <button
              type="button"
              onClick={() => setIsListViewOpen(true)}
              title="View all candidate PDFs"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F7F6F2] dark:bg-[#262422] hover:bg-stone-200/70 dark:hover:bg-[#2F2C29] border border-[#E6E4DD] dark:border-[#38342F] text-[11px] font-medium text-stone-800 dark:text-stone-200 transition-colors shrink-0 cursor-pointer"
            >
              <List className="w-3 h-3 text-stone-600 dark:text-stone-400" />
              <span>All PDFs ({candidates.length})</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
              {activeCandidate.full_name}
            </span>
          </div>
        </div>

        {isCurrentCitationTarget && (
          <div className="text-[10px] sm:text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
            <span>Evidence Highlighted</span>
          </div>
        )}
      </div>

      {/* Pagination & Zoom Toolbar */}
      <div className="px-3 sm:px-4 py-1.5 border-b border-[#E6E4DD] dark:border-white/10 bg-white/95 dark:bg-[#1E1C1A]/70 dark:backdrop-blur-xl flex items-center justify-between gap-2 text-xs shrink-0">
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || loading}
            aria-label="Previous page"
            className="p-1.5 rounded-lg hover:bg-[#F7F6F2] dark:hover:bg-[#262422] disabled:opacity-30 text-stone-800 dark:text-stone-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-medium text-stone-700 dark:text-stone-400 px-1.5 tabular-nums">
            Page <strong className="text-stone-900 dark:text-stone-100">{currentPage}</strong> of{" "}
            {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || loading}
            aria-label="Next page"
            className="p-1.5 rounded-lg hover:bg-[#F7F6F2] dark:hover:bg-[#262422] disabled:opacity-30 text-stone-800 dark:text-stone-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-[#F7F6F2] dark:bg-[#282522]/80 border border-[#E6E4DD] dark:border-white/10 rounded-lg px-1 py-0.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= MIN_SCALE || loading}
            title="Zoom out"
            aria-label="Zoom out"
            className="p-1 rounded hover:bg-white dark:hover:bg-[#332F2B] disabled:opacity-30 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-medium text-stone-800 dark:text-stone-200 w-11 text-center font-mono tabular-nums select-none">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= MAX_SCALE || loading}
            title="Zoom in"
            aria-label="Zoom in"
            className="p-1 rounded hover:bg-white dark:hover:bg-[#332F2B] disabled:opacity-30 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-[#E6E4DD] dark:bg-[#38342F] mx-0.5" />

          <button
            type="button"
            onClick={handleFitWidth}
            disabled={loading}
            title="Fit to width"
            aria-label="Fit PDF to container width"
            className="p-1 rounded hover:bg-white dark:hover:bg-[#332F2B] disabled:opacity-30 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable PDF Canvas Viewport */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-4 sm:p-6"
      >
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center p-12 text-stone-500 dark:text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin text-stone-700 dark:text-amber-400 mb-2" />
            <span className="text-xs font-medium">
              Rendering candidate PDF...
            </span>
          </div>
        ) : (
          <div className="relative mx-auto shadow-md dark:shadow-2xl border border-[#E6E4DD] dark:border-[#2E2B27] rounded-xs bg-white overflow-hidden">
            {/* High-DPI PDF Canvas */}
            <canvas ref={canvasRef} className="block" />

            {/* Responsive Percentage-Based Grounded Highlight Overlay */}
            {isCurrentCitationTarget && (
              <div className="absolute inset-0 pointer-events-none">
                {activeCitation?.boundingBoxes.map((box, idx) => {
                  const left = `${box.x0 * 100}%`;
                  const top = `${box.y0 * 100}%`;
                  const width = `${(box.x1 - box.x0) * 100}%`;
                  const height = `${(box.y1 - box.y0) * 100}%`;

                  return (
                    <div
                      key={idx}
                      style={{ left, top, width, height }}
                      className="absolute bg-amber-300/40 border border-amber-500 rounded-xs shadow-[0_0_8px_rgba(217,119,6,0.25)] border-l-[3.5px] border-l-amber-700 animate-in fade-in duration-300"
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}