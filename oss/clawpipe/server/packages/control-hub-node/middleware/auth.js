"use strict";

const utils = require("../utils");

function resolveBasicAuthCredentials(env) {
  const raw = String(env.CONTROL_HUB_BASIC_AUTH || "").trim();
  const user = String(env.CONTROL_HUB_BASIC_USER || "").trim();
  const pass = String(env.CONTROL_HUB_BASIC_PASS || "").trim();
  if (raw.includes(":")) {
    const idx = raw.indexOf(":");
    const u = raw.slice(0, idx).trim();
    const p = raw.slice(idx + 1).trim();
    if (u && p) return { user: u, pass: p };
  }
  if (user && pass) return { user, pass };
  return null;
}

function requireBasicAuth(req, res, basicAuth) {
  if (!basicAuth) {
    req.authState = "disabled";
    req.authUser = "";
    return true;
  }

  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Basic ")) {
    req.authState = "missing";
    req.authUser = "";
    res.writeHead(401, {
      ...utils.apiHeaders("text/plain; charset=utf-8"),
      "WWW-Authenticate": 'Basic realm="Control Hub"',
    });
    res.end("Authentication required");
    return false;
  }

  try {
    const encoded = header.slice(6).trim();
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    const user = idx >= 0 ? decoded.slice(0, idx) : "";
    const pass = idx >= 0 ? decoded.slice(idx + 1) : "";
    if (user === basicAuth.user && pass === basicAuth.pass) {
      req.authState = "ok";
      req.authUser = user;
      return true;
    }
  } catch {
    // fallthrough to unauthorized
  }

  req.authState = "invalid";
  req.authUser = "";
  res.writeHead(401, {
    ...utils.apiHeaders("text/plain; charset=utf-8"),
    "WWW-Authenticate": 'Basic realm="Control Hub"',
  });
  res.end("Invalid credentials");
  return false;
}

module.exports = { resolveBasicAuthCredentials, requireBasicAuth };
