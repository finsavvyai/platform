'use strict';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const FALLBACK_AGENTS = [
  { id: 'run', name: 'run', description: 'Route request to cluster chat completions' },
  { id: 'inference', name: 'inference', description: 'Cluster chat completion skill' },
  { id: 'cluster-status', name: 'cluster-status', description: 'Cluster status and health' },
  { id: 'models', name: 'models', description: 'List available models' },
  { id: 'benchmark', name: 'benchmark', description: 'Run simple benchmark calls' },
];

const FALLBACK_CHANNEL_TYPES = [
  {
    name: 'whatsapp',
    type: 'whatsapp',
    authMethod: 'token + webhook',
    description: 'Meta webhook bridged to local worker endpoint',
  },
  {
    name: 'telegram',
    type: 'telegram',
    authMethod: 'bot token + webhook',
    description: 'Telegram webhook bridged to local worker endpoint',
  },
  {
    name: 'slack',
    type: 'slack',
    authMethod: 'oauth/webhook',
    description: 'Slack events can be forwarded through worker webhook',
  },
  {
    name: 'discord',
    type: 'discord',
    authMethod: 'bot/webhook',
    description: 'Discord events can be forwarded through worker webhook',
  },
  {
    name: 'webhook',
    type: 'webhook',
    authMethod: 'none',
    description: 'Direct webhook ingestion endpoint',
  },
];

/**
 * Builds response headers with security defaults and the given content type.
 */
function apiHeaders(contentType) {
  return {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  };
}

/**
 * Builds upstream auth headers based on the authentication mode.
 */
function buildAuthHeaders(authMode, authSecret, userId) {
  const mode = String(authMode || 'none').toLowerCase();
  const secret = String(authSecret || '');
  const headers = {};
  if (!secret || mode === 'none') return headers;

  if (mode === 'bearer') {
    headers.Authorization = `Bearer ${secret}`;
  } else if (mode === 'apikey') {
    headers['X-API-Key'] = secret;
  } else if (mode === 'service') {
    headers['X-Service-Key'] = secret;
    if (userId) headers['X-User-Id'] = String(userId);
  }
  return headers;
}

/**
 * Synthesizes a fallback agent list from FALLBACK_AGENTS.
 */
function buildFallbackAgents() {
  return FALLBACK_AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    label: agent.name,
    description: agent.description,
    source: 'local-facade',
  }));
}

/**
 * Synthesizes a fallback service list based on discovered model count.
 */
function buildFallbackServices(modelsCount = 0) {
  return [
    {
      id: 'local-channel-bridge',
      name: 'Local Channel Bridge',
      tier: 'core',
      status: 'ready',
      quickInfo: 'Channels configured through local facade compatibility mode',
    },
    {
      id: 'cluster-chat',
      name: 'Cluster Chat API',
      tier: 'core',
      status: 'ready',
      quickInfo: 'Routes skill calls to gateway /v1/chat/completions',
    },
    {
      id: 'cluster-models',
      name: 'Cluster Models',
      tier: 'core',
      status: modelsCount > 0 ? 'ready' : 'degraded',
      quickInfo: `${modelsCount} model(s) discovered via gateway`,
    },
  ];
}

/**
 * Extracts a prompt string from a skill execution payload.
 */
function buildSkillPromptFromPayload(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const context =
    p.context || p.input || p.query || p.prompt || p.text || p.message || '';
  const normalizedContext = String(context).trim();
  return normalizedContext || 'Provide a short status summary for the cluster.';
}

/**
 * Validates and normalises a state object (channels array).
 */
function sanitizeState(raw) {
  const channels = Array.isArray(raw?.channels)
    ? raw.channels
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          id: String(item.id || ''),
          label: String(item.label || ''),
          channelType: String(item.channelType || 'webhook'),
          status: String(item.status || 'configured-local'),
          mode: String(item.mode || 'local-facade'),
          messageCount: Number(item.messageCount || 0),
          defaultAgent: String(item.defaultAgent || 'run'),
          webhookUrl: String(item.webhookUrl || ''),
          updatedAt: String(item.updatedAt || new Date().toISOString()),
        }))
    : [];
  return { channels };
}

module.exports = {
  SECURITY_HEADERS,
  FALLBACK_AGENTS,
  FALLBACK_CHANNEL_TYPES,
  apiHeaders,
  buildAuthHeaders,
  buildFallbackAgents,
  buildFallbackServices,
  buildSkillPromptFromPayload,
  sanitizeState,
};
