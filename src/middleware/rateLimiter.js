import { warn } from "../utils/logger.js";

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based rate limiting
 */

const requestCounts = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

/**
 * Clean up old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.resetTime > WINDOW_MS) {
      requestCounts.delete(key);
    }
  }
}, WINDOW_MS);

/**
 * Rate limiter middleware
 * @param {number} maxRequests - Maximum requests allowed in window
 * @param {number} windowMs - Time window in milliseconds
 */
export function rateLimiter(maxRequests = MAX_REQUESTS, windowMs = WINDOW_MS) {
  return (req, res, next) => {
    // Use IP address or user ID as identifier
    const identifier = req.telegram?.id?.toString() || req.ip || "unknown";
    const now = Date.now();

    let requestData = requestCounts.get(identifier);

    if (!requestData || now - requestData.resetTime > windowMs) {
      // New window
      requestData = {
        count: 1,
        resetTime: now
      };
      requestCounts.set(identifier, requestData);
      return next();
    }

    if (requestData.count >= maxRequests) {
      warn("⚠️ Rate limit exceeded", {
        identifier,
        count: requestData.count,
        path: req.path
      });

      return res.status(429).json({
        ok: false,
        error: "rate_limit_exceeded",
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((windowMs - (now - requestData.resetTime)) / 1000)
      });
    }

    requestData.count++;
    next();
  };
}

/**
 * Strict rate limiter for sensitive endpoints (like key activation)
 */
export function strictRateLimiter() {
  return rateLimiter(10, 60 * 1000); // 10 requests per minute
}
