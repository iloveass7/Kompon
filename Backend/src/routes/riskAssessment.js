// Kompon — Risk Assessment route (§6.1)
// POST /v1/risk-assessment — the core feature.
// Combines image analysis (HF Space), questionnaire scoring, geospatial
// hazard lookup, and optional scenario scoring into a single risk tier.

import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";

import { rateLimit } from "../middleware/rateLimit.js";
import { inferImageRisk, inferScenarioScore } from "../services/mlClient.js";
import {
  computeStructuralVulnerability,
  deriveCrackEvidence,
  combineScores,
  generateChecklist,
} from "../services/scoringEngine.js";
import HazardPoint from "../models/HazardPoint.js";
import ScenarioPoint from "../models/ScenarioPoint.js";
import { VALID_EVENT_IDS, questionnaireSchema } from "../middleware/validate.js";

const router = Router();

// ─── Multer setup: memory storage, 8MB limit, single file ───
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB
    files: 1,
  },
});

// ─── Allowed MIME types (verified by magic bytes, not Content-Type header) ───
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// ─── Max image dimension for downscaling before forwarding to HF Space ───
const MAX_IMAGE_DIM = 1600;

/**
 * Validate, sanitize, and downscale an uploaded image buffer.
 * - Verify actual file type via magic bytes (file-type)
 * - Re-encode through sharp (validates it's a real image, strips EXIF)
 * - Downscale to MAX_IMAGE_DIM if larger
 * - Never writes to disk
 *
 * @param {Buffer} buffer — raw upload buffer
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 * @throws {Error} on invalid file type
 */
async function processImage(buffer) {
  // 1. Verify magic bytes — don't trust Content-Type header
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !ALLOWED_MIME_TYPES.has(type.mime)) {
    const detected = type ? type.mime : "unknown";
    throw new Error(
      `Invalid image type: "${detected}". Accepted: JPEG, PNG, WebP.`
    );
  }

  // 2. Re-encode through sharp:
  //    - .rotate() respects EXIF orientation before stripping metadata
  //    - Default sharp output strips EXIF (do NOT call .withMetadata())
  //    - Downscale if larger than MAX_IMAGE_DIM
  const processed = await sharp(buffer)
    .rotate() // auto-orient from EXIF, then strip
    .resize({
      width: MAX_IMAGE_DIM,
      height: MAX_IMAGE_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 }) // re-encode as JPEG
    .toBuffer();

  return { buffer: processed, mimeType: "image/jpeg" };
}

