// Kompon — Safe Places route (§6.3)
// GET /v1/safe-places?lat=&lon=&radius_m=
// Nearest parks, open fields, recreation grounds via Overpass/OSM.

import { Router } from "express";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateRequest, safePlacesSchema } from "../middleware/validate.js";
import { findSafePlaces } from "../services/overpassClient.js";

const router = Router();

// GET /v1/safe-places?lat=23.81&lon=90.41&radius_m=1000
router.get(
  "/",
  rateLimit("safePlaces"),
  validateRequest(safePlacesSchema, "query"),
  async (req, res) => {
    try {
      const { lat, lon, radius_m, bypassCache } = req.query;
      const places = await findSafePlaces(lat, lon, radius_m, bypassCache === true || bypassCache === "true");

      return res.status(200).json({
        places,
        count: places.length,
        search: { lat, lon, radius_m },
        disclaimer:
          "Safe places are derived from OpenStreetMap data and may not be complete or current. Always verify locations independently during an emergency.",
      });
    } catch (err) {
      console.error("[SafePlaces] Error:", err.message);
      return res.status(500).json({
        error: "Failed to find nearby safe places.",
        places: [],
      });
    }
  }
);

export default router;
