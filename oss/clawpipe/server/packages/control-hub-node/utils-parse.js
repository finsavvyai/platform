'use strict';

const { URL } = require('url');

/**
 * Converts an environment variable string to a boolean.
 * Recognises "true"/"1"/"yes" as true, "false"/"0"/"no" as false.
 */
function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return fallback;
}

/**
 * Converts an environment variable string to an integer with floor and min guard.
 */
function parseIntEnv(value, fallback, min = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < min) return fallback;
  return rounded;
}

/**
 * Strips the IPv6-mapped IPv4 prefix "::ffff:" from an address.
 */
function normalizeClientIp(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

/**
 * Strips trailing slashes and whitespace from a base URL string.
 */
function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

/**
 * Validates that a URL has http/https protocol and no embedded credentials.
 * When a non-empty allowlist Set is provided, the hostname:port must appear in it.
 */
function parseAndValidateBaseUrl(value, proxyAllowlist) {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) throw new Error('Missing target base URL');

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('Invalid target base URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https target URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Target URL must not include credentials');
  }

  if (proxyAllowlist && proxyAllowlist.size > 0) {
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const hostWithPort = `${host}:${port}`;
    if (!proxyAllowlist.has(host) && !proxyAllowlist.has(hostWithPort)) {
      throw new Error(
        `Target host '${hostWithPort}' is not in CONTROL_HUB_PROXY_ALLOWLIST`,
      );
    }
  }

  const pathPart =
    parsed.pathname && parsed.pathname !== '/'
      ? parsed.pathname.replace(/\/+$/, '')
      : '';
  return `${parsed.origin}${pathPart}`;
}

/**
 * Maps a Docker stack input to a canonical stack name ("core" or "full").
 */
function normalizeDockerStack(input) {
  const value = String(input || 'full').toLowerCase();
  if (value === 'core' || value === 'minimal') return 'core';
  if (value === 'full' || value === 'openclaw' || value === 'fork') return 'full';
  return 'full';
}

/**
 * Extracts the container port from a request body, falling back by image name.
 */
function parseOpenclawContainerPort(body) {
  const explicit = Number(body?.openclawContainerPort || body?.openclawPort || 0);
  if (Number.isInteger(explicit) && explicit > 0 && explicit <= 65535) {
    return String(explicit);
  }
  const image = String(body?.openclawImage || '').toLowerCase();
  if (image.includes('lunaos')) return '8000';
  return '11434';
}

/**
 * Extracts an explicitly provided container port, or returns empty string.
 */
function parseExplicitOpenclawContainerPort(body) {
  const explicit = Number(body?.openclawContainerPort || body?.openclawPort || 0);
  if (Number.isInteger(explicit) && explicit > 0 && explicit <= 65535) {
    return String(explicit);
  }
  return '';
}

/**
 * Tests whether an error message indicates a Docker pull-access-denied for openclaw.
 */
function isOpenclawPullDeniedError(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('pull access denied') && message.includes('openclaw/openclaw');
}

/**
 * Normalises a channel type string to one of the known set.
 */
function normalizeChannelType(value) {
  const type = String(value || 'webhook').toLowerCase().trim();
  const known = new Set(['whatsapp', 'telegram', 'slack', 'discord', 'webhook']);
  return known.has(type) ? type : 'webhook';
}

/**
 * Tests whether a proxy result indicates a missing endpoint (404/405).
 */
function isMissingEndpoint(result) {
  const status = Number(result?.status || 0);
  return !result?.ok && (status === 404 || status === 405);
}

/**
 * Trims a header value string to at most `max` characters.
 */
function trimHeaderValue(value, max = 256) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

module.exports = {
  parseBooleanEnv,
  parseIntEnv,
  normalizeClientIp,
  normalizeBaseUrl,
  parseAndValidateBaseUrl,
  normalizeDockerStack,
  parseOpenclawContainerPort,
  parseExplicitOpenclawContainerPort,
  isOpenclawPullDeniedError,
  normalizeChannelType,
  isMissingEndpoint,
  trimHeaderValue,
};
