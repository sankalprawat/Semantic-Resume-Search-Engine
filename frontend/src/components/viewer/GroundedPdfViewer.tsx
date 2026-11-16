"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEngine } from "@/context/EngineContext";
import { getCandidateResumeUrl } from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export function GroundedPdfViewer() {
  const { activeCandidate, activeCitation } = useEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.15);
  const [loading, setLoading] = useState<boolean>(false);
  const [canvasDims, setCanvasDims] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // 1. Load PDF when active candidate changes
  useEffect(() => {
    if (!activeCandidate) {
      setPdfDoc(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setCurrentPage(1);

    const loadPdf = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

        const pdfUrl = getCandidateResumeUrl(activeCandidate.id);
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const doc = await loadingTask.promise;

        if (!isCancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        }
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
  }, [activeCandidate?.id]);

  // 2. Synchronize page navigation when active citation triggers
  useEffect(() => {
    if (activeCitation && activeCitation.pageNumber) {
      if (
        activeCandidate &&
        (activeCitation.candidateId === activeCandidate.id ||
          activeCitation.candidateName
            .toLowerCase()
            .includes(activeCandidate.full_name.toLowerCase()))
      ) {
        setCurrentPage(activeCitation.pageNumber);
      }
    }
  }, [activeCitation, activeCandidate?.id]);

  // 3. Render Page to Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isRenderCancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isRenderCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setCanvasDims({ width: viewport.width, height: viewport.height });

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });

        await renderTask.promise;

        // Auto-scroll to bounding box if citation is active on this page
        if (
          activeCitation &&
          activeCitation.pageNumber === currentPage &&
          activeCitation.boundingBoxes.length > 0 &&
          scrollContainerRef.current
        ) {
          const firstBox = activeCitation.boundingBoxes[0];
          const targetY = firstBox.y0 * viewport.height;
          scrollContainerRef.current.scrollTo({
            top: Math.max(0, targetY - 120),
            behavior: "smooth",
          });
        }
      } catch (err: any) {
        if (err.name !== "RenderingCancelledException") {
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
  }, [pdfDoc, currentPage, scale, activeCitation]);

  if (!activeCandidate) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-ink-muted">
        <div className="w-12 h-12 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center text-ink-muted mb-3">
          <FileQuestion className="w-6 h-6 text-stone-500" />
        </div>
        <h3 className="text-xs font-semibold text-ink-primary">No Candidate Selected</h3>
        <p className="text-[11px] text-ink-muted max-w-xs mt-1">
          Upload resumes or select a candidate tab above to inspect their original PDF with
          synchronized bounding boxes.
        </p>
      </div>
    );
  }

  const isCurrentCitationTarget =
    activeCitation &&
    (activeCitation.candidateId === activeCandidate.id ||
      activeCitation.candidateName
        .toLowerCase()
        .includes(activeCandidate.full_name.toLowerCase())) &&
    activeCitation.pageNumber === currentPage;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-stone-100/70 overflow-hidden">
      {/* Top Toolbar */}
      <div className="px-4 py-2 border-b border-surface-200 bg-white flex items-center justify-between text-xs">
        {/* Page navigation */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-surface-100 disabled:opacity-30 text-ink-primary"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-medium text-ink-primary px-1">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded hover:bg-surface-100 disabled:opacity-30 text-ink-primary"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Active evidence notification */}
        {isCurrentCitationTarget && (
          <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            <span>Citation Highlight Synchronized</span>
          </div>
        )}

        {/* Zoom controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}
            title="Zoom out"
            className="p-1 rounded hover:bg-surface-100 text-ink-secondary hover:text-ink-primary"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-ink-muted w-10 text-center font-mono">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
            title="Zoom in"
            className="p-1 rounded hover:bg-surface-100 text-ink-secondary hover:text-ink-primary"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale(1.15)}
            title="Reset zoom"
            className="p-1 rounded hover:bg-surface-100 text-ink-secondary hover:text-ink-primary"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-6 flex justify-center items-start"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-ink-muted">
            <Loader2 className="w-6 h-6 animate-spin text-stone-600 mb-2" />
            <span className="text-xs">Rendering candidate PDF...</span>
          </div>
        ) : (
          <div className="relative shadow-md border border-surface-300 rounded-sm bg-white overflow-hidden">
            {/* The PDF Canvas */}
            <canvas ref={canvasRef} className="block" />

            {/* The SVG Grounded Highlight Coordinate Overlay */}
            {canvasDims.width > 0 && isCurrentCitationTarget && (
              <svg
                className="absolute inset-0 pointer-events-none"
                width={canvasDims.width}
                height={canvasDims.height}
              >
                {activeCitation.boundingBoxes.map((box, idx) => {
                  const x = box.x0 * canvasDims.width;
                  const y = box.y0 * canvasDims.height;
                  const w = (box.x1 - box.x0) * canvasDims.width;
                  const h = (box.y1 - box.y0) * canvasDims.height;

                  return (
                    <g key={idx}>
                      {/* Highlight Fill Rectangle */}
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill="rgba(253, 230, 138, 0.45)"
                        stroke="#D97706"
                        strokeWidth="1.5"
                        rx="2"
                        className="transition-all duration-300"
                      />
                      {/* Left border indicator pulse */}
                      <line
                        x1={x}
                        y1={y}
                        x2={x}
                        y2={y + h}
                        stroke="#B45309"
                        strokeWidth="3.5"
                      />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
