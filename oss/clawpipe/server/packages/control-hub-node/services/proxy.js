"use strict";

const utils = require("../utils");

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Upstream request timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function proxyRequest(options, proxyAllowlist, fetchTimeoutMs) {
  const {
    baseUrl,
    endpoint,
    method = "GET",
    authMode,
    authSecret,
    userId,
    payload,
    extraHeaders,
  } = options;

  const base = utils.parseAndValidateBaseUrl(baseUrl, proxyAllowlist);
  const normalizedEndpoint = String(endpoint || "").startsWith("/")
    ? String(endpoint || "")
    : `/${String(endpoint || "")}`;
  const url = `${base}${normalizedEndpoint}`;
  const headers = {
    ...utils.buildAuthHeaders(authMode, authSecret, userId),
    ...(extraHeaders || {}),
  };
  let body;
  if (payload !== undefined && method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload);
  }

  const response = await fetchWithTimeout(url, { method, headers, body }, fetchTimeoutMs);
  const contentType = response.headers.get("content-type") || "";
  const parsedBody = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { ok: response.ok, status: response.status, url, body: parsedBody };
}

module.exports = { fetchWithTimeout, proxyRequest };
