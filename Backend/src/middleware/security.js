// Kompon — Security middleware (§7)
// helmet() for security headers + CORS locked to ALLOWED_ORIGIN.

import helmet from "helmet";
import cors from "cors";

/**
 * Configure helmet with sane defaults + HSTS.
 * Covers X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.
 */
export const helmetMiddleware = helmet({
  // HSTS — Render provides TLS automatically
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // Content-Type sniffing prevention
  contentTypeOptions: true, // X-Content-Type-Options: nosniff
  // Prevent clickjacking
  frameguard: { action: "deny" },
  // Referrer policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

/**
 * Configure CORS — locked to ALLOWED_ORIGIN, never wildcard.
 */
export function createCorsMiddleware() {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5173";

  // Support multiple origins if comma-separated
  const origins = allowedOrigin.split(",").map((o) => o.trim()).filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      // Only in development — in production, reject them.
      if (!origin && process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      if (origins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`CORS: Origin "${origin}" not allowed.`));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Accept"],
    maxAge: 86400, // 24h preflight cache
  });
}

export default { helmetMiddleware, createCorsMiddleware };
