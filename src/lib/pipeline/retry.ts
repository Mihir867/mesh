/**
 * retry.ts — Resilient Exponential Backoff Retry Helper for LLM Calls
 *
 * Automatically recovers from transient Google Gemini errors (503 High Demand / Model Overloaded,
 * 429 Rate Limits, 500/502/504 gateways, socket disconnects, and network timeouts)
 * with exponential backoff and full jitter to prevent thundering herds.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  optionsOrRetries: number | RetryOptions = 4,
  initialDelayMs = 2000
): Promise<T> {
  const options: RetryOptions =
    typeof optionsOrRetries === "number"
      ? { maxRetries: optionsOrRetries, initialDelayMs }
      : {
          maxRetries: 4,
          initialDelayMs: 2000,
          maxDelayMs: 12000,
          backoffFactor: 2,
          ...optionsOrRetries,
        };

  const maxRetries = options.maxRetries ?? 4;
  const baseDelay = options.initialDelayMs ?? 2000;
  const maxDelay = options.maxDelayMs ?? 12000;
  const factor = options.backoffFactor ?? 2;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      const status = error?.status || error?.statusCode || error?.code;
      const msg = String(error?.message || error || "");

      const isTransient =
        status === 503 ||
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 504 ||
        msg.includes("503") ||
        msg.includes("429") ||
        msg.includes("high demand") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("overloaded") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("fetch failed") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("socket hang up");

      if (!isTransient || attempt > maxRetries) {
        throw error;
      }

      // Parse Google RPC suggested retry delay if present in error message
      let suggestedDelayMs = 0;
      const retryInMatch = msg.match(/Please retry in\s+([0-9.]+)\s*s/i);
      if (retryInMatch) {
        suggestedDelayMs = parseFloat(retryInMatch[1]) * 1000 + 500;
      }

      // Exponential backoff with full randomized jitter
      const exponentialWait = baseDelay * Math.pow(factor, attempt - 1);
      const jitter = Math.random() * 1000;
      const calculatedWait = Math.min(exponentialWait + jitter, maxDelay);
      // Respect suggested delay but cap at maxDelay (default 12s) to prevent browser timeouts
      const waitTime = Math.min(Math.max(calculatedWait, suggestedDelayMs), maxDelay);

      console.warn(
        `[Pipeline Retry] Transient API notice (${status || "Network/429/503"}). Backing off for ${Math.round(
          waitTime
        )}ms before retry ${attempt}/${maxRetries}...`
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}

