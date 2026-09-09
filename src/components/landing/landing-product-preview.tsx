"use client";

import React, { useState } from "react";
import {
  FileText,
  Bot,
  Code2,
  Check,
  Copy,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  Zap,
  Layers,
} from "lucide-react";
import { ChatMarkdown } from "../dashboard/chat-markdown";

interface SampleDocument {
  id: string;
  name: string;
  type: string;
  category: string;
  confidence: string;
  processingTime: string;
  summary: string;
  docContent: {
    title: string;
    subtitle: string;
    meta: string;
    sections: {
      heading: string;
      content: string;
      highlight?: string;
    }[];
  };
  jsonOutput: object;
  chatQAs: {
    question: string;
    answer: string;
  }[];
}

const SAMPLE_DOCS: SampleDocument[] = [
  {
    id: "risk-profile",
    name: "Organic_Steel_Risk_Profile.pdf",
    type: "PDF · 4 pages",
    category: "Business Risk Profile",
    confidence: "99.4%",
    processingTime: "842ms",
    summary: "Business risk profile analysis for Organic Steel Pvt Ltd detailing manufacturing capacity, port proximity, and revenue trajectory.",
    docContent: {
      title: "ORGANIC STEEL PRIVATE LIMITED",
      subtitle: "Comprehensive Risk Assessment & Operations Profile",
      meta: "CRISIL Ref: OSPL/2026/Q3 · Published: Dec 2024 · Rating: CRISIL BBB+/Stable",
      sections: [
        {
          heading: "1. Executive Summary & Core Operations",
          content: "Organic Steel Pvt Ltd is a premier manufacturer and exporter of stainless steel pipes and tubes across 5 dedicated product lines. Located strategically in Gujarat, primary facilities operate in proximity to key maritime gateways.",
          highlight: "Kandla (55 km) and Mundra (75 km) ports",
        },
        {
          heading: "2. Financial Trajectory & Scale",
          content: "The company demonstrated substantial top-line acceleration. Revenue grew from ₹1,187.52 million in FY2022 to ₹3,093.31 million in FY2024. For the 9-month period ending December 2024, revenue stood at ₹2,767.69 million.",
          highlight: "FY2024 Revenue: ₹3,093.31 million (160% 2-year expansion)",
        },
        {
          heading: "3. Strategic Procurement & Key Success Factors",
          content: "Raw materials are procured through balanced domestic partnerships and direct high-sea import contracts from China, Indonesia, Malaysia, and Singapore. Core moats include manufacturing precision, diversified industrial sectors, and ISO 9001 compliance.",
          highlight: "Domestic & high-sea international procurement channels",
        },
      ],
    },
    jsonOutput: {
      document_id: "doc_steel_9942",
      category: "Business Risk Profile",
      confidence: 0.994,
      processing_time_ms: 842,
      data: {
        company_name: "Organic Steel Pvt Ltd",
        industry: "Stainless steel pipes and tubes",
        product_lines: 5,
        rating: "CRISIL BBB+/Stable",
        nearby_ports: ["Kandla (55 km)", "Mundra (75 km)"],
        financials: {
          fy22_revenue: "₹1,187.52M",
          fy24_revenue: "₹3,093.31M",
          nine_month_fy25: "₹2,767.69M",
          cagr: "61.4%"
        },
        procurement_origins: ["India", "China", "Indonesia", "Malaysia", "Singapore"]
      }
    },
    chatQAs: [
      {
        question: "Summarize key data points",
        answer: `Here is a summary of the key data points extracted from the **Business Risk Profile** report:

### Company Overview
- **Company Name:** Organic Steel Pvt Ltd
- **Industry:** Stainless steel pipes and tubes
- **Product Lines:** 5 specialized lines
- **Logistics Hub:** Kandla (55 km) & Mundra (75 km)

### Financial Performance
| Period | Revenue (INR) | Growth Metric |
| :--- | :--- | :--- |
| **FY2022** | ₹1,187.52 Million | Base Period |
| **FY2024** | ₹3,093.31 Million | +160.5% Expansion |
| **9M FY2025** | ₹2,767.69 Million | Run-rate: ₹3,690M |

### Operations & Strategy
- **Key Success Factors:** Manufacturing precision, sectoral diversification, rigorous ISO compliance.
- **Procurement Channels:** High-sea imports (China, Indonesia, Malaysia, Singapore) paired with regional domestic suppliers.`
      },
      {
        question: "What are the primary logistics advantages?",
        answer: `### Strategic Maritime Access
The document notes proximity to two major ports in Gujarat:
- **Kandla Port:** Located **55 km** from primary facility.
- **Mundra Port:** Located **75 km** from primary facility.

> Proximity to both ports enables freight cost savings and reliable access for raw material shipments originating from China, Indonesia, and Singapore.`
      },
    ]
  },
  {
    id: "commercial-invoice",
    name: "Apex_Logistics_Invoice_7841.pdf",
    type: "PDF · 1 page",
    category: "Commercial Invoice",
    confidence: "99.8%",
    processingTime: "512ms",
    summary: "Commercial freight invoice from Apex Logistics International to Northwind Traders totaling $48,250.00.",
    docContent: {
      title: "APEX LOGISTICS INTERNATIONAL",
      subtitle: "Freight Forwarding & Customs Clearance Invoice",
      meta: "Invoice #INV-2026-7841 · Issue Date: Oct 14, 2026 · Payment Terms: Net 30",
      sections: [
        {
          heading: "Bill To",
          content: "Northwind Traders Inc., 450 Lexington Ave, Suite 1200, New York, NY 10017. Attn: Accounts Payable.",
        },
        {
          heading: "Service Breakdown & Line Items",
          content: "Ocean Freight Container 40ft HQ (Rotterdam to New York): $38,500.00. Customs Clearance and Terminal Handling Fees: $6,750.00. Inland Drayage & Fuel Surcharge: $3,000.00.",
          highlight: "Total Amount Due: $48,250.00 USD",
        },
        {
          heading: "Remittance Instructions",
          content: "Wire transfers payable to JP Morgan Chase, Swift: APEXUS33, Account: 8492048102. Please reference Invoice #INV-2026-7841.",
        },
      ],
    },
    jsonOutput: {
      document_id: "inv_apex_7841",
      category: "Commercial Invoice",
      confidence: 0.998,
      processing_time_ms: 512,
      data: {
        invoice_number: "INV-2026-7841",
        vendor: "Apex Logistics International",
        customer: "Northwind Traders Inc.",
        total_amount: "$48,250.00",
        currency: "USD",
        due_date: "Nov 13, 2026",
        items_count: 3,
        payment_terms: "Net 30"
      }
    },
    chatQAs: [
      {
        question: "What is the total amount and payment deadline?",
        answer: `### Invoice Summary
- **Invoice Number:** \`INV-2026-7841\`
- **Vendor:** Apex Logistics International
- **Total Amount Due:** **$48,250.00 USD**
- **Issue Date:** Oct 14, 2026
- **Payment Deadline:** **Nov 13, 2026** (Net 30 terms)

### Wire Instructions
- **Bank:** JP Morgan Chase
- **SWIFT:** \`APEXUS33\`
- **Account:** \`8492048102\``
      }
    ]
  }
];

