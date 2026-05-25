"use strict";

const fs = require("fs");
const path = require("path");
const utils = require("../utils");

function loadLocalState(stateFile) {
  try {
    if (!fs.existsSync(stateFile)) return { channels: [] };
    const raw = fs.readFileSync(stateFile, "utf8");
    return utils.sanitizeState(JSON.parse(raw));
  } catch {
    return { channels: [] };
  }
}

function saveLocalState(stateFile, state) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Keep runtime functional even if persistence fails.
  }
}

function upsertLocalChannelConnection(localFacadeState, stateFile, payload, workerBaseUrl) {
  const channelType = utils.normalizeChannelType(payload?.channelType);
  const label = String(payload?.label || `My ${channelType}`).trim() || `My ${channelType}`;
  const defaultAgent = String(payload?.config?.defaultAgent || "run").trim() || "run";
  const workerUrl = utils.normalizeBaseUrl(workerBaseUrl || "http://localhost:8001");
  const webhookUrl = `${workerUrl}/hooks/agent`;
  const existingIdx = localFacadeState.channels.findIndex(
    (e) => e.channelType === channelType && e.label === label,
  );
  const next = {
    id: existingIdx >= 0
      ? localFacadeState.channels[existingIdx].id
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label, channelType, status: "configured-local", mode: "local-facade",
    messageCount: existingIdx >= 0 ? localFacadeState.channels[existingIdx].messageCount || 0 : 0,
    defaultAgent, webhookUrl, updatedAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    localFacadeState.channels[existingIdx] = next;
  } else {
    localFacadeState.channels.push(next);
  }
  saveLocalState(stateFile, localFacadeState);
  return next;
}

module.exports = { loadLocalState, saveLocalState, upsertLocalChannelConnection };
