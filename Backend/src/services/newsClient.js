// Kompon — News client (§6.2)
// Currents API primary, GDELT DOC 2.0 fallback.
// Cron-refreshed every 20 min — never called synchronously on user requests.

import axios from "axios";
import sanitizeHtml from "sanitize-html";
import { getCache, setCache } from "./redisClient.js";

const NEWS_CACHE_KEY = "news:list:v1";
const NEWS_CACHE_TTL = 30 * 60; // 30 minutes in seconds
const NEWS_PAGE_SIZE = 10;

// ─── Sanitization ───
// Strip all HTML tags from titles/summaries — defense against malicious upstream.
function sanitizeText(text) {
  if (!text) return "";
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

function sanitizeImageUrl(url) {
  if (!url || typeof url !== "string") return null;

  const trimmed = url.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return null;

  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

// ─── Currents API (primary) ───
async function fetchFromCurrents(query = "earthquake") {
  const apiKey = process.env.CURRENTS_API_KEY;
  if (!apiKey) {
    console.warn("[News] CURRENTS_API_KEY not set — skipping Currents.");
    return null;
  }

  try {
    const response = await axios.get("https://api.currentsapi.services/v1/search", {
      params: {
        apiKey,
        keywords: query,
        language: "en",
        type: 1, // news articles
      },
      timeout: 10_000,
    });

    const articles = response.data?.news;
    if (!Array.isArray(articles)) return null;

    return articles.map((a) => ({
      title: sanitizeText(a.title),
      summary: sanitizeText(a.description),
      image_url: sanitizeImageUrl(a.image),
      source_name: sanitizeText(a.author) || sanitizeText(a.id?.split("/")[2]) || "Unknown",
      source_url: a.url || null,
      published_at: a.published || null,
    }));
  } catch (err) {
    console.error("[News] Currents API error:", err.message);
    return null;
  }
}

// ─── GDELT DOC 2.0 (fallback) ───
async function fetchFromGDELT(query = "earthquake") {
  try {
    const response = await axios.get("https://api.gdeltproject.org/api/v2/doc/doc", {
      params: {
        query,
        mode: "ArtList",
        maxrecords: 50,
        format: "json",
        sort: "DateDesc",
      },
      timeout: 10_000,
    });

    const articles = response.data?.articles;
    if (!Array.isArray(articles)) return null;

    return articles.map((a) => ({
      title: sanitizeText(a.title),
      summary: sanitizeText(a.seendate ? `Published: ${a.seendate}` : ""),
      image_url: sanitizeImageUrl(a.socialimage),
      source_name: sanitizeText(a.domain) || "Unknown",
      source_url: a.url || null,
      published_at: a.seendate || null,
    }));
  } catch (err) {
    console.error("[News] GDELT API error:", err.message);
    return null;
  }
}

/**
 * Refresh the news cache — called by cron job, NOT per-request.
 * Tries Currents first, falls back to GDELT.
 */
// ─── Relevance filter ───
// Currents API sometimes returns unrelated news. Filter server-side
// to keep only articles that actually mention earthquake-related terms.
const EARTHQUAKE_TERMS = /earthquake|quake|seismic|tremor|aftershock|magnitude|richter|liquefaction|tectonic|temblor/i;

function filterEarthquakeArticles(articles) {
  if (!articles) return null;
  return articles.filter(
    (a) =>
      a.image_url &&
      (EARTHQUAKE_TERMS.test(a.title || "") ||
        EARTHQUAKE_TERMS.test(a.summary || ""))
  );
}

export async function refreshNewsCache() {
  console.log("[News] Refreshing earthquake news cache...");

  // Try Currents with Bangladesh focus first
  let articles = filterEarthquakeArticles(
    await fetchFromCurrents("earthquake Bangladesh")
  );

  // Fallback: GDELT Bangladesh
  if (!articles || articles.length === 0) {
    console.log("[News] Currents empty/failed — trying GDELT fallback...");
    articles = filterEarthquakeArticles(
      await fetchFromGDELT("earthquake Bangladesh")
    );
  }

  // Fallback: broader earthquake query
  if (!articles || articles.length === 0) {
    articles = filterEarthquakeArticles(
      await fetchFromCurrents("earthquake")
    );
    if (!articles || articles.length === 0) {
      articles = filterEarthquakeArticles(
        await fetchFromGDELT("earthquake")
      );
    }
  }

  if (articles && articles.length > 0) {
    await setCache(NEWS_CACHE_KEY, articles, NEWS_CACHE_TTL);
    console.log(`[News] Cached ${articles.length} earthquake-related articles.`);
  } else {
    console.warn("[News] No earthquake articles found from any source.");
  }
}

/**
 * Get paginated news from cache.
 * @param {number} page — 1-indexed
 * @param {string} [country] — optional filter (not implemented in cache, future use)
 * @returns {Promise<{ articles: Array, page: number, total: number, page_size: number }>}
 */
export async function getCachedNews(page = 1, country = null) {
  const allArticles = ((await getCache(NEWS_CACHE_KEY)) || []).filter(
    (a) => sanitizeImageUrl(a?.image_url)
  );

  // Optional country filter (loose substring match on title/source)
  let filtered = allArticles;
  if (country) {
    const lower = country.toLowerCase();
    filtered = allArticles.filter(
      (a) =>
        (a.title && a.title.toLowerCase().includes(lower)) ||
        (a.summary && a.summary.toLowerCase().includes(lower)) ||
        (a.source_name && a.source_name.toLowerCase().includes(lower))
    );
  }

  const start = (page - 1) * NEWS_PAGE_SIZE;
  const pageArticles = filtered.slice(start, start + NEWS_PAGE_SIZE);

  return {
    articles: pageArticles,
    page,
    total: filtered.length,
    page_size: NEWS_PAGE_SIZE,
  };
}

export default { refreshNewsCache, getCachedNews };