// ─── POST /v1/risk-assessment ───
router.post(
  "/",
  rateLimit("riskAssessment"),
  upload.single("image"),
  async (req, res) => {
    try {
      // ── Step 0: Validate inputs ──
      if (!req.file) {
        return res.status(400).json({ error: "Image file is required." });
      }

      // Parse optional fields
      const lat = req.body.lat !== undefined ? parseFloat(req.body.lat) : null;
      const lon = req.body.lon !== undefined ? parseFloat(req.body.lon) : null;
      const scenarioEventId = req.body.scenario_event_id || null;

      // Validate lat/lon if provided
      if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
        return res.status(400).json({ error: "Latitude must be between -90 and 90." });
      }
      if (lon !== null && (isNaN(lon) || lon < -180 || lon > 180)) {
        return res.status(400).json({ error: "Longitude must be between -180 and 180." });
      }
      const hasLocation = lat !== null && lon !== null;

      // Validate scenario_event_id if provided
      if (scenarioEventId && !VALID_EVENT_IDS.includes(scenarioEventId)) {
        return res.status(400).json({
          error: `Invalid scenario_event_id. Valid IDs: ${VALID_EVENT_IDS.join(", ")}`,
        });
      }

      // Parse questionnaire JSON
      let questionnaire = {};
      if (req.body.questionnaire) {
        try {
          const raw = JSON.parse(req.body.questionnaire);
          const parsed = questionnaireSchema.safeParse(raw);
          if (!parsed.success) {
            return res.status(400).json({
              error: "Invalid questionnaire data.",
              details: parsed.error.issues.map((i) => ({
                field: i.path.join("."),
                message: i.message,
              })),
            });
          }
          questionnaire = parsed.data;
        } catch {
          return res.status(400).json({ error: "questionnaire must be valid JSON." });
        }
      }

      // ── Step 1: Process & validate image, then forward to HF Space ──
      let processedImage;
      try {
        processedImage = await processImage(req.file.buffer);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      let mlResult;
      try {
        mlResult = await inferImageRisk(processedImage.buffer, processedImage.mimeType);
      } catch (err) {
        console.error("[RiskAssessment] ML Space error:", err.message);
        return res.status(503).json({
          error:
            "The image analysis service is temporarily unavailable. It may be waking up from a cold start — please try again in 30–60 seconds.",
          disclaimer:
            "Screening result could not be generated. Do not interpret this as an indication of safety.",
        });
      }

      const { gate, crack_analysis: crackAnalysis } = mlResult;

      // If gate rejected the image, return early with the reason
      if (gate && gate.decision !== "accept") {
        return res.status(200).json({
          gate,
          rejected: true,
          rejection_reason:
            gate.class === "road_or_pavement"
              ? "The uploaded image appears to be a road or pavement surface, not a building. Please upload a photo of a building surface."
              : "The uploaded image does not appear to be a building surface. Please upload a clear photo of a building wall, column, or structural element.",
          disclaimer:
            "Screening result only — not a safety certificate. Refer High/Very High findings to a licensed engineer.",
        });
      }

      // ── Step 2: Compute structural vulnerability from questionnaire ──
      const structuralScore = computeStructuralVulnerability(questionnaire);

      // ── Step 3: Derive crack evidence score ──
      const crackScore = deriveCrackEvidence(crackAnalysis);

      // ── Step 4: Site hazard lookup (if location provided) ──
      let siteHazardScore = null;
      let hazardPointData = null;
      if (hasLocation) {
        try {
          const nearest = await HazardPoint.findOne({
            location: {
              $near: {
                $geometry: { type: "Point", coordinates: [lon, lat] },
                $maxDistance: 500, // meters, matches 250m grid spacing
              },
            },
          }).lean();

          if (nearest) {
            siteHazardScore = nearest.ground_susceptibility_score;
            hazardPointData = {
              ground_susceptibility_score: nearest.ground_susceptibility_score,
              ground_susceptibility_class: nearest.ground_susceptibility_class,
              vs30: nearest.vs30,
              confidence: nearest.confidence,
            };
          }
        } catch (err) {
          console.error("[RiskAssessment] Hazard lookup error:", err.message);
          // Continue without site hazard — it's optional
        }
      }

      // ── Step 5: Scenario scoring (if location + event_id provided) ──
      let scenarioScore = null;
      let scenarioData = null;
      if (hasLocation && scenarioEventId) {
        try {
          // Look up pre-computed scenario features for this location and event
          const scenarioPoint = await ScenarioPoint.findOne({
            event_id: scenarioEventId,
            location: {
              $near: {
                $geometry: { type: "Point", coordinates: [lon, lat] },
                $maxDistance: 500,
              },
            },
          }).lean();

          if (scenarioPoint) {
            // Call HF Space for Model 3 scenario score
            const features = {
              magnitude: scenarioPoint.magnitude,
              depth_km: scenarioPoint.depth_km,
              dist_epicenter_km: scenarioPoint.dist_epicenter_km,
              pga_g_filled: scenarioPoint.pga_g_filled,
              pgv_cms_filled: scenarioPoint.pgv_cms_filled,
              mmi_filled: scenarioPoint.mmi_filled,
              ground_susceptibility_score:
                scenarioPoint.ground_susceptibility_score ??
                siteHazardScore ??
                50,
              vs30: scenarioPoint.vs30 ?? hazardPointData?.vs30 ?? 250,
            };

            const scenarioResult = await inferScenarioScore(features);
            scenarioScore = scenarioResult?.score ?? null;
            scenarioData = scenarioResult;
          }
        } catch (err) {
          console.error("[RiskAssessment] Scenario scoring error:", err.message);
          // Continue without scenario — it's optional
        }
      }

      // ── Step 6: Combine scores ──
      const combined = combineScores({
        structuralScore,
        crackScore,
        siteHazardScore,
        scenarioScore,
        crackAnalysis,
        gate,
      });

      // Generate preparedness checklist based on results
      const checklist = generateChecklist(combined.final_tier, combined.breakdown);

      // ── Build final response ──
      return res.status(200).json({
        final_score: combined.final_score,
        final_tier: combined.final_tier,
        breakdown: combined.breakdown,
        escalation_applied: combined.escalation_applied,
        gate,
        crack_analysis: crackAnalysis,
        site_hazard: hazardPointData,
        scenario_shaking: scenarioData,
        preparedness_checklist: checklist,
        engineer_referral_recommended: combined.engineer_referral_recommended,
        inputs_used: {
          image: true,
          questionnaire: Object.keys(questionnaire).length > 0,
          location: hasLocation,
          scenario: scenarioScore !== null,
        },
        disclaimer:
          "Screening result only — not a safety certificate. Based on a photo, a short questionnaire, and (if provided) location data. Do not use for structural decisions without a licensed engineer.",
      });
    } catch (err) {
      console.error("[RiskAssessment] Unexpected error:", err);
      return res.status(500).json({
        error: "An unexpected error occurred during risk assessment.",
        disclaimer:
          "Screening result could not be generated. Do not interpret this as an indication of safety.",
      });
    }
  }
);

export default router;
