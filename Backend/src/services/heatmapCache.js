import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(BACKEND_ROOT, "..");

export const HEATMAP_CACHE_DIR = path.join(BACKEND_ROOT, "data");
export const HEATMAP_CACHE_FILE = path.join(HEATMAP_CACHE_DIR, "hazard_heatmap_static.json");

const DEFAULT_STATIC_CSV = path.join(REPO_ROOT, "static_ground_susceptibility.csv");

const BD_BOUNDS = {
  minLat: 20.35,
  maxLat: 26.75,
  minLon: 88.0,
  maxLon: 92.95,
};

let memoryCache = null;
let buildPromise = null;

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getStaticCsvPath() {
  return process.env.HAZARD_STATIC_CSV || DEFAULT_STATIC_CSV;
}

function readGroundScore(row) {
  const preferredScore = Number(row.ground_susceptibility_score_v2);
  if (Number.isFinite(preferredScore)) return preferredScore;

  return Number(row.ground_susceptibility_score);
}

function normalizeCachePayload(payload, cellDeg, limit) {
  if (!payload?.layers?.length) return null;

  const staticLayer = payload.layers.find((layer) => layer.id === "static");
  if (!staticLayer?.points?.length) return null;

  const cachedCellDeg = Number(payload.cell_deg);
  if (Number.isFinite(cachedCellDeg) && Math.abs(cachedCellDeg - cellDeg) > 0.000001) {
    return null;
  }

  return {
    ...staticLayer,
    points: sampleSpatialPoints(staticLayer.points, limit),
  };
}

function quantile(sortedValues, q) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedValues.length) return sortedValues[lower];
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function normalizeDisplayScore(value, low, high) {
  if (!Number.isFinite(value) || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return 50;
  }

  return clampNumber(((value - low) / (high - low)) * 100, 50, 0, 100);
}

function sampleSpatialPoints(points, limit) {
  if (points.length <= limit) return points;

  const ordered = [...points].sort((a, b) => {
    if (a.lat !== b.lat) return a.lat - b.lat;
    return a.lon - b.lon;
  });
  const step = ordered.length / limit;
  const sampled = [];

  for (let index = 0; index < limit; index += 1) {
    sampled.push(ordered[Math.floor(index * step)]);
  }

  return sampled;
}

export function getStaticHeatmapCacheStatus() {
  const sourceCsv = getStaticCsvPath();

  return {
    cache_file: HEATMAP_CACHE_FILE,
    cache_exists: fs.existsSync(HEATMAP_CACHE_FILE),
    source_csv: sourceCsv,
    source_csv_exists: fs.existsSync(sourceCsv),
    building: Boolean(buildPromise),
  };
}

export async function getStaticHeatmapLayerFromCache({ cellDeg, limit }) {
  const normalizedCellDeg = clampNumber(cellDeg, 0.035, 0.015, 0.12);
  const normalizedLimit = Math.round(clampNumber(limit, 1200, 200, 5000));

  if (memoryCache) {
    const layer = normalizeCachePayload(memoryCache, normalizedCellDeg, normalizedLimit);
    if (layer) return layer;
  }

  if (!fs.existsSync(HEATMAP_CACHE_FILE)) return null;

  const payload = JSON.parse(await fs.promises.readFile(HEATMAP_CACHE_FILE, "utf8"));
  memoryCache = payload;
  return normalizeCachePayload(payload, normalizedCellDeg, normalizedLimit);
}

export function warmStaticHeatmapCache(options = {}) {
  if (buildPromise) return buildPromise;
  if (fs.existsSync(HEATMAP_CACHE_FILE)) return null;

  const sourceCsv = getStaticCsvPath();
  if (!fs.existsSync(sourceCsv)) return null;

  buildPromise = buildStaticHeatmapCache(options)
    .catch((err) => {
      console.error("[HeatmapCache] Failed to build static heatmap cache:", err.message);
      throw err;
    })
    .finally(() => {
      buildPromise = null;
    });

  return buildPromise;
}

export async function buildStaticHeatmapCache(options = {}) {
  const cellDeg = clampNumber(options.cellDeg, 0.035, 0.015, 0.12);
  const sourceCsv = getStaticCsvPath();

  if (!fs.existsSync(sourceCsv)) {
    throw new Error(`Static hazard CSV not found: ${sourceCsv}`);
  }

  await fs.promises.mkdir(HEATMAP_CACHE_DIR, { recursive: true });

  const bins = new Map();

  await new Promise((resolve, reject) => {
    fs.createReadStream(sourceCsv)
      .pipe(
        parse({
          columns: true,
          bom: true,
          relax_quotes: true,
          skip_empty_lines: true,
        })
      )
      .on("data", (row) => {
        const lat = Number(row.lat);
        const lon = Number(row.lon);
        const score = readGroundScore(row);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lon) ||
          !Number.isFinite(score) ||
          lat < BD_BOUNDS.minLat ||
          lat > BD_BOUNDS.maxLat ||
          lon < BD_BOUNDS.minLon ||
          lon > BD_BOUNDS.maxLon
        ) {
          return;
        }

        const key = `${Math.floor(lat / cellDeg)}:${Math.floor(lon / cellDeg)}`;
        const bin = bins.get(key) || { latSum: 0, lonSum: 0, scoreSum: 0, samples: 0 };
        bin.latSum += lat;
        bin.lonSum += lon;
        bin.scoreSum += score;
        bin.samples += 1;
        bins.set(key, bin);
      })
      .on("error", reject)
      .on("end", resolve);
  });

  const rawPoints = Array.from(bins.values())
    .map((bin) => {
      const value = bin.scoreSum / bin.samples;

      return {
        lat: Number((bin.latSum / bin.samples).toFixed(6)),
        lon: Number((bin.lonSum / bin.samples).toFixed(6)),
        value: Number(value.toFixed(3)),
        samples: bin.samples,
      };
    })
    .sort((a, b) => {
      if (a.lat !== b.lat) return a.lat - b.lat;
      return a.lon - b.lon;
    });

  const sortedValues = rawPoints.map((point) => point.value).sort((a, b) => a - b);
  const displayLow = quantile(sortedValues, 0.05);
  const displayHigh = quantile(sortedValues, 0.95);
  const points = rawPoints.map((point) => ({
    ...point,
    score: Number(normalizeDisplayScore(point.value, displayLow, displayHigh).toFixed(3)),
  }));

  const payload = {
    status: points.length > 0 ? "ok" : "empty",
    source: "static_csv_cache",
    generated_at: new Date().toISOString(),
    bounds: BD_BOUNDS,
    cell_deg: cellDeg,
    point_count: points.length,
    layers: [
      {
        id: "static",
        label: "Ground susceptibility",
        metric: "Corrected ground susceptibility score",
        display_scale: {
          type: "percentile_normalized",
          low_percentile: 5,
          high_percentile: 95,
          raw_low: Number(displayLow.toFixed(3)),
          raw_high: Number(displayHigh.toFixed(3)),
        },
        points,
      },
    ],
  };

  await fs.promises.writeFile(HEATMAP_CACHE_FILE, JSON.stringify(payload), "utf8");
  memoryCache = payload;
  console.log(`[HeatmapCache] Wrote ${points.length} static heatmap cells to ${HEATMAP_CACHE_FILE}`);

  return payload;
}
