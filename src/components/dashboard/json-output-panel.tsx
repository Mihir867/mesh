"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  Download,
  Code2,
  Cpu,
  Database,
} from "lucide-react";

interface JsonOutputPanelProps {
  jsonData: object;
  processingTimeMs?: number;
  confidenceScore?: number;
}

export function JsonOutputPanel({
  jsonData,
  processingTimeMs = 847,
  confidenceScore = 0.996,
}: JsonOutputPanelProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(jsonData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mesh_extracted_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderValueToken = (valStr: string) => {
    if (valStr.includes('"')) {
      return (
        <span className="text-emerald-700">{valStr}</span>
      );
    }
    if (/\b\d+(\.\d+)?\b/.test(valStr)) {
      return (
        <span className="text-amber-600 font-medium">
          {valStr}
        </span>
      );
    }
    if (/\b(true|false|null)\b/.test(valStr)) {
      return (
        <span className="text-purple-600 font-semibold">
          {valStr}
        </span>
      );
    }
    return <span className="text-zinc-700">{valStr}</span>;
  };

  const renderHighlightedJson = (jsonStr: string) => {
    const lines = jsonStr.split("\n");
    return lines.map((line, idx) => {
      const keyMatch = line.match(/^(\s*)(".*?")(\s*:)(.*)$/);

      return (
        <div
          key={idx}
          className="table-row hover:bg-zinc-200/40 group transition-colors"
        >
          <span className="table-cell select-none pr-4 text-right text-[11px] text-zinc-400 group-hover:text-zinc-600 font-mono w-8">
            {idx + 1}
          </span>
          <span className="table-cell whitespace-pre font-mono text-[13px] leading-6">
            {keyMatch ? (
              <>
                <span>{keyMatch[1]}</span>
                <span className="text-indigo-600 font-medium">
                  {keyMatch[2]}
                </span>
                <span className="text-zinc-400">{keyMatch[3]}</span>
                {renderValueToken(keyMatch[4])}
              </>
            ) : (
              renderValueToken(line)
            )}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="lg:col-span-6 xl:col-span-7 p-5 sm:p-6 lg:p-7 flex flex-col justify-between bg-white text-zinc-900 h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Output Stream
              </span>
            </div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              Structured Output
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-medium">
                Valid JSON
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 transition-colors font-mono text-[11px]"
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 transition-colors font-mono text-[11px]"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Code Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <span>Lines:</span>
            <span className="px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-200 text-zinc-800 font-medium">
              {jsonString.split("\n").length}
            </span>
            <span className="text-zinc-300">&bull;</span>
            <span>Schema v3.0</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400">
            <span>UTF-8</span>
            <span>&bull;</span>
            <span>2 spaces</span>
          </div>
        </div>
      </div>

      {/* JSON Viewer - STRICTLY CONSTRAINED */}
      <div className="relative my-2.5 flex-1 min-h-0 rounded-lg bg-[#f8f9fa] border border-zinc-200/90 overflow-hidden flex flex-col shadow-inner">
        <div className="shrink-0 px-3.5 py-2 bg-zinc-100/80 border-b border-zinc-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="ml-2 font-mono text-[11px] text-zinc-600 font-medium">
              payload.mesh.json
            </span>
          </div>
          <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
            PARSED
          </span>
        </div>

        <div className="p-4 flex-1 min-h-0 overflow-auto font-mono text-zinc-800 text-[13px] leading-6 select-text">
          <div className="table w-full">{renderHighlightedJson(jsonString)}</div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="shrink-0 pt-3 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" /> {processingTimeMs}ms
          </span>
          <span className="text-zinc-300">&bull;</span>
          <span className="flex items-center gap-1">
            <Code2 className="w-3.5 h-3.5 text-emerald-600" /> {confidenceScore} conf
          </span>
        </div>

        <button
          onClick={handleDownload}
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-medium text-xs tracking-wider transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
        >
          <Database className="w-3.5 h-3.5" />
          EXPORT SCHEMA
        </button>
      </div>
    </div>
  );
}

export default JsonOutputPanel;
