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
import { getNearestHazardPoint, getNearestScenarioPoint } from "../services/duckdbClient.js";
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
const ACCEPTED_GATE_DECISIONS = new Set(["accept", "accepted", "building", "building_surface"]);
const BUILDING_GATE_CLASSES = new Set(["building", "building_surface", "wall", "column", "beam"]);
const NON_BUILDING_GATE_CLASSES = new Set([
  "road_or_pavement",
  "road",
  "pavement",
  "other",
  "person",
  "human",
  "face",
  "portrait",
  "vehicle",
  "animal",
  "landscape",
]);
const CRACK_SEVERITY_RANK = {
  "Very Low": 0,
  Low: 1,
  Moderate: 2,
  High: 3,
  "Very High": 4,
};
const ACTIONABLE_CRACK_CONFIDENCE = 0.18;
const STRUCTURAL_RESCUE_CONFIDENCE = 0.55;
const STRUCTURAL_RESCUE_COVERAGE_PCT = 1.0;
const GATE_UNCERTAINTY_THRESHOLD = 0.55;

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeTier(value) {
  const token = normalizeToken(value);
  if (token === "very_low") return "Very Low";
  if (token === "low") return "Low";
  if (token === "moderate") return "Moderate";
  if (token === "high") return "High";
  if (token === "very_high") return "Very High";
  return null;
}

function readConfidence(detection) {
  return Number(detection.confidence ?? detection.conf ?? detection.score ?? 0);
}

