import { config } from "../config.js";

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export function isRetryable(status) {
  return RETRYABLE_STATUSES.has(status);
}

export function getRetryDelay(status, attempt, retryAfterHeader) {
  if (status === 429 && retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  if (status === 429) {
    return Math.min(60000, 1000 * Math.pow(2, attempt));
  }
  if (status && status >= 500) {
    return Math.min(30000, 1000 * Math.pow(2, attempt));
  }
  return 1000 * attempt;
}

export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    context = "operation",
    verbose = config.devVerboseLogging,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const status = error?.status || error?.response?.status;
      if (attempt >= maxRetries || (status && !isRetryable(status))) {
        throw error;
      }

      const retryAfter = error?.response?.headers?.["retry-after"];
      const baseDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt));
      const jitteredDelay = Math.floor(Math.random() * baseDelay);
      const delay = retryAfter ? getRetryDelay(status, attempt, retryAfter) : jitteredDelay;

      if (verbose) {
        console.warn(`[Retry] ${context} attempt ${attempt + 1}/${maxRetries} failed (${error.message || status}), retrying in ${delay}ms...`);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function createFetchWithRetry(options = {}) {
  const {
    maxRetries = 3,
    timeoutMs = 15000,
    context = "fetch",
  } = options;

  return async function fetchWithRetry(url, init = {}) {
    return retryWithBackoff(
      async () => {
        const signal = AbortSignal.timeout(timeoutMs);
        const res = await fetch(url, { ...init, signal });

        if (res.status === 429 || res.status >= 500) {
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          err.response = res;
          err.retryable = isRetryable(res.status);
          throw err;
        }

        return res;
      },
      { maxRetries, context, initialDelayMs: 3000 }
    );
  };
}

export default { retryWithBackoff, isRetryable, getRetryDelay, createFetchWithRetry };
