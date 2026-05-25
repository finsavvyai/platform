import type {
  SkillContext,
  SkillLogger,
  SkillHttpClient,
  SkillVaultClient,
  SkillEmitter,
  SkillFinding,
  SkillMetric,
  SkillAsset,
} from './types.js';

export interface CapturedOutputs {
  findings: SkillFinding[];
  metrics: SkillMetric[];
  assets: SkillAsset[];
  logs: { level: string; message: string; data?: Record<string, unknown> }[];
}

export function createMockContext(
  overrides: Partial<SkillContext> = {},
): { context: SkillContext; outputs: CapturedOutputs } {
  const outputs: CapturedOutputs = {
    findings: [],
    metrics: [],
    assets: [],
    logs: [],
  };

  const logger: SkillLogger = {
    info: (msg, data) => outputs.logs.push({ level: 'info', message: msg, data }),
    warn: (msg, data) => outputs.logs.push({ level: 'warn', message: msg, data }),
    error: (msg, data) => outputs.logs.push({ level: 'error', message: msg, data }),
  };

  const http: SkillHttpClient = {
    get: async () => new Response('{}'),
    post: async () => new Response('{}'),
  };

  const vault: SkillVaultClient = {
    getSecret: async () => null,
  };

  const emit: SkillEmitter = {
    finding: (f) => outputs.findings.push(f),
    metric: (m) => outputs.metrics.push(m),
    asset: (a) => outputs.assets.push(a),
  };

  const context: SkillContext = {
    orgId: 'org_test',
    userId: 'user_test',
    config: {},
    logger,
    http,
    vault,
    emit,
    ...overrides,
  };

  return { context, outputs };
}
