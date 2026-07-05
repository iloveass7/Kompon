// Kompon — Fire Brigade route (§6.4)
// GET /v1/fire-brigade/search?district=&upazila=
// Loads station data from fire_service.json in-memory (small, static data).
// Always includes national fallback hotlines alongside results.

import { Router } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateRequest, fireBrigadeSchema } from "../middleware/validate.js";

const router = Router();

// ─── Load fire service data from JSON at startup ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, "..", "..", "fire_service.json");

let fireData = null;
let stationsList = [];
let knownDistricts = new Set();
let knownDivisions = new Set();

function loadFireData() {
  try {
    const raw = readFileSync(DATA_PATH, "utf-8");
    fireData = JSON.parse(raw);
    stationsList = fireData.stations || [];

    // Build lookup sets for validation
    knownDistricts = new Set(stationsList.map((s) => s.district.toLowerCase()));
    knownDivisions = new Set(stationsList.map((s) => s.division.toLowerCase()));

    console.log(
      `[FireBrigade] Loaded ${stationsList.length} stations from fire_service.json ` +
      `(${knownDistricts.size} districts, ${knownDivisions.size} divisions).`
    );
  } catch (err) {
    console.error("[FireBrigade] Failed to load fire_service.json:", err.message);
    fireData = null;
    stationsList = [];
  }
}

// Load immediately at import time
loadFireData();

// ─── National fallback from the JSON data ───
function getNationalFallback() {
  if (fireData?.national_hotlines) {
    return {
      emergency_numbers: [
        { number: fireData.national_hotlines.national_emergency, label: "National Emergency Hotline" },
        { number: fireData.national_hotlines.fire_service, label: "Fire Service & Civil Defence" },
        { number: fireData.national_hotlines.alternative, label: "Alternative Fire Service Line" },
        { number: fireData.national_hotlines.monitoring_cell, label: "Monitoring Cell" },
      ].filter((e) => e.number), // drop any missing numbers
      note: fireData.disclaimer || "In case of emergency, always dial the national hotline 102 or 999.",
    };
  }

  // Hardcoded fallback if JSON didn't load
  return {
    emergency_numbers: [
      { number: "999", label: "National Emergency Hotline" },
      { number: "102", label: "Fire Service & Civil Defence" },
    ],
    note: "If no local station is found, call the national emergency numbers above. Verify the current number at fireservice.gov.bd.",
  };
}

/**
 * Case-insensitive substring match helper.
 */
function matchesCI(value, query) {
  if (!value || !query) return false;
  return value.toLowerCase().includes(query.toLowerCase());
}

// ─── GET /v1/fire-brigade/search?district=Dhaka&upazila=Dohar ───
router.get(
  "/search",
  rateLimit("fireBrigade"),
  validateRequest(fireBrigadeSchema, "query"),
  async (req, res) => {
    try {
      const { district, upazila } = req.query;
      const nationalFallback = getNationalFallback();

      if (stationsList.length === 0) {
        return res.status(503).json({
          error: "Fire brigade directory is not available. Please try again later.",
          national_fallback: nationalFallback,
        });
      }

      // Validate district against known set
      if (!knownDistricts.has(district.toLowerCase())) {
        return res.status(404).json({
          error: `District "${district}" not found in our database.`,
          available_districts: [...knownDistricts].sort(),
          national_fallback: nationalFallback,
        });
      }

      // Filter stations — case-insensitive match
      let results = stationsList.filter((s) => matchesCI(s.district, district));

      if (upazila) {
        const upazilaResults = results.filter((s) => matchesCI(s.upazila, upazila));
        // If upazila filter returns nothing, still return district results with a note
        if (upazilaResults.length > 0) {
          results = upazilaResults;
        } else {
          return res.status(200).json({
            stations: results.map(formatStation),
            count: results.length,
            note: `No stations found specifically in "${upazila}". Showing all stations in "${district}" district instead.`,
            national_fallback: nationalFallback,
          });
        }
      }

      if (results.length === 0) {
        return res.status(404).json({
          error: `No fire stations found for district "${district}".`,
          suggestion: "Try searching with just the district name, or check available districts.",
          available_districts: [...knownDistricts].sort(),
          national_fallback: nationalFallback,
        });
      }

      return res.status(200).json({
        stations: results.map(formatStation),
        count: results.length,
        national_fallback: nationalFallback,
      });
    } catch (err) {
      console.error("[FireBrigade] Error:", err.message);
      return res.status(500).json({
        error: "Failed to search fire brigade directory.",
        national_fallback: getNationalFallback(),
      });
    }
  }
);

// ─── GET /v1/fire-brigade/divisions — list all available divisions ───
router.get(
  "/divisions",
  rateLimit("fireBrigade"),
  async (_req, res) => {
    const divisions = [...knownDivisions].sort().map((div) => {
      const divStations = stationsList.filter((s) => s.division.toLowerCase() === div);
      const districts = [...new Set(divStations.map((s) => s.district))].sort();
      return {
        division: divStations[0]?.division || div,
        districts,
        station_count: divStations.length,
      };
    });

    return res.status(200).json({
      divisions,
      total_stations: stationsList.length,
      national_fallback: getNationalFallback(),
    });
  }
);

// ─── GET /v1/fire-brigade/districts — list all available districts ───
router.get(
  "/districts",
  rateLimit("fireBrigade"),
  async (_req, res) => {
    const districts = [...knownDistricts].sort();
    return res.status(200).json({
      districts,
      total: districts.length,
    });
  }
);

/**
 * Format a station object for API response.
 * Strips any internal fields, ensures consistent shape.
 */
function formatStation(station) {
  return {
    division: station.division,
    district: station.district,
    upazila: station.upazila || null,
    station_name: station.station_name,
    phone_numbers: station.phone_numbers || [],
    address: station.address || null,
    email: station.email || null,
    source_url: station.source_url || null,
  };
}

export default router;
