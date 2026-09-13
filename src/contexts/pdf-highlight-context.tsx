"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface HighlightRequest {
  text: string;
  timestamp: number;
}

interface PdfHighlightContextType {
  highlightText: (text: string) => void;
  currentHighlight: HighlightRequest | null;
  clearHighlight: () => void;
}

const PdfHighlightContext = createContext<PdfHighlightContextType | null>(null);

export function PdfHighlightProvider({ children }: { children: React.ReactNode }) {
  const [currentHighlight, setCurrentHighlight] = useState<HighlightRequest | null>(null);

  const highlightText = useCallback((text: string) => {
    if (!text || text.trim().length === 0) return;
    
    setCurrentHighlight({
      text: text.trim(),
      timestamp: Date.now(),
    });
  }, []);

  const clearHighlight = useCallback(() => {
    setCurrentHighlight(null);
  }, []);

  return (
    <PdfHighlightContext.Provider value={{ highlightText, currentHighlight, clearHighlight }}>
      {children}
    </PdfHighlightContext.Provider>
  );
}

export function usePdfHighlight() {
  const context = useContext(PdfHighlightContext);
  if (!context) {
    throw new Error("usePdfHighlight must be used within PdfHighlightProvider");
  }
  return context;
}
