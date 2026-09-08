"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { DocumentUploadPanel, type UploadedFile } from "./document-upload-panel";
import { JsonOutputPanel } from "./json-output-panel";
import { ChatSidebar } from "./chat-sidebar";

const ACTIVE_DOC_STORAGE_KEY = "docstruct_active_doc_id";

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

  // Restore session from Database / localStorage / URL on page refresh
  useEffect(() => {
    let isCancelled = false;

    async function restoreActiveSession() {
      try {
        // 1. Check URL query param or localStorage
        const searchParams = new URLSearchParams(window.location.search);
        const urlDocId = searchParams.get("docId");
        const storedDocId =
          typeof window !== "undefined"
            ? localStorage.getItem(ACTIVE_DOC_STORAGE_KEY)
            : null;

        const targetDocId = urlDocId || storedDocId;

        let docRecord = null;
        let extRecord = null;

        if (targetDocId && !targetDocId.startsWith("local_")) {
          // Fetch existing document from DB
          const res = await fetch(`/api/documents/${targetDocId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.document) {
              docRecord = data.document;
              extRecord = data.extraction;
            }
          }
        }

        // If no document found by ID, fallback to user's latest completed document
        if (!docRecord) {
          const latestRes = await fetch("/api/documents/latest");
          if (latestRes.ok) {
            const latestData = await latestRes.json();
            if (latestData.success && latestData.document) {
              docRecord = latestData.document;
              extRecord = latestData.extraction;
            }
          }
        }

        if (isCancelled || !docRecord) return;

        console.log(`[SplitDashboard] Restored active document from database: ${docRecord.id}`);

        // Update URL and storage
        if (typeof window !== "undefined") {
          localStorage.setItem(ACTIVE_DOC_STORAGE_KEY, docRecord.id);
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("docId", docRecord.id);
          window.history.replaceState(null, "", currentUrl.toString());
        }

        const restoredFile: UploadedFile = {
          id: docRecord.id,
          name: docRecord.name,
          fileUrl: docRecord.fileUrl,
          url: docRecord.fileUrl,
          fileType: docRecord.fileType,
          mimeType: docRecord.mimeType,
          fileSize: docRecord.fileSize,
          status: docRecord.status,
          createdAt: docRecord.createdAt,
        };

        setUploadedFile(restoredFile);

        if (extRecord) {
          const payload = {
            document_id: docRecord.id,
            category: extRecord.category || "Document",
            summary: extRecord.summary || "",
            data: extRecord.data || {},
          };

          // Calculate confidence score if grounded fields
          if (Array.isArray(payload.data) && payload.data.length > 0) {
            const totalConf = payload.data.reduce(
              (acc: number, f: any) =>
                acc + (typeof f.confidence === "number" ? f.confidence : 0.95),
              0
            );
            setConfidenceScore(parseFloat((totalConf / payload.data.length).toFixed(3)));
          } else {
            setConfidenceScore(0.98);
          }

          setCategory(payload.category);
          setSummary(payload.summary);
          setExtractedData(payload);
          setIsProcessing(false);
          setIsStreaming(false);
        }
      } catch (err) {
        console.warn("[SplitDashboard] Session restore error:", err);
      }
    }

    restoreActiveSession();

    return () => {
      isCancelled = true;
    };
  }, []);

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
      console.log(`[SplitDashboard] Triggering pipeline for document: ${docId}`);
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

      console.log(`[SplitDashboard] Pipeline complete in ${elapsed}ms:`, result);

      // Persist active document ID to localStorage & URL without reload
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_DOC_STORAGE_KEY, docId);
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("docId", docId);
        window.history.replaceState(null, "", currentUrl.toString());
      }

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
          0
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

      // Save documentId in storage
      if (file.id && !file.id.startsWith("local_")) {
        if (typeof window !== "undefined") {
          localStorage.setItem(ACTIVE_DOC_STORAGE_KEY, file.id);
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("docId", file.id);
          window.history.replaceState(null, "", currentUrl.toString());
        }
      }

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
    [runPipeline]
  );

  // Clear handler: resets UI state, storage, and URL
  const handleClear = useCallback(() => {
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(ACTIVE_DOC_STORAGE_KEY);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("docId");
      window.history.replaceState(null, "", currentUrl.pathname);
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
    <div className="w-full max-w-[1560px] mx-auto">
      <div className="rounded-[16px] bg-white border border-zinc-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden h-[740px] max-h-[calc(100vh-160px)] min-h-[620px] flex flex-col">
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

      {/* Interactive Shadcn Chat Sidebar */}
      <ChatSidebar
        open={isChatOpen}
        onOpenChange={setIsChatOpen}
        documentId={uploadedFile?.id || null}
        documentName={uploadedFile?.name || "Document"}
        category={category}
        summary={summary}
      />
    </div>
  );
}

export default SplitDashboard;
