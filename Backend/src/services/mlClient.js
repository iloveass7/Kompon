// Kompon — ML Space client
// Calls the Hugging Face Space (FastAPI) for Model 0/A image inference
// and Model 3 scenario scoring. Uses a persistent axios instance with
// keep-alive to avoid per-request connection overhead.

import axios from "axios";
import http from "node:http";
import https from "node:https";
import FormData from "form-data";

const ML_TIMEOUT_MS = 35_000; // 35s — generous to allow for Hugging Face Space cold-start / weight downloads

// Persistent HTTP agent with keep-alive (reuse connections to HF Space)
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const mlAxios = axios.create({
  baseURL: process.env.ML_SPACE_BASE_URL,
  timeout: ML_TIMEOUT_MS,
  httpAgent,
  httpsAgent,
});

/**
 * Send an image buffer to the HF Space for crack/damage analysis.
 * POST /infer/image-risk (multipart/form-data, field "image")
 *
 * @param {Buffer} imageBuffer — processed image (already re-encoded via sharp)
 * @param {string} [mimeType="image/jpeg"] — MIME type of the buffer
 * @returns {Promise<Object>} gate + crack_analysis + disclaimer
 */
export async function inferImageRisk(imageBuffer, mimeType = "image/jpeg") {
  const form = new FormData();
  const ext = mimeType === "image/png" ? "image.png" : "image.jpg";
  form.append("image", imageBuffer, {
    filename: ext,
    contentType: mimeType,
  });

  const response = await mlAxios.post("/infer/image-risk", form, {
    headers: form.getHeaders(),
    maxContentLength: 50 * 1024 * 1024, // 50MB response limit
  });

  return response.data;
}

/**
 * Send scenario features to the HF Space for liquefaction scoring.
 * POST /infer/scenario-score (JSON body)
 *
 * @param {Object} features — ground + shaking features as required by Model 3
 * @returns {Promise<Object>} scenario score + tier + disclaimer
 */
export async function inferScenarioScore(features) {
  const response = await mlAxios.post("/infer/scenario-score", features);
  return response.data;
}

/**
 * Health-check the ML Space.
 * GET /health — instant 200 if the Space is awake.
 *
 * @returns {Promise<boolean>} true if healthy
 */
export async function checkMLHealth() {
  try {
    const response = await mlAxios.get("/health", { timeout: 5_000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

export default { inferImageRisk, inferScenarioScore, checkMLHealth };
