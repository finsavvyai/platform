"use strict";

const utils = require("../utils");

function makeRateLimitStore() {
  return new Map();
}

function getClientIp(req, trustProxy) {
  if (trustProxy) {
    const forwardedFor = String(req.headers["x-forwarded-for"] || "")
      .split(",")
      .map((item) => item.trim())
      .find(Boolean);
    if (forwardedFor) return utils.normalizeClientIp(forwardedFor);
    const realIp = String(req.headers["x-real-ip"] || "").trim();
    if (realIp) return utils.normalizeClientIp(realIp);
  }
  return utils.normalizeClientIp(req.socket?.remoteAddress);
}

function consumeRateLimit(store, ip, windowMs, maxRequests, now = Date.now()) {
  const key = String(ip || "unknown");
  const windowStart = Math.floor(now / windowMs) * windowMs;
  if (store.size > 2048) {
    for (const [storedKey, entry] of store.entries()) {
      if (!entry || entry.windowStart + windowMs < windowStart) {
        store.delete(storedKey);
      }
    }
  }
  const bucket = store.get(key);
  if (!bucket || bucket.windowStart !== windowStart) {
    const fresh = { windowStart, count: 1 };
    store.set(key, fresh);
    return {
      limited: false,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - fresh.count),
      resetAt: windowStart + windowMs,
      retryAfterSeconds: 0,
    };
  }
  bucket.count += 1;
  const remaining = Math.max(0, maxRequests - bucket.count);
  const limited = bucket.count > maxRequests;
  const resetAt = windowStart + windowMs;
  return {
    limited,
    limit: maxRequests,
    remaining,
    resetAt,
    retryAfterSeconds: limited ? Math.max(1, Math.ceil((resetAt - now) / 1000)) : 0,
  };
}

module.exports = { makeRateLimitStore, getClientIp, consumeRateLimit };
