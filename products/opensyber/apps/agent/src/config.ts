export interface AgentConfig {
  instanceId: string;
  apiBaseUrl: string;
  gatewayToken: string;
  healthCheckIntervalMs: number;
  securityScanIntervalMs: number;
  auditBatchIntervalMs: number;
  engineGatewayUrl: string;
  engineConfigDir: string;
  /** Ed25519 public JWK (JSON string) used to verify skill package signatures. */
  skillSigningPublicKey?: string;
}

export function loadConfig(): AgentConfig {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  };

  return {
    instanceId: required('OPENSYBER_INSTANCE_ID'),
    apiBaseUrl: process.env.OPENSYBER_API_URL || 'https://api.opensyber.cloud',
    gatewayToken: required('OPENSYBER_GATEWAY_TOKEN'),
    healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '60000', 10),
    securityScanIntervalMs: parseInt(process.env.SECURITY_SCAN_INTERVAL_MS || '30000', 10),
    auditBatchIntervalMs: parseInt(process.env.AUDIT_BATCH_INTERVAL_MS || '300000', 10),
    engineGatewayUrl: process.env.SYBER_ENGINE_GATEWAY_URL || 'http://127.0.0.1:18789',
    engineConfigDir: process.env.SYBER_ENGINE_CONFIG_DIR || `${process.env.HOME}/.syber-engine`,
    skillSigningPublicKey: process.env.SKILL_SIGNING_PUBLIC_KEY,
  };
}
