/**
 * Agent Activity Discoverer
 *
 * Extracts assets and relations from agent activity records (file reads, bash commands).
 */
import type { DiscoveryResult, AgentActivityRecord } from './types.js';
import type { DiscoveredAsset, DiscoveredRelation } from './types.js';
import { classifyFileSensitivity, classifyEnvVarSensitivity, isCrownJewelCandidate } from './sensitivity-rules.js';

const ENV_VAR_PATTERN = /\b([A-Z][A-Z0-9_]{2,})=(\S+)/g;
const DB_URL_PATTERN = /(postgres|mysql|mongodb|redis):\/\/[^@]*@([^/:]+)/i;

export function discoverFromActivity(
  sessionId: string,
  agentName: string,
  activities: AgentActivityRecord[],
): DiscoveryResult {
  const assets: DiscoveredAsset[] = [];
  const relations: DiscoveredRelation[] = [];
  const seen = new Set<string>();

  // Add agent session as entry point
  const sessionKey = `agent_session:${sessionId}`;
  if (!seen.has(sessionKey)) {
    seen.add(sessionKey);
    assets.push({
      assetType: 'agent_session',
      name: `${agentName} session`,
      identifier: sessionId,
      sensitivity: 'medium',
      discoverySource: 'agent_activity',
      metadata: { agent: agentName },
    });
  }

  for (const activity of activities) {
    if (activity.type === 'file_read' && activity.path) {
      addFileAsset(activity.path, sessionId, assets, relations, seen);
    }
    if (activity.type === 'bash_exec') {
      extractFromCommand(activity.summary, sessionId, assets, relations, seen);
    }
    if (activity.secretsCount > 0 && activity.path) {
      addSecretAsset(activity.path, sessionId, assets, relations, seen);
    }
  }

  return { assets, relations };
}

function addFileAsset(
  path: string, sessionId: string,
  assets: DiscoveredAsset[], relations: DiscoveredRelation[], seen: Set<string>,
): void {
  const key = `file:${path}`;
  if (seen.has(key)) return;
  seen.add(key);
  assets.push({
    assetType: 'file',
    name: path.split('/').pop() || path,
    identifier: path,
    sensitivity: classifyFileSensitivity(path),
    isCrownJewel: isCrownJewelCandidate(path),
    discoverySource: 'agent_activity',
  });
  relations.push({
    sourceIdentifier: sessionId,
    targetIdentifier: path,
    relationType: 'read_access',
    confidence: 1.0,
    discoverySource: 'agent_activity',
  });
}

function addSecretAsset(
  path: string, sessionId: string,
  assets: DiscoveredAsset[], relations: DiscoveredRelation[], seen: Set<string>,
): void {
  const secretKey = `secret:${path}`;
  if (seen.has(secretKey)) return;
  seen.add(secretKey);
  assets.push({
    assetType: 'secret',
    name: `Secret in ${path.split('/').pop()}`,
    identifier: `secret:${path}`,
    sensitivity: 'critical',
    isCrownJewel: true,
    discoverySource: 'agent_activity',
  });
  relations.push({
    sourceIdentifier: sessionId,
    targetIdentifier: `secret:${path}`,
    relationType: 'secret_access',
    confidence: 0.9,
    discoverySource: 'agent_activity',
  });
}

function extractFromCommand(
  summary: string, sessionId: string,
  assets: DiscoveredAsset[], relations: DiscoveredRelation[], seen: Set<string>,
): void {
  // Extract env vars from command output
  for (const match of summary.matchAll(ENV_VAR_PATTERN)) {
    const envName = match[1] ?? '';
    const envValue = match[2] ?? '';
    if (!envName) continue;
    const envKey = `env_var:${envName}`;
    if (seen.has(envKey)) continue;
    seen.add(envKey);
    assets.push({
      assetType: 'env_var',
      name: envName,
      identifier: envName,
      sensitivity: classifyEnvVarSensitivity(envName),
      discoverySource: 'agent_activity',
    });
    relations.push({
      sourceIdentifier: sessionId,
      targetIdentifier: envName,
      relationType: 'read_access',
      confidence: 0.8,
      discoverySource: 'agent_activity',
    });
    // Check if env var contains a DB URL
    const dbMatch = envValue.match(DB_URL_PATTERN);
    if (dbMatch) {
      const dbHost = dbMatch[2] ?? '';
      if (!dbHost) continue;
      const dbKey = `database:${dbHost}`;
      if (!seen.has(dbKey)) {
        seen.add(dbKey);
        assets.push({
          assetType: 'database',
          name: dbHost,
          identifier: dbHost,
          sensitivity: 'high',
          discoverySource: 'inferred',
        });
        relations.push({
          sourceIdentifier: envName,
          targetIdentifier: dbHost,
          relationType: 'authenticates_to',
          confidence: 0.7,
          discoverySource: 'inferred',
        });
      }
    }
  }
}
