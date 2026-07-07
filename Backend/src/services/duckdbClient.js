import path from 'path';
import fs from 'fs';
import { DATA_DIR } from '../scripts/fetchServingData.js';
import {
  getStaticHeatmapCacheStatus,
  getStaticHeatmapLayerFromCache,
  warmStaticHeatmapCache,
} from './heatmapCache.js';

let connection;
let duckdbAvailable = true;

const BD_BOUNDS = {
  minLat: 20.35,
  maxLat: 26.75,
  minLon: 88.0,
  maxLon: 92.95,
};

const SCENARIO_EVENT_IDS = Array.from({ length: 8 }, (_, index) => `event_${index + 1}`);

function sqlPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "''");
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function rowsToObjects(result, rows) {
  if (!rows || rows.length === 0) return [];

  const columns = result.columnNames();
  return rows.map((rowArray) => {
    const row = {};
    columns.forEach((col, idx) => {
      row[col] = rowArray[idx];
    });
    return row;
  });
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

function scenarioFileNameFromEventId(eventId) {
  const scenarioNumber = String(eventId).replace(/^event_/, '');
  return `scenario_${scenarioNumber}.parquet`;
}

export async function initDuckDB() {
  let DuckDBInstance;
  try {
    ({ DuckDBInstance } = await import('@duckdb/node-api'));
  } catch (err) {
    duckdbAvailable = false;
    console.warn(
      `[DuckDB] @duckdb/node-api is not installed or could not be loaded. Parquet hazard lookups are disabled. (${err.code || err.message})`
    );
    return;
  }

  const instance = await DuckDBInstance.create(':memory:');
  connection = await instance.connect();
  console.log('[DuckDB] In-memory database initialized.');
}

export async function getNearestHazardPoint(lat, lon) {
  if (!duckdbAvailable) return null;
  if (!connection) throw new Error('DuckDB not initialized');

  const hazardFile = path.join(DATA_DIR, 'hazard_grid.parquet');

  if (!fs.existsSync(hazardFile)) {
    console.warn(`[DuckDB] Missing data file: ${hazardFile}`);
    return null;
  }

  const prepared = await connection.prepare(`
    SELECT *,
      (lat - $lat) * (lat - $lat) + (lon - $lon) * (lon - $lon) AS dist2
    FROM read_parquet('${sqlPath(hazardFile)}')
    WHERE lat BETWEEN $lat - 0.01 AND $lat + 0.01
      AND lon BETWEEN $lon - 0.01 AND $lon + 0.01
    ORDER BY dist2
    LIMIT 1;
  `);

  prepared.bind({ lat, lon });
  const result = await prepared.run();
  const rows = await result.getRows();
  const objects = rowsToObjects(result, rows);

  if (objects.length === 0) return null;

  const row = objects[0];

  return {
    ground_susceptibility_score: row.ground_susceptibility_score,
    ground_susceptibility_class: row.ground_susceptibility_class,
    vs30: row.vs30,
    confidence: row.confidence,
    location: {
      type: 'Point',
      coordinates: [row.lon, row.lat],
    },
  };
}

export async function getNearestScenarioPoint(eventId, lat, lon) {
  if (!duckdbAvailable) return null;
  if (!connection) throw new Error('DuckDB not initialized');

  const scenarioFile = path.join(DATA_DIR, scenarioFileNameFromEventId(eventId));

  if (!fs.existsSync(scenarioFile)) {
    console.warn(`[DuckDB] Missing data file: ${scenarioFile}`);
    return null;
  }

  const prepared = await connection.prepare(`
    SELECT *,
      (lat - $lat) * (lat - $lat) + (lon - $lon) * (lon - $lon) AS dist2
    FROM read_parquet('${sqlPath(scenarioFile)}')
    WHERE lat BETWEEN $lat - 0.01 AND $lat + 0.01
      AND lon BETWEEN $lon - 0.01 AND $lon + 0.01
    ORDER BY dist2
    LIMIT 1;
  `);

  prepared.bind({ lat, lon });
  const result = await prepared.run();
  const rows = await result.getRows();
  const objects = rowsToObjects(result, rows);

  if (objects.length === 0) return null;

  const row = objects[0];
  const cleanedRow = { ...row };
  delete cleanedRow.dist2;

  return {
    ...cleanedRow,
    location: {
      type: 'Point',
      coordinates: [row.lon, row.lat],
    },
  };
}

async function queryHeatmapLayer({
  id,
  label,
  filePath,
  valueColumn,
  metric,
  scoreSql,
  cellDeg,
  limit,
}) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[DuckDB] Missing heatmap data file: ${filePath}`);
    return null;
  }

  const query = `
    WITH binned AS (
      SELECT
        AVG(CAST(lat AS DOUBLE)) AS lat,
        AVG(CAST(lon AS DOUBLE)) AS lon,
        AVG(CAST(${valueColumn} AS DOUBLE)) AS raw_value,
        COUNT(*) AS samples
      FROM read_parquet('${sqlPath(filePath)}')
      WHERE lat BETWEEN ${BD_BOUNDS.minLat} AND ${BD_BOUNDS.maxLat}
        AND lon BETWEEN ${BD_BOUNDS.minLon} AND ${BD_BOUNDS.maxLon}
        AND ${valueColumn} IS NOT NULL
      GROUP BY FLOOR(CAST(lat AS DOUBLE) / ${cellDeg}), FLOOR(CAST(lon AS DOUBLE) / ${cellDeg})
    )
    SELECT
      lat,
      lon,
      raw_value,
      ${scoreSql} AS score,
      samples
    FROM binned
    WHERE raw_value IS NOT NULL
    ORDER BY lat, lon;
  `;

  const result = await connection.run(query);
  const rows = await result.getRows();
  const objects = rowsToObjects(result, rows);

  return {
    id,
    label,
    metric,
    points: sampleSpatialPoints(
      objects
      .map((row) => ({
        lat: Number(row.lat),
        lon: Number(row.lon),
        value: Number(row.raw_value),
        score: clampNumber(row.score, 0, 0, 100),
        samples: Number(row.samples) || 0,
      }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)),
      limit
    ),
  };
}

export async function getHazardHeatmapLayers(options = {}) {
  const cellDeg = clampNumber(options.cellDeg, 0.035, 0.015, 0.12);
  const limit = Math.round(clampNumber(options.limitPerLayer, 1200, 200, 2500));
  const includeScenarios = options.includeScenarios !== false;

  const layers = [];
  const staticLayerFromCache = await getStaticHeatmapLayerFromCache({ cellDeg, limit });

  if (staticLayerFromCache) {
    layers.push(staticLayerFromCache);
  } else {
    warmStaticHeatmapCache({ cellDeg, limit });
  }

  if (!duckdbAvailable) {
    return {
      status: layers.length > 0 ? 'ok' : 'building',
      reason: 'DuckDB is not available in this environment.',
      generated_at: new Date().toISOString(),
      bounds: BD_BOUNDS,
      cell_deg: cellDeg,
      limit_per_layer: limit,
      cache: getStaticHeatmapCacheStatus(),
      layers,
    };
  }

  if (!connection) {
    return {
      status: layers.length > 0 ? 'ok' : 'building',
      reason: 'DuckDB is not initialized yet.',
      generated_at: new Date().toISOString(),
      bounds: BD_BOUNDS,
      cell_deg: cellDeg,
      limit_per_layer: limit,
      cache: getStaticHeatmapCacheStatus(),
      layers,
    };
  }

  if (!staticLayerFromCache) {
    const staticLayer = await queryHeatmapLayer({
      id: 'static',
      label: 'Ground susceptibility',
      filePath: path.join(DATA_DIR, 'hazard_grid.parquet'),
      valueColumn: 'ground_susceptibility_score',
      metric: 'Ground susceptibility score',
      scoreSql: `
        CASE
          WHEN raw_value < 0 THEN 0
          WHEN raw_value > 100 THEN 100
          ELSE raw_value
        END
      `,
      cellDeg,
      limit,
    });

    if (staticLayer) layers.push(staticLayer);
  }

  if (includeScenarios) {
    for (const eventId of SCENARIO_EVENT_IDS) {
      const scenarioLayer = await queryHeatmapLayer({
        id: eventId,
        label: `Scenario ${eventId.replace('event_', '')} shaking`,
        filePath: path.join(DATA_DIR, scenarioFileNameFromEventId(eventId)),
        valueColumn: 'mmi_filled',
        metric: 'Modified Mercalli intensity',
        scoreSql: `
          CASE
            WHEN ((raw_value - 2.0) / 7.0) * 100.0 < 0 THEN 0
            WHEN ((raw_value - 2.0) / 7.0) * 100.0 > 100 THEN 100
            ELSE ((raw_value - 2.0) / 7.0) * 100.0
          END
        `,
        cellDeg,
        limit,
      });

      if (scenarioLayer) layers.push(scenarioLayer);
    }
  }

  return {
    status: layers.length > 0 ? 'ok' : 'empty',
    generated_at: new Date().toISOString(),
    bounds: BD_BOUNDS,
    cell_deg: cellDeg,
    limit_per_layer: limit,
    cache: getStaticHeatmapCacheStatus(),
    layers,
  };
}
