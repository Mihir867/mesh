"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Send,
  Bot,
  User,
  RotateCw,
  AlertCircle,
  FileText,
  CheckCircle2,
  Copy,
  Check,
  Zap,
} from "lucide-react";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export interface ChatSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentName?: string;
  category?: string | null;
  summary?: string | null;
}

const SUGGESTED_PROMPTS = [
  "Summarize key data points",
  "What are the main amounts or numbers?",
  "List any dates, deadlines, or timelines",
  "Are there any low confidence fields or anomalies?",
];

export function ChatSidebar({
  open,
  onOpenChange,
  documentId,
  documentName = "Document",
  category,
  summary,
}: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Fetch message history from DB whenever sidebar opens or documentId changes
  useEffect(() => {
    if (!open || !documentId || documentId.startsWith("local_")) {
      return;
    }

    let isSubscribed = true;
    setIsInitialLoading(true);
    setErrorMessage(null);

    async function fetchChatHistory() {
      try {
        const res = await fetch(`/api/documents/${documentId}/chat`);
        if (!res.ok) {
          throw new Error(`Failed to load chat: ${res.statusText}`);
        }
        const data = await res.json();
        if (isSubscribed && data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (err: any) {
        if (isSubscribed) {
          console.error("[ChatSidebar] Error loading history:", err);
          setErrorMessage("Could not load past chat history.");
        }
      } finally {
        if (isSubscribed) {
          setIsInitialLoading(false);
          setTimeout(() => scrollToBottom(false), 100);
        }
      }
    }

    fetchChatHistory();

    return () => {
      isSubscribed = false;
    };
  }, [open, documentId, scrollToBottom]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (open && messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages, open, scrollToBottom]);

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 200);
    }
  }, [open]);

  // Send message handler
  const handleSendMessage = async (promptToSend?: string) => {
    const textToSend = (promptToSend || input).trim();
    if (!textToSend || !documentId || isLoading) return;

    setInput("");
    setErrorMessage(null);

    // Optimistic user message
    const tempUserId = `user_${Date.now()}`;
    const userMsg: ChatMessageItem = {
      id: tempUserId,
      role: "user",
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/documents/${documentId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to get AI response.");
      }

      const assistantMsg: ChatMessageItem = {
        id: data.message?.id || `asst_${Date.now()}`,
        role: "assistant",
        content: data.message?.content || "",
        createdAt: data.message?.createdAt || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("[ChatSidebar] Send error:", err);
      setErrorMessage(err.message || "Failed to get AI reply. Please retry.");
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollToBottom(true), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 flex flex-col bg-white border-l border-zinc-200/90 shadow-2xl z-50 overflow-hidden font-sans"
      >
        {/* Header */}
        <SheetHeader className="p-4 sm:p-5 border-b border-zinc-200/80 bg-zinc-50/70 shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <span>Document Assistant</span>
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Zap className="w-2.5 h-2.5" />
                    JSON Context
                  </span>
                </SheetTitle>
                <SheetDescription className="text-xs text-zinc-500 truncate max-w-[260px] sm:max-w-[320px] font-sans">
                  {documentName} &bull; {category || "Analyzed"}
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Message Thread Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#fbfbfd]">
          {/* Document Summary Context Banner */}
          {summary && (
            <div className="p-3.5 rounded-xl bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-xs text-zinc-600 leading-relaxed font-sans">
              <div className="flex items-center gap-1.5 text-zinc-900 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Extracted Document Scope</span>
              </div>
              <p className="line-clamp-3 text-zinc-600 font-sans">{summary}</p>
            </div>
          )}

          {/* Initial Loading Skeleton */}
          {isInitialLoading ? (
            <div className="space-y-4 py-8">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-zinc-200 animate-pulse shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-zinc-200 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-zinc-100 rounded w-1/2 animate-pulse" />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="h-10 bg-indigo-100/60 rounded-2xl w-2/3 animate-pulse" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State with Suggested Prompts */
            <div className="py-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-900 mb-1">
                Ask about this document
              </h4>
              <p className="text-xs text-zinc-500 max-w-xs mb-6 leading-relaxed">
                Powered by Gemini 3.6 Flash using the extracted schema for fast,
                token-efficient answers.
              </p>

              {/* Suggested prompt chips */}
              <div className="w-full space-y-2 text-left">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block px-1">
                  Suggested Questions
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full p-2.5 rounded-lg bg-white hover:bg-zinc-100/80 border border-zinc-200 text-xs text-zinc-700 font-medium text-left transition-all hover:border-zinc-300 hover:shadow-sm active:scale-[0.99] flex items-center justify-between group"
                    >
                      <span className="truncate pr-2">{prompt}</span>
                      <Send className="w-3 h-3 text-zinc-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Rendered Messages */
            messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`relative group max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      isUser
                        ? "bg-zinc-900 text-white shadow-xs rounded-br-xs font-sans"
                        : "bg-white text-zinc-800 border border-zinc-200/90 shadow-xs rounded-bl-xs font-sans"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans break-words">
                      {msg.content}
                    </div>

                    {!isUser && (
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-zinc-200 text-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Assistant Thinking State */}
          {isLoading && (
            <div className="flex gap-3 justify-start items-start">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-white border border-zinc-200/90 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                </div>
                <span className="text-[11px] text-zinc-500 font-sans ml-1">
                  DocStruct AI is thinking...
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSendMessage()}
                className="h-7 px-2 text-xs text-red-700 hover:bg-red-100"
              >
                <RotateCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-4 border-t border-zinc-200/80 bg-white shrink-0">
          <div className="relative rounded-xl border border-zinc-200 bg-white focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-900/5 transition-all shadow-xs">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about the extracted document data..."
              disabled={isLoading || !documentId}
              className="w-full resize-none border-0 bg-transparent p-3 pr-12 text-xs placeholder:text-zinc-400 focus:outline-hidden disabled:opacity-50 font-sans"
            />
            <div className="absolute right-2 bottom-2">
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isLoading || !documentId}
                className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-zinc-400 font-sans">
            <span>Enter to send &bull; Shift + Enter for new line</span>
            <span className="text-zinc-500 font-medium">Minimal Context Mode</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ChatSidebar;
