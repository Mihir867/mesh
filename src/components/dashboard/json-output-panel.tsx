"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Table as TableIcon,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Calendar,
  Building2,
  Hash,
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
  ShieldCheck,
  ListOrdered,
  X,
  Plus,
  Trash2,
} from "lucide-react";

export interface JsonOutputPanelProps {
  jsonData?: any | null;
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

export interface ExtractedLineItemRow {
  id: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number;
  confidence: number;
}

interface TableRowItem {
  id: string;
  field: string;
  key: string;
  value: string | number | boolean | null;
  displayValue: string;
  numericValue: number | null;
  confidence: number;
  sourceSnippet?: string;
  isNumeric: boolean;
}

interface FilterExpression {
  textQuery: string;
  qty?: { op: ">" | ">=" | "<" | "<=" | "="; val: number };
  total?: { op: ">" | ">=" | "<" | "<=" | "="; val: number };
  price?: { op: ">" | ">=" | "<" | "<=" | "="; val: number };
  amount?: { op: ">" | ">=" | "<" | "<=" | "="; val: number };
}

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  displayText: string;
}

function parseNumberWithSuffix(str: string): number | null {
  const cleaned = str.replace(/[$,\s]/g, "").toLowerCase();
  if (cleaned.endsWith("k")) {
    const n = parseFloat(cleaned.slice(0, -1));
    return isNaN(n) ? null : n * 1000;
  }
  if (cleaned.endsWith("m")) {
    const n = parseFloat(cleaned.slice(0, -1));
    return isNaN(n) ? null : n * 1000000;
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function matchesOp(val: number | null | undefined, op: string, target: number): boolean {
  if (val === null || val === undefined || isNaN(val)) return false;
  switch (op) {
    case ">":
      return val > target;
    case ">=":
      return val >= target;
    case "<":
      return val < target;
    case "<=":
      return val <= target;
    case "=":
      return Math.abs(val - target) < 0.001 || val === target;
    default:
      return true;
  }
}

function parseFilterExpression(raw: string): FilterExpression {
  let remaining = raw.trim();
  const expr: FilterExpression = { textQuery: "" };

  if (!remaining) return expr;

  // 1. Check qty / quantity: e.g. "qty > 5", "quantity >= 10", "qty = 1", "qty < 5"
  const qtyMatch = remaining.match(/(?:qty|quantity)\s*(>=|<=|>|<|=)\s*(\$?[0-9.,]+[km]?)/i);
  if (qtyMatch) {
    const val = parseNumberWithSuffix(qtyMatch[2]);
    if (val !== null) {
      expr.qty = { op: qtyMatch[1] as any, val };
      remaining = remaining.replace(qtyMatch[0], " ");
    }
  }

  // 2. Check total: e.g. "total > 5000", "total >= 100k"
  const totalMatch = remaining.match(/(?:total|tot)\s*(>=|<=|>|<|=)\s*(\$?[0-9.,]+[km]?)/i);
  if (totalMatch) {
    const val = parseNumberWithSuffix(totalMatch[2]);
    if (val !== null) {
      expr.total = { op: totalMatch[1] as any, val };
      remaining = remaining.replace(totalMatch[0], " ");
    }
  }

  // 3. Check price / unit price: e.g. "price > 1000", "unitPrice <= 50"
  const priceMatch = remaining.match(/(?:unit_?price|price)\s*(>=|<=|>|<|=)\s*(\$?[0-9.,]+[km]?)/i);
  if (priceMatch) {
    const val = parseNumberWithSuffix(priceMatch[2]);
    if (val !== null) {
      expr.price = { op: priceMatch[1] as any, val };
      remaining = remaining.replace(priceMatch[0], " ");
    }
  }

  // 4. Check amount / amt: e.g. "amount > 5000", "amt >= 100k"
  const amountMatch = remaining.match(/(?:amount|amt)\s*(>=|<=|>|<|=)\s*(\$?[0-9.,]+[km]?)/i);
  if (amountMatch) {
    const val = parseNumberWithSuffix(amountMatch[2]);
    if (val !== null) {
      expr.amount = { op: amountMatch[1] as any, val };
      remaining = remaining.replace(amountMatch[0], " ");
    }
  } else {
    // Standalone operator query e.g. "> 5000", ">= 100k", "< 50"
    const standaloneMatch = remaining.match(/^(>=|<=|>|<|=)\s*(\$?[0-9.,]+[km]?)$/i);
    if (standaloneMatch) {
      const val = parseNumberWithSuffix(standaloneMatch[2]);
      if (val !== null) {
        expr.amount = { op: standaloneMatch[1] as any, val };
        remaining = "";
      }
    }
  }

  expr.textQuery = remaining.trim();
  return expr;
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
  // View Switcher: "table" (default) or "json"
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [tableSubView, setTableSubView] = useState<"fields" | "lineItems">("fields");
  const [copied, setCopied] = useState(false);

  // Table Controls: Search, Filter, Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortField, setSortField] = useState<"field" | "value" | "confidence">("field");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [lineItemSortField, setLineItemSortField] = useState<"description" | "quantity" | "unitPrice" | "total">("total");
  const [lineItemSortDirection, setLineItemSortDirection] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<"all" | "numeric" | "high-conf">("all");
  const [expandedSnippetKey, setExpandedSnippetKey] = useState<string | null>(null);

  // Advanced Filter Builder
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  // Close preset dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(event.target as Node)) {
        setIsPresetDropdownOpen(false);
      }
    };
    
    if (isPresetDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isPresetDropdownOpen]);

  // Handle switching between fields and line items
  const handleSubViewChange = (newView: "fields" | "lineItems") => {
    setTableSubView(newView);
    setSearchQuery("");
    setFilterConditions([]);
  };

  // Add a new filter condition from the visual builder
  const addFilterCondition = (field: string, operator: string, value: string) => {
    const displayText = generateFilterDisplayText(field, operator, value, tableSubView);
    const queryValue = buildQueryFromCondition(field, operator, value);
    
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      field,
      operator: 'raw', // Store as raw query
      value: queryValue,
      displayText,
    };
    setFilterConditions([...filterConditions, newCondition]);
    setShowFilterBuilder(false);
  };

  // Add filter from text query (when smart filter is clicked or search is used)
  const addFilterFromQuery = (query: string) => {
    if (!query.trim()) return;
    
    // Parse the query to create a proper chip
    const displayText = query.includes('>=') || query.includes('<=') || query.includes('>') || query.includes('<') || query.includes('=')
      ? query.replace(/qty/gi, 'item.quantity')
               .replace(/total/gi, 'item.total')
               .replace(/price/gi, 'item.unitPrice')
               .replace(/amount/gi, 'amount')
      : `item.description includes "${query}"`;
    
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      field: 'query',
      operator: 'raw',
      value: query,
      displayText,
    };
    
    setFilterConditions([...filterConditions, newCondition]);
    setSearchQuery(''); // Clear the search box after adding
  };

  // Remove a filter condition
  const removeFilterCondition = (id: string) => {
    setFilterConditions(filterConditions.filter(c => c.id !== id));
  };

  // Generate human-readable filter text
  const generateFilterDisplayText = (
    field: string,
    operator: string,
    value: string,
    viewType: "fields" | "lineItems"
  ): string => {
    const fieldLabels: Record<string, string> = {
      description: "item.description",
      quantity: "item.quantity",
      qty: "item.quantity",
      unitPrice: "item.unitPrice",
      price: "item.unitPrice",
      total: "item.total",
      amount: "amount",
      field: "field.name",
      value: "field.value",
    };

    const operatorLabels: Record<string, string> = {
      ">": ">",
      ">=": "≥",
      "<": "<",
      "<=": "≤",
      "=": "=",
      "!=": "≠",
      "includes": "includes",
      "startsWith": "starts with",
      "endsWith": "ends with",
    };

    const fieldLabel = fieldLabels[field] || field;
    const operatorLabel = operatorLabels[operator] || operator;

    if (operator === "includes" || operator === "startsWith" || operator === "endsWith") {
      return `${fieldLabel} ${operatorLabel} "${value}"`;
    }

    return `${fieldLabel} ${operatorLabel} ${value}`;
  };

  // Convert field from builder to query syntax
  const buildQueryFromCondition = (field: string, operator: string, value: string): string => {
    const fieldMapping: Record<string, string> = {
      description: 'description',
      quantity: 'qty',
      unitPrice: 'price',
      total: 'total',
      amount: 'amount',
      field: 'field',
      value: 'value',
    };

    const queryField = fieldMapping[field] || field;

    if (operator === "includes") {
      return value; // Just the keyword for text search
    }

    if (operator === "startsWith" || operator === "endsWith") {
      return value; // Simplified for now
    }

    return `${queryField} ${operator} ${value}`;
  };

  // Apply filter conditions to search query
  const combineFilterConditions = (): string => {
    // No longer combine with searchQuery - chips ARE the filters
    if (filterConditions.length === 0) return "";
    
    const conditionStrings = filterConditions.map(c => {
      // If it's a raw query (from smart filter or manual entry), use the original value
      if (c.operator === 'raw') {
        return c.value;
      }
      // Otherwise construct from field/operator/value
      if (c.operator === "includes") {
        return c.value;
      }
      return `${c.field} ${c.operator} ${c.value}`;
    });

    return conditionStrings.join(" ");
  };

  // Code Viewer ref
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const jsonString = useMemo(() => {
    return jsonData ? JSON.stringify(jsonData, null, 2) : "";
  }, [jsonData]);

  // Parse payload into rows, line items, and math validation
  const parsedData = useMemo(() => {
    if (!jsonData) {
      return {
        kpis: null,
        rows: [],
        lineItems: [] as ExtractedLineItemRow[],
        mathValidation: null,
        isTabularSpreadsheet: false,
        spreadsheetHeaders: [],
      };
    }

    // Check if it's a tabular file (CSV/XLSX) with headers & rows
    const dataObj = jsonData.data || jsonData;
    if (dataObj && Array.isArray(dataObj.headers) && Array.isArray(dataObj.rows)) {
      return {
        kpis: null,
        rows: dataObj.rows,
        lineItems: [] as ExtractedLineItemRow[],
        mathValidation: null,
        isTabularSpreadsheet: true,
        spreadsheetHeaders: dataObj.headers,
      };
    }

    // Line items parsing
    const rawLineItems = Array.isArray(dataObj?.lineItems) ? dataObj.lineItems : [];
    const lineItems: ExtractedLineItemRow[] = rawLineItems.map((item: any, idx: number) => ({
      id: `li_${idx}`,
      description: item.description || "Unspecified item",
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : null,
      total: typeof item.total === "number" ? item.total : 0,
      confidence: typeof item.confidence === "number" ? item.confidence : 0.98,
    }));

    // Math validation status
    const mathValidation = dataObj?.mathValidation || null;

    // Standard Document Grounded Fields array
    let fieldsArray: any[] = [];
    if (Array.isArray(dataObj)) {
      fieldsArray = dataObj;
    } else if (dataObj && Array.isArray(dataObj.fields)) {
      fieldsArray = dataObj.fields;
    } else if (typeof dataObj === "object") {
      fieldsArray = Object.entries(dataObj)
        .filter(([k]) => !["lineItems", "totals", "mathValidation", "metadata", "fields"].includes(k))
        .map(([k, v]) => ({
          key: k,
          label: k.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
          value: typeof v === "object" && v !== null ? JSON.stringify(v) : v,
          confidence: 0.95,
        }));
    }

    // Build KPI Summary Cards
    let kpiTotal: string | null = null;
    let kpiVendor: string | null = null;
    let kpiInvoiceNo: string | null = null;
    let kpiDate: string | null = null;

    // Direct metadata precedence
    if (dataObj?.metadata?.vendor) kpiVendor = String(dataObj.metadata.vendor);
    if (dataObj?.metadata?.invoiceNumber) kpiInvoiceNo = String(dataObj.metadata.invoiceNumber);
    if (dataObj?.metadata?.dueDate || dataObj?.metadata?.invoiceDate) {
      kpiDate = String(dataObj.metadata.dueDate || dataObj.metadata.invoiceDate);
    }
    if (dataObj?.totals?.totalDue !== undefined && dataObj?.totals?.totalDue !== null) {
      const cur = dataObj?.metadata?.currency || "$";
      kpiTotal = `${cur}${Number(dataObj.totals.totalDue).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    const tableRows: TableRowItem[] = fieldsArray.map((item, index) => {
      const key = item.key || `field_${index}`;
      const field =
        item.label ||
        key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str: string) => str.toUpperCase())
          .trim();

      const rawVal = item.value;
      const displayVal =
        rawVal === null || rawVal === undefined || rawVal === "null"
          ? "—"
          : typeof rawVal === "object"
          ? JSON.stringify(rawVal)
          : String(rawVal);

      // Try parsing numeric values (stripping $, €, £, commas)
      const cleanNumStr = displayVal.replace(/[^0-9.-]+/g, "");
      const parsedNum = cleanNumStr !== "" && !isNaN(Number(cleanNumStr)) ? Number(cleanNumStr) : null;

      // Extract KPI matches if not already populated from metadata
      const lowerKey = key.toLowerCase();
      if (!kpiTotal && (lowerKey.includes("total") || lowerKey.includes("amount") || lowerKey.includes("bill"))) {
        if (parsedNum !== null) kpiTotal = `$${parsedNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (!kpiVendor && (lowerKey.includes("vendor") || lowerKey.includes("merchant") || lowerKey.includes("company") || lowerKey.includes("party"))) {
        if (displayVal !== "—") kpiVendor = displayVal;
      }
      if (!kpiInvoiceNo && (lowerKey.includes("invoicenum") || lowerKey.includes("invoice_no") || lowerKey.includes("receiptnum") || lowerKey.includes("reference"))) {
        if (displayVal !== "—") kpiInvoiceNo = displayVal;
      }
      if (!kpiDate && (lowerKey.includes("date") || lowerKey.includes("due"))) {
        if (displayVal !== "—") kpiDate = displayVal;
      }

      return {
        id: `row_${index}`,
        key,
        field,
        value: rawVal,
        displayValue: displayVal,
        numericValue: parsedNum,
        confidence: typeof item.confidence === "number" ? item.confidence : 0.95,
        sourceSnippet: item.source_snippet || item.sourceSnippet,
        isNumeric: parsedNum !== null,
      };
    });

    return {
      kpis: {
        total: kpiTotal,
        vendor: kpiVendor,
        invoiceNo: kpiInvoiceNo,
        date: kpiDate,
      },
      rows: tableRows,
      lineItems,
      mathValidation,
      isTabularSpreadsheet: false,
      spreadsheetHeaders: [],
    };
  }, [jsonData]);

  // Generate dynamic filter suggestions based on actual data
  const generateDynamicPresets = useMemo(() => {
    if (!parsedData || parsedData.rows.length === 0) return [];

    const presets: Array<{ value: string; label: string; desc: string; category: string }> = [];

    if (tableSubView === "lineItems" && parsedData.lineItems.length > 0) {
      // Analyze line items for dynamic presets
      const quantities = parsedData.lineItems.map(item => item.quantity).filter(q => q !== null) as number[];
      const totals = parsedData.lineItems.map(item => item.total).filter(t => t > 0);
      const prices = parsedData.lineItems.map(item => item.unitPrice).filter(p => p !== null && p > 0) as number[];
      
      // Get unique keywords from descriptions
      const keywords = new Set<string>();
      parsedData.lineItems.forEach(item => {
        const words = item.description.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 3 && !['item', 'unit', 'each', 'total', 'price'].includes(word)) {
            keywords.add(word);
          }
        });
      });

      // Quantity-based presets
      if (quantities.length > 0) {
        const avgQty = Math.round(quantities.reduce((a, b) => a + b, 0) / quantities.length);
        const maxQty = Math.max(...quantities);
        
        presets.push(
          { value: `qty > ${avgQty}`, label: `Quantity > ${avgQty}`, desc: `Above average quantity`, category: "Quantity" },
          { value: `qty >= ${Math.ceil(maxQty / 2)}`, label: `Quantity ≥ ${Math.ceil(maxQty / 2)}`, desc: `Large orders`, category: "Quantity" },
          { value: `qty = 1`, label: `Quantity = 1`, desc: `Single units`, category: "Quantity" }
        );
      }

      // Price-based presets
      if (totals.length > 0) {
        const avgTotal = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
        const maxTotal = Math.max(...totals);
        
        presets.push(
          { value: `total > ${avgTotal}`, label: `Line Total > $${avgTotal.toLocaleString()}`, desc: `Above average value`, category: "Amount" },
          { value: `total > ${Math.round(maxTotal / 2)}`, label: `Line Total > $${Math.round(maxTotal / 2).toLocaleString()}`, desc: `High-value items`, category: "Amount" }
        );
      }

      if (prices.length > 0) {
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        presets.push(
          { value: `price > ${avgPrice}`, label: `Unit Price > $${avgPrice.toLocaleString()}`, desc: `Premium items`, category: "Amount" }
        );
      }

      // Keyword-based presets (top 5 most common meaningful words)
      Array.from(keywords).slice(0, 5).forEach(keyword => {
        presets.push(
          { value: keyword, label: `Contains "${keyword}"`, desc: `Items with ${keyword}`, category: "Keywords" }
        );
      });

    } else if (tableSubView === "fields" && !parsedData.isTabularSpreadsheet) {
      // Analyze document fields for dynamic presets
      const numericFields = (parsedData.rows as TableRowItem[]).filter(r => r.isNumeric && r.numericValue !== null);
      
      if (numericFields.length > 0) {
        const amounts = numericFields.map(r => r.numericValue!);
        const avgAmount = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
        const maxAmount = Math.max(...amounts);

        presets.push(
          { value: `amount > ${avgAmount}`, label: `Amount > $${avgAmount.toLocaleString()}`, desc: `Above average`, category: "Amount" },
          { value: `amount > ${Math.round(maxAmount / 2)}`, label: `Amount > $${Math.round(maxAmount / 2).toLocaleString()}`, desc: `High values`, category: "Amount" }
        );
      }

      // Common field name patterns
      const fieldPatterns = ['vendor', 'invoice', 'date', 'total', 'tax', 'subtotal', 'payment', 'due'];
      fieldPatterns.forEach(pattern => {
        const hasField = (parsedData.rows as TableRowItem[]).some(r => 
          r.field.toLowerCase().includes(pattern) || r.key.toLowerCase().includes(pattern)
        );
        if (hasField) {
          presets.push(
            { value: pattern, label: `${pattern.charAt(0).toUpperCase() + pattern.slice(1)} Fields`, desc: `Filter by ${pattern}`, category: "Fields" }
          );
        }
      });
    }

    return presets;
  }, [parsedData, tableSubView]);

  // Filtered and Sorted Table Rows
  const filteredRows = useMemo(() => {
    const combinedQuery = combineFilterConditions();
    const filterExpr = parseFilterExpression(combinedQuery);

    if (parsedData.isTabularSpreadsheet) {
      // Spreadsheet rows filter
      let rows = [...parsedData.rows];
      if (filterExpr.amount) {
        const { op, val } = filterExpr.amount;
        rows = rows.filter((r) =>
          Object.values(r).some((cellVal) => {
            const num = parseNumberWithSuffix(String(cellVal));
            return num !== null && matchesOp(num, op, val);
          })
        );
      }
      if (filterExpr.textQuery) {
        const q = filterExpr.textQuery.toLowerCase();
        rows = rows.filter((r) =>
          Object.values(r).some((v) => String(v).toLowerCase().includes(q))
        );
      }
      return rows;
    }

    let items = (parsedData.rows as TableRowItem[]) || [];

    // Search query filter (supports structured operators and text keywords)
    if (filterExpr.amount) {
      const { op, val } = filterExpr.amount;
      items = items.filter((r) => r.numericValue !== null && matchesOp(r.numericValue, op, val));
    }
    if (filterExpr.total) {
      const { op, val } = filterExpr.total;
      items = items.filter((r) => r.numericValue !== null && matchesOp(r.numericValue, op, val));
    }
    if (filterExpr.textQuery) {
      const q = filterExpr.textQuery.toLowerCase();
      items = items.filter(
        (r) =>
          r.field.toLowerCase().includes(q) ||
          r.displayValue.toLowerCase().includes(q) ||
          (r.sourceSnippet && r.sourceSnippet.toLowerCase().includes(q))
      );
    }

    // Min Amount Filter
    if (minAmount.trim() && !isNaN(Number(minAmount))) {
      const min = Number(minAmount);
      items = items.filter((r) => r.numericValue !== null && r.numericValue >= min);
    }

    // Max Amount Filter
    if (maxAmount.trim() && !isNaN(Number(maxAmount))) {
      const max = Number(maxAmount);
      items = items.filter((r) => r.numericValue !== null && r.numericValue <= max);
    }

    // Quick filter chips
    if (filterType === "numeric") {
      items = items.filter((r) => r.isNumeric);
    } else if (filterType === "high-conf") {
      items = items.filter((r) => r.confidence >= 0.95);
    }

    // Sort items
    items.sort((a, b) => {
      let comparison = 0;
      if (sortField === "field") {
        comparison = a.field.localeCompare(b.field);
      } else if (sortField === "value") {
        if (a.numericValue !== null && b.numericValue !== null) {
          comparison = a.numericValue - b.numericValue;
        } else {
          comparison = a.displayValue.localeCompare(b.displayValue);
        }
      } else if (sortField === "confidence") {
        comparison = a.confidence - b.confidence;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return items;
  }, [parsedData, searchQuery, minAmount, maxAmount, filterType, sortField, sortDirection, filterConditions]);

  // Filtered and Sorted Line Items
  const filteredLineItems = useMemo(() => {
    let items = [...parsedData.lineItems];
    const combinedQuery = combineFilterConditions();
    const filterExpr = parseFilterExpression(combinedQuery);

    // Quantity filter (e.g. qty > 5, qty >= 10, qty = 1)
    if (filterExpr.qty) {
      const { op, val } = filterExpr.qty;
      items = items.filter((item) => matchesOp(item.quantity, op, val));
    }

    // Line total filter (e.g. total > 5000, total > 100k)
    if (filterExpr.total) {
      const { op, val } = filterExpr.total;
      items = items.filter((item) => matchesOp(item.total, op, val));
    }

    // Unit price filter (e.g. price > 1000)
    if (filterExpr.price) {
      const { op, val } = filterExpr.price;
      items = items.filter((item) => matchesOp(item.unitPrice, op, val));
    }

    // Generic amount filter (e.g. amount > 5000 or > 5000) matches line total
    if (filterExpr.amount) {
      const { op, val } = filterExpr.amount;
      items = items.filter((item) => matchesOp(item.total, op, val));
    }

    // Keyword text search (e.g. printer, router, tablet)
    if (filterExpr.textQuery) {
      const q = filterExpr.textQuery.toLowerCase();
      items = items.filter((item) =>
        item.description.toLowerCase().includes(q)
      );
    }

    if (minAmount.trim() && !isNaN(Number(minAmount))) {
      const min = Number(minAmount);
      items = items.filter((item) => item.total >= min);
    }

    if (maxAmount.trim() && !isNaN(Number(maxAmount))) {
      const max = Number(maxAmount);
      items = items.filter((item) => item.total <= max);
    }

    if (filterType === "high-conf") {
      items = items.filter((item) => item.confidence >= 0.95);
    }

    items.sort((a, b) => {
      let comparison = 0;
      if (lineItemSortField === "description") {
        comparison = a.description.localeCompare(b.description);
      } else if (lineItemSortField === "quantity") {
        comparison = (a.quantity ?? 0) - (b.quantity ?? 0);
      } else if (lineItemSortField === "unitPrice") {
        comparison = (a.unitPrice ?? 0) - (b.unitPrice ?? 0);
      } else if (lineItemSortField === "total") {
        comparison = a.total - b.total;
      }
      return lineItemSortDirection === "asc" ? comparison : -comparison;
    });

    return items;
  }, [parsedData.lineItems, searchQuery, minAmount, maxAmount, filterType, lineItemSortField, lineItemSortDirection, filterConditions]);

  // Copy to clipboard
  const handleCopy = () => {
    if (!jsonString) return;
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export as CSV
  const handleExportCsv = () => {
    if (!jsonData) return;
    let csvContent = "";

    if (tableSubView === "lineItems" && parsedData.lineItems.length > 0) {
      csvContent += "Description,Quantity,UnitPrice,Total,Confidence\n";
      for (const item of filteredLineItems) {
        csvContent += `"${item.description.replace(/"/g, '""')}",${item.quantity ?? ""},${item.unitPrice ?? ""},${item.total},${(item.confidence * 100).toFixed(1)}%\n`;
      }
    } else if (parsedData.isTabularSpreadsheet) {
      const headers = parsedData.spreadsheetHeaders;
      csvContent += headers.join(",") + "\n";
      for (const row of parsedData.rows) {
        csvContent += headers.map((h: string) => `"${String((row as any)[h] || "").replace(/"/g, '""')}"`).join(",") + "\n";
      }
    } else {
      csvContent += "Field,Value,Confidence,Source Snippet\n";
      for (const row of parsedData.rows as TableRowItem[]) {
        csvContent += `"${row.field.replace(/"/g, '""')}","${row.displayValue.replace(/"/g, '""')}",${(row.confidence * 100).toFixed(1)}%,"${(row.sourceSnippet || "").replace(/"/g, '""')}"\n`;
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mesh_extracted_${tableSubView}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as JSON
  const handleDownloadJson = () => {
    if (!jsonString) return;
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mesh_extracted_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSortToggle = (field: "field" | "value" | "confidence") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleLineItemSortToggle = (field: "description" | "quantity" | "unitPrice" | "total") => {
    if (lineItemSortField === field) {
      setLineItemSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setLineItemSortField(field);
      setLineItemSortDirection("asc");
    }
  };

  return (
    <div
      className="lg:col-span-6 xl:col-span-7 p-6 flex flex-col h-full min-h-0 overflow-hidden"
      style={{ background: "var(--color-bg)" }}
    >
      {/* Top Header & View Switcher */}
      <div className="shrink-0 pb-4 border-b border-[var(--color-border)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: isProcessing
                    ? "var(--color-warning)"
                    : jsonData
                    ? "var(--color-success)"
                    : "var(--color-border-strong)",
                }}
                className={isProcessing ? "animate-pulse" : ""}
              />
              <span
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-text-tertiary)",
                  fontWeight: "var(--font-weight-medium)",
                }}
              >
                {isProcessing
                  ? "Processing"
                  : jsonData
                  ? "Structured Extraction"
                  : "Awaiting Document"}
              </span>
            </div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "var(--font-weight-medium)",
                color: "var(--color-text-primary)",
                letterSpacing: "-0.006em",
              }}
            >
              {category || "Document Data"}
            </h2>
          </div>

          {/* Right Toolbar: View Switcher & Export */}
          <div className="flex items-center gap-2">
            {/* View Switcher: Table vs JSON */}
            <div className="flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-0.5">
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all ${
                  viewMode === "table"
                    ? "bg-[var(--color-bg)] text-[var(--color-accent)] shadow-xs"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                Table View
              </button>
              <button
                onClick={() => setViewMode("json")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all ${
                  viewMode === "json"
                    ? "bg-[var(--color-bg)] text-[var(--color-accent)] shadow-xs"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                JSON Code
              </button>
            </div>

            {/* Export Dropdown */}
            <button
              onClick={handleExportCsv}
              disabled={!jsonData || isProcessing}
              title="Export as CSV"
              className="px-2.5 py-1.5 border border-[var(--color-border)] rounded-md text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Document Summary Quote */}
        {summary && !isProcessing && (
          <div className="mt-3 p-2.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)] leading-relaxed">
            <span className="font-semibold text-[var(--color-text-primary)]">Summary: </span>
            {summary}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 my-3 flex flex-col overflow-hidden">
        {/* Error State */}
        {errorMessage ? (
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-50 border border-red-200 mb-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Extraction Failed
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mb-4 leading-relaxed">
              {errorMessage}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-[var(--color-accent)] text-white text-xs font-medium rounded-md flex items-center gap-2 hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Retry Extraction
              </button>
            )}
          </div>
        ) : isProcessing ? (
          /* Loading State */
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 mb-3 animate-pulse">
              <Sparkles className="w-5 h-5 text-[var(--color-accent)] animate-spin" />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Extracting Structured Data...
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
              Analyzing document layout, extracting typed values, and grounding exact source citations.
            </p>
          </div>
        ) : !jsonData ? (
          /* Empty State */
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] mb-3">
              <FileCode2 className="w-6 h-6 text-[var(--color-text-tertiary)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Awaiting Document
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
              Upload an invoice, contract, or spreadsheet on the left to extract structured tables.
            </p>
          </div>
        ) : viewMode === "json" ? (
          /* RAW JSON CODE VIEW */
          <div
            ref={codeContainerRef}
            className="p-4 flex-1 min-h-0 overflow-auto select-text font-mono text-xs leading-relaxed bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
          >
            <pre>{jsonString}</pre>
          </div>
        ) : (
          /* INTERACTIVE STRUCTURED TABLE VIEW */
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
            {/* Top KPI Metric Cards */}
            {parsedData.kpis && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                {/* Total Due */}
                <div className="p-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)] tracking-wider">
                      Total Due
                    </div>
                    <div className="text-xs font-bold text-emerald-600 truncate">
                      {parsedData.kpis.total || "—"}
                    </div>
                  </div>
                </div>

                {/* Vendor / Entity */}
                <div className="p-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)] tracking-wider">
                      Vendor / Entity
                    </div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                      {parsedData.kpis.vendor || "—"}
                    </div>
                  </div>
                </div>

                {/* Invoice / Ref # */}
                <div className="p-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)] tracking-wider">
                      Reference #
                    </div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                      {parsedData.kpis.invoiceNo || "—"}
                    </div>
                  </div>
                </div>

                {/* Date */}
                <div className="p-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)] tracking-wider">
                      Date / Due
                    </div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                      {parsedData.kpis.date || "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Self-Healing Math Verification Banner */}
            {parsedData.mathValidation && (
              <div
                className={`shrink-0 p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${
                  parsedData.mathValidation.isValid
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {parsedData.mathValidation.isValid ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <span className="font-semibold">
                      {parsedData.mathValidation.isReconciled
                        ? "Self-Healing Math Reconciled:"
                        : parsedData.mathValidation.isValid
                        ? "Self-Healing Math Verified:"
                        : "Math Discrepancy Alert:"}
                    </span>{" "}
                    <span className="opacity-90">{parsedData.mathValidation.statusMessage}</span>
                  </div>
                </div>
                {parsedData.mathValidation.discrepancy > 0 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-200/60 text-amber-900 shrink-0 font-medium">
                    Diff: ${parsedData.mathValidation.discrepancy.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            {/* Quick Filter Bar & Sub-View Switcher */}
            <div className="shrink-0 p-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
                {/* Line Items vs Key Fields Sub-Tabs (if document has line items) */}
                {!parsedData.isTabularSpreadsheet && parsedData.lineItems.length > 0 && (
                  <div className="flex items-center gap-1 p-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md">
                    <button
                      onClick={() => handleSubViewChange("fields")}
                      className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                        tableSubView === "fields"
                          ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-2xs font-semibold"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      Fields ({parsedData.rows.length})
                    </button>
                    <button
                      onClick={() => handleSubViewChange("lineItems")}
                      className={`px-2 py-0.5 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                        tableSubView === "lineItems"
                          ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-2xs font-semibold"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <ListOrdered className="w-3 h-3" />
                      Line Items ({parsedData.lineItems.length})
                    </button>
                  </div>
                )}

                {/* Preset Filter Select Box - Custom Dropdown */}
                <div className="relative shrink-0" ref={presetDropdownRef}>
                  <button
                    onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                    className="h-7 px-2.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded cursor-pointer hover:border-[var(--color-accent)] focus:outline-none focus:border-[var(--color-accent)] transition-colors font-medium flex items-center gap-1.5"
                    title="Smart filter suggestions based on your data"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Smart Filters</span>
                    {generateDynamicPresets.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded text-[10px] font-bold">
                        {generateDynamicPresets.length}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-tertiary)] transition-transform ${isPresetDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isPresetDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-72 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                      <div className="p-1.5">
                        {generateDynamicPresets.length === 0 ? (
                          <div className="px-3 py-4 text-center">
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              No suggested filters available
                            </p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                              Try adding custom filters using the filter builder
                            </p>
                          </div>
                        ) : (
                          <>
                            {Object.entries(
                              generateDynamicPresets.reduce((acc, preset) => {
                                if (!acc[preset.category]) acc[preset.category] = [];
                                acc[preset.category].push(preset);
                                return acc;
                              }, {} as Record<string, typeof generateDynamicPresets>)
                            ).map(([category, presets]) => (
                              <div key={category}>
                                <div className="px-2 py-1.5 text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)] tracking-wider flex items-center gap-2">
                                  <span>{category}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 bg-[var(--color-surface)] rounded">
                                    {presets.length}
                                  </span>
                                </div>
                                {presets.map((preset, idx) => (
                                  <button
                                    key={`${category}-${idx}`}
                                    onClick={() => {
                                      addFilterFromQuery(preset.value);
                                      setIsPresetDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-[var(--color-surface)] transition-colors flex items-start gap-2"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-[var(--color-text-primary)]">{preset.label}</div>
                                      <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{preset.desc}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Search Input with Better Placeholder */}
                <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        addFilterFromQuery(searchQuery);
                      }
                    }}
                    placeholder={
                      tableSubView === "lineItems"
                        ? 'Type filter and press Enter (e.g., qty > 5)'
                        : 'Type filter and press Enter (e.g., amount > 5000)'
                    }
                    className="w-full pl-8 pr-16 py-1 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                  />
                  {searchQuery && (
                    <>
                      <button
                        onClick={() => addFilterFromQuery(searchQuery)}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors font-medium text-xs"
                        title="Add filter (or press Enter)"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        title="Clear"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>

                {/* Add Filter Button */}
                <button
                  onClick={() => setShowFilterBuilder(!showFilterBuilder)}
                  className={`h-7 px-2.5 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
                    showFilterBuilder || filterConditions.length > 0
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
                  }`}
                  title="Add filter condition"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Filter</span>
                  {filterConditions.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-bold">
                      {filterConditions.length}
                    </span>
                  )}
                </button>

                {/* Numeric Range Filter */}
                <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]">
                  <span>Min $:</span>
                  <input
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="0"
                    className="w-16 py-1 px-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)]"
                  />
                </div>

                {/* Filter Chips (Fields View Only) */}
                {!parsedData.isTabularSpreadsheet && tableSubView === "fields" && (
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      onClick={() => setFilterType("all")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        filterType === "all"
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType("numeric")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        filterType === "numeric"
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      Amounts ($)
                    </button>
                    <button
                      onClick={() => setFilterType("high-conf")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        filterType === "high-conf"
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      ≥95% Conf
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-[var(--color-text-tertiary)] font-medium">
                {tableSubView === "lineItems"
                  ? `${filteredLineItems.length} ${filteredLineItems.length === 1 ? "item" : "items"}`
                  : `${filteredRows.length} ${filteredRows.length === 1 ? "record" : "records"}`}
              </div>
            </div>

            {/* Filter Builder Panel */}
            {showFilterBuilder && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                        Field
                      </label>
                      <select
                        id="filter-field"
                        className="w-full px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)]"
                      >
                        {tableSubView === "lineItems" ? (
                          <>
                            <option value="description">Description</option>
                            <option value="quantity">Quantity</option>
                            <option value="unitPrice">Unit Price</option>
                            <option value="total">Total</option>
                          </>
                        ) : (
                          <>
                            <option value="field">Field Name</option>
                            <option value="value">Field Value</option>
                            <option value="amount">Numeric Amount</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                        Operator
                      </label>
                      <select
                        id="filter-operator"
                        className="w-full px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)]"
                      >
                        <option value="includes">includes</option>
                        <option value=">">{">"}</option>
                        <option value=">=">{"≥"}</option>
                        <option value="<">{"<"}</option>
                        <option value="<=">{"≤"}</option>
                        <option value="=">=</option>
                        <option value="startsWith">starts with</option>
                        <option value="endsWith">ends with</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                        Value
                      </label>
                      <input
                        type="text"
                        id="filter-value"
                        placeholder="Enter value..."
                        className="w-full px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const field = (document.getElementById("filter-field") as HTMLSelectElement)?.value;
                      const operator = (document.getElementById("filter-operator") as HTMLSelectElement)?.value;
                      const value = (document.getElementById("filter-value") as HTMLInputElement)?.value;
                      
                      if (field && operator && value) {
                        addFilterCondition(field, operator, value);
                        // Clear the value input
                        const valueInput = document.getElementById("filter-value") as HTMLInputElement;
                        if (valueInput) valueInput.value = "";
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Active Filter Conditions Chips */}
            {filterConditions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  Active Filters:
                </span>
                {filterConditions.map((condition) => (
                  <div
                    key={condition.id}
                    className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded text-xs text-[var(--color-text-primary)]"
                  >
                    <span className="font-mono">{condition.displayText}</span>
                    <button
                      onClick={() => removeFilterCondition(condition.id)}
                      className="hover:text-[var(--color-accent)] transition-colors"
                      title="Remove filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setFilterConditions([])}
                  className="px-2 py-1 text-[10px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors uppercase tracking-wider"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Interactive Data Table Grid */}
            <div className="flex-1 min-h-0 border border-[var(--color-border)] rounded-lg overflow-auto bg-[var(--color-bg)]">
              {parsedData.isTabularSpreadsheet ? (
                /* CSV / SPREADSHEET TABLE */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] z-10 shadow-2xs">
                    <tr>
                      {parsedData.spreadsheetHeaders.map((header: string) => (
                        <th key={header} className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] truncate">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {filteredRows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[var(--color-surface)] transition-colors">
                        {parsedData.spreadsheetHeaders.map((header: string) => (
                          <td key={header} className="py-2 px-3 text-[var(--color-text-secondary)] truncate max-w-[200px]">
                            {row[header] !== null && row[header] !== undefined ? String(row[header]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : tableSubView === "lineItems" ? (
                /* ITEMIZED LINE ITEMS TABLE */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] z-10 shadow-2xs">
                    <tr>
                      <th
                        onClick={() => handleLineItemSortToggle("description")}
                        className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-accent)] select-none w-3/6"
                      >
                        <div className="flex items-center gap-1.5">
                          Description
                          {lineItemSortField === "description" ? (
                            lineItemSortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleLineItemSortToggle("quantity")}
                        className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-accent)] select-none w-1/6 text-right"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          Qty
                          {lineItemSortField === "quantity" ? (
                            lineItemSortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleLineItemSortToggle("unitPrice")}
                        className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-accent)] select-none w-1/6 text-right"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          Unit Price
                          {lineItemSortField === "unitPrice" ? (
                            lineItemSortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleLineItemSortToggle("total")}
                        className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-accent)] select-none w-1/6 text-right"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          Total
                          {lineItemSortField === "total" ? (
                            lineItemSortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {filteredLineItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--color-text-tertiary)]">
                          No line items match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredLineItems.map((item) => (
                        <tr key={item.id} className="hover:bg-[var(--color-surface)] transition-colors">
                          <td className="py-2.5 px-3 font-medium text-[var(--color-text-primary)]">
                            {item.description}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[var(--color-text-secondary)]">
                            {item.quantity !== null ? item.quantity : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[var(--color-text-secondary)]">
                            {item.unitPrice !== null ? `$${item.unitPrice.toFixed(2)}` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600">
                            ${item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                /* EXTRACTED DOCUMENT FIELDS TABLE */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] z-10 shadow-2xs">
                    <tr>
                      <th
                        onClick={() => handleSortToggle("field")}
                        className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-accent)] select-none w-2/6"
                      >
                        <div className="flex items-center gap-1.5">
                          Field Name
                          {sortField === "field" ? (
                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortToggle("value")}
                        className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-accent)] select-none w-2/6"
                      >
                        <div className="flex items-center gap-1.5">
                          Extracted Value
                          {sortField === "value" ? (
                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortToggle("confidence")}
                        className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-accent)] select-none w-1/6"
                      >
                        <div className="flex items-center gap-1.5">
                          Confidence
                          {sortField === "confidence" ? (
                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)] w-1/6 text-right">
                        Source Citation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--color-text-tertiary)]">
                          No fields match your search or amount filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row: TableRowItem) => {
                        const confPct = Math.round(row.confidence * 100);
                        const isExpanded = expandedSnippetKey === row.id;

                        return (
                          <React.Fragment key={row.id}>
                            <tr className="hover:bg-[var(--color-surface)] transition-colors group">
                              {/* Field */}
                              <td className="py-2.5 px-3 font-medium text-[var(--color-text-primary)]">
                                <div>{row.field}</div>
                                <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                                  {row.key}
                                </div>
                              </td>

                              {/* Value */}
                              <td className="py-2.5 px-3">
                                {row.numericValue !== null ? (
                                  <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200">
                                    {row.displayValue}
                                  </span>
                                ) : (
                                  <span className="text-[var(--color-text-primary)]">
                                    {row.displayValue}
                                  </span>
                                )}
                              </td>

                              {/* Confidence */}
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    confPct >= 95
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : confPct >= 80
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-red-50 text-red-700 border border-red-200"
                                  }`}
                                >
                                  {confPct}%
                                </span>
                              </td>

                              {/* Source Snippet */}
                              <td className="py-2.5 px-3 text-right">
                                {row.sourceSnippet ? (
                                  <button
                                    onClick={() => setExpandedSnippetKey(isExpanded ? null : row.id)}
                                    className="text-[11px] text-[var(--color-accent)] hover:underline font-medium"
                                  >
                                    {isExpanded ? "Hide snippet" : "View citation"}
                                  </button>
                                ) : (
                                  <span className="text-[var(--color-text-disabled)]">—</span>
                                )}
                              </td>
                            </tr>

                            {/* Expanded Citation Row */}
                            {isExpanded && row.sourceSnippet && (
                              <tr className="bg-[var(--color-surface)]">
                                <td colSpan={4} className="p-3 border-t border-b border-[var(--color-border-subtle)]">
                                  <div className="text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg)] p-2 rounded border border-[var(--color-border)] font-mono leading-relaxed">
                                    <span className="font-sans font-semibold text-[var(--color-accent)]">Grounded Quote: </span>
                                    &ldquo;{row.sourceSnippet}&rdquo;
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div
        className="shrink-0 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--color-border)]"
      >
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            {isProcessing ? "Processing..." : `${processingTimeMs}ms`}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Code2 className="w-3.5 h-3.5 text-emerald-600" />
            {isProcessing ? "—" : `${confidenceScore} conf`}
          </span>
        </div>

        <button
          onClick={onOpenChat}
          disabled={!jsonData || isProcessing}
          className="w-full sm:w-auto px-4 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Chat with Document
        </button>
      </div>
    </div>
  );
}

export default JsonOutputPanel;
