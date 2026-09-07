/**
 * retry.ts — Exponential backoff retry helper for API calls
 *
 * Automatically retries transient errors (503 High Demand, 429 Rate Limit, network disconnects)
 * with exponential backoff and jitter.
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1500
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isTransient =
      error?.status === 503 ||
      error?.status === 429 ||
      error?.code === 503 ||
      error?.code === 429 ||
      error?.message?.includes("high demand") ||
      error?.message?.includes("UNAVAILABLE") ||
      error?.message?.includes("fetch failed") ||
      error?.message?.includes("RESOURCE_EXHAUSTED");

    if (!isTransient || retries <= 0) {
      throw error;
    }

    // Add jitter to avoid thundering herd
    const jitter = Math.random() * 500;
    const waitTime = delayMs + jitter;

    console.warn(
      `[Pipeline Retry] Transient API error (${error?.status || error?.code || "network"}). Retrying in ${Math.round(waitTime)}ms... (${retries} retries left)`
    );

    await new Promise((resolve) => setTimeout(resolve, waitTime));
    return withRetry(fn, retries - 1, delayMs * 2);
  }
}
