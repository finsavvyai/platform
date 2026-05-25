/**
 * @amliq/brain-connectors public surface.
 *
 * Consumers (SEARCH-UI, SAR-AGENT) import only from this barrel so the
 * internal layout of slack/, confluence/, drive/ remains private.
 */
export * from "./types.js";
export {
  SlackConnector,
  type SlackClient,
  type SlackConnectorConfig,
  type SlackSearchMatch,
  type SlackSearchResponse,
  type SlackMessageResponse,
} from "./slack/slack-connector.js";
export {
  ConfluenceConnector,
  type ConfluenceConnectorConfig,
} from "./confluence/confluence-connector.js";
export {
  DriveConnector,
  type DriveConnectorConfig,
} from "./drive/drive-connector.js";
// Brain Month 3 mesh §8 — connector parity (Jira + Teams).
export {
  JiraConnector,
  type JiraAuthMode,
  type JiraConnectorConfig,
} from "./jira/jira-connector.js";
export { JiraRateLimitedError } from "./jira/jira-rate-limited-error.js";
export {
  TeamsConnector,
  type TeamsConnectorConfig,
} from "./teams/teams-connector.js";
export { TeamsRateLimitedError } from "./teams/teams-rate-limited-error.js";
