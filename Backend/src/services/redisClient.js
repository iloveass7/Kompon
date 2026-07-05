// Kompon — Upstash Redis client
// REST-based Redis for caching and rate limiting.
// Uses @upstash/redis (REST SDK) — works cleanly from Render's free tier.

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Get a value from Redis cache.
 * @param {string} key
 * @returns {Promise<any|null>} parsed value or null on miss/error
 */
export async function getCache(key) {
  try {
    const value = await redis.get(key);
    return value ?? null;
  } catch (err) {
    console.error(`[Redis] GET error for key "${key}":`, err.message);
    return null;
  }
}

/**
 * Set a value in Redis cache with TTL.
 * @param {string} key
 * @param {any} value — will be JSON-serialized by @upstash/redis
 * @param {number} ttlSeconds
 */
export async function setCache(key, value, ttlSeconds) {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error(`[Redis] SET error for key "${key}":`, err.message);
  }
}

export { redis };
export default redis;
