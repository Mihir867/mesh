"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Code2 } from "lucide-react";

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
}

function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace("language-", "") || "code";
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg border border-zinc-200 bg-zinc-900 overflow-hidden text-zinc-100 shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/80 border-b border-zinc-700/60 text-[11px] font-mono text-zinc-400">
        <span className="flex items-center gap-1.5 uppercase font-medium tracking-wider">
          <Code2 className="w-3 h-3 text-indigo-400" />
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-zinc-700/70 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-[12px] font-mono leading-relaxed selection:bg-indigo-500/30">
        <code>{children}</code>
      </div>
    </div>
  );
}

export interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown text-[13px] leading-[1.65] text-zinc-800 space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="text-[14px] font-semibold text-zinc-900 mt-4 mb-2 pb-1.5 border-b border-zinc-200/80 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-indigo-500 rounded-[2px] shrink-0" />
              <span>{children}</span>
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="text-[13.5px] font-semibold text-zinc-900 mt-3.5 mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-indigo-400 rounded-[2px] shrink-0" />
              <span>{children}</span>
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="text-[12px] font-semibold text-zinc-700 uppercase tracking-wide mt-3 mb-1">
              {children}
            </h5>
          ),
          h4: ({ children }) => (
            <h6 className="text-[12px] font-semibold text-zinc-700 mt-2.5 mb-1">
              {children}
            </h6>
          ),
          p: ({ children }) => (
            <p className="my-1.5 text-[13px] leading-[1.65] text-zinc-800 first:mt-0 last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 space-y-1.5 pl-4 list-disc marker:text-indigo-500/70 text-[13px] text-zinc-800">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1.5 pl-4 list-decimal marker:text-zinc-400 marker:font-mono text-[13px] text-zinc-800">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-[1.6] pl-0.5 text-[13px] text-zinc-800">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-950 bg-zinc-100/90 px-1.5 py-0.5 rounded text-[12px] border border-zinc-200/70 inline-block my-0.5">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="text-zinc-700 italic">{children}</em>
          ),
          hr: () => (
            <hr className="my-3 border-0 border-t border-zinc-200/80" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 pl-3.5 py-1.5 border-l-2 border-indigo-500 bg-indigo-50/40 rounded-r-md text-zinc-700 text-[12.5px] italic leading-[1.6]">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs border-collapse divide-y divide-zinc-200">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-50/90 text-zinc-700 font-semibold">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-zinc-100 bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-zinc-50/70 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[12px] text-zinc-800">
              {children}
            </td>
          ),
          code: ({ className, children, ...props }) => {
            const isCodeBlock = className && className.startsWith("language-");
            if (isCodeBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-zinc-100 font-mono text-[11.5px] text-zinc-900 border border-zinc-200/60 font-medium"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => {
            return <>{children}</>;
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2 font-medium transition-colors"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default ChatMarkdown;
