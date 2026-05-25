/**
 * OpsGenie alert channel
 *
 * Creates alerts in OpsGenie using Alerts API.
 */

import type {
  AlertChannel,
  AlertMessage,
  AlertResult,
  OpsGenieChannelConfig,
} from '../types.js';

/**
 * Map our severity to OpsGenie priority
 */
function mapOpsGeniePriority(severity: string): 'P1' | 'P2' | 'P3' | 'P4' | 'P5' {
  switch (severity) {
    case 'critical':
      return 'P1';
    case 'high':
      return 'P2';
    case 'medium':
      return 'P3';
    case 'low':
    default:
      return 'P4';
  }
}

/**
 * Build OpsGenie alert payload
 */
function buildOpsGeniePayload(message: AlertMessage): string {
  const priority = mapOpsGeniePriority(message.severity);

  // Build finding details
  const findingDescriptions = message.findings
    .slice(0, 5)
    .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.resourceType}/${f.resourceId}`)
    .join('\n');

  const payload = {
    message: message.title,
    alias: `opensyber-${message.id}`,
    description: message.description,
    priority,
    source: message.account || 'OpenSyber',
    tags: [
      'security',
      'opensyber',
      message.severity,
      ...(message.organization ? [message.organization] : []),
    ],
    details: {
      severity: message.severity,
      findings_count: message.findings.length.toString(),
      findings: findingDescriptions,
      organization: message.organization || 'N/A',
      timestamp: message.timestamp,
      dashboard_url: message.dashboardUrl || 'N/A',
    },
    entity: message.organization || 'Security',
  };

  return JSON.stringify(payload);
}

/**
 * Get OpsGenie API endpoint
 */
function getOpsGenieEndpoint(region: 'us' | 'eu'): string {
  const endpoints = {
    us: 'https://api.opsgenie.com/v2/alerts',
    eu: 'https://api.eu.opsgenie.com/v2/alerts',
  };
  return endpoints[region];
}

/**
 * OpsGenie alert channel implementation
 */
export const opsgenieChannel: AlertChannel = {
  async send(
    message: AlertMessage,
    config: OpsGenieChannelConfig,
  ): Promise<AlertResult> {
    if (!config.apiKey) {
      return {
        success: false,
        error: 'OpsGenie API key not configured',
      };
    }

    try {
      const region = config.region || 'us';
      const endpoint = getOpsGenieEndpoint(region);
      const payload = buildOpsGeniePayload(message);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          error: `OpsGenie API error: ${response.status} ${body}`,
        };
      }

      const data = await response.json() as { result: string; alertId: string };

      return {
        success: data.result === 'created' || data.result === 'success',
        externalId: data.alertId,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send OpsGenie alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  validate(config: OpsGenieChannelConfig): { valid: boolean; error?: string } {
    if (config.type !== 'opsgenie') {
      return { valid: false, error: 'Invalid channel type' };
    }

    if (!config.apiKey) {
      return { valid: false, error: 'API key is required' };
    }

    // OpsGenie API keys start with specific prefixes
    const validPrefixes = ['eb3aa', '20f92', '54b0e'];
    const hasValidPrefix = validPrefixes.some((prefix) =>
      config.apiKey.startsWith(prefix),
    );

    if (!hasValidPrefix && config.apiKey.length < 20) {
      return {
        valid: false,
        error: 'Invalid API key format',
      };
    }

    if (config.region && !['us', 'eu'].includes(config.region)) {
      return { valid: false, error: 'Region must be "us" or "eu"' };
    }

    return { valid: true };
  },
};
