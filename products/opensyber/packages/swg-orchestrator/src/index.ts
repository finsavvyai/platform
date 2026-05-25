export {
  SWG_CATEGORIES,
  getCategory,
  alwaysOnCategories,
  normaliseCategoryIds,
} from './categories.js';
export type { SwgCategory } from './categories.js';

export { buildSquidConfig } from './squid-config.js';
export type { SquidConfigOptions } from './squid-config.js';

export { buildE2guardianConfig, parseE2guardianConfig } from './e2guardian-config.js';
export type { E2guardianConfigOptions } from './e2guardian-config.js';

export {
  DLP_RULES,
  evaluateDlp,
  renderE2guardianRegexBody,
  luhnValid,
  ilIdValid,
  ibanValid,
} from './dlp-rules.js';
export type { DlpRule, DlpRuleId, DlpMatch } from './dlp-rules.js';

export {
  SHALLA_TARBALL_URL,
  BLACKWEB_REPO_URL,
  categoryListPath,
  parseSquidguardDomains,
  buildCategoryBlocklist,
} from './blocklist-builder.js';
export type { BlocklistSource } from './blocklist-builder.js';
