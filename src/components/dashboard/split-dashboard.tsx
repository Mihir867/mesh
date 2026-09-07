"use client";

import React, { useState } from "react";
import { DocumentUploadPanel, type UploadedFile } from "./document-upload-panel";
import { JsonOutputPanel } from "./json-output-panel";

const SAMPLE_JSON = {
  document_type: "structured_data",
  schema_version: "3.0.0",
  confidence_score: 0.996,
  extracted_at: "2026-09-07T11:32:45Z",
  processing_time_ms: 847,
  metadata: {
    source_format: "PDF",
    page_count: 3,
    language: "en-US",
    character_count: 4821,
  },
  entities: {
    organizations: [
      {
        name: "Mesh Corporation",
        type: "company",
        confidence: 0.98,
        mentions: 3,
      },
      {
        name: "Global Tech Solutions",
        type: "vendor",
        confidence: 0.94,
        mentions: 2,
      },
    ],
    dates: [
      { value: "2026-08-15", type: "transaction_date", confidence: 0.99 },
      { value: "2026-09-15", type: "due_date", confidence: 0.97 },
    ],
    amounts: [
      { value: 15750.0, currency: "USD", type: "total", confidence: 0.99 },
      { value: 14500.0, currency: "USD", type: "subtotal", confidence: 0.98 },
    ],
  },
  structured_fields: {
    reference_number: "REF-2026-891047",
    status: "verified",
    priority: "high",
    category: "financial",
    tags: ["invoice", "payment", "recurring"],
  },
  line_items: [
    {
      id: "item_001",
      description: "Cloud Infrastructure Services",
      quantity: 1,
      unit_price: 8500.0,
      total: 8500.0,
      metadata: {
        service_period: "2026-08",
        billing_cycle: "monthly",
      },
    },
    {
      id: "item_002",
      description: "AI Processing Credits",
      quantity: 500,
      unit_price: 12.0,
      total: 6000.0,
      metadata: {
        usage_type: "compute",
        region: "us-east-1",
      },
    },
  ],
  computed_analytics: {
    total_value: 15750.0,
    payment_terms: "NET-30",
    risk_score: 0.12,
    processing_confidence: 0.996,
  },
};

export function SplitDashboard() {
  const [, setUploadedFile] = useState<UploadedFile | null>(null);
  const [extractedData] = useState<object>(SAMPLE_JSON);

  const handleUploadSuccess = (file: UploadedFile) => {
    setUploadedFile(file);
    // Future integration: fetch extraction data for this file
    console.log("File uploaded successfully:", file);
  };

  return (
    <div className="w-full max-w-[1560px] mx-auto">
      <div className="rounded-[16px] bg-white border border-zinc-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden h-[740px] max-h-[calc(100vh-160px)] min-h-[620px] flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 h-full">
          <DocumentUploadPanel onUploadSuccess={handleUploadSuccess} />
          <JsonOutputPanel
            jsonData={extractedData}
            processingTimeMs={847}
            confidenceScore={0.996}
          />
        </div>
      </div>
    </div>
  );
}

export default SplitDashboard;
