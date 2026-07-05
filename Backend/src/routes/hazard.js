// Kompon — Hazard route (§6.5)
// GET /v1/hazard/static?lat=&lon=
// Direct $near lookup on hazard_points for map display.

import { Router } from "express";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateRequest, hazardSchema } from "../middleware/validate.js";
import HazardPoint from "../models/HazardPoint.js";

const router = Router();

// GET /v1/hazard/static?lat=23.81&lon=90.41
router.get(
  "/static",
  rateLimit("hazard"),
  validateRequest(hazardSchema, "query"),
  async (req, res) => {
    try {
      const { lat, lon } = req.query;

      const nearest = await HazardPoint.findOne({
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [lon, lat] },
            $maxDistance: 500, // meters — matches the 250m grid spacing
          },
        },
      })
        .select("-_id -__v")
        .lean();

      if (!nearest) {
        return res.status(404).json({
          error:
            "No hazard data available for this location. The coverage area may not include this point.",
          location: { lat, lon },
        });
      }

      return res.status(200).json({
        hazard: {
          ground_susceptibility_score: nearest.ground_susceptibility_score,
          ground_susceptibility_class: nearest.ground_susceptibility_class,
          vs30: nearest.vs30,
          confidence: nearest.confidence,
          location: nearest.location,
        },
        disclaimer:
          "Ground hazard data is a screening-level estimate derived from a national 250m grid. It is not a site-specific geotechnical assessment. Consult a qualified engineer for construction or safety decisions.",
      });
    } catch (err) {
      console.error("[Hazard] Error:", err.message);
      return res.status(500).json({
        error: "Failed to retrieve hazard data.",
      });
    }
  }
);

export default router;