export function LandingProductPreview() {
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"json" | "chat">("json");
  const [copied, setCopied] = useState(false);
  const [activeChatIndex, setActiveChatIndex] = useState(0);

  const currentDoc = SAMPLE_DOCS[selectedDocIndex];

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentDoc.jsonOutput, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-6">
      {/* Interactive Mockup Window */}
      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        className="transition-all duration-200"
      >
        {/* Top Window Header */}
        <div
          style={{
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
          className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          {/* Window dots & Active file */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-amber-400/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
            </div>
            <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block" />
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-medium text-zinc-900 font-mono">
                {currentDoc.name}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/80">
                {currentDoc.type}
              </span>
            </div>
          </div>

          {/* Sample Document Switcher Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100/90 p-1 rounded-md border border-zinc-200/60">
            {SAMPLE_DOCS.map((doc, idx) => (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedDocIndex(idx);
                  setActiveChatIndex(0);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
                  selectedDocIndex === idx
                    ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/80"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {doc.id === "risk-profile" ? "Risk Profile Report" : "Commercial Invoice"}
              </button>
            ))}
          </div>
        </div>

        {/* Dual-Pane Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
          {/* Left Pane: Document Canvas Preview (7 cols) */}
          <div className="lg:col-span-6 border-b lg:border-b-0 lg:border-r border-zinc-200 bg-zinc-50/70 p-5 flex flex-col justify-between">
            <div>
              {/* Document Toolbar */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-700">Source Document</span>
                  <span className="text-[11px] text-zinc-400">· 100% OCR Grounded</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-zinc-200 text-[11px]">
                    <ZoomIn className="w-3 h-3 text-zinc-400" />
                    <span>100%</span>
                    <ZoomOut className="w-3 h-3 text-zinc-400" />
                  </div>
                </div>
              </div>

              {/* Realistic Document Paper Sheet */}
              <div className="bg-white rounded-md border border-zinc-200/90 shadow-xs p-6 space-y-4 max-w-full">
                <div className="border-b border-zinc-100 pb-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-600 font-semibold mb-1">
                    {currentDoc.category}
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                    {currentDoc.docContent.title}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {currentDoc.docContent.subtitle}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-400 mt-1">
                    {currentDoc.docContent.meta}
                  </p>
                </div>

                <div className="space-y-3">
                  {currentDoc.docContent.sections.map((section, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-800">
                        {section.heading}
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {section.content}
                      </p>
                      {section.highlight && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50/80 border border-indigo-200/80 text-[11.5px] text-indigo-900 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <span>AI Grounded: {section.highlight}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-200/80 flex items-center justify-between text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Lineage-verified document preview
              </span>
              <span className="font-mono text-[11px]">Page 1 of 4</span>
            </div>
          </div>

          {/* Right Pane: AI Structured Intelligence (6 cols) */}
          <div className="lg:col-span-6 bg-white flex flex-col justify-between">
            {/* Right Pane Header: Tabs */}
            <div>
              <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("json")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeTab === "json"
                        ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Structured JSON</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("chat")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeTab === "chat"
                        ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Document Assistant</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                      AI
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {currentDoc.confidence} Confidence
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
                    {currentDoc.processingTime}
                  </span>
                </div>
              </div>

              {/* Tab Content: JSON Mode */}
              {activeTab === "json" && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Extracted Schema Payload
                      </span>
                      <p className="text-xs text-zinc-600">
                        Normalized key-values ready for database sync or APIs.
                      </p>
                    </div>
                    <button
                      onClick={handleCopyJson}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[11px]">Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* JSON Code Viewer */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-xs font-mono text-zinc-200 overflow-x-auto max-h-[380px] shadow-xs">
                    <pre className="text-[12px] leading-relaxed selection:bg-indigo-500/30">
                      <code>{JSON.stringify(currentDoc.jsonOutput, null, 2)}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab Content: Chat Assistant Mode (Demonstrating new Markdown renderer) */}
              {activeTab === "chat" && (
                <div className="p-5 space-y-4">
                  {/* Prompt Questions Chips */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Sample Inquiries
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentDoc.chatQAs.map((qa, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveChatIndex(idx)}
                          className={`text-xs px-3 py-1.5 rounded-md border transition-all cursor-pointer text-left ${
                            activeChatIndex === idx
                              ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-medium"
                              : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {qa.question}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rendered Assistant Response using the new ChatMarkdown */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-900">
                      <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <span>Document Assistant Answer</span>
                      <span className="text-[10px] text-zinc-400 font-mono">Markdown V2</span>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 max-h-[340px] overflow-y-auto">
                      <ChatMarkdown content={currentDoc.chatQAs[activeChatIndex]?.answer || ""} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Panel Status */}
            <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50/80 flex items-center justify-between text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Dual-pane synchronization active
              </span>
              <span className="text-zinc-600 font-medium">Ready for export</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Value Row Below Preview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
        <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-zinc-900">&lt; 1.2s Latency</h4>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Ultra-fast document ingestion with streamed structured outputs.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-semibold text-zinc-900">99.8% Accuracy</h4>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Every numeric amount and clause anchored with source bounding boxes.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-zinc-900">Multi-Format</h4>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Native support for PDF, DOCX, Excel spreadsheets, and CSV files.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5">
            <Bot className="w-4 h-4 text-purple-600" />
            <h4 className="text-sm font-semibold text-zinc-900">Assistant Q&A</h4>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Natural conversation over extracted schemas with formatted markdown.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LandingProductPreview;
