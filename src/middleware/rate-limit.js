const buckets = new Map();

export function rateLimiter({ windowMs = 60_000, limit = 60 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.headers["x-forwarded-for"] || "anonymous";
    const entry = buckets.get(key) || { count: 0, start: now };

    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }

    entry.count += 1;
    buckets.set(key, entry);

    if (entry.count > limit) {
      return res.status(429).json({ success: false, message: "rate_limited" });
    }

    next();
  };
}
