// Kompon — Express orchestration API (§6)
// Main server entry point. No ML libraries here — stays light so
// cold starts are fast and 512MB RAM is never a problem.

// dotenv/config runs as a side effect during import — must be FIRST
// so env vars are available when other modules (Redis, etc.) initialize.
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import compression from "compression";
import cron from "node-cron";

import { helmetMiddleware, createCorsMiddleware } from "./middleware/security.js";
import { refreshNewsCache } from "./services/newsClient.js";

// Route imports
import riskAssessmentRouter from "./routes/riskAssessment.js";
import newsRouter from "./routes/news.js";
import safePlacesRouter from "./routes/safePlaces.js";
import fireBrigadeRouter from "./routes/fireBrigade.js";
import hazardRouter from "./routes/hazard.js";
import chatRouter from "./routes/chat.js";

import { fetchServingData } from "./scripts/fetchServingData.js";
import { initDuckDB } from "./services/duckdbClient.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global middleware ───
// Order matters: security headers first, then CORS, then body parsing.

// Security headers via helmet (§7)
app.use(helmetMiddleware);

// CORS locked to ALLOWED_ORIGIN (§7) — never wildcard
app.use(createCorsMiddleware());

// Gzip compression on all JSON responses (§8)
app.use(compression());

// JSON body parsing (for non-multipart routes)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── Health check (§6.6) ───
// Trivial 200 OK — used by UptimeRobot, no model loading touched.
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "kompon-backend",
    timestamp: new Date().toISOString(),
  });
});

// ─── API routes (§6.1–6.5) ───
app.use("/v1/risk-assessment", riskAssessmentRouter);
app.use("/v1/news", newsRouter);
app.use("/v1/safe-places", safePlacesRouter);
app.use("/v1/fire-brigade", fireBrigadeRouter);
app.use("/v1/hazard", hazardRouter);
app.use("/v1/chat", chatRouter);

// ─── 404 handler ───
app.use((_req, res) => {
  res.status(404).json({
    error: "Endpoint not found.",
    hint: "Available endpoints: /v1/risk-assessment, /v1/news/earthquakes, /v1/safe-places, /v1/fire-brigade/search, /v1/hazard/static, /health",
  });
});

// ─── Global error handler ───
// Must have 4 params to be recognized as error middleware by Express.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // CORS errors from the cors middleware
  if (err.message && err.message.startsWith("CORS:")) {
    return res.status(403).json({ error: err.message });
  }

  console.error("[Server] Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error.",
    disclaimer:
      "If this occurred during a risk assessment, do not interpret the absence of a result as an indication of safety.",
  });
});

// ─── Start server ───
async function start() {
  // 1. Connect to MongoDB Atlas
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(
      "MONGODB_URI is not set. Copy .env.example to .env and configure it."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      // Mongoose 8 defaults are sane — no need for deprecated options
      serverSelectionTimeoutMS: 10000, // 10s timeout instead of 30s default
    });
    console.log("[DB] Connected to MongoDB Atlas.");
  } catch (err) {
    console.error("[DB] MongoDB connection failed:", err.message);
    console.warn("[DB] Server will start without MongoDB. Endpoints needing geospatial data (hazard, risk-assessment location) will return errors.");
    console.warn("[DB] Fix: Ensure your IP is whitelisted in MongoDB Atlas → Network Access → Add Current IP Address.");
  }

  // 1.5 Download Parquet data and init DuckDB
  try {
    await fetchServingData();
    await initDuckDB();
  } catch (err) {
    console.error("[DuckDB] Initialization failed:", err.message);
  }

  // 2. Initial news cache population
  // Don't block startup on this — run in background
  refreshNewsCache().catch((err) =>
    console.error("[News] Initial cache refresh failed:", err.message)
  );

  // 3. Schedule news cache refresh every 20 minutes (§6.2, §8)
  cron.schedule("*/20 * * * *", () => {
    refreshNewsCache().catch((err) =>
      console.error("[News] Scheduled refresh failed:", err.message)
    );
  });
  console.log("[Cron] News cache refresh scheduled every 20 minutes.");

  // 4. Start listening
  app.listen(PORT, () => {
    console.log(`[Kompon] Backend API running on port ${PORT}`);
    console.log(`[Kompon] Health check: http://localhost:${PORT}/health`);
    console.log(`[Kompon] Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

// ─── Graceful shutdown ───
async function shutdown(signal) {
  console.log(`\n[Kompon] Received ${signal}. Shutting down gracefully...`);
  try {
    await mongoose.disconnect();
    console.log("[DB] MongoDB disconnected.");
  } catch (err) {
    console.error("[DB] Error during disconnect:", err.message);
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Go!
start();

export default app;
