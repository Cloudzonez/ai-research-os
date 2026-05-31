const buckets = new Map();
const CLEANUP_INTERVAL = 60000;

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL).unref();

export function rateLimiter(options = {}) {
  const {
    windowMs = 60000,
    max = 30,
    keyFn = (req) => req.ip || req.connection?.remoteAddress || "unknown",
    message = "Too many requests, please try again later",
  } = options;

  return function rateLimitMiddleware(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - bucket.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}
