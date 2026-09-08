"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Copy,
  Check,
  Download,
  Code2,
  Cpu,
  Database,
  Sparkles,
  FileCode2,
  AlertCircle,
  RotateCw,
  FastForward,
} from "lucide-react";

export interface JsonOutputPanelProps {
  jsonData?: object | null;
  category?: string | null;
  summary?: string | null;
  isProcessing?: boolean;
  isStreaming?: boolean;
  processingTimeMs?: number;
  confidenceScore?: number;
  errorMessage?: string | null;
  onRetry?: () => void;
  onOpenChat?: () => void;
}

export function JsonOutputPanel({
  jsonData = null,
  category = null,
  summary = null,
  isProcessing = false,
  isStreaming = false,
  processingTimeMs = 847,
  confidenceScore = 0.98,
  errorMessage = null,
  onRetry,
  onOpenChat,
}: JsonOutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [renderedLineCount, setRenderedLineCount] = useState<number>(0);
  const [isActivelyTyping, setIsActivelyTyping] = useState<boolean>(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const jsonString = jsonData ? JSON.stringify(jsonData, null, 2) : "";
  const allLines = jsonString ? jsonString.split("\n") : [];
  const totalLines = allLines.length;

  // Typewriter streaming effect line by line
  useEffect(() => {
    if (!jsonData || isProcessing) {
      setRenderedLineCount(0);
      setIsActivelyTyping(false);
      return;
    }

    if (isStreaming && totalLines > 0) {
      setIsActivelyTyping(true);
      setRenderedLineCount(1);

      // Dynamic pacing: shorter documents stream at ~22ms/line, longer documents at ~8-12ms/line
      const lineIntervalMs = totalLines > 100 ? 8 : totalLines > 40 ? 14 : 22;

      let current = 1;
      const interval = setInterval(() => {
        current += 1;
        if (current >= totalLines) {
          setRenderedLineCount(totalLines);
          setIsActivelyTyping(false);
          clearInterval(interval);
        } else {
          setRenderedLineCount(current);
        }
      }, lineIntervalMs);

      return () => clearInterval(interval);
    } else {
      // Direct render (session restore or instant complete)
      setRenderedLineCount(totalLines);
      setIsActivelyTyping(false);
    }
  }, [jsonData, isStreaming, isProcessing, totalLines]);

  // Auto-scroll smooth follow during typewriter streaming
  useEffect(() => {
    if (isActivelyTyping && codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [renderedLineCount, isActivelyTyping]);

  const handleSkipAnimation = () => {
    setRenderedLineCount(totalLines);
    setIsActivelyTyping(false);
  };

  const handleCopy = () => {
    if (!jsonString) return;
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!jsonString) return;
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `docstruct_extracted_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderValueToken = (valStr: string) => {
    if (valStr.includes('"')) {
      return <span className="text-emerald-700">{valStr}</span>;
    }
    if (/\b\d+(\.\d+)?\b/.test(valStr)) {
      return <span className="text-amber-600 font-medium">{valStr}</span>;
    }
    if (/\b(true|false|null)\b/.test(valStr)) {
      return <span className="text-purple-600 font-semibold">{valStr}</span>;
    }
    return <span className="text-zinc-700">{valStr}</span>;
  };

  const renderHighlightedJson = (linesToRender: string[]) => {
    return linesToRender.map((line, idx) => {
      const keyMatch = line.match(/^(\s*)(".*?")(\s*:)(.*)$/);
      const isLatestLine = isActivelyTyping && idx === linesToRender.length - 1;

      return (
        <div
          key={idx}
          className={`table-row hover:bg-zinc-200/40 group transition-colors ${
            isLatestLine ? "bg-indigo-50/50" : ""
          }`}
        >
          <span className="table-cell select-none pr-4 text-right text-[11px] text-zinc-400 group-hover:text-zinc-600 font-mono w-8">
            {idx + 1}
          </span>
          <span className="table-cell whitespace-pre font-mono text-[13px] leading-6">
            {keyMatch ? (
              <>
                <span>{keyMatch[1]}</span>
                <span className="text-indigo-600 font-medium">{keyMatch[2]}</span>
                <span className="text-zinc-400">{keyMatch[3]}</span>
                {renderValueToken(keyMatch[4])}
              </>
            ) : (
              renderValueToken(line)
            )}
            {isLatestLine && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-500 animate-pulse align-middle" />
            )}
          </span>
        </div>
      );
    });
  };

  const visibleLines = allLines.slice(0, renderedLineCount);

  return (
    <div className="lg:col-span-6 xl:col-span-7 p-5 sm:p-6 lg:p-7 flex flex-col justify-between bg-white text-zinc-900 h-full min-h-0 overflow-hidden font-sans">
      {/* Header */}
      <div className="shrink-0 font-sans">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  isProcessing
                    ? "bg-amber-400 animate-pulse"
                    : isActivelyTyping
                    ? "bg-emerald-500 animate-pulse ring-2 ring-emerald-200"
                    : jsonData
                    ? "bg-emerald-500"
                    : "bg-zinc-300"
                }`}
              />
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium font-sans">
                {isProcessing
                  ? "AI Processing Engine"
                  : isActivelyTyping
                  ? "Streaming Extraction"
                  : jsonData
                  ? "Structured Output"
                  : "Awaiting Document"}
              </span>
            </div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 flex items-center gap-2 font-sans">
              Structured JSON
              {isProcessing && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium font-sans animate-pulse">
                  Extracting...
                </span>
              )}
              {isActivelyTyping && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium font-sans">
                  Streaming
                </span>
              )}
              {!isProcessing && !isActivelyTyping && jsonData && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium font-sans">
                  {category || "Valid JSON"}
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2 font-sans">
            {isActivelyTyping && (
              <button
                onClick={handleSkipAnimation}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 transition-colors text-[11px] font-medium font-sans shadow-sm"
                title="Skip typewriter animation"
              >
                <FastForward className="w-3.5 h-3.5 text-indigo-600" />
                <span>Skip</span>
              </button>
            )}

            <button
              onClick={handleCopy}
              disabled={!jsonData || isProcessing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 transition-colors text-[11px] font-medium font-sans disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={!jsonData || isProcessing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 transition-colors text-[11px] font-medium font-sans disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Code Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-[11px] text-zinc-500 font-sans">
          <div className="flex items-center gap-2">
            <span>Lines:</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-800 font-medium font-sans">
              {isProcessing
                ? "—"
                : isActivelyTyping
                ? `${renderedLineCount} / ${totalLines}`
                : totalLines}
            </span>
            <span className="text-zinc-300">&bull;</span>
            <span className="font-sans">Schema v3.0</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400 font-sans">
            <span>UTF-8</span>
            <span>&bull;</span>
            <span>2 spaces</span>
          </div>
        </div>

        {/* Summary banner if available */}
        {summary && !isProcessing && (
          <div className="my-1.5 p-2.5 rounded-md bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 leading-relaxed font-sans">
            <span className="font-semibold text-zinc-900">Summary: </span>
            {summary}
          </div>
        )}
      </div>

      {/* JSON Viewer Window */}
      <div className="relative my-2.5 flex-1 min-h-0 rounded-lg bg-[#f8f9fa] border border-zinc-200/90 overflow-hidden flex flex-col shadow-inner">
        {/* Window Chrome Header */}
        <div className="shrink-0 px-3.5 py-2 bg-zinc-100/80 border-b border-zinc-200 flex items-center justify-between text-xs font-sans">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="ml-2 text-[11px] text-zinc-600 font-medium font-sans">
              payload.mesh.json
            </span>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium font-sans uppercase ${
              isProcessing
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : isActivelyTyping
                ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                : jsonData
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : "text-zinc-500 bg-zinc-100 border-zinc-200"
            }`}
          >
            {isProcessing
              ? "EXTRACTING"
              : isActivelyTyping
              ? "STREAMING"
              : jsonData
              ? "PARSED"
              : "IDLE"}
          </span>
        </div>

        {/* ERROR STATE */}
        {errorMessage ? (
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center font-sans">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-500 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-1 font-sans">
              Extraction Failed
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mb-4 font-sans leading-relaxed">
              {errorMessage}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium font-sans transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry Extraction</span>
              </button>
            )}
          </div>
        ) : isProcessing ? (
          /* SKELETON LOADER — Code-specific layout with zero spinners */
          <div className="p-4 flex-1 min-h-0 overflow-hidden font-mono text-[13px] leading-6 select-none animate-pulse">
            <div className="space-y-1.5">
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">1</span>
                <span className="text-zinc-400 font-mono">&#123;</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">2</span>
                <div className="flex items-center gap-2 pl-4">
                  <div className="h-3 w-20 bg-indigo-200/80 rounded" />
                  <span className="text-zinc-300 font-mono">:</span>
                  <div className="h-3 w-28 bg-emerald-200/80 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">3</span>
                <div className="flex items-center gap-2 pl-4">
                  <div className="h-3 w-16 bg-indigo-200/80 rounded" />
                  <span className="text-zinc-300 font-mono">:</span>
                  <div className="h-3 w-64 bg-emerald-200/80 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">4</span>
                <div className="flex items-center gap-2 pl-4">
                  <div className="h-3 w-20 bg-indigo-200/80 rounded" />
                  <span className="text-zinc-300 font-mono">: [</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">5</span>
                <div className="pl-8 text-zinc-400 font-mono">&#123;</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">6</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="h-3 w-14 bg-indigo-200/80 rounded" />
                  <span className="text-zinc-300 font-mono">:</span>
                  <div className="h-3 w-28 bg-emerald-200/80 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">7</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="h-3 w-20 bg-indigo-200/80 rounded" />
                  <span className="text-zinc-300 font-mono">:</span>
                  <div className="h-3 w-14 bg-amber-200/80 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">8</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="h-3 w-24 bg-indigo-200/80 rounded" />
                  <span className="text-zinc-300 font-mono">:</span>
                  <div className="h-3 w-40 bg-emerald-200/80 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">9</span>
                <div className="pl-8 text-zinc-400 font-mono">&#125;,</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">10</span>
                <div className="pl-8 text-zinc-400 font-mono">&#123;</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">11</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="h-3 w-16 bg-indigo-200/80 rounded" />
                  <span className="text-zinc-300 font-mono">:</span>
                  <div className="h-3 w-32 bg-emerald-200/80 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">12</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="h-3 w-20 bg-indigo-200/80 rounded" />
                  <span className="text-zinc-300 font-mono">:</span>
                  <div className="h-3 w-14 bg-amber-200/80 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">13</span>
                <div className="pl-8 text-zinc-400 font-mono">&#125;</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">14</span>
                <div className="pl-4 text-zinc-400 font-mono">]</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">15</span>
                <span className="text-zinc-400 font-mono">&#125;</span>
              </div>
            </div>
          </div>
        ) : !jsonData ? (
          /* EMPTY STATE */
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center font-sans">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-400 mb-3.5 shadow-sm">
              <FileCode2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800 mb-1 font-sans">
              Awaiting Document
            </h3>
            <p className="text-xs text-zinc-500 max-w-[280px] leading-relaxed font-sans">
              Upload a document on the left to extract structured JSON data with grounded source citations.
            </p>
          </div>
        ) : (
          /* ACTIVE / STREAMING CODE VIEWER */
          <div
            ref={codeContainerRef}
            className="p-4 flex-1 min-h-0 overflow-auto font-mono text-zinc-800 text-[13px] leading-6 select-text scroll-smooth"
          >
            <div className="table w-full font-mono">
              {renderHighlightedJson(visibleLines)}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="shrink-0 pt-3 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-sans">
          <span className="flex items-center gap-1 font-sans">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />{" "}
            {isProcessing ? "Processing..." : `${processingTimeMs}ms`}
          </span>
          <span className="text-zinc-300">&bull;</span>
          <span className="flex items-center gap-1 font-sans">
            <Code2 className="w-3.5 h-3.5 text-emerald-600" />{" "}
            {isProcessing ? "—" : `${confidenceScore} conf`}
          </span>
        </div>

        <button
          onClick={onOpenChat}
          disabled={!jsonData || isProcessing}
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs tracking-wide transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 font-sans"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Chat with Document
        </button>
      </div>
    </div>
  );
}

export default JsonOutputPanel;