function readCoveragePct(detection) {
  const raw = Number(detection.coverage_pct ?? detection.coverage ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw <= 1 ? raw * 100 : raw;
}

function summarizeCrackEvidence(crackAnalysis) {
  if (!crackAnalysis || typeof crackAnalysis !== "object") {
    return {
      detectionCount: 0,
      maxConfidence: 0,
      maxCoverage: 0,
      severityRank: -1,
      actionable: false,
      strong: false,
    };
  }

  const severityTier = normalizeTier(crackAnalysis.severity_tier ?? crackAnalysis.concern);
  const severityRank = CRACK_SEVERITY_RANK[severityTier] ?? -1;
  const detections = Array.isArray(crackAnalysis.detections)
    ? crackAnalysis.detections
    : [];

  const crackLikeDetections = detections.filter((detection) => {
    const label = normalizeToken(detection.class ?? detection.label ?? detection.name);
    return (
      !label ||
      /crack|damage|spall|exposed|rebar|structural|fracture|wall|column|beam|concrete|masonry/.test(label)
    );
  });

  const maxConfidence = crackLikeDetections.reduce((max, detection) => Math.max(max, readConfidence(detection)), 0);
  const maxCoverage = crackLikeDetections.reduce((max, detection) => Math.max(max, readCoveragePct(detection)), 0);
  const detectionCount = crackLikeDetections.length;
  const structuralDetections = crackLikeDetections.filter((detection) => {
    const label = normalizeToken(detection.class ?? detection.label ?? detection.name);
    return /structural_crack|spalling|rebar_corrosion|severe_distress|exposed|rebar|crushing/.test(label);
  });
  const structuralRescue = structuralDetections.some((detection) => (
    readConfidence(detection) >= STRUCTURAL_RESCUE_CONFIDENCE ||
    readCoveragePct(detection) >= STRUCTURAL_RESCUE_COVERAGE_PCT
  ));

  const actionable =
    severityRank >= CRACK_SEVERITY_RANK.Low ||
    (detectionCount > 0 && (maxConfidence >= ACTIONABLE_CRACK_CONFIDENCE || maxCoverage > 0));

  const strong =
    severityRank >= CRACK_SEVERITY_RANK.High ||
    structuralRescue;

  return {
    detectionCount,
    structuralDetectionCount: structuralDetections.length,
    maxConfidence,
    maxCoverage,
    severityTier,
    severityRank,
    actionable,
    strong,
    structuralRescue,
  };
}

function isBuildingGateAccepted(gate) {
  if (!gate || typeof gate !== "object") return false;

  const gateClass = normalizeToken(gate.class ?? gate.label ?? gate.name);
  const acceptedBy = normalizeToken(gate.accepted_by ?? gate.acceptedBy);

  if (BUILDING_GATE_CLASSES.has(gateClass)) return true;
  return acceptedBy === "building_surface";
}

function isUncertainGatePass(gate) {
  if (!gate || typeof gate !== "object") return false;

  const decision = normalizeToken(gate.decision ?? gate.action);
  const acceptedBy = normalizeToken(gate.accepted_by ?? gate.acceptedBy);
  const gateClass = normalizeToken(gate.class ?? gate.label ?? gate.name);
  const confidence = Number(gate.confidence ?? gate.conf ?? gate.score ?? 1);

  if (!ACCEPTED_GATE_DECISIONS.has(decision)) return false;
  if (BUILDING_GATE_CLASSES.has(gateClass)) return false;
  if (gateClass === "road_or_pavement" || gateClass === "road" || gateClass === "pavement") return false;

  return acceptedBy === "uncertainty" || confidence < GATE_UNCERTAINTY_THRESHOLD;
}

function buildImageRejection({ gate, crackEvidence }) {
  const gateClass = normalizeToken(gate?.class ?? gate?.label ?? gate?.name);
  const gateConfidence = Number(gate?.confidence ?? gate?.conf ?? gate?.score ?? 0);

  if (isBuildingGateAccepted(gate) && !crackEvidence.actionable) {
    return {
      code: "no_crack_evidence",
      message:
        "The image appears to show a building surface, but no visible crack or damage evidence was detected. Please capture the crack closer, sharper, and with the damaged area clearly in frame.",
    };
  }

  if (gateClass === "road_or_pavement" || gateClass === "road" || gateClass === "pavement") {
    return {
      code: "road_or_pavement",
      message:
        "The uploaded image appears to be a road or pavement surface, not a building crack. Please capture a wall, column, beam joint, or other building element with visible cracking.",
    };
  }

  if (gateClass === "other" && gateConfidence >= 0.45) {
    return {
      code: "not_building_surface",
      message:
        "The uploaded image does not look like a building surface with visible cracking. Please capture a clear building wall, column, beam joint, or structural element.",
    };
  }

  return {
    code: "unclear_building_crack",
    message:
      "Kompon could not verify that this is a building crack image. Please retake the photo so the building surface and crack are clearly visible.",
  };
}

function finiteOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requiredFinite(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Scenario point is missing required field "${fieldName}".`);
  }
  return parsed;
}

function textOr(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

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
      const gateAccepted = isBuildingGateAccepted(gate);
      const gateUncertain = isUncertainGatePass(gate);
      const crackEvidence = summarizeCrackEvidence(crackAnalysis);
      const canProceedFromGate = gateAccepted || (gateUncertain && crackEvidence.strong);

      // The pipeline proceeds only for a building surface with visible
      // crack/damage evidence. If the gate misses a real building crack, strong
      // Model A evidence can rescue it; otherwise no risk score is produced.
      if (!canProceedFromGate || !crackEvidence.actionable) {
        const rejection = buildImageRejection({ gate, crackEvidence });
        return res.status(200).json({
          gate,
          crack_analysis: crackAnalysis,
          rejected: true,
          rejection_code: rejection.code,
          rejection_reason: rejection.message,
          disclaimer:
            "Screening result only — not a safety certificate. Refer High/Very High findings to a licensed engineer.",
        });
      }

      const gateOverridden =
        gate &&
        !gateAccepted &&
        gateUncertain &&
        crackEvidence.strong;

      // ── Step 2: Compute structural vulnerability from questionnaire ──
      const structuralScore = computeStructuralVulnerability(questionnaire);

      // ── Step 3: Derive crack evidence score ──
      const crackScore = deriveCrackEvidence(crackAnalysis);

      // ── Step 4: Site hazard lookup (if location provided) ──
      let siteHazardScore = null;
      let hazardPointData = null;
      if (hasLocation) {
        try {
          const nearest = await getNearestHazardPoint(lat, lon);

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
          const scenarioPoint = await getNearestScenarioPoint(scenarioEventId, lat, lon);

          if (scenarioPoint) {
            // Call HF Space for Model 3 scenario score
            const features = {
              vs30: finiteOr(scenarioPoint.vs30 ?? hazardPointData?.vs30, 250),
              elevation_m: finiteOr(scenarioPoint.elevation_m, 10),
              slope_deg: finiteOr(scenarioPoint.slope_deg, 0.5),
              dist_water_m: finiteOr(scenarioPoint.dist_water_m, 1000),
              water_occurrence_pct: finiteOr(scenarioPoint.water_occurrence_pct, 0),
              geology_class: textOr(scenarioPoint.geology_class, "Unknown"),
              hand_m: finiteOr(scenarioPoint.hand_m, 10),
              water_max_extent: finiteOr(scenarioPoint.water_max_extent, 0),
              dynamic_label_name: textOr(scenarioPoint.dynamic_label_name, "Unknown"),
              magnitude: requiredFinite(scenarioPoint.magnitude, "magnitude"),
              depth_km: requiredFinite(scenarioPoint.depth_km, "depth_km"),
              dist_epicenter_km: requiredFinite(scenarioPoint.dist_epicenter_km, "dist_epicenter_km"),
              pga_g_filled: requiredFinite(scenarioPoint.pga_g_filled, "pga_g_filled"),
              pgv_cms_filled: requiredFinite(scenarioPoint.pgv_cms_filled, "pgv_cms_filled"),
              mmi_filled: requiredFinite(scenarioPoint.mmi_filled, "mmi_filled"),
              ground_susceptibility_score:
                scenarioPoint.ground_susceptibility_score ??
                siteHazardScore ??
                50,
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
        image_gate_overridden: Boolean(gateOverridden),
        crack_evidence_summary: crackEvidence,
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
