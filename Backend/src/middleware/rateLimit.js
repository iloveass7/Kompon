// Kompon — Rate limiting middleware (§7)
// Uses @upstash/ratelimit (sliding window) backed by Upstash Redis.
// Per-endpoint limits per IP — the only access control on a no-auth API.

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../services/redisClient.js";

/**
 * Create a rate limiter with a sliding window.
 * @param {string} prefix — key prefix for this endpoint group
 * @param {number} maxRequests — max requests in the window
 * @param {string} window — window duration, e.g. "1m", "60s"
 * @returns {Ratelimit}
 */
function createLimiter(prefix, maxRequests, window) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    prefix: `kompon:ratelimit:${prefix}`,
    analytics: false, // no extra Redis writes for analytics
  });
}

// Per-endpoint limiters (§7 limits)
const limiters = {
  riskAssessment: createLimiter("risk", 5, "1m"),
  news: createLimiter("news", 30, "1m"),
  safePlaces: createLimiter("safe", 20, "1m"),
  fireBrigade: createLimiter("fire", 30, "1m"),
  hazard: createLimiter("hazard", 30, "1m"),
  general: createLimiter("general", 60, "1m"),
};

/**
 * Express middleware factory for rate limiting.
 * @param {string} limiterName — key from the `limiters` object
 * @returns {Function} Express middleware
 */
export function rateLimit(limiterName = "general") {
  const limiter = limiters[limiterName] || limiters.general;

  return async (req, res, next) => {
    // Use the client IP as the identifier
    const identifier =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";

    try {
      const { success, limit, remaining, reset } = await limiter.limit(identifier);

      // Set rate limit headers regardless of outcome
      res.set("X-RateLimit-Limit", String(limit));
      res.set("X-RateLimit-Remaining", String(remaining));
      res.set("X-RateLimit-Reset", String(reset));

      if (!success) {
        return res.status(429).json({
          error: "Too many requests. Please try again later.",
          retry_after_ms: reset - Date.now(),
        });
      }

      next();
    } catch (err) {
      // If Redis is down, fail open — don't block legitimate requests
      console.error("[RateLimit] Error:", err.message);
      next();
    }
  };
}

export default rateLimit;
