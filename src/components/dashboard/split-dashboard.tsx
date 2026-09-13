"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  DocumentUploadPanel,
  type UploadedFile,
} from "./document-upload-panel";
import { JsonOutputPanel } from "./json-output-panel";
import { ChatSidebar } from "./chat-sidebar";
import { PdfHighlightProvider } from "@/contexts/pdf-highlight-context";

export function SplitDashboard() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [extractedData, setExtractedData] = useState<object | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [processingTimeMs, setProcessingTimeMs] = useState<number>(0);
  const [confidenceScore, setConfidenceScore] = useState<number>(0.98);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chat Sidebar Drawer State
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  const processingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Triggered the moment user drops or selects a file
  const handleUploadStart = useCallback(() => {
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
    }
    setExtractedData(null);
    setCategory(null);
    setSummary(null);
    setIsProcessing(false);
    setIsStreaming(false);
    setErrorMessage(null);
    setIsChatOpen(false);
  }, []);

  // Core processing pipeline trigger
  const runPipeline = useCallback(async (docId: string) => {
    const startTime = Date.now();
    try {
      console.log(
        `[SplitDashboard] Triggering pipeline for document: ${docId}`,
      );
      const res = await fetch(`/api/documents/${docId}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await res.json();
      const elapsed = Date.now() - startTime;
      setProcessingTimeMs(elapsed);

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Document processing failed.");
      }

      console.log(
        `[SplitDashboard] Pipeline complete in ${elapsed}ms:`,
        result,
      );

      // Construct clean structured JSON presentation payload
      const payload = {
        document_id: docId,
        category: result.category || result.extraction?.category || "Unknown",
        summary: result.summary || result.extraction?.summary || "",
        data: result.data || result.extraction?.data || {},
      };

      // Calculate confidence if array of grounded fields
      const fields = result.data || result.extraction?.data;
      if (Array.isArray(fields) && fields.length > 0) {
        const totalConf = fields.reduce(
          (acc: number, f: any) =>
            acc + (typeof f.confidence === "number" ? f.confidence : 0.95),
          0,
        );
        const avg = parseFloat((totalConf / fields.length).toFixed(3));
        setConfidenceScore(avg);
      } else {
        setConfidenceScore(0.98);
      }

      setCategory(payload.category);
      setSummary(payload.summary);
      setExtractedData(payload);

      // Stop skeleton loader and start line-by-line typewriter streaming
      setIsProcessing(false);
      setIsStreaming(true);
    } catch (err: any) {
      console.error("[SplitDashboard] Pipeline error:", err);
      setIsProcessing(false);
      setIsStreaming(false);
      setErrorMessage(err.message || "Failed to process document with AI.");
    }
  }, []);

  // Triggered when file upload to Supabase finishes
  const handleUploadSuccess = useCallback(
    (file: UploadedFile) => {
      setUploadedFile(file);
      setErrorMessage(null);

      // UX Requirement: after 50ms, start the right panel skeleton loader
      if (processingTimerRef.current) {
        clearTimeout(processingTimerRef.current);
      }

      processingTimerRef.current = setTimeout(() => {
        setIsProcessing(true);
        setIsStreaming(false);
        setExtractedData(null);

        // Run the backend processing
        if (file.id && !file.id.startsWith("local_")) {
          runPipeline(file.id);
        } else {
          console.warn("[SplitDashboard] Local fallback without document ID");
          setIsProcessing(false);
        }
      }, 50);
    },
    [runPipeline],
  );

  // Clear handler: resets UI state, storage, and URL
  const handleClear = useCallback(() => {
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
    }

    setUploadedFile(null);
    setExtractedData(null);
    setCategory(null);
    setSummary(null);
    setIsProcessing(false);
    setIsStreaming(false);
    setErrorMessage(null);
    setProcessingTimeMs(0);
    setIsChatOpen(false);
  }, []);

  // Retry handler
  const handleRetry = useCallback(() => {
    if (uploadedFile?.id) {
      setErrorMessage(null);
      setIsProcessing(true);
      setIsStreaming(false);
      runPipeline(uploadedFile.id);
    }
  }, [uploadedFile, runPipeline]);

  return (
    <PdfHighlightProvider>
      <div className="w-full max-w-[1600px] mx-auto">
        {/* Premium Container - Hairline border, tight shadow for elevation */}
        <div style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          height: '740px',
          maxHeight: 'calc(100vh - 180px)',
          minHeight: '620px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 h-full">
            <DocumentUploadPanel
              onUploadStart={handleUploadStart}
              onUploadSuccess={handleUploadSuccess}
              onClear={handleClear}
              restoredFile={uploadedFile}
            />
            <JsonOutputPanel
              jsonData={extractedData}
              category={category}
              summary={summary}
              isProcessing={isProcessing}
              isStreaming={isStreaming}
              processingTimeMs={processingTimeMs}
              confidenceScore={confidenceScore}
              errorMessage={errorMessage}
              onRetry={handleRetry}
              onOpenChat={() => setIsChatOpen(true)}
            />
          </div>
        </div>

        {/* Interactive Chat Sidebar */}
        <ChatSidebar
          open={isChatOpen}
          onOpenChange={setIsChatOpen}
          documentId={uploadedFile?.id || null}
          documentName={uploadedFile?.name || "Document"}
          category={category}
          summary={summary}
        />
      </div>
    </PdfHighlightProvider>
  );
}

export default SplitDashboard;
