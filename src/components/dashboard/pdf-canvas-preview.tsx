"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ZoomIn, ZoomOut, ExternalLink } from "lucide-react";

interface PdfCanvasPreviewProps {
  fileUrl: string;
  fileName?: string;
}

interface PdfPageItemProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  zoomScale: number;
  containerWidth: number;
}

const PdfPageItem = memo(function PdfPageItem({
  doc,
  pageNumber,
  zoomScale,
  containerWidth,
}: PdfPageItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        const page = await doc.getPage(pageNumber);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        
        // Available width inside container minus padding (32px)
        const availableWidth = Math.max(containerWidth - 48, 300);
        // Base scale fits neatly into available width, maxing out at 1.4 for readability
        const baseScale = Math.min(availableWidth / unscaledViewport.width, 1.4);
        const effectiveScale = baseScale * zoomScale;

        // HIGH DPI / RETINA CRISP RENDERING (Fixes blurry/broken quality)
        const dpr = Math.max(window.devicePixelRatio || 1, 2); // Minimum 2x for razor-sharp typography
        const scaledViewport = page.getViewport({ scale: effectiveScale * dpr });

        const displayWidth = Math.floor(scaledViewport.width / dpr);
        const displayHeight = Math.floor(scaledViewport.height / dpr);

        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        setPageDimensions({ width: displayWidth, height: displayHeight });

        const renderContext = {
          canvas: canvas,
          canvasContext: ctx,
          viewport: scaledViewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (!isCancelled) {
          setIsRendered(true);
        }
      } catch (err: unknown) {
        const errObj = err as { name?: string };
        if (errObj?.name !== "RenderingCancelledException") {
          console.error(`Page ${pageNumber} render error:`, err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [doc, pageNumber, zoomScale, containerWidth]);

  return (
    <div
      className="relative bg-white rounded-[3px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-zinc-200/90 overflow-hidden shrink-0 transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      style={{
        width: pageDimensions ? `${pageDimensions.width}px` : "auto",
        minHeight: pageDimensions ? `${pageDimensions.height}px` : "400px",
      }}
    >
      {!isRendered && (
        <div className="absolute inset-0 flex flex-col justify-between p-6 bg-white animate-pulse">
          <div className="h-4 w-1/3 bg-zinc-200 rounded" />
          <div className="space-y-3">
            <div className="h-3 w-full bg-zinc-100 rounded" />
            <div className="h-3 w-5/6 bg-zinc-100 rounded" />
            <div className="h-3 w-4/6 bg-zinc-100 rounded" />
          </div>
          <div className="h-28 w-full bg-zinc-50 rounded border border-zinc-100" />
          <div className="space-y-2">
            <div className="h-3 w-3/4 bg-zinc-100 rounded" />
            <div className="h-3 w-1/2 bg-zinc-100 rounded" />
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="block mx-auto" />
      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white/90 select-none">
        {pageNumber}
      </div>
    </div>
  );
});

export function PdfCanvasPreview({ fileUrl, fileName = "Document.pdf" }: PdfCanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(500);

  // Measure container width for responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const pdfjsLib = await import("pdfjs-dist");

        if (typeof window !== "undefined") {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const doc = await loadingTask.promise;

        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn("PDF.js load failed:", err);
        if (!isCancelled) {
          setLoadError(errorMsg || "Could not parse PDF document");
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [fileUrl]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-zinc-100/70 rounded-lg border border-zinc-200">
      {/* Top sticky controls bar */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-zinc-200 text-xs select-none">
        <div className="flex items-center gap-2 text-zinc-700 min-w-0">
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-600 border border-red-200 font-semibold shrink-0">
            PDF
          </span>
          <span className="truncate text-xs font-medium text-zinc-800" title={fileName}>
            {fileName}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {numPages > 0 && (
            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 text-[11px] font-medium">
              {numPages} {numPages === 1 ? "page" : "pages"}
            </span>
          )}

          <div className="flex items-center gap-1 bg-zinc-100 rounded-md p-0.5 text-zinc-600">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
              className="p-1 hover:text-zinc-900 rounded hover:bg-zinc-200"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] px-1">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={() => setZoomScale((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
              className="p-1 hover:text-zinc-900 rounded hover:bg-zinc-200"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-zinc-100 rounded text-zinc-500 hover:text-zinc-800 transition-colors"
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* CONTINUOUS VERTICAL SCROLLABLE CANVAS CONTAINER */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 flex flex-col items-center gap-5 scroll-smooth"
      >
        {isLoading && (
          <div className="w-full flex-1 flex flex-col items-center gap-5 p-4 animate-pulse">
            <div className="w-full max-w-[440px] h-[560px] bg-white rounded-[3px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-zinc-200 p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-5 w-40 bg-zinc-200 rounded" />
                <div className="h-3 w-24 bg-zinc-100 rounded" />
              </div>
              <div className="space-y-2.5">
                <div className="h-3 bg-zinc-100 rounded w-full" />
                <div className="h-3 bg-zinc-100 rounded w-11/12" />
                <div className="h-3 bg-zinc-100 rounded w-4/5" />
                <div className="h-3 bg-zinc-100 rounded w-2/3" />
              </div>
              <div className="h-32 bg-zinc-50 rounded border border-zinc-100" />
              <div className="space-y-2">
                <div className="h-3 bg-zinc-100 rounded w-3/4" />
                <div className="h-3 bg-zinc-100 rounded w-1/2" />
              </div>
            </div>
          </div>
        )}

        {loadError && (
          <div className="my-auto flex flex-col items-center justify-center p-6 text-center max-w-xs bg-white rounded-lg border border-zinc-200">
            <p className="text-xs text-zinc-600 mb-3">
              Unable to render PDF: {loadError}
            </p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-zinc-900 text-white rounded text-xs font-medium"
            >
              Open Directly
            </a>
          </div>
        )}

        {/* Render all pages vertically so users can scroll through the entire PDF */}
        {!isLoading && pdfDoc && numPages > 0 && (
          Array.from({ length: numPages }, (_, index) => (
            <PdfPageItem
              key={`page-${index + 1}`}
              doc={pdfDoc}
              pageNumber={index + 1}
              zoomScale={zoomScale}
              containerWidth={containerWidth}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default PdfCanvasPreview;
