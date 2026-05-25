/**
 * PagerDuty alert channel
 *
 * Creates incidents in PagerDuty using Events API v2.
 */

import type {
  AlertChannel,
  AlertMessage,
  AlertResult,
  PagerDutyChannelConfig,
} from '../types.js';

/**
 * Map our severity to PagerDuty severity
 */
function mapPagerDutySeverity(severity: string): 'critical' | 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    default:
      return 'info';
  }
}

/**
 * Map our severity to PagerDuty event action
 * All alerts that reach the channel should trigger incidents.
 * Severity filtering is handled by the dispatcher's meetsMinSeverity.
 */
function getEventAction(): 'trigger' {
  return 'trigger';
}

/**
 * Build PagerDuty Events API v2 payload
 */
function buildPagerDutyPayload(message: AlertMessage, dedupKey?: string): string {
  const pdSeverity = mapPagerDutySeverity(message.severity);
  const action = getEventAction();

  // Build finding details
  let findingDetails = message.findings
    .slice(0, 3)
    .map((f) => `• [${f.severity.toUpperCase()}] ${f.title}\n  Resource: ${f.resourceType}/${f.resourceId}`)
    .join('\n');

  if (message.findings.length > 3) {
    findingDetails += `\n• ... and ${message.findings.length - 3} more`;
  }

  const payload = {
    routing_key: '', // Will be set from config
    event_action: action,
    dedup_key: dedupKey,
    payload: {
      summary: message.title,
      source: message.account || 'OpenSyber',
      severity: pdSeverity,
      timestamp: message.timestamp,
      component: 'Security Platform',
      group: message.organization || 'Security',
      custom_details: {
        description: message.description,
        findings_count: message.findings.length,
        findings: findingDetails,
        severity: message.severity,
        dashboard_url: message.dashboardUrl || '',
      },
    },
    client: 'OpenSyber Security',
    client_url: message.dashboardUrl,
  };

  return JSON.stringify(payload);
}

/**
 * Get PagerDuty API endpoint
 */
function getPagerDutyEndpoint(region: 'us' | 'eu'): string {
  const endpoints = {
    us: 'https://events.pagerduty.com/v2/enqueue',
    eu: 'https://events.eu.pagerduty.com/v2/enqueue',
  };
  return endpoints[region];
}

/**
 * PagerDuty alert channel implementation
 */
export const pagerdutyChannel: AlertChannel = {
  async send(
    message: AlertMessage,
    config: PagerDutyChannelConfig,
  ): Promise<AlertResult> {
    if (!config.integrationKey) {
      return {
        success: false,
        error: 'PagerDuty integration key not configured',
      };
    }

    try {
      const region = config.region || 'us';
      const endpoint = getPagerDutyEndpoint(region);
      const dedupKey = `opensyber-${message.id}`;
      const payloadJson = buildPagerDutyPayload(message, dedupKey);
      const payload = JSON.parse(payloadJson);
      payload.routing_key = config.integrationKey;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          error: `PagerDuty API error: ${response.status} ${body}`,
        };
      }

      const data = await response.json() as { dedup_key: string; status: string };

      return {
        success: data.status === 'success' || response.status === 202,
        externalId: data.dedup_key,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send PagerDuty alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  validate(config: PagerDutyChannelConfig): { valid: boolean; error?: string } {
    if (config.type !== 'pagerduty') {
      return { valid: false, error: 'Invalid channel type' };
    }

    if (!config.integrationKey) {
      return { valid: false, error: 'Integration key is required' };
    }

    // PagerDuty integration keys start with specific prefixes
    const validPrefixes = ['R', 'P']; // Routing key, PagerDuty integration
    const hasValidPrefix = validPrefixes.some((prefix) =>
      config.integrationKey.startsWith(prefix),
    );

    if (!hasValidPrefix) {
      return {
        valid: false,
        error: 'Invalid integration key format',
      };
    }

    if (config.region && !['us', 'eu'].includes(config.region)) {
      return { valid: false, error: 'Region must be "us" or "eu"' };
    }

    return { valid: true };
  },
};
