"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileCode,
  Trash2,
  AlertCircle,
  Search,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  FileWarning,
  RefreshCw,
  File,
} from "lucide-react";

// Dynamically import continuous-scroll, high-DPI canvas PDF preview with SSR disabled
const PdfCanvasPreview = dynamic(() => import("./pdf-canvas-preview"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex-1 flex flex-col items-center gap-5 p-6 animate-pulse">
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
  ),
});

// Dynamically import client-side DOCX Word renderer with SSR disabled
const DocxViewer = dynamic(() => import("./docx-viewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex-1 flex flex-col items-center gap-5 p-6 animate-pulse">
      <div className="w-full max-w-[480px] h-[580px] bg-white rounded-[3px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-zinc-200 p-8 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="h-5 w-48 bg-zinc-200 rounded" />
          <div className="h-3 w-28 bg-zinc-100 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-3 bg-zinc-100 rounded w-full" />
          <div className="h-3 bg-zinc-100 rounded w-11/12" />
          <div className="h-3 bg-zinc-100 rounded w-4/5" />
          <div className="h-3 bg-zinc-100 rounded w-2/3" />
        </div>
        <div className="h-28 bg-zinc-50 rounded border border-zinc-100" />
        <div className="space-y-2">
          <div className="h-3 bg-zinc-100 rounded w-3/4" />
          <div className="h-3 bg-zinc-100 rounded w-1/2" />
        </div>
      </div>
    </div>
  ),
});

export interface UploadedFile {
  id?: string;
  name: string;
  fileUrl?: string;
  url?: string;
  fileType?: string;
  mimeType?: string;
  type?: string;
  fileSize?: number;
  size?: number;
  status?: string;
  createdAt?: string;
}

export interface DocumentUploadPanelProps {
  onUploadStart?: () => void;
  onUploadSuccess?: (file: UploadedFile) => void;
  onClear?: () => void;
  restoredFile?: UploadedFile | null;
}

// Exactly the supported MIME types requested by the user
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
] as const;

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "csv",
  "xlsx",
  "xls",
  "docx",
  "doc",
  "txt",
] as const;

type PreviewType = "pdf" | "xlsx" | "csv" | "docx" | "text" | "unsupported";

interface ParsedSheet {
  name: string;
  data: (string | number | null)[][];
}

interface ParsedCsv {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface UnsupportedFileState {
  name: string;
  type: string;
  size: number;
}

export function DocumentUploadPanel({
  onUploadStart,
  onUploadSuccess,
  onClear,
  restoredFile,
}: DocumentUploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unsupportedFile, setUnsupportedFile] =
    useState<UnsupportedFileState | null>(null);
  const [uploadedFileMeta, setUploadedFileMeta] = useState<UploadedFile | null>(
    null,
  );

