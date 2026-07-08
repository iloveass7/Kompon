// Kompon — Static data loader (§3a, §3b, §3c)
// One-off script to load clipped CSV data into MongoDB collections.
// Run once at build time: npm run load-data
//
// Usage:
//   node src/scripts/loadStaticData.js --hazard ./data/hazard_grid_clipped.csv
//   node src/scripts/loadStaticData.js --scenario ./data/scenario_event1.csv --event-id event_1
//   node src/scripts/loadStaticData.js --fire ./data/fire_stations.csv
//   node src/scripts/loadStaticData.js --all  (loads all from ./data/ directory)

import "../config/env.js";

import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import mongoose from "mongoose";

import HazardPoint from "../models/HazardPoint.js";
import ScenarioPoint from "../models/ScenarioPoint.js";
import FireStation from "../models/FireStation.js";

const BATCH_SIZE = 500; // insertMany batch size to avoid memory spikes on M0

// ─── Helpers ───

function parseCSV(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: true, // auto-cast numbers
  });
}

async function insertInBatches(Model, docs, label) {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    await Model.insertMany(batch, { ordered: false });
    inserted += batch.length;
    process.stdout.write(`\r[${label}] Inserted ${inserted}/${docs.length}`);
  }
  console.log(`\n[${label}] Done — ${inserted} documents.`);
}

// ─── Hazard grid loader (§3a) ───

async function loadHazardGrid(filePath) {
  console.log(`[Hazard] Loading from ${filePath}...`);
  const rows = parseCSV(filePath);

  const docs = rows
    .map((row) => {
      const lat = parseFloat(row.lat ?? row.latitude);
      const lon = parseFloat(row.lon ?? row.longitude ?? row.lng);
      const score = parseFloat(
        row.ground_susceptibility_score ?? row.susceptibility_score ?? row.score
      );

      if (isNaN(lat) || isNaN(lon) || isNaN(score)) return null;

      return {
        location: {
          type: "Point",
          coordinates: [lon, lat], // GeoJSON: lon first
        },
        ground_susceptibility_score: score,
        ground_susceptibility_class:
          row.ground_susceptibility_class ?? row.susceptibility_class ?? row.class ?? "Unknown",
        vs30: parseFloat(row.vs30) || 250,
        confidence: parseFloat(row.confidence) || 0.5,
      };
    })
    .filter(Boolean);

  // Drop existing data and reload
  await HazardPoint.deleteMany({});
  await insertInBatches(HazardPoint, docs, "Hazard");
}

// ─── Scenario grid loader (§3b) ───

async function loadScenarioGrid(filePath, eventId) {
  console.log(`[Scenario] Loading event "${eventId}" from ${filePath}...`);
  const rows = parseCSV(filePath);

  const docs = rows
    .map((row) => {
      const lat = parseFloat(row.lat ?? row.latitude);
      const lon = parseFloat(row.lon ?? row.longitude ?? row.lng);

      if (isNaN(lat) || isNaN(lon)) return null;

      return {
        event_id: eventId,
        location: {
          type: "Point",
          coordinates: [lon, lat],
        },
        magnitude: parseFloat(row.magnitude) || 0,
        depth_km: parseFloat(row.depth_km) || 0,
        dist_epicenter_km: parseFloat(row.dist_epicenter_km) || 0,
        pga_g_filled: parseFloat(row.pga_g_filled ?? row.pga_g) || 0,
        pgv_cms_filled: parseFloat(row.pgv_cms_filled ?? row.pgv_cms) || 0,
        mmi_filled: parseFloat(row.mmi_filled ?? row.mmi) || 0,
        ground_susceptibility_score: parseFloat(row.ground_susceptibility_score) || null,
        vs30: parseFloat(row.vs30) || null,
        elevation_m: parseFloat(row.elevation_m) || null,
        slope_deg: parseFloat(row.slope_deg) || null,
        dist_water_m: parseFloat(row.dist_water_m) || null,
        water_occurrence_pct: parseFloat(row.water_occurrence_pct) || null,
        geology_class: row.geology_class || null,
        hand_m: parseFloat(row.hand_m) || null,
        water_max_extent: parseFloat(row.water_max_extent) || null,
        dynamic_label_name: row.dynamic_label_name || null,
      };
    })
    .filter(Boolean);

  // Drop only this event's data, not all scenario data
  await ScenarioPoint.deleteMany({ event_id: eventId });
  await insertInBatches(ScenarioPoint, docs, `Scenario:${eventId}`);
}

// ─── Fire station loader (§3c) ───

async function loadFireStations(filePath) {
  console.log(`[Fire] Loading from ${filePath}...`);
  const rows = parseCSV(filePath);

  const docs = rows.map((row) => ({
    division: row.division || "Unknown",
    district: row.district || "Unknown",
    upazila: row.upazila || null,
    station_name: row.station_name || row.name || "Unknown Station",
    phone_numbers: (row.phone_numbers || row.phone || "")
      .split(/[,;|]/)
      .map((p) => p.trim())
      .filter(Boolean),
    source_url: row.source_url || null,
    last_verified: row.last_verified || new Date().toISOString().split("T")[0],
  }));

  await FireStation.deleteMany({});
  await insertInBatches(FireStation, docs, "Fire");
}

// ─── CLI entry point ───

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Kompon — Static Data Loader

Usage:
  node src/scripts/loadStaticData.js --hazard <csv_path>
  node src/scripts/loadStaticData.js --scenario <csv_path> --event-id <id>
  node src/scripts/loadStaticData.js --fire <csv_path>

Examples:
  node src/scripts/loadStaticData.js --hazard ./data/hazard_grid_dhaka.csv
  node src/scripts/loadStaticData.js --scenario ./data/scenario_event1.csv --event-id event_1
  node src/scripts/loadStaticData.js --fire ./data/fire_stations_dhaka.csv
`);
    process.exit(0);
  }

  // Connect to MongoDB
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  console.log("[DB] Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("[DB] Connected.");

  try {
    // Parse CLI arguments
    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case "--hazard":
          await loadHazardGrid(args[++i]);
          break;
        case "--scenario": {
          const csvPath = args[++i];
          let eventId = "event_1"; // default
          if (args[i + 1] === "--event-id") {
            i++;
            eventId = args[++i];
          }
          await loadScenarioGrid(csvPath, eventId);
          break;
        }
        case "--fire":
          await loadFireStations(args[++i]);
          break;
        default:
          console.warn(`Unknown argument: ${args[i]}`);
      }
    }
  } finally {
    await mongoose.disconnect();
    console.log("[DB] Disconnected.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
