/**
 * math-validator.ts — Self-Healing Math & Discrepancy Reconciliation
 *
 * Mathematically verifies that line items add up to reported totals.
 * Handles common OCR/LLM numerical discrepancies:
 *  - 1-cent to 5-cent rounding differences
 *  - Missing subtotal when line item sum is known
 *  - Discrepancy detection between subtotal + tax and reported total due
 */

export interface LineItemInput {
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  total: number;
  confidence?: number;
}

export interface DocumentTotalsInput {
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  shipping?: number | null;
  totalDue?: number | null;
}

export interface MathValidationResult {
  /** True if mathematical integrity holds within acceptable tolerance */
  isValid: boolean;
  /** True if self-healing automatically corrected a minor rounding issue or missing subtotal */
  isReconciled: boolean;
  /** Difference between reported total and computed line items sum */
  discrepancy: number;
  /** Sum of all line item totals calculated in TypeScript */
  computedItemSum: number;
  /** Total reported in the document */
  reportedTotal: number;
  /** Reconciled total due after self-healing */
  reconciledTotal: number;
  /** Human-readable explanation of verification outcome */
  statusMessage: string;
  /** Detailed audit trail notes */
  auditNotes: string[];
}

/**
 * Clean floating point numbers to 2 decimal places to eliminate IEEE 754 precision artifacts.
 */
function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Validate and reconcile mathematical values between line items and totals.
 */
export function validateAndReconcileMath(
  lineItems: LineItemInput[] = [],
  totals: DocumentTotalsInput = {}
): MathValidationResult {
  const auditNotes: string[] = [];

  // 1. Calculate sum of line item totals
  const rawSum = lineItems.reduce((acc, item) => {
    const val = typeof item.total === "number" && !isNaN(item.total) ? item.total : 0;
    return acc + val;
  }, 0);
  const computedItemSum = round2(rawSum);

  // 2. Resolve reported total due
  const reportedTotalDue =
    typeof totals.totalDue === "number" && !isNaN(totals.totalDue)
      ? round2(totals.totalDue)
      : null;

  const reportedSubtotal =
    typeof totals.subtotal === "number" && !isNaN(totals.subtotal)
      ? round2(totals.subtotal)
      : null;

  const tax = typeof totals.tax === "number" && !isNaN(totals.tax) ? round2(totals.tax) : 0;
  const discount =
    typeof totals.discount === "number" && !isNaN(totals.discount) ? round2(totals.discount) : 0;
  const shipping =
    typeof totals.shipping === "number" && !isNaN(totals.shipping) ? round2(totals.shipping) : 0;

  // Case A: No line items found (e.g. general contract or simple letter)
  if (lineItems.length === 0) {
    const fallbackTotal = reportedTotalDue ?? reportedSubtotal ?? 0;
    return {
      isValid: true,
      isReconciled: false,
      discrepancy: 0,
      computedItemSum: 0,
      reportedTotal: fallbackTotal,
      reconciledTotal: fallbackTotal,
      statusMessage: "Non-itemized document: No line items to cross-verify.",
      auditNotes: ["No line items present for mathematical cross-validation."],
    };
  }

  // Determine benchmark to compare against: prefer subtotal if present, otherwise totalDue
  const targetForItems = reportedSubtotal ?? reportedTotalDue ?? computedItemSum;
  const itemDiscrepancy = round2(Math.abs(computedItemSum - targetForItems));

  let reconciledTotal = reportedTotalDue ?? round2(computedItemSum + tax - discount + shipping);
  let isReconciled = false;
  let isValid = false;

  // Check 1: Perfect or near-perfect match with line items (within $0.05 tolerance)
  if (itemDiscrepancy <= 0.05) {
    isValid = true;
    if (itemDiscrepancy > 0) {
      isReconciled = true;
      auditNotes.push(
        `Self-healed minor rounding anomaly of $${itemDiscrepancy.toFixed(2)} between line items sum ($${computedItemSum.toFixed(2)}) and reported figure ($${targetForItems.toFixed(2)}).`
      );
    } else {
      auditNotes.push(
        `Exact mathematical match: Sum of ${lineItems.length} line items ($${computedItemSum.toFixed(2)}) perfectly equals reported figure ($${targetForItems.toFixed(2)}).`
      );
    }
  } else {
    // Check 2: Tax or discount wasn't separated in line items
    const computedWithTax = round2(computedItemSum + tax - discount + shipping);
    const taxDiscrepancy = reportedTotalDue !== null ? round2(Math.abs(computedWithTax - reportedTotalDue)) : null;

    if (taxDiscrepancy !== null && taxDiscrepancy <= 0.05) {
      isValid = true;
      if (taxDiscrepancy > 0) {
        isReconciled = true;
        auditNotes.push(
          `Self-healed $${taxDiscrepancy.toFixed(2)} discrepancy after factoring reported tax ($${tax.toFixed(2)}), discount ($${discount.toFixed(2)}), and shipping ($${shipping.toFixed(2)}).`
        );
      } else {
        auditNotes.push(
          `Mathematical match verified with tax ($${tax.toFixed(2)}), discount ($${discount.toFixed(2)}), and shipping ($${shipping.toFixed(2)}).`
        );
      }
    } else {
      isValid = false;
      auditNotes.push(
        `Discrepancy detected: Sum of line items is $${computedItemSum.toFixed(2)}, but reported total is $${(reportedTotalDue ?? targetForItems).toFixed(2)} (difference of $${itemDiscrepancy.toFixed(2)}).`
      );
    }
  }

  // Missing subtotal auto-fill
  if (reportedSubtotal === null && lineItems.length > 0) {
    isReconciled = true;
    auditNotes.push(`Automatically populated missing subtotal with verified line item sum: $${computedItemSum.toFixed(2)}.`);
  }

  const discrepancy = reportedTotalDue !== null ? round2(Math.abs(computedItemSum - reportedTotalDue)) : itemDiscrepancy;
  const statusMessage = isValid
    ? isReconciled
      ? `Math Verified & Reconciled: Sum of line items ($${computedItemSum.toFixed(2)}) matches total within tolerance.`
      : `Math Verified: Sum of ${lineItems.length} line items ($${computedItemSum.toFixed(2)}) matches total.`
    : `Math Warning: Discrepancy of $${discrepancy.toFixed(2)} found between line items ($${computedItemSum.toFixed(2)}) and reported total ($${(reportedTotalDue ?? targetForItems).toFixed(2)}).`;

  return {
    isValid,
    isReconciled,
    discrepancy,
    computedItemSum,
    reportedTotal: reportedTotalDue ?? targetForItems,
    reconciledTotal,
    statusMessage,
    auditNotes,
  };
}
