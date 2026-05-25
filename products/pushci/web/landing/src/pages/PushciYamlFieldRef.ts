// Field reference for pushci.yml. Mirrors internal/config/config.go —
// every option listed here so the guide's reference table is
// exhaustive. New fields MUST be added here at the same time as the
// Go struct, otherwise the docs silently drift.
//
// Separated from PushciYamlGuideData.ts so both files stay under the
// portfolio 200-line cap. The guide page imports from both.

export interface FieldRef {
  path: string
  type: string
  description: string
  example?: string
}

export const fieldReference: FieldRef[] = [
  {
    path: 'on',
    type: '[]string',
    description:
      'Events that trigger this pipeline. Valid values: push, pull_request, workflow_dispatch, schedule.',
    example: 'on: [push, pull_request]',
  },
  {
    path: 'stages',
    type: '[]Stage',
    description:
      'Ordered list of stages. Each stage is a named group of checks. ' +
      'Stages run sequentially unless depends_on creates a DAG.',
  },
  {
    path: 'stages[].name',
    type: 'string',
    description: 'Unique stage identifier. Used by depends_on to wire the DAG.',
  },
  {
    path: 'stages[].dir',
    type: 'string',
    description: 'Working directory for every check in this stage (relative to repo root).',
    example: 'dir: apps/web',
  },
  {
    path: 'stages[].depends_on',
    type: '[]string',
    description:
      'Other stages that must pass before this one runs. Any unresolved dependency marks the stage as skipped.',
    example: 'depends_on: [install, lint]',
  },
  {
    path: 'stages[].only_on',
    type: '[]string',
    description:
      'Branch filter. Stage runs only when the current git branch matches one of the listed names or patterns.',
    example: 'only_on: [main, release/*]',
  },
  {
    path: 'stages[].parallel',
    type: 'bool',
    description:
      'When true, all checks inside the stage run concurrently. Default is sequential.',
  },
  {
    path: 'stages[].env',
    type: 'map[string]string',
    description: 'Environment variables shared by every check in the stage.',
    example: 'env:\n  NODE_ENV: test',
  },
  {
    path: 'stages[].retry',
    type: 'int',
    description: 'Number of times to retry the entire stage on failure before giving up.',
  },
  {
    path: 'stages[].retry_until',
    type: 'string',
    description:
      "Retry-until condition. Common values: 'success', or a shell expression evaluated between retries.",
  },
  {
    path: 'stages[].timeout',
    type: 'duration',
    description:
      'Hard wall-clock limit for the entire stage. Go duration syntax: 30s, 5m, 1h30m.',
  },
  {
    path: 'stages[].on_failure',
    type: '[]string',
    description:
      'Names of stages to run if this stage fails. Useful for cleanup or notification branches.',
  },
  {
    path: 'stages[].approve',
    type: 'bool',
    description:
      'Pause before running and require interactive approval. Useful for pre-production gates.',
  },
  {
    path: 'stages[].checks',
    type: '[]Check',
    description: 'The actual commands to run inside the stage.',
  },
  {
    path: 'stages[].checks[].name',
    type: 'string',
    description: 'Human-readable check name shown in logs.',
  },
  {
    path: 'stages[].checks[].run',
    type: 'string',
    description:
      'Shell command to execute. Multi-line values are supported via YAML block scalars (|).',
    example: 'run: |\n  npm ci\n  npm test',
  },
  {
    path: 'stages[].checks[].docker',
    type: 'string',
    description:
      'Docker image to run the command inside. When set, the command runs in an isolated container.',
    example: 'docker: node:20-alpine',
  },
  {
    path: 'stages[].checks[].if',
    type: 'string',
    description:
      'Expression that must evaluate truthy for this check to run. Supports branch, env, and previous step outputs.',
    example: "if: branch == 'main'",
  },
  {
    path: 'stages[].checks[].retry',
    type: 'int',
    description: 'Per-check retry count. Overrides stage-level retry for this check only.',
  },
  {
    path: 'stages[].checks[].on_fail',
    type: 'string',
    description:
      'Behavior when the check fails. Values: fail (default), warn (log but do not fail stage), skip.',
  },
  {
    path: 'stages[].checks[].line-limit',
    type: 'int',
    description: 'Maximum output lines to capture before truncating. Default is unlimited.',
  },
  {
    path: 'deploy',
    type: 'Deploy',
    description: 'Deploy block. Runs after every stage passes unless gated by trigger/approve.',
  },
  {
    path: 'deploy.trigger',
    type: 'string',
    description:
      "When to run the deploy block. Values: push (webhook only, default), manual (only `pushci deploy`), always. " +
      "`push` is the safe default that prevents silent prod deploys from local `pushci run`.",
  },
  {
    path: 'deploy.run',
    type: 'string',
    description:
      'Single-target deploy command. Use environments[] instead for multi-stage staged deploys.',
  },
  {
    path: 'deploy.environments[]',
    type: '[]Environment',
    description: 'Staged deploy: each environment runs in sequence with its own approval gate.',
  },
  {
    path: 'deploy.environments[].approve',
    type: 'bool',
    description:
      'Require interactive approval before executing this environment. Use on production.',
  },
  {
    path: 'notify.slack',
    type: 'string',
    description: 'Slack webhook URL. Posts run summary on pass/fail.',
  },
  {
    path: 'notify.discord',
    type: 'string',
    description: 'Discord webhook URL.',
  },
  {
    path: 'notify.email',
    type: 'string',
    description: 'Email address to receive run summaries.',
  },
  {
    path: 'notify.telegram',
    type: 'string',
    description: 'Telegram bot token + chat ID (format: bot_token:chat_id).',
  },
  {
    path: 'notify.webhook',
    type: 'string',
    description: 'Generic webhook URL. Payload is JSON-encoded run summary.',
  },
]