  // Local active file for instantaneous client preview
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>("unsupported");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Parsed spreadsheet data
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
    val: string;
  } | null>(null);
  const [xlsxPage, setXlsxPage] = useState(0);
  const XLSX_ROWS_PER_PAGE = 30;

  // Parsed CSV data
  const [csvData, setCsvData] = useState<ParsedCsv | null>(null);
  const [csvSearch, setCsvSearch] = useState("");
  const [csvPage, setCsvPage] = useState(0);
  const CSV_ROWS_PER_PAGE = 30;

  // Text data
  const [textContent, setTextContent] = useState<string>("");

  // Fullscreen preview toggle
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Clean up blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Validate allowed format
  const isFileSupported = (file: File): boolean => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const mime = file.type.toLowerCase();

    // Check exact MIME types
    if (
      ALLOWED_MIME_TYPES.some(
        (allowed) => mime === allowed || mime.startsWith(allowed),
      )
    ) {
      return true;
    }

    // Check fallback extension for OS/browser mismatches
    if (ext && (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      return true;
    }

    return false;
  };

  // Determine preview type
  const detectFileType = (file: { name: string; type?: string }): PreviewType => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const mime = (file.type || "").toLowerCase();

    if (ext === "pdf" || mime === "application/pdf") return "pdf";
    if (
      ext === "xlsx" ||
      ext === "xls" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel"
    ) {
      return "xlsx";
    }
    if (ext === "csv" || mime === "text/csv") return "csv";
    if (
      ext === "docx" ||
      ext === "doc" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/msword"
    ) {
      return "docx";
    }
    if (ext === "txt" || mime === "text/plain") return "text";

    return "unsupported";
  };

  // Sync restoredFile from parent when available
  useEffect(() => {
    if (restoredFile && !activeFile) {
      setUploadedFileMeta(restoredFile);
      const type = detectFileType({
        name: restoredFile.name,
        type: restoredFile.fileType || restoredFile.type,
      });
      setPreviewType(type);
    } else if (!restoredFile && !activeFile && uploadedFileMeta) {
      setUploadedFileMeta(null);
      setPreviewType("unsupported");
    }
  }, [restoredFile, activeFile]);

  // Load remote data for restored spreadsheet / text files
  useEffect(() => {
    const url = uploadedFileMeta?.fileUrl || uploadedFileMeta?.url;
    if (!url || activeFile) return;

    if (previewType === "xlsx" && sheets.length === 0) {
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          const workbook = XLSX.read(buffer, { type: "array" });
          const parsedSheets: ParsedSheet[] = workbook.SheetNames.map((name) => {
            const sheet = workbook.Sheets[name];
            const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(
              sheet,
              { header: 1 }
            );
            return { name, data };
          });
          setSheets(parsedSheets);
        })
        .catch((err) => console.error("[DocumentUploadPanel] Error loading restored excel:", err));
    } else if (previewType === "csv" && !csvData) {
      fetch(url)
        .then((res) => res.text())
        .then((text) => parseCsvText(text))
        .catch((err) => console.error("[DocumentUploadPanel] Error loading restored csv:", err));
    } else if (previewType === "text" && !textContent) {
      fetch(url)
        .then((res) => res.text())
        .then((text) => setTextContent(text))
        .catch((err) => console.error("[DocumentUploadPanel] Error loading restored text:", err));
    }
  }, [uploadedFileMeta, activeFile, previewType, sheets.length, csvData, textContent]);

  // Parse XLSX using SheetJS
  const parseExcel = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsedSheets: ParsedSheet[] = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(
          sheet,
          {
            header: 1,
            blankrows: false,
            defval: "",
          },
        );
        return { name, data };
      });
      setSheets(parsedSheets);
      setActiveSheetIndex(0);
      setXlsxPage(0);
      if (parsedSheets[0]?.data?.[0]?.[0] !== undefined) {
        setSelectedCell({
          row: 0,
          col: 0,
          val: String(parsedSheets[0].data[0][0]),
        });
      }
    } catch (err) {
      console.error("Failed to parse XLSX:", err);
      setErrorMessage("Could not parse Excel spreadsheet format.");
    }
  };

  // Parse CSV
  const parseCsvText = (text: string) => {
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);

    setCsvData({
      headers,
      rows,
      totalRows: rows.length,
    });
    setCsvPage(0);
  };

  // Core file processing pipeline
  const processFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);

      // Validate supported formats: PDF, CSV, XLSX, XLS, DOCX, DOC, TXT
      if (!isFileSupported(file)) {
        setUnsupportedFile({
          name: file.name,
          type: file.type || "unknown/binary",
          size: file.size,
        });
        return;
      }

      setUnsupportedFile(null);
      onUploadStart?.();
      setIsUploading(true);

      // Create object URL for client preview
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      setActiveFile(file);

      const type = detectFileType(file);
      setPreviewType(type);

      // Format specific parser triggers
      if (type === "xlsx") {
        await parseExcel(file);
      } else if (type === "csv") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) parseCsvText(text);
        };
        reader.readAsText(file);
      } else if (type === "text") {
        const reader = new FileReader();
        reader.onload = (e) => {
          setTextContent((e.target?.result as string) || "");
        };
        reader.readAsText(file);
      }

      // Attempt upload to server API
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          const fileObj: UploadedFile = {
            id: data.file?.id || `doc_${Date.now()}`,
            name: data.file?.name || file.name,
            fileUrl: data.file?.url || url,
            url: data.file?.url || url,
            fileType: data.file?.type || file.type,
            type: data.file?.type || file.type,
            fileSize: data.file?.size || file.size,
            size: data.file?.size || file.size,
            status: "ready",
            createdAt: new Date().toISOString(),
          };
          setUploadedFileMeta(fileObj);
          onUploadSuccess?.(fileObj);
        } else {
          // Fallback to local mode if Supabase credentials are not configured yet
          const fallbackObj: UploadedFile = {
            id: `local_${Date.now()}`,
            name: file.name,
            fileUrl: url,
            url: url,
            fileType: file.type,
            type: file.type,
            fileSize: file.size,
            size: file.size,
            status: "ready",
            createdAt: new Date().toISOString(),
          };
          setUploadedFileMeta(fallbackObj);
          onUploadSuccess?.(fallbackObj);
        }
      } catch {
        // Local offline fallback
        const fallbackObj: UploadedFile = {
          id: `local_${Date.now()}`,
          name: file.name,
          fileUrl: url,
          url: url,
          fileType: file.type,
          type: file.type,
          fileSize: file.size,
          size: file.size,
          status: "ready",
          createdAt: new Date().toISOString(),
        };
        setUploadedFileMeta(fallbackObj);
        onUploadSuccess?.(fallbackObj);
      } finally {
        // Clean skeleton transition
        setTimeout(() => {
          setIsUploading(false);
        }, 600);
      }
    },
    [onUploadSuccess],
  );

  // Handle Drag Events across the entire panel
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
      e.dataTransfer.clearData();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    setActiveFile(null);
    setBlobUrl(null);
    setPreviewType("unsupported");
    setUploadedFileMeta(null);
    setUnsupportedFile(null);
    setSheets([]);
    setCsvData(null);
    setTextContent("");
    setSelectedCell(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClear?.();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Column letters (A, B, C, ... AA, AB)
  const getColLetter = (index: number): string => {
    let letter = "";
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  };

  const currentSheet = sheets[activeSheetIndex];
  const totalXlsxRows = currentSheet?.data?.length || 0;
  const paginatedXlsxRows =
    currentSheet?.data?.slice(
      xlsxPage * XLSX_ROWS_PER_PAGE,
      (xlsxPage + 1) * XLSX_ROWS_PER_PAGE,
    ) || [];

  const filteredCsvRows = (csvData?.rows || []).filter((r) =>
    csvSearch
      ? r.some((c) => c.toLowerCase().includes(csvSearch.toLowerCase()))
      : true,
  );
  const totalCsvRows = filteredCsvRows.length;
  const paginatedCsvRows = filteredCsvRows.slice(
    csvPage * CSV_ROWS_PER_PAGE,
    (csvPage + 1) * CSV_ROWS_PER_PAGE,
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`lg:col-span-6 xl:col-span-5 border-b lg:border-b-0 lg:border-r border-zinc-200 bg-[#fafbfc] flex flex-col justify-between relative select-none h-full min-h-0 overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-50 bg-white" : ""
      }`}
    >
      {/* Hidden File Input strictly restricting formats */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv,.xlsx,.xls,.docx,.doc,.txt,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* DRAG OVERLAY: Full panel trigger */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm border-2 border-dashed border-indigo-600 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mb-3 shadow-sm">
            <Upload className="w-6 h-6 text-indigo-600 animate-bounce" />
          </div>
          <p className="text-sm font-semibold text-zinc-900">
            Drop document to inspect
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            PDF &bull; Excel &bull; Word &bull; CSV &bull; TXT
          </p>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
            {previewType === "pdf" ? (
              <FileText className="w-3.5 h-3.5 text-red-600" />
            ) : previewType === "xlsx" ? (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            ) : previewType === "csv" ? (
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            ) : previewType === "docx" ? (
              <File className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-zinc-600" />
            )}
          </div>
          <span className="text-xs font-semibold text-zinc-800 tracking-tight">
            DOCUMENT_INSPECTOR
          </span>
          {(activeFile || uploadedFileMeta) && !unsupportedFile && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200 uppercase font-medium">
              {previewType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {(activeFile || uploadedFileMeta || unsupportedFile) && (
            <>
              {(activeFile || uploadedFileMeta) && (
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Expand Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              <button
                onClick={handleClear}
                className="p-1.5 rounded-md hover:bg-red-50 text-zinc-500 hover:text-red-600 transition-colors"
                title="Remove document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-xs font-medium transition-all"
              >
                Choose File
              </button>
            </>
          )}
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="shrink-0 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* DYNAMIC CONTENT CONTAINER: STRICTLY CONSTRAINED */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {/* =================================================================== */}
        {/* STATE 1: DELIGHTFUL UNSUPPORTED FORMAT ERROR CARD                   */}
        {/* =================================================================== */}
        {unsupportedFile && (
          <div className="flex-1 min-h-0 p-6 sm:p-8 flex flex-col items-center justify-center text-center bg-zinc-50/70 overflow-y-auto">
            <div className="w-full max-w-md bg-white rounded-2xl border border-rose-200/80 p-6 sm:p-8 shadow-sm flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 mb-4 shadow-sm">
                <FileWarning className="w-7 h-7" />
              </div>

              <h3 className="text-base font-bold text-zinc-900 mb-1.5">
                Unsupported Document Format
              </h3>

              <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                You uploaded{" "}
                <span className="font-mono font-medium text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">
                  {unsupportedFile.name}
                </span>
                . DocStruct is designed exclusively for structured enterprise
                documents.
              </p>

              {/* Delightful accepted formats badge matrix */}
              <div className="w-full bg-zinc-50/80 rounded-xl border border-zinc-200/80 p-3.5 mb-5 text-left">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider font-mono mb-2">
                  Supported Document Formats
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-700 bg-white p-1.5 rounded border border-zinc-200/70">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>PDF (.pdf)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700 bg-white p-1.5 rounded border border-zinc-200/70">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Excel (.xlsx, .xls)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700 bg-white p-1.5 rounded border border-zinc-200/70">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Word (.docx, .doc)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700 bg-white p-1.5 rounded border border-zinc-200/70">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>CSV & Text (.csv, .txt)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Choose Supported File
                </button>
                <button
                  onClick={handleClear}
                  className="py-2 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE 2: FULL WIDTH & FULL HEIGHT SKELETON LOADER                    */}
        {/* =================================================================== */}
        {isUploading && !unsupportedFile && (
          <div className="flex-1 min-h-0 w-full h-full p-5 sm:p-7 flex flex-col justify-between overflow-hidden bg-white">
            <div className="w-full flex-1 flex flex-col justify-between space-y-6">
              {/* Document Title & Status Skeleton */}
              <div className="flex items-center justify-between pb-5 border-b border-zinc-100 shrink-0">
                <div className="space-y-2">
                  <div className="h-6 w-60 bg-zinc-200/90 rounded-md animate-pulse" />
                  <div className="h-3.5 w-36 bg-zinc-100 rounded animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-zinc-100 rounded-lg animate-pulse" />
              </div>

              {/* Paragraph Skeleton Lines */}
              <div className="space-y-3 shrink-0">
                <div className="h-3.5 bg-zinc-100 rounded w-full animate-pulse" />
                <div className="h-3.5 bg-zinc-100 rounded w-11/12 animate-pulse" />
                <div className="h-3.5 bg-zinc-100 rounded w-4/5 animate-pulse" />
                <div className="h-3.5 bg-zinc-100 rounded w-2/3 animate-pulse" />
              </div>

              {/* Full Width High-Density Table Skeleton */}
              <div className="flex-1 min-h-0 border border-zinc-200/80 rounded-xl overflow-hidden p-3 bg-zinc-50/50 flex flex-col justify-between space-y-2.5">
                <div className="grid grid-cols-5 gap-3 pb-3 border-b border-zinc-200/80">
                  <div className="h-3.5 bg-zinc-200 rounded animate-pulse" />
                  <div className="h-3.5 bg-zinc-200 rounded animate-pulse" />
                  <div className="h-3.5 bg-zinc-200 rounded animate-pulse" />
                  <div className="h-3.5 bg-zinc-200 rounded animate-pulse" />
                  <div className="h-3.5 bg-zinc-200 rounded animate-pulse" />
                </div>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-5 gap-3 py-1.5">
                    <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>

              {/* Bottom Paragraph Lines */}
              <div className="space-y-2.5 shrink-0 pt-2 border-t border-zinc-100">
                <div className="h-3.5 bg-zinc-100 rounded w-5/6 animate-pulse" />
                <div className="h-3.5 bg-zinc-100 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE 3: EMPTY DROPZONE STATE (LIGHT THEME)                          */}
        {/* =================================================================== */}
        {!isUploading && !activeFile && !uploadedFileMeta && !unsupportedFile && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer group hover:bg-white transition-colors"
          >
            <div className="w-14 h-14 rounded-xl bg-white border border-zinc-200 group-hover:border-zinc-300 group-hover:shadow-md flex items-center justify-center text-zinc-600 group-hover:text-zinc-900 transition-all shadow-sm mb-4">
              <Upload className="w-6 h-6 text-zinc-500 group-hover:text-indigo-600 transition-colors" />
            </div>

            <h3 className="text-sm font-semibold text-zinc-900 mb-1.5">
              Upload or drag document here
            </h3>
            <p className="text-xs text-zinc-500 max-w-[280px] leading-relaxed mb-6">
              Drop PDF, Excel (.xlsx, .xls), Word (.docx, .doc), CSV, or raw
              text to inspect and parse schema.
            </p>

            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-all shadow-sm flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              Browse Files
            </button>

            {/* Supported Format Badges */}
            <div className="mt-8 pt-6 border-t border-zinc-200/80 flex items-center gap-2 flex-wrap justify-center font-mono text-[11px] text-zinc-400">
              <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium">
                PDF
              </span>
              <span>&bull;</span>
              <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium">
                XLSX / XLS
              </span>
              <span>&bull;</span>
              <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium">
                DOCX / DOC
              </span>
              <span>&bull;</span>
              <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium">
                CSV
              </span>
              <span>&bull;</span>
              <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium">
                TXT
              </span>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE 4: PREVIEW RENDERERS                                          */}
        {/* =================================================================== */}
        {!isUploading && (activeFile || uploadedFileMeta) && !unsupportedFile && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 bg-[#f4f5f7]">
            {/* 4A: PDF PREVIEW (Multi-page continuous scroll, high-DPI retina rendering) */}
            {previewType === "pdf" && (blobUrl || uploadedFileMeta?.fileUrl || uploadedFileMeta?.url) && (
              <PdfCanvasPreview
                fileUrl={blobUrl || uploadedFileMeta?.fileUrl || uploadedFileMeta?.url!}
                fileName={activeFile?.name || uploadedFileMeta?.name || "Document.pdf"}
              />
            )}

            {/* 4B: XLSX / EXCEL PREVIEW (Strictly Contained, NO OVERFLOW) */}
            {previewType === "xlsx" && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white rounded-lg border border-zinc-200 shadow-sm">
                {/* Excel Formula Bar */}
                <div className="h-8 px-3 bg-zinc-50 border-b border-zinc-200 flex items-center gap-2 text-xs font-mono shrink-0 select-none">
                  <span className="text-zinc-600 font-bold text-[11px] px-1.5 py-0.5 bg-white rounded border border-zinc-200">
                    {selectedCell
                      ? `${getColLetter(selectedCell.col)}${selectedCell.row + 1}`
                      : "A1"}
                  </span>
                  <span className="text-zinc-400 font-sans font-semibold">
                    fx
                  </span>
                  <div className="flex-1 px-2 py-0.5 bg-white border border-zinc-200 rounded text-zinc-800 text-[11px] truncate">
                    {selectedCell?.val ?? ""}
                  </div>
                </div>

                {/* Spreadsheet Grid - STRICTLY CONSTRAINED SCROLL CONTAINER */}
                <div className="flex-1 min-h-0 overflow-auto font-mono text-xs">
                  {currentSheet && (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-zinc-100 z-10 select-none border-b border-zinc-200">
                        <tr>
                          <th className="w-10 px-2 py-1.5 border border-zinc-200 text-[10px] text-zinc-500 bg-zinc-100 font-medium">
                            #
                          </th>
                          {currentSheet.data[0]?.map((_, colIdx) => (
                            <th
                              key={colIdx}
                              className="px-3 py-1.5 border border-zinc-200 text-[10px] text-zinc-600 font-semibold text-center min-w-[90px] bg-zinc-100"
                            >
                              {getColLetter(colIdx)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {paginatedXlsxRows.map((row, rOffset) => {
                          const rowIdx =
                            xlsxPage * XLSX_ROWS_PER_PAGE + rOffset;
                          return (
                            <tr
                              key={rowIdx}
                              className="hover:bg-zinc-50 transition-colors"
                            >
                              <td className="px-2 py-1 border border-zinc-200 text-[10px] text-zinc-400 text-center bg-zinc-50/80 select-none font-mono">
                                {rowIdx + 1}
                              </td>
                              {row.map((cell, colIdx) => {
                                const isSelected =
                                  selectedCell?.row === rowIdx &&
                                  selectedCell?.col === colIdx;
                                return (
                                  <td
                                    key={colIdx}
                                    onClick={() =>
                                      setSelectedCell({
                                        row: rowIdx,
                                        col: colIdx,
                                        val: String(cell ?? ""),
                                      })
                                    }
                                    title={String(cell ?? "")}
                                    className={`px-2.5 py-1.5 border border-zinc-200 text-[11px] truncate max-w-[180px] cursor-cell transition-all ${
                                      isSelected
                                        ? "bg-indigo-50 text-indigo-900 ring-1 ring-inset ring-indigo-500 font-medium"
                                        : "text-zinc-700 hover:bg-zinc-50"
                                    }`}
                                  >
                                    {String(cell ?? "")}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Bottom Bar: Sheet Tabs & Pagination */}
                <div className="shrink-0 h-9 px-2 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-2 overflow-x-auto text-xs font-mono select-none">
                  <div className="flex items-center gap-1">
                    {sheets.map((sheet, idx) => (
                      <button
                        key={sheet.name}
                        onClick={() => {
                          setActiveSheetIndex(idx);
                          setXlsxPage(0);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          activeSheetIndex === idx
                            ? "bg-white text-indigo-600 border border-zinc-200 shadow-sm"
                            : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        {sheet.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 shrink-0">
                    {totalXlsxRows > XLSX_ROWS_PER_PAGE && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setXlsxPage((p) => Math.max(0, p - 1))}
                          disabled={xlsxPage === 0}
                          className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30"
                          title="Previous rows"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span>
                          {xlsxPage * XLSX_ROWS_PER_PAGE + 1}-
                          {Math.min(
                            (xlsxPage + 1) * XLSX_ROWS_PER_PAGE,
                            totalXlsxRows,
                          )}{" "}
                          of {totalXlsxRows}
                        </span>
                        <button
                          onClick={() =>
                            setXlsxPage((p) =>
                              (p + 1) * XLSX_ROWS_PER_PAGE < totalXlsxRows
                                ? p + 1
                                : p,
                            )
                          }
                          disabled={
                            (xlsxPage + 1) * XLSX_ROWS_PER_PAGE >= totalXlsxRows
                          }
                          className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30"
                          title="Next rows"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <span className="hidden sm:inline">
                      {totalXlsxRows} rows
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 4C: CSV PREVIEW (Strictly Contained, NO OVERFLOW) */}
            {previewType === "csv" && csvData && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white rounded-lg border border-zinc-200 shadow-sm">
                {/* Search Bar */}
                <div className="h-9 px-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-2 shrink-0 text-xs">
                  <div className="flex items-center gap-2 flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Filter records..."
                      value={csvSearch}
                      onChange={(e) => {
                        setCsvSearch(e.target.value);
                        setCsvPage(0);
                      }}
                      className="w-full bg-transparent border-0 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 shrink-0">
                    {totalCsvRows} records &bull; {csvData.headers.length}{" "}
                    columns
                  </div>
                </div>

                {/* CSV Table - STRICTLY CONSTRAINED SCROLL CONTAINER */}
                <div className="flex-1 min-h-0 overflow-auto font-mono text-xs">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-zinc-100 z-10 border-b border-zinc-200">
                      <tr>
                        <th className="w-10 px-2 py-1.5 border border-zinc-200 text-[10px] text-zinc-500 bg-zinc-100 text-center font-medium">
                          #
                        </th>
                        {csvData.headers.map((h, i) => (
                          <th
                            key={i}
                            className="px-3 py-1.5 border border-zinc-200 text-[11px] font-semibold text-zinc-700 text-left whitespace-nowrap bg-zinc-100"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {paginatedCsvRows.map((row, rOffset) => {
                        const rowIdx = csvPage * CSV_ROWS_PER_PAGE + rOffset;
                        return (
                          <tr
                            key={rowIdx}
                            className="hover:bg-zinc-50 transition-colors"
                          >
                            <td className="px-2 py-1 text-[10px] text-zinc-400 text-center bg-zinc-50/80 border-r border-zinc-200 select-none">
                              {rowIdx + 1}
                            </td>
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                title={cell}
                                className="px-3 py-1.5 text-[11px] text-zinc-700 whitespace-nowrap border-r border-zinc-200 max-w-[200px] truncate"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* CSV Bottom Pagination */}
                {totalCsvRows > CSV_ROWS_PER_PAGE && (
                  <div className="shrink-0 h-8 px-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs font-mono text-zinc-500">
                    <span>
                      Showing {csvPage * CSV_ROWS_PER_PAGE + 1}-
                      {Math.min(
                        (csvPage + 1) * CSV_ROWS_PER_PAGE,
                        totalCsvRows,
                      )}{" "}
                      of {totalCsvRows}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCsvPage((p) => Math.max(0, p - 1))}
                        disabled={csvPage === 0}
                        className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setCsvPage((p) =>
                            (p + 1) * CSV_ROWS_PER_PAGE < totalCsvRows
                              ? p + 1
                              : p,
                          )
                        }
                        disabled={
                          (csvPage + 1) * CSV_ROWS_PER_PAGE >= totalCsvRows
                        }
                        className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4D: WORD DOCUMENT PREVIEW (.docx, .doc) */}
            {previewType === "docx" && (
              <DocxViewer
                file={activeFile}
                fileUrl={blobUrl || uploadedFileMeta?.fileUrl || uploadedFileMeta?.url}
                fileName={activeFile?.name || uploadedFileMeta?.name || "Document.docx"}
              />
            )}

            {/* 4E: TEXT PREVIEW */}
            {previewType === "text" && (
              <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden font-sans">
                <div className="shrink-0 px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-600 select-none">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="font-medium text-zinc-800 text-[11px] truncate max-w-[200px]">
                      {activeFile?.name || uploadedFileMeta?.name || "Document.txt"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 uppercase">
                      TXT
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {textContent.length} chars
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 font-mono text-xs text-zinc-800 leading-relaxed select-text bg-[#fcfcfc]">
                  <pre className="whitespace-pre-wrap font-mono font-normal">
                    {textContent || "(Empty file)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM STATUS BAR (LIGHT THEME) */}
      <div className="shrink-0 px-4 py-2.5 bg-white border-t border-zinc-200 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>PARSER_ENGINE: ONLINE</span>
        </div>

        <div className="flex items-center gap-3">
          {uploadedFileMeta?.id && (
            <span className="text-zinc-400 hidden sm:inline">
              REF: {uploadedFileMeta.id}
            </span>
          )}
          {activeFile && <span>SIZE: {formatFileSize(activeFile.size)}</span>}
          <span className="text-zinc-700 font-medium flex items-center gap-1">
            READY
            <ChevronRight className="w-3 h-3 text-zinc-400" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default DocumentUploadPanel;
