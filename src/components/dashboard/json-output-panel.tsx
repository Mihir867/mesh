"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Copy,
  Check,
  Download,
  Code2,
  Cpu,
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
    a.download = `mesh_extracted_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderValueToken = (valStr: string) => {
    if (valStr.includes('"')) {
      return <span style={{ color: 'var(--color-success)' }}>{valStr}</span>;
    }
    if (/\b\d+(\.\d+)?\b/.test(valStr)) {
      return <span style={{ color: 'var(--color-warning)', fontWeight: 'var(--font-weight-medium)' }}>{valStr}</span>;
    }
    if (/\b(true|false|null)\b/.test(valStr)) {
      return <span style={{ color: 'var(--color-accent)', fontWeight: 'var(--font-weight-medium)' }}>{valStr}</span>;
    }
    return <span style={{ color: 'var(--color-text-secondary)' }}>{valStr}</span>;
  };

  const renderHighlightedJson = (linesToRender: string[]) => {
    return linesToRender.map((line, idx) => {
      const keyMatch = line.match(/^(\s*)(".*?")(\s*:)(.*)$/);
      const isLatestLine = isActivelyTyping && idx === linesToRender.length - 1;

      return (
        <div
          key={idx}
          className="table-row group transition-colors"
          style={{
            background: isLatestLine ? 'var(--color-accent-subtle)' : 'transparent'
          }}
          onMouseOver={(e) => {
            if (!isLatestLine) e.currentTarget.style.background = 'var(--color-surface)';
          }}
          onMouseOut={(e) => {
            if (!isLatestLine) e.currentTarget.style.background = 'transparent';
          }}
        >
          <span className="table-cell select-none pr-4 text-right font-mono w-8" style={{
            fontSize: '11px',
            color: 'var(--color-text-tertiary)',
            transition: 'color 120ms ease-out'
          }}>
            {idx + 1}
          </span>
          <span className="table-cell whitespace-pre font-mono" style={{
            fontSize: '13px',
            lineHeight: '1.5'
          }}>
            {keyMatch ? (
              <>
                <span>{keyMatch[1]}</span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 'var(--font-weight-medium)' }}>{keyMatch[2]}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{keyMatch[3]}</span>
                {renderValueToken(keyMatch[4])}
              </>
            ) : (
              renderValueToken(line)
            )}
            {isLatestLine && (
              <span className="inline-block align-middle animate-pulse" style={{
                width: '6px',
                height: '14px',
                marginLeft: '4px',
                background: 'var(--color-accent)'
              }} />
            )}
          </span>
        </div>
      );
    });
  };

  const visibleLines = allLines.slice(0, renderedLineCount);

  return (
    <div className="lg:col-span-6 xl:col-span-7 p-6 flex flex-col h-full min-h-0 overflow-hidden" style={{
      background: 'var(--color-bg)'
    }}>
      {/* Header */}
      <div className="shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4" style={{
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isProcessing 
                  ? 'var(--color-warning)' 
                  : isActivelyTyping || jsonData 
                  ? 'var(--color-success)' 
                  : 'var(--color-border-strong)'
              }} className={isProcessing || isActivelyTyping ? 'animate-pulse' : ''} />
              <span style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-tertiary)',
                fontWeight: 'var(--font-weight-medium)'
              }}>
                {isProcessing
                  ? "Processing"
                  : isActivelyTyping
                  ? "Streaming"
                  : jsonData
                  ? "Structured Output"
                  : "Awaiting Document"}
              </span>
            </div>
            <h2 style={{
              fontSize: '16px',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.006em'
            }}>
              {category || "JSON Output"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isActivelyTyping && (
              <button
                onClick={handleSkipAnimation}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent-subtle)',
                  border: '1px solid var(--color-accent)',
                  color: 'var(--color-accent)',
                  fontSize: '13px',
                  fontWeight: 'var(--font-weight-medium)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease-out'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-accent-subtle)'}
                title="Skip animation"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Skip</span>
              </button>
            )}

            <button
              onClick={handleCopy}
              disabled={!jsonData || isProcessing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
                fontWeight: 'var(--font-weight-medium)',
                cursor: !jsonData || isProcessing ? 'not-allowed' : 'pointer',
                opacity: !jsonData || isProcessing ? 0.4 : 1,
                transition: 'all 120ms ease-out'
              }}
              onMouseOver={(e) => {
                if (jsonData && !isProcessing) e.currentTarget.style.background = 'var(--color-surface)';
              }}
              onMouseOut={(e) => {
                if (jsonData && !isProcessing) e.currentTarget.style.background = 'transparent';
              }}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                  <span style={{ color: 'var(--color-success)' }}>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={!jsonData || isProcessing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
                fontWeight: 'var(--font-weight-medium)',
                cursor: !jsonData || isProcessing ? 'not-allowed' : 'pointer',
                opacity: !jsonData || isProcessing ? 0.4 : 1,
                transition: 'all 120ms ease-out'
              }}
              onMouseOver={(e) => {
                if (jsonData && !isProcessing) e.currentTarget.style.background = 'var(--color-surface)';
              }}
              onMouseOut={(e) => {
                if (jsonData && !isProcessing) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Code Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-2" style={{
          fontSize: '11px',
          color: 'var(--color-text-tertiary)'
        }}>
          <div className="flex items-center gap-2">
            <span>Lines</span>
            <span style={{
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontWeight: 'var(--font-weight-medium)',
              fontFamily: 'var(--font-mono)'
            }}>
              {isProcessing
                ? "—"
                : isActivelyTyping
                ? `${renderedLineCount} / ${totalLines}`
                : totalLines}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>UTF-8</span>
            <span>·</span>
            <span>2 spaces</span>
          </div>
        </div>

        {/* Summary banner if available */}
        {summary && !isProcessing && (
          <div className="my-2 p-3 rounded-md" style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.5'
          }}>
            <span style={{ 
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)' 
            }}>Summary: </span>
            {summary}
          </div>
        )}
      </div>

      {/* JSON Viewer Window */}
      <div className="relative my-3 flex-1 min-h-0 rounded-lg overflow-hidden flex flex-col" style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)'
      }}>
        {/* Window Chrome Header - Minimal */}
        <div className="shrink-0 px-4 h-10 flex items-center justify-between" style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '13px'
        }}>
          <span style={{
            color: 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-medium)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px'
          }}>
            payload.json
          </span>
          <span style={{
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            fontWeight: 'var(--font-weight-medium)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            ...(isProcessing
              ? { color: 'var(--color-warning)', background: '#fffbeb', borderColor: '#fde68a' }
              : isActivelyTyping
              ? { color: 'var(--color-accent)', background: 'var(--color-accent-subtle)', borderColor: 'var(--color-accent)' }
              : jsonData
              ? { color: 'var(--color-success)', background: '#f0fdf4', borderColor: '#86efac' }
              : { color: 'var(--color-text-tertiary)', background: 'var(--color-surface)' })
          }}>
            {isProcessing
              ? "Extracting"
              : isActivelyTyping
              ? "Streaming"
              : jsonData
              ? "Parsed"
              : "Idle"}
          </span>
        </div>

        {/* ERROR STATE */}
        {errorMessage ? (
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <div style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              marginBottom: '12px'
            }}>
              <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-danger)' }} />
            </div>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              marginBottom: '6px'
            }}>
              Extraction Failed
            </h3>
            <p style={{
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              maxWidth: '400px',
              marginBottom: '16px',
              lineHeight: '1.5'
            }}>
              {errorMessage}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 'var(--font-weight-medium)',
                  cursor: 'pointer',
                  transition: 'background 120ms ease-out'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-accent-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry Extraction</span>
              </button>
            )}
          </div>
        ) : isProcessing ? (
          /* SKELETON LOADER */
          <div className="p-4 flex-1 min-h-0 overflow-hidden select-none" style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '1.5'
          }}>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>1</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>&#123;</span>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>2</span>
                <div className="flex items-center gap-2 pl-4">
                  <div className="skeleton h-3 w-20 rounded" />
                  <span style={{ color: 'var(--color-text-tertiary)' }}>:</span>
                  <div className="skeleton h-3 w-28 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>3</span>
                <div className="flex items-center gap-2 pl-4">
                  <div className="skeleton h-3 w-16 rounded" />
                  <span style={{ color: 'var(--color-text-tertiary)' }}>:</span>
                  <div className="skeleton h-3 w-64 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>4</span>
                <div className="flex items-center gap-2 pl-4">
                  <div className="skeleton h-3 w-20 rounded" />
                  <span style={{ color: 'var(--color-text-tertiary)' }}>: [</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>5</span>
                <div className="pl-8" style={{ color: 'var(--color-text-tertiary)' }}>&#123;</div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>6</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="skeleton h-3 w-14 rounded" />
                  <span style={{ color: 'var(--color-text-tertiary)' }}>:</span>
                  <div className="skeleton h-3 w-28 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>7</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="skeleton h-3 w-20 rounded" />
                  <span style={{ color: 'var(--color-text-tertiary)' }}>:</span>
                  <div className="skeleton h-3 w-14 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>8</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="skeleton h-3 w-24 rounded" />
                  <span style={{ color: 'var(--color-text-tertiary)' }}>:</span>
                  <div className="skeleton h-3 w-40 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>9</span>
                <div className="pl-8" style={{ color: 'var(--color-text-tertiary)' }}>&#125;,</div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>10</span>
                <div className="pl-8" style={{ color: 'var(--color-text-tertiary)' }}>&#123;</div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>11</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="skeleton h-3 w-16 rounded" />
                  <span style={{ color: 'var(--color-text-tertiary)' }}>:</span>
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>12</span>
                <div className="flex items-center gap-2 pl-12">
                  <div className="skeleton h-3 w-20 rounded" />
                  <span style={{ color: 'var(--color-text-tertiary)' }}>:</span>
                  <div className="skeleton h-3 w-14 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>13</span>
                <div className="pl-8" style={{ color: 'var(--color-text-tertiary)' }}>&#125;</div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>14</span>
                <div className="pl-4" style={{ color: 'var(--color-text-tertiary)' }}>]</div>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)', width: '32px', textAlign: 'right' }}>15</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>&#125;</span>
              </div>
            </div>
          </div>
        ) : !jsonData ? (
          /* EMPTY STATE */
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <div style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              marginBottom: '14px'
            }}>
              <FileCode2 className="w-6 h-6" style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              marginBottom: '6px'
            }}>
              Awaiting Document
            </h3>
            <p style={{
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              maxWidth: '280px',
              lineHeight: '1.5'
            }}>
              Upload a document on the left to extract structured JSON data.
            </p>
          </div>
        ) : (
          /* ACTIVE / STREAMING CODE VIEWER */
          <div
            ref={codeContainerRef}
            className="p-4 flex-1 min-h-0 overflow-auto select-text scroll-smooth"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
              lineHeight: '1.5'
            }}
          >
            <div className="table w-full">
              {renderHighlightedJson(visibleLines)}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="shrink-0 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3" style={{
        borderTop: '1px solid var(--color-border)'
      }}>
        <div className="flex items-center gap-3" style={{
          fontSize: '11px',
          color: 'var(--color-text-tertiary)'
        }}>
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
            {isProcessing ? "Processing..." : `${processingTimeMs}ms`}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Code2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
            {isProcessing ? "—" : `${confidenceScore} conf`}
          </span>
        </div>

        <button
          onClick={onOpenChat}
          disabled={!jsonData || isProcessing}
          style={{
            width: '100%',
            maxWidth: '200px',
            padding: '7px 16px',
            borderRadius: 'var(--radius-md)',
            background: !jsonData || isProcessing ? 'var(--color-surface)' : 'var(--color-accent)',
            border: 'none',
            color: !jsonData || isProcessing ? 'var(--color-text-disabled)' : 'white',
            fontSize: '13px',
            fontWeight: 'var(--font-weight-medium)',
            cursor: !jsonData || isProcessing ? 'not-allowed' : 'pointer',
            opacity: !jsonData || isProcessing ? 0.4 : 1,
            transition: 'all 120ms ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            if (jsonData && !isProcessing) e.currentTarget.style.background = 'var(--color-accent-hover)';
          }}
          onMouseOut={(e) => {
            if (jsonData && !isProcessing) e.currentTarget.style.background = 'var(--color-accent)';
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Chat with Document
        </button>
      </div>
    </div>
  );
}

export default JsonOutputPanel;
