// Kompon — Hazard route (§6.5)
// GET /v1/hazard/static?lat=&lon=
// GET /v1/hazard/heatmap?cell_deg=&limit_per_layer=&include_scenarios=

import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { validateRequest, hazardSchema } from '../middleware/validate.js';
import { getHazardHeatmapLayers, getNearestHazardPoint } from '../services/duckdbClient.js';

const router = Router();

function parseBoolean(value, fallback = true) {
  if (value === undefined) return fallback;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
}

function parseBoundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// GET /v1/hazard/static?lat=23.81&lon=90.41
router.get(
  '/static',
  rateLimit('hazard'),
  validateRequest(hazardSchema, 'query'),
  async (req, res) => {
    try {
      const { lat, lon } = req.query;

      const nearest = await getNearestHazardPoint(parseFloat(lat), parseFloat(lon));

      if (!nearest) {
        return res.status(404).json({
          error:
            'No hazard data available for this location. The coverage area may not include this point.',
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
          'Ground hazard data is a screening-level estimate derived from a national 250m grid. It is not a site-specific geotechnical assessment. Consult a qualified engineer for construction or safety decisions.',
      });
    } catch (err) {
      console.error('[Hazard] Static lookup error:', err.message);

      const isUnavailable = /DuckDB not initialized|not available|Missing data file/i.test(err.message);
      return res.status(isUnavailable ? 503 : 500).json({
        error: isUnavailable
          ? 'Hazard database is temporarily unavailable.'
          : 'Failed to retrieve hazard data.',
      });
    }
  }
);

// GET /v1/hazard/heatmap?cell_deg=0.035&limit_per_layer=1200&include_scenarios=false
router.get('/heatmap', rateLimit('hazard'), async (req, res) => {
  try {
    const cellDeg = parseBoundedNumber(req.query.cell_deg, 0.035, 0.015, 0.12);
    const limitPerLayer = Math.round(
      parseBoundedNumber(req.query.limit_per_layer, 1200, 200, 2500)
    );
    const includeScenarios = parseBoolean(req.query.include_scenarios, false);

    const heatmap = await getHazardHeatmapLayers({
      cellDeg,
      limitPerLayer,
      includeScenarios,
    });

    return res.status(200).json({
      ...heatmap,
      disclaimer:
        'Heatmap values are downsampled screening-level grid estimates for visualization only. They are not site-specific safety or geotechnical assessments.',
    });
  } catch (err) {
    console.error('[Hazard] Heatmap error:', err.message);

    const isUnavailable = /DuckDB not initialized|not available|Missing heatmap data file/i.test(
      err.message
    );

    return res.status(isUnavailable ? 503 : 500).json({
      status: 'error',
      error: isUnavailable
        ? 'Hazard heatmap data is temporarily unavailable.'
        : 'Failed to retrieve hazard heatmap data.',
      layers: [],
    });
  }
});

export default router;
