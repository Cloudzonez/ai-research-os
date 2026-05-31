export const DEFAULT_RETRY_CONFIG = {
  retries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true,
  timeoutMs: 15000,
  retryOn: [429, 502, 503, 504],
};

export async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  const maxAttempts = config.retries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt >= maxAttempts - 1;
      const shouldRetry = config.retryOn.includes(err.status);

      if (isLast || !shouldRetry) throw err;

      const delay = calcDelay(attempt, config, err);
      if (config.onRetry) {
        config.onRetry(err, attempt + 1, delay);
      }
      await sleep(delay);
    }
  }
}

function calcDelay(attempt, config, err) {
  let delay = Math.min(
    config.maxDelayMs,
    config.baseDelayMs * Math.pow(2, attempt)
  );

  if (config.jitter) {
    delay = Math.random() * delay;
  }

  if (err?.headers) {
    const retryAfter = err.headers.get("retry-after");
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        delay = Math.max(delay, seconds * 1000);
      }
    }
  }

  return Math.max(100, delay);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { withRetry, DEFAULT_RETRY_CONFIG };
