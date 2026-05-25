# PushCI REST API Specification

Base URL: `https://api.pushci.dev/v1`

## Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/github | OAuth callback, returns JWT |
| POST | /auth/gitlab | OAuth callback, returns JWT |
| GET | /auth/me | Current user profile |

## Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /orgs | List user's orgs |
| POST | /orgs | Create org |
| GET | /orgs/:id | Get org details |
| PATCH | /orgs/:id | Update org |
| DELETE | /orgs/:id | Delete org (owner only) |
| GET | /orgs/:id/members | List members |
| POST | /orgs/:id/members | Invite member |
| PATCH | /orgs/:id/members/:uid | Change role |
| DELETE | /orgs/:id/members/:uid | Remove member |

## Project Governance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /governance/projects | Create project and bootstrap creator as maintainer |
| POST | /governance/projects/bootstrap | Claim maintainer access for an existing project with no memberships yet |
| GET | /governance/projects/:id/access | Current caller's project role and effective policies |
| GET | /governance/projects/:id/memberships | List project memberships |
| POST | /governance/projects/:id/memberships | Upsert project membership |
| GET | /governance/projects/:id/policies | List effective deploy policies |
| PUT | /governance/projects/:id/policies/:environment | Update deploy policy for environment |
| POST | /governance/projects/:id/deploy-requests | Create deploy request and run policy checks |
| GET | /governance/deploy-requests/:id | Fetch deploy request |
| POST | /governance/deploy-requests/:id/approve | Record manual deploy approval |
| POST | /governance/deploy-requests/:id/execute | Queue approved deploy request |

## Repositories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /orgs/:id/repos | List connected repos |
| POST | /orgs/:id/repos/connect | Connect repo (installs webhook) |
| GET | /repos/:id | Get repo details |
| DELETE | /repos/:id | Disconnect repo |

## Pipelines
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /repos/:id/pipelines | List pipelines |
| POST | /repos/:id/pipelines | Create pipeline |
| GET | /pipelines/:id | Get pipeline + YAML |
| PUT | /pipelines/:id | Update pipeline YAML |
| DELETE | /pipelines/:id | Delete pipeline |

## Runs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /repos/:id/runs | List runs (filter: status, branch) |
| GET | /runs/:id | Get run details |
| POST | /runs/:id/rerun | Re-trigger run |
| POST | /runs/:id/cancel | Cancel run |

## Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /runs/:id/jobs | List jobs for run |
| GET | /jobs/:id | Get job + steps |

## Runners
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /orgs/:id/runners/register | Register runner |
| GET | /orgs/:id/runners | List runners |
| GET | /runners/:id | Runner details |
| DELETE | /runners/:id | Deregister runner |
| POST | /runners/heartbeat | Heartbeat (runner-token auth) |
| POST | /runners/poll | Poll for job (runner-token auth) |

## Secrets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /repos/:id/secrets | List keys (values hidden) |
| POST | /repos/:id/secrets | Create secret |
| PUT | /secrets/:id | Update value |
| DELETE | /secrets/:id | Delete secret |
| GET | /orgs/:id/secrets | List org-level secrets |
| POST | /orgs/:id/secrets | Create org-level secret |

## Deployments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /repos/:id/environments | List environments |
| POST | /repos/:id/environments | Create environment |
| GET | /envs/:id/deployments | List deployments |
| POST | /envs/:id/deploy | Trigger deploy from run |

Production deploys should be driven through the governance endpoints above so PushCI can enforce:
- project-scoped deploy permissions
- required review counts
- manual approval gates
- protected-branch requirements
- separation of duties between author, approver, and deployer

## Logs, Artifacts, Webhooks & More
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /jobs/:id/logs | Stream logs (SSE) or full text |
| GET | /runs/:id/artifacts | List artifacts |
| GET | /artifacts/:id/download | Download artifact |
| POST | /runs/:id/artifacts | Upload artifact (multipart) |
| POST | /webhooks/github | GitHub push/PR events |
| POST | /webhooks/gitlab | GitLab push/MR events |
| POST | /webhooks/bitbucket | Bitbucket push/PR events |
| GET | /orgs/:id/audit-logs | Audit log entries |
| GET | /orgs/:id/usage | Usage summary for billing period |
| GET | /orgs/:id/notifications | List notification channels |
| POST | /orgs/:id/notifications | Create notification channel |
| DELETE | /notifications/:id | Remove notification channel |

## AI Recommendation (Public — No Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/recommend | Get CI/CD recommendations with cost savings analysis. Params: `runs` (int), `minutes` (int), `tool` (string) |
| GET | /api/recommend/compare/:tool | Side-by-side feature comparison (github-actions, gitlab-ci, circleci, jenkins, travis-ci, buildkite) |

## AI Promotion (Public — No Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/promote | Register PushCI with AI registries (Smithery, mcp.so, Glama), ping search engines (Google, Bing, IndexNow), verify all AI discovery endpoints |

## AI Auto-Remediation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/remediate/audit | AI-audit a pipeline YAML for security and performance issues |
| POST | /api/remediate/fix | Apply AI-suggested fixes to pipeline YAML |
| POST | /api/remediate/diagnose | AI-diagnose a pipeline failure with context |

## Autofix
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/autofix/root-cause | Deep failure analysis using AI |
| POST | /api/autofix/suggest-fix | Generate fix suggestions from root cause |
| POST | /api/autofix/create-pr | Create auto-fix PR with patches |
| POST | /api/autofix/check-update | Detect if pipeline needs updates |
| POST | /api/autofix/apply-update | Apply detected pipeline updates |

## NLP (Natural Language Pipeline)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/nlp/ask | Natural language CI/CD command processor. Supports: run_pipeline, deploy, diagnose_failure, show_status, update_config, manage_secret, optimize_pipeline, fix_pipeline, generate_pipeline, heal_pipeline |

## AI Gateway
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/ai/generate-pipeline | AI-generate pipeline YAML using Claude with tool use |
| POST | /api/ai/explain-failure | AI-diagnose CI failure with root cause analysis |
| POST | /api/ai/convert-actions | Convert GitHub Actions YAML to PushCI format |
