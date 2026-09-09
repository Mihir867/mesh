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
      className={`lg:col-span-6 xl:col-span-5 border-b lg:border-b-0 lg:border-r flex flex-col relative select-none h-full min-h-0 overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)'
      }}
    >
      {/* Hidden File Input strictly restricting formats */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv,.xlsx,.xls,.docx,.doc,.txt,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* DRAG OVERLAY */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          border: '2px dashed var(--color-accent)',
          padding: '32px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-accent-subtle)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '12px'
          }}>
            <Upload className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          </div>
          <p style={{
            fontSize: '15px',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)',
            marginBottom: '4px'
          }}>
            Drop document to inspect
          </p>
          <p style={{
            fontSize: '13px',
            fontWeight: 'var(--font-weight-regular)',
            color: 'var(--color-text-tertiary)'
          }}>
            PDF, Excel, Word, CSV, TXT
          </p>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <div className="shrink-0 px-4 h-12 flex items-center justify-between" style={{
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)'
      }}>
        <div className="flex items-center gap-2.5">
          <div style={{
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)'
          }}>
            {previewType === "pdf" ? (
              <FileText className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
            ) : previewType === "xlsx" ? (
              <FileSpreadsheet className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
            ) : previewType === "csv" ? (
              <FileSpreadsheet className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
            ) : previewType === "docx" ? (
              <File className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
            ) : (
              <FileCode className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
            )}
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.006em'
          }}>
            Document Inspector
          </span>
          {(activeFile || uploadedFileMeta) && !unsupportedFile && (
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-tertiary)',
              border: '1px solid var(--color-border)',
              textTransform: 'uppercase',
              fontWeight: 'var(--font-weight-medium)',
              letterSpacing: '0.02em'
            }}>
              {previewType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(activeFile || uploadedFileMeta || unsupportedFile) && (
            <>
              {(activeFile || uploadedFileMeta) && (
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  style={{
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-tertiary)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease-out'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  }}
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
                style={{
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-tertiary)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease-out'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface)';
                  e.currentTarget.style.color = 'var(--color-danger)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
                title="Remove document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                  fontWeight: 'var(--font-weight-medium)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease-out',
                  letterSpacing: '-0.006em'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Choose File
              </button>
            </>
          )}
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-2" style={{
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          color: 'var(--color-danger)',
          fontSize: '13px'
        }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* DYNAMIC CONTENT CONTAINER */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {/* =================================================================== */}
        {/* STATE 1: UNSUPPORTED FORMAT ERROR */}
        {/* =================================================================== */}
        {unsupportedFile && (
          <div className="flex-1 min-h-0 p-8 flex flex-col items-center justify-center text-center overflow-y-auto" style={{
            background: 'var(--color-surface)'
          }}>
            <div className="w-full max-w-md rounded-lg p-8 flex flex-col items-center" style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '16px'
              }}>
                <FileWarning className="w-7 h-7" style={{ color: 'var(--color-danger)' }} />
              </div>

              <h3 style={{
                fontSize: '16px',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: '8px'
              }}>
                Unsupported Document Format
              </h3>

              <p style={{
                fontSize: '13px',
                fontWeight: 'var(--font-weight-regular)',
                color: 'var(--color-text-secondary)',
                lineHeight: '1.5',
                marginBottom: '16px'
              }}>
                You uploaded{" "}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-surface)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  {unsupportedFile.name}
                </span>
                . MESH supports specific enterprise document formats.
              </p>

              {/* Supported formats */}
              <div style={{
                width: '100%',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: '12px',
                marginBottom: '20px',
                textAlign: 'left'
              }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px'
                }}>
                  Supported Formats
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '6px',
                  fontSize: '13px'
                }}>
                  {['PDF', 'Excel (XLSX, XLS)', 'Word (DOCX, DOC)', 'CSV & Text'].map((format) => (
                    <div key={format} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--color-text-secondary)',
                      background: 'var(--color-bg)',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--color-accent)'
                      }} />
                      <span>{format}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    height: '32px',
                    padding: '0 16px',
                    fontSize: '13px',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'white',
                    background: 'var(--color-accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'background 120ms ease-out',
                    letterSpacing: '-0.006em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-accent-hover)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Choose Supported File
                </button>
                <button
                  onClick={handleClear}
                  style={{
                    height: '32px',
                    padding: '0 16px',
                    fontSize: '13px',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-primary)',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease-out',
                    letterSpacing: '-0.006em'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE 2: SKELETON LOADER */}
        {/* =================================================================== */}
        {isUploading && !unsupportedFile && (
          <div className="flex-1 min-h-0 w-full h-full p-6 flex flex-col justify-between overflow-hidden" style={{
            background: 'var(--color-bg)'
          }}>
            <div className="w-full flex-1 flex flex-col justify-between space-y-6">
              {/* Document Title & Status Skeleton */}
              <div className="flex items-center justify-between pb-5 shrink-0" style={{
                borderBottom: '1px solid var(--color-border-subtle)'
              }}>
                <div className="space-y-2">
                  <div className="skeleton h-6 w-60 rounded-md" />
                  <div className="skeleton h-3.5 w-36 rounded" />
                </div>
                <div className="skeleton h-8 w-24 rounded-lg" />
              </div>

              {/* Paragraph Skeleton Lines */}
              <div className="space-y-3 shrink-0">
                <div className="skeleton h-3.5 rounded w-full" />
                <div className="skeleton h-3.5 rounded w-11/12" />
                <div className="skeleton h-3.5 rounded w-4/5" />
                <div className="skeleton h-3.5 rounded w-2/3" />
              </div>

              {/* Table Skeleton */}
              <div className="flex-1 min-h-0 rounded-lg overflow-hidden p-3 flex flex-col justify-between space-y-2.5" style={{
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)'
              }}>
                <div className="grid grid-cols-5 gap-3 pb-3" style={{
                  borderBottom: '1px solid var(--color-border)'
                }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton h-3.5 rounded" />
                  ))}
                </div>
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="grid grid-cols-5 gap-3 py-1.5">
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="skeleton h-3 rounded" />
                    ))}
                  </div>
                ))}
              </div>

              {/* Bottom Paragraph Lines */}
              <div className="space-y-2.5 shrink-0 pt-2" style={{
                borderTop: '1px solid var(--color-border-subtle)'
              }}>
                <div className="skeleton h-3.5 rounded w-5/6" />
                <div className="skeleton h-3.5 rounded w-1/2" />
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE 3: EMPTY DROPZONE STATE */}
        {/* =================================================================== */}
        {!isUploading && !activeFile && !uploadedFileMeta && !unsupportedFile && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 p-8 flex flex-col items-center justify-center text-center cursor-pointer group transition-colors"
            style={{ background: 'var(--color-surface)' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-bg)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
          >
            <div style={{
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              transition: 'all 120ms ease-out'
            }}
            className="group-hover:border-[var(--color-border-strong)]">
              <Upload className="w-6 h-6" style={{ 
                color: 'var(--color-text-tertiary)',
                transition: 'color 120ms ease-out'
              }} />
            </div>

            <h3 style={{
              fontSize: '15px',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              marginBottom: '6px'
            }}>
              Upload or drag document here
            </h3>
            <p style={{
              fontSize: '13px',
              fontWeight: 'var(--font-weight-regular)',
              color: 'var(--color-text-secondary)',
              maxWidth: '280px',
              lineHeight: '1.5',
              marginBottom: '24px'
            }}>
              Drop PDF, Excel, Word, CSV, or text files to inspect and parse.
            </p>

            <button
              type="button"
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent)',
                border: 'none',
                color: 'white',
                fontSize: '13px',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
                transition: 'background 120ms ease-out',
                letterSpacing: '-0.006em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-accent-hover)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
            >
              <Upload className="w-3.5 h-3.5" />
              Browse Files
            </button>

            {/* Supported Format Badges */}
            <div className="mt-8 pt-6 flex items-center gap-2 flex-wrap justify-center" style={{
              borderTop: '1px solid var(--color-border-subtle)',
              fontSize: '11px',
              color: 'var(--color-text-tertiary)'
            }}>
              {['PDF', 'XLSX', 'DOCX', 'CSV', 'TXT'].map((format, idx) => (
                <React.Fragment key={format}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    fontWeight: 'var(--font-weight-medium)'
                  }}>
                    {format}
                  </span>
                  {idx < 4 && <span>·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE 4: PREVIEW RENDERERS                                          */}
        {/* =================================================================== */}
        {!isUploading && (activeFile || uploadedFileMeta) && !unsupportedFile && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3" style={{
            background: 'var(--color-surface)'
          }}>
            {/* 4A: PDF PREVIEW */}
            {previewType === "pdf" && (blobUrl || uploadedFileMeta?.fileUrl || uploadedFileMeta?.url) && (
              <PdfCanvasPreview
                fileUrl={blobUrl || uploadedFileMeta?.fileUrl || uploadedFileMeta?.url!}
                fileName={activeFile?.name || uploadedFileMeta?.name || "Document.pdf"}
              />
            )}

            {/* 4B: XLSX / EXCEL PREVIEW */}
            {previewType === "xlsx" && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg" style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)'
              }}>
                {/* Excel Formula Bar */}
                <div className="h-8 px-3 flex items-center gap-2 text-xs font-mono shrink-0 select-none" style={{
                  background: 'var(--color-surface)',
                  borderBottom: '1px solid var(--color-border)'
                }}>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-primary)'
                  }}>
                    {selectedCell
                      ? `${getColLetter(selectedCell.col)}${selectedCell.row + 1}`
                      : "A1"}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-tertiary)'
                  }}>
                    fx
                  </span>
                  <div style={{
                    flex: 1,
                    padding: '2px 8px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedCell?.val ?? ""}
                  </div>
                </div>

                {/* Spreadsheet Grid */}
                <div className="flex-1 min-h-0 overflow-auto font-mono text-xs">
                  {currentSheet && (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 select-none" style={{
                        background: 'var(--color-surface)',
                        borderBottom: '1px solid var(--color-border)'
                      }}>
                        <tr>
                          <th style={{
                            width: '40px',
                            padding: '6px 8px',
                            border: '1px solid var(--color-border)',
                            fontSize: '10px',
                            color: 'var(--color-text-tertiary)',
                            background: 'var(--color-surface)',
                            fontWeight: 'var(--font-weight-medium)'
                          }}>
                            #
                          </th>
                          {currentSheet.data[0]?.map((_, colIdx) => (
                            <th
                              key={colIdx}
                              style={{
                                padding: '6px 12px',
                                border: '1px solid var(--color-border)',
                                fontSize: '10px',
                                color: 'var(--color-text-secondary)',
                                fontWeight: 'var(--font-weight-medium)',
                                textAlign: 'center',
                                minWidth: '90px',
                                background: 'var(--color-surface)'
                              }}
                            >
                              {getColLetter(colIdx)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedXlsxRows.map((row, rOffset) => {
                          const rowIdx = xlsxPage * XLSX_ROWS_PER_PAGE + rOffset;
                          return (
                            <tr
                              key={rowIdx}
                              style={{
                                transition: 'background 120ms ease-out'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{
                                padding: '4px 8px',
                                border: '1px solid var(--color-border)',
                                fontSize: '10px',
                                color: 'var(--color-text-tertiary)',
                                textAlign: 'center',
                                background: 'var(--color-surface)',
                                fontFamily: 'var(--font-mono)'
                              }}>
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
                                    style={{
                                      padding: '6px 10px',
                                      border: '1px solid var(--color-border)',
                                      fontSize: '11px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      maxWidth: '180px',
                                      cursor: 'cell',
                                      transition: 'all 120ms ease-out',
                                      ...(isSelected ? {
                                        background: 'var(--color-accent-subtle)',
                                        color: 'var(--color-accent)',
                                        fontWeight: 'var(--font-weight-medium)',
                                        outline: '1px solid var(--color-accent)'
                                      } : {
                                        color: 'var(--color-text-secondary)'
                                      })
                                    }}
                                    onMouseOver={(e) => {
                                      if (!isSelected) e.currentTarget.style.background = 'var(--color-surface)';
                                    }}
                                    onMouseOut={(e) => {
                                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    }}
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
                <div className="shrink-0 h-9 px-2 flex items-center justify-between gap-2 overflow-x-auto text-xs font-mono select-none" style={{
                  background: 'var(--color-surface)',
                  borderTop: '1px solid var(--color-border)'
                }}>
                  <div className="flex items-center gap-1">
                    {sheets.map((sheet, idx) => (
                      <button
                        key={sheet.name}
                        onClick={() => {
                          setActiveSheetIndex(idx);
                          setXlsxPage(0);
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '11px',
                          fontWeight: 'var(--font-weight-medium)',
                          transition: 'all 120ms ease-out',
                          ...(activeSheetIndex === idx ? {
                            background: 'var(--color-bg)',
                            color: 'var(--color-accent)',
                            border: '1px solid var(--color-border)'
                          } : {
                            color: 'var(--color-text-secondary)',
                            border: '1px solid transparent'
                          })
                        }}
                        onMouseOver={(e) => {
                          if (activeSheetIndex !== idx) {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (activeSheetIndex !== idx) {
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                          }
                        }}
                      >
                        {sheet.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 shrink-0" style={{
                    fontSize: '11px',
                    color: 'var(--color-text-tertiary)'
                  }}>
                    {totalXlsxRows > XLSX_ROWS_PER_PAGE && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setXlsxPage((p) => Math.max(0, p - 1))}
                          disabled={xlsxPage === 0}
                          style={{
                            padding: '4px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'transparent',
                            border: 'none',
                            cursor: xlsxPage === 0 ? 'not-allowed' : 'pointer',
                            opacity: xlsxPage === 0 ? 0.3 : 1,
                            transition: 'all 120ms ease-out'
                          }}
                          onMouseOver={(e) => {
                            if (xlsxPage !== 0) e.currentTarget.style.background = 'var(--color-bg)';
                          }}
                          onMouseOut={(e) => {
                            if (xlsxPage !== 0) e.currentTarget.style.background = 'transparent';
                          }}
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
                          style={{
                            padding: '4px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'transparent',
                            border: 'none',
                            cursor: (xlsxPage + 1) * XLSX_ROWS_PER_PAGE >= totalXlsxRows ? 'not-allowed' : 'pointer',
                            opacity: (xlsxPage + 1) * XLSX_ROWS_PER_PAGE >= totalXlsxRows ? 0.3 : 1,
                            transition: 'all 120ms ease-out'
                          }}
                          onMouseOver={(e) => {
                            if ((xlsxPage + 1) * XLSX_ROWS_PER_PAGE < totalXlsxRows) {
                              e.currentTarget.style.background = 'var(--color-bg)';
                            }
                          }}
                          onMouseOut={(e) => {
                            if ((xlsxPage + 1) * XLSX_ROWS_PER_PAGE < totalXlsxRows) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
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

      {/* BOTTOM STATUS BAR - Premium minimal */}
      <div className="shrink-0 px-4 h-10 flex items-center justify-between" style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-text-tertiary)'
      }}>
        <div className="flex items-center gap-2">
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--color-success)'
          }} />
          <span>Parser Online</span>
        </div>

        <div className="flex items-center gap-3">
          {uploadedFileMeta?.id && (
            <span className="text-zinc-400 hidden sm:inline">
              {uploadedFileMeta.id}
            </span>
          )}
          {activeFile && <span>{formatFileSize(activeFile.size)}</span>}
          <span style={{
            color: 'var(--color-text-primary)',
            fontWeight: 'var(--font-weight-medium)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            Ready
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default DocumentUploadPanel;
