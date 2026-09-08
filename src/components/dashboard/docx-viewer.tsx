"use client";

import React, { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, FileText, Download } from "lucide-react";

export interface DocxViewerProps {
  file?: File | Blob | null;
  fileUrl?: string | null;
  fileName?: string;
}

export function DocxViewer({ file, fileUrl, fileName = "Document.docx" }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docxTargetRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [renderedWith, setRenderedWith] = useState<"docx-preview" | "mammoth" | null>(null);
  const [fallbackHtml, setFallbackHtml] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadDocx() {
      if (!file && !fileUrl) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setFallbackHtml(null);
      setRenderedWith(null);

      try {
        let arrayBuffer: ArrayBuffer;

        if (file) {
          arrayBuffer = await file.arrayBuffer();
        } else if (fileUrl) {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error(`Failed to fetch document: ${res.status}`);
          arrayBuffer = await res.arrayBuffer();
        } else {
          return;
        }

        if (isCancelled) return;

        // Try primary renderer: docx-preview (renders authentic pages with exact Word layout)
        try {
          const { renderAsync } = await import("docx-preview");
          if (isCancelled) return;

          if (docxTargetRef.current) {
            docxTargetRef.current.innerHTML = "";
            await renderAsync(arrayBuffer, docxTargetRef.current, undefined, {
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              breakPages: true,
              renderHeaders: true,
              renderFooters: true,
              className: "docx-rendered-content",
            });
            if (!isCancelled) {
              setRenderedWith("docx-preview");
              setIsLoading(false);
              return;
            }
          }
        } catch (docxErr) {
          console.warn("[DocxViewer] docx-preview failed, attempting mammoth HTML fallback:", docxErr);
        }

        if (isCancelled) return;

        // Secondary fallback: mammoth HTML conversion (works great for older or non-standard docx)
        try {
          const mammoth = await import("mammoth");
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!isCancelled) {
            setFallbackHtml(result.value || "<p class='text-zinc-500 italic'>Document contains no text content.</p>");
            setRenderedWith("mammoth");
            setIsLoading(false);
            return;
          }
        } catch (mammothErr) {
          console.warn("[DocxViewer] mammoth fallback failed:", mammothErr);
        }

        throw new Error("Unable to parse Word document format.");
      } catch (err: any) {
        if (!isCancelled) {
          console.error("[DocxViewer] Load error:", err);
          setLoadError(err.message || "Failed to render Word document preview.");
          setIsLoading(false);
        }
      }
    }

    loadDocx();

    return () => {
      isCancelled = true;
    };
  }, [file, fileUrl]);

  const handleZoomIn = () => setZoomScale((prev) => Math.min(prev + 0.15, 1.8));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(prev - 0.15, 0.6));
  const handleZoomReset = () => setZoomScale(1.0);

  return (
    <div className="w-full h-full flex flex-col bg-[#f8f9fa] overflow-hidden font-sans select-text">
      {/* TOOLBAR */}
      <div className="shrink-0 px-3 py-1.5 bg-white border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-600 select-none font-sans">
        <div className="flex items-center gap-2 overflow-hidden pr-2">
          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate font-medium text-zinc-800 text-[11px] font-sans" title={fileName}>
            {fileName}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-sans uppercase">
            DOCX
          </span>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1 shrink-0 font-sans">
          <button
            onClick={handleZoomOut}
            disabled={isLoading || zoomScale <= 0.6}
            className="p-1 hover:bg-zinc-100 rounded text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-40"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomReset}
            disabled={isLoading}
            className="px-1.5 py-0.5 hover:bg-zinc-100 rounded text-[11px] font-mono text-zinc-600 hover:text-zinc-900 transition-colors"
            title="Reset zoom"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={isLoading || zoomScale >= 1.8}
            className="p-1 hover:bg-zinc-100 rounded text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-40"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {fileUrl && (
            <a
              href={fileUrl}
              download={fileName}
              className="p-1 hover:bg-zinc-100 rounded text-zinc-500 hover:text-zinc-800 transition-colors ml-1"
              title="Download original file"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* DOCUMENT PAGE SCROLL CONTAINER */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 sm:p-6 flex flex-col items-center gap-6 scroll-smooth"
      >
        {/* SKELETON LOADER (ZERO SPINNERS) */}
        {isLoading && (
          <div className="w-full flex-1 flex flex-col items-center gap-5 p-4 animate-pulse font-sans">
            <div className="w-full max-w-[500px] min-h-[580px] bg-white rounded-[4px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-zinc-200 p-8 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="h-6 w-3/4 bg-zinc-200 rounded" />
                <div className="h-3 w-1/3 bg-zinc-100 rounded" />
              </div>
              <div className="space-y-3 my-6">
                <div className="h-3.5 bg-zinc-100 rounded w-full" />
                <div className="h-3.5 bg-zinc-100 rounded w-11/12" />
                <div className="h-3.5 bg-zinc-100 rounded w-4/5" />
                <div className="h-3.5 bg-zinc-100 rounded w-5/6" />
                <div className="h-3.5 bg-zinc-100 rounded w-2/3" />
              </div>
              <div className="h-28 bg-zinc-50 rounded border border-zinc-100 mb-6" />
              <div className="space-y-2.5">
                <div className="h-3.5 bg-zinc-100 rounded w-full" />
                <div className="h-3.5 bg-zinc-100 rounded w-4/5" />
                <div className="h-3.5 bg-zinc-100 rounded w-1/2" />
              </div>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {loadError && (
          <div className="my-auto flex flex-col items-center justify-center p-6 text-center max-w-sm bg-white rounded-lg border border-zinc-200 shadow-sm font-sans">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-xs text-zinc-700 font-medium mb-1">Unable to display Word preview</p>
            <p className="text-[11px] text-zinc-500 mb-4">{loadError}</p>
            {fileUrl && (
              <a
                href={fileUrl}
                download={fileName}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-medium transition-colors"
              >
                Download Document
              </a>
            )}
          </div>
        )}

        {/* RENDER TARGET FOR DOCX-PREVIEW */}
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: "top center",
            transition: "transform 0.15s ease-out",
          }}
          className={`w-full flex flex-col items-center ${isLoading || loadError ? "hidden" : "block"}`}
        >
          {/* Target container for docx-preview */}
          <div
            ref={docxTargetRef}
            className={`docx-preview-wrapper ${renderedWith === "docx-preview" ? "block" : "hidden"}`}
          />

          {/* Fallback container for mammoth converted HTML */}
          {renderedWith === "mammoth" && fallbackHtml && (
            <div className="w-full max-w-[620px] bg-white rounded-[4px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-zinc-200 p-8 sm:p-10 prose prose-sm prose-zinc max-w-none text-zinc-900 leading-relaxed font-sans">
              <div dangerouslySetInnerHTML={{ __html: fallbackHtml }} />
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        /* Scoped styling for docx-preview generated content */
        .docx-preview-wrapper .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 24px !important;
        }

        .docx-preview-wrapper .docx-rendered-content,
        .docx-preview-wrapper section.docx {
          background: #ffffff !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06) !important;
          border: 1px solid #e4e4e7 !important;
          border-radius: 4px !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          color: #18181b !important;
        }

        .docx-preview-wrapper table {
          border-collapse: collapse !important;
          width: 100% !important;
          margin: 12px 0 !important;
        }

        .docx-preview-wrapper td,
        .docx-preview-wrapper th {
          border: 1px solid #e4e4e7 !important;
          padding: 6px 10px !important;
        }
      `}</style>
    </div>
  );
}

export default DocxViewer;
