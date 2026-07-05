// Kompon — Overpass (OSM) client (§6.3)
// Nearest safe places (parks, open fields, recreation grounds).
// Redis-cached with rounded lat/lon key, 7-day TTL.

import axios from "axios";
import { getCache, setCache } from "./redisClient.js";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const SAFE_PLACES_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const MAX_RESULTS = 15;
const FALLBACK_RADII = [5000, 3000, 2000, 1000, 500];

/**
 * Build an Overpass QL query for safe/open places near a point.
 * Searches both nodes and ways for parks, open fields, playgrounds,
 * sports grounds, gardens, and other open spaces.
 */
function buildOverpassQuery(lat, lon, radiusM) {
  return `
[out:json][timeout:15];
(
  node["leisure"~"park|pitch|playground|garden|sports_centre|stadium"](around:${radiusM},${lat},${lon});
  way["leisure"~"park|pitch|playground|garden|sports_centre|stadium"](around:${radiusM},${lat},${lon});
  node["landuse"~"grass|meadow|recreation_ground|village_green"](around:${radiusM},${lat},${lon});
  way["landuse"~"grass|meadow|recreation_ground|village_green"](around:${radiusM},${lat},${lon});
  node["natural"~"field|grassland"](around:${radiusM},${lat},${lon});
  way["natural"~"field|grassland"](around:${radiusM},${lat},${lon});
  way["leisure"="park"](around:${radiusM},${lat},${lon});
  relation["leisure"="park"](around:${radiusM},${lat},${lon});
);
out center;
`.trim();
}

/**
 * Compute distance in meters between two lat/lon pairs (Haversine).
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build a cache key from rounded lat/lon and radius.
 * Rounds to ~100m precision to cluster nearby queries.
 */
function cacheKey(lat, lon, radius) {
  const latR = Math.round(lat * 1000) / 1000; // ~111m precision
  const lonR = Math.round(lon * 1000) / 1000;
  return `safeplaces:${latR}:${lonR}:${radius}`;
}

function normalizePlaces(elements, lat, lon) {
  if (!Array.isArray(elements)) return [];

  const seen = new Set();

  return elements
    .map((el) => {
      // For ways, Overpass returns center coords when using "out center"
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;

      if (elLat === undefined || elLon === undefined) return null;

      const tags = el.tags || {};
      const name =
        tags.name ||
        tags["name:en"] ||
        tags.leisure ||
        tags.landuse ||
        tags.natural ||
        "Open space";

      const type =
        tags.leisure || tags.landuse || tags.natural || "open_space";

      const distance_m = Math.round(haversineDistance(lat, lon, elLat, elLon));
      const key = `${Number(elLat).toFixed(6)}:${Number(elLon).toFixed(6)}:${name}`;

      if (seen.has(key)) return null;
      seen.add(key);

      return {
        name,
        lat: elLat,
        lon: elLon,
        type,
        distance_m,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, MAX_RESULTS);
}

async function queryOverpass(lat, lon, radiusM) {
  const query = buildOverpassQuery(lat, lon, radiusM);
  console.log(`[Overpass] Running query for ${radiusM}m:\n${query}`);

  let response;
  try {
    response = await axios.post(
      OVERPASS_API,
      `data=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "KomponEarthquakeScanner/1.0 (contact@kompon.org)"
        },
        timeout: 15_000,
      }
    );
  } catch (err) {
    console.error(`[Overpass] Query error for ${radiusM}m:`, err.message);
    if (err.response) {
      console.error("[Overpass] Status:", err.response.status);
      console.error("[Overpass] Data:", err.response.data);
    }
    return [];
  }

  const elements = response.data?.elements;
  console.log(`[Overpass] Raw elements count returned for ${radiusM}m: ${Array.isArray(elements) ? elements.length : 0}`);
  return normalizePlaces(elements, lat, lon);
}

function smallerFallbackRadii(radiusM) {
  return FALLBACK_RADII.filter((radius) => radius < radiusM).sort((a, b) => b - a);
}

/**
 * Find safe/open places near a coordinate.
 * Checks Redis first, then queries Overpass on cache miss.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} [radiusM=1000] — search radius in meters
 * @returns {Promise<Array<{name, lat, lon, type, distance_m}>>}
 */
export async function findSafePlaces(lat, lon, radiusM = 1000, bypassCache = false) {
  const key = cacheKey(lat, lon, radiusM);

  // Check cache (unless bypassed)
  if (!bypassCache) {
    const cached = await getCache(key);
    if (cached) {
      return cached;
    }
  }

  const places = await queryOverpass(lat, lon, radiusM);

  // Cache the result only if we found actual places
  if (places.length > 0) {
    await setCache(key, places, SAFE_PLACES_TTL);
    return places;
  }

  for (const fallbackRadius of smallerFallbackRadii(radiusM)) {
    const fallbackKey = cacheKey(lat, lon, fallbackRadius);

    if (!bypassCache) {
      const cachedFallback = await getCache(fallbackKey);
      if (cachedFallback?.length > 0) {
        console.warn(`[Overpass] Empty ${radiusM}m result; using cached ${fallbackRadius}m fallback.`);
        return cachedFallback;
      }
    }

    const fallbackPlaces = await queryOverpass(lat, lon, fallbackRadius);
    if (fallbackPlaces.length > 0) {
      await setCache(fallbackKey, fallbackPlaces, SAFE_PLACES_TTL);
      console.warn(`[Overpass] Empty ${radiusM}m result; using fresh ${fallbackRadius}m fallback.`);
      return fallbackPlaces;
    }
  }

  return [];
}

export default { findSafePlaces };
