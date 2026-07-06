import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';
import { DATA_DIR } from '../scripts/fetchServingData.js';
import fs from 'fs';

let connection;

export async function initDuckDB() {
  const instance = await DuckDBInstance.create(':memory:');
  connection = await instance.connect();
  console.log("[DuckDB] In-memory database initialized.");
}

export async function getNearestHazardPoint(lat, lon) {
  if (!connection) throw new Error("DuckDB not initialized");
  
  const hazardFile = path.join(DATA_DIR, 'hazard_grid.parquet');
  
  // Check if file exists, else return null
  if (!fs.existsSync(hazardFile)) {
    console.warn(`[DuckDB] Missing data file: ${hazardFile}`);
    return null;
  }
  
  const prepared = await connection.prepare(`
    SELECT *,
      (lat - $lat) * (lat - $lat) + (lon - $lon) * (lon - $lon) AS dist2
    FROM read_parquet('${hazardFile.replace(/\\/g, '/')}')
    WHERE lat BETWEEN $lat - 0.01 AND $lat + 0.01
      AND lon BETWEEN $lon - 0.01 AND $lon + 0.01
    ORDER BY dist2
    LIMIT 1;
  `);
  
  prepared.bind({ lat, lon });
  const result = await prepared.run();
  const rows = await result.getRows();
  
  if (!rows || rows.length === 0) return null;
  
  // Clean up the row and format it to match previous mongoose object
  const columns = result.columnNames();
  const rowArray = rows[0];
  const row = {};
  columns.forEach((col, idx) => {
    row[col] = rowArray[idx];
  });
  
  return {
    ground_susceptibility_score: row.ground_susceptibility_score,
    ground_susceptibility_class: row.ground_susceptibility_class,
    vs30: row.vs30,
    confidence: row.confidence,
    location: {
      type: "Point",
      coordinates: [row.lon, row.lat]
    }
  };
}

export async function getNearestScenarioPoint(eventId, lat, lon) {
  if (!connection) throw new Error("DuckDB not initialized");
  
  const scenarioFile = path.join(DATA_DIR, `scenario_${eventId}.parquet`);
  
  if (!fs.existsSync(scenarioFile)) {
    console.warn(`[DuckDB] Missing data file: ${scenarioFile}`);
    return null;
  }
  
  const prepared = await connection.prepare(`
    SELECT *,
      (lat - $lat) * (lat - $lat) + (lon - $lon) * (lon - $lon) AS dist2
    FROM read_parquet('${scenarioFile.replace(/\\/g, '/')}')
    WHERE lat BETWEEN $lat - 0.01 AND $lat + 0.01
      AND lon BETWEEN $lon - 0.01 AND $lon + 0.01
    ORDER BY dist2
    LIMIT 1;
  `);
  
  prepared.bind({ lat, lon });
  const result = await prepared.run();
  const rows = await result.getRows();
  
  if (!rows || rows.length === 0) return null;
  
  const columns = result.columnNames();
  const rowArray = rows[0];
  const row = {};
  columns.forEach((col, idx) => {
    row[col] = rowArray[idx];
  });
  
  // Clean out the dist2 column and format location like mongoose did
  const cleanedRow = { ...row };
  delete cleanedRow.dist2;
  
  return {
    ...cleanedRow,
    location: {
      type: "Point",
      coordinates: [row.lon, row.lat]
    }
  };
}
