export {
  FALCO_RULES,
  getFalcoRule,
  rulesBySeverity,
  isValidMitreTechnique,
} from './falco-rules.js';
export type { FalcoRule, FalcoSeverity } from './falco-rules.js';

export {
  buildFalcoConfig,
  activeRuleNames,
  falcoConfigSchema,
} from './falco-config.js';
export type { FalcoConfigInput, FalcoConfigOptions } from './falco-config.js';

export {
  buildOsqueryConfig,
  parseOsqueryConfig,
  osqueryConfigSchema,
  SCHEDULED_QUERIES,
  REQUIRED_QUERY_NAMES,
} from './osquery-config.js';
export type {
  OsqueryConfigInput,
  OsqueryConfigOptions,
} from './osquery-config.js';

export { buildWazuhAgentConfig, wazuhConfigSchema } from './wazuh-config.js';
export type { WazuhConfigInput, WazuhConfigOptions } from './wazuh-config.js';
