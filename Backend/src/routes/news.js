// Kompon — News route (§6.2)
// GET /v1/news/earthquakes — serves from Redis cache only.
// The cache is refreshed by a cron job, never on user request.

import { Router } from "express";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateRequest, newsSchema } from "../middleware/validate.js";
import { getCachedNews } from "../services/newsClient.js";

const router = Router();

// GET /v1/news/earthquakes?page=1&country=Bangladesh
router.get(
  "/earthquakes",
  rateLimit("news"),
  validateRequest(newsSchema, "query"),
  async (req, res) => {
    try {
      const { page, country } = req.query;
      const result = await getCachedNews(page, country);

      return res.status(200).json({
        ...result,
        disclaimer:
          "News articles are aggregated from third-party sources and may not reflect the latest information. Verify critical details with official sources.",
      });
    } catch (err) {
      console.error("[News] Error:", err.message);
      return res.status(500).json({
        error: "Failed to retrieve news articles.",
        articles: [],
      });
    }
  }
);

export default router;
