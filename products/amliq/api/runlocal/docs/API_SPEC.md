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
