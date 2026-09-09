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
  Copy,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
        className="w-full sm:max-w-md lg:max-w-2xl xl:max-w-3xl data-[side=right]:sm:max-w-md data-[side=right]:lg:max-w-2xl data-[side=right]:xl:max-w-3xl sm:!max-w-md lg:!max-w-2xl xl:!max-w-3xl p-0 flex flex-col z-50 overflow-hidden"
        style={{
          background: 'var(--color-bg)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Header */}
        <SheetHeader className="p-5 shrink-0" style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg)'
        }}>
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <div style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent)',
                color: 'white'
              }}>
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <SheetTitle style={{
                  fontSize: '15px',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>Document Assistant</span>
                </SheetTitle>
                <SheetDescription
                  className="max-w-[280px] sm:max-w-[360px] lg:max-w-[540px]"
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {documentName} · {category || "Analyzed"}
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Message Thread Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4" style={{
          background: 'var(--color-surface)'
        }}>
          {/* Document Summary Context Banner */}
          {summary && (
            <div className="p-3 rounded-lg" style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.5'
            }}>
              <div className="flex items-center gap-2 mb-2" style={{
                color: 'var(--color-text-primary)',
                fontWeight: 'var(--font-weight-medium)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <FileText className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                <span>Document Context</span>
              </div>
              <p style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical'
              }}>
                {summary}
              </p>
            </div>
          )}

          {/* Initial Loading Skeleton */}
          {isInitialLoading ? (
            <div className="space-y-4 py-8">
              <div className="flex gap-3">
                <div className="skeleton w-7 h-7 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="skeleton h-4 rounded w-3/4" />
                  <div className="skeleton h-3 rounded w-1/2" />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="skeleton h-10 rounded-lg w-2/3" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State with Suggested Prompts */
            <div className="py-6 flex flex-col items-center text-center">
              <div style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-accent-subtle)',
                border: '1px solid var(--color-accent)',
                marginBottom: '12px'
              }}>
                <Sparkles className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h4 style={{
                fontSize: '15px',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: '6px'
              }}>
                Ask about this document
              </h4>
              <p style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                maxWidth: '320px',
                marginBottom: '24px',
                lineHeight: '1.5'
              }}>
                Ask questions about the extracted data and get instant answers.
              </p>

              {/* Suggested prompt chips */}
              <div className="w-full space-y-2 text-left">
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  paddingLeft: '4px'
                }}>
                  Suggested Questions
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        fontSize: '13px',
                        color: 'var(--color-text-primary)',
                        fontWeight: 'var(--font-weight-regular)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 120ms ease-out',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'var(--color-surface)';
                        e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'var(--color-bg)';
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                    >
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: '8px'
                      }}>
                        {prompt}
                      </span>
                      <Send className="w-3 h-3 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
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
                    <div style={{
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-accent-subtle)',
                      color: 'var(--color-accent)',
                      border: '1px solid var(--color-accent)',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className="relative group"
                    style={{
                      maxWidth: '85%',
                      borderRadius: 'var(--radius-lg)',
                      padding: '12px 14px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      ...(isUser ? {
                        background: 'var(--color-text-primary)',
                        color: 'white',
                        borderBottomRightRadius: '4px'
                      } : {
                        background: 'var(--color-bg)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        borderBottomLeftRadius: '4px'
                      })
                    }}
                  >
                    {isUser ? (
                      <div style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {msg.content}
                      </div>
                    ) : (
                      <div className="prose prose-xs max-w-none prose-zinc prose-p:my-2 prose-p:leading-relaxed prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-semibold prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:font-semibold prose-strong:text-zinc-900 prose-code:text-xs prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {!isUser && (
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 rounded"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-text-tertiary)',
                          cursor: 'pointer'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'var(--color-surface)';
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text-tertiary)';
                        }}
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {isUser && (
                    <div style={{
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
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
              <div style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                borderBottomLeftRadius: '4px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{
                    background: 'var(--color-accent)',
                    animationDelay: '-0.3s'
                  }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{
                    background: 'var(--color-accent)',
                    animationDelay: '-0.15s'
                  }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{
                    background: 'var(--color-accent)'
                  }} />
                </div>
                <span style={{
                  fontSize: '11px',
                  color: 'var(--color-text-tertiary)',
                  marginLeft: '4px'
                }}>
                  Thinking...
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-lg flex items-center justify-between gap-2" style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: 'var(--color-danger)',
              fontSize: '13px'
            }}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSendMessage()}
                className="h-7 px-2 text-xs"
                style={{
                  color: 'var(--color-danger)'
                }}
              >
                <RotateCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 shrink-0" style={{
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg)'
        }}>
          <div className="relative rounded-lg transition-all" style={{
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)'
          }}>
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about the extracted document data..."
              disabled={isLoading || !documentId}
              style={{
                width: '100%',
                resize: 'none',
                border: 'none',
                background: 'transparent',
                padding: '12px',
                paddingRight: '48px',
                fontSize: '13px',
                color: 'var(--color-text-primary)',
                outline: 'none',
                opacity: isLoading || !documentId ? 0.5 : 1
              }}
              className="placeholder:text-[var(--color-text-tertiary)]"
              onFocus={(e) => e.currentTarget.parentElement!.style.borderColor = 'var(--color-accent)'}
              onBlur={(e) => e.currentTarget.parentElement!.style.borderColor = 'var(--color-border)'}
            />
            <div className="absolute right-2 bottom-2">
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isLoading || !documentId}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  background: !input.trim() || isLoading || !documentId ? 'var(--color-surface)' : 'var(--color-accent)',
                  border: 'none',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: !input.trim() || isLoading || !documentId ? 'not-allowed' : 'pointer',
                  opacity: !input.trim() || isLoading || !documentId ? 0.3 : 1,
                  transition: 'all 120ms ease-out'
                }}
                onMouseOver={(e) => {
                  if (input.trim() && !isLoading && documentId) {
                    e.currentTarget.style.background = 'var(--color-accent-hover)';
                  }
                }}
                onMouseOut={(e) => {
                  if (input.trim() && !isLoading && documentId) {
                    e.currentTarget.style.background = 'var(--color-accent)';
                  }
                }}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 px-1" style={{
            fontSize: '10px',
            color: 'var(--color-text-tertiary)'
          }}>
            <span>Enter to send · Shift + Enter for new line</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ChatSidebar;
