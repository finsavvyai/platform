# PushCI Project Governance

## Goal

Make deployment authority project-scoped and environment-aware so a random authenticated user cannot trigger production changes.

This document defines the baseline governance model for PushCI and the shared `agent-platform`.

## Role Model

Use project-scoped role bindings instead of one flat global role for every action.

### Org Roles

- `admin`
  - org-wide override
  - manage users, policies, secrets, environments
- `auditor`
  - read-only access to runs and audit data

### Project Roles

- `maintainer`
  - project settings, secrets, environment rules, policy management
  - may approve gates
  - may deploy where explicitly allowed
- `release_manager`
  - execute deployments for bound environments
  - cannot approve gates by default
- `deploy_approver`
  - approve deployment gates for bound environments
  - cannot execute deployments by default
- `developer`
  - run pipelines, inspect runs, update CI config
  - no production deploy permission by default
- `viewer`
  - read-only project visibility

## Deployment Rules

### Staging

- authenticated user must have a project binding with deploy permission
- tests must pass
- at least one review approval is recommended, and may be required by project policy

### Production

- deployer must have a project binding for `production`
- deployment approver must be a different actor than the deployer
- minimum two code review approvals by default
- branch must be protected
- secrets scan must be clean
- audit log entry is mandatory

This is the separation-of-duties model:

1. developer opens PR
2. reviewers approve code
3. `deploy_approver` approves production gate
4. `release_manager` executes the deployment

No single developer should both author and release to production unless there is an explicit break-glass policy.

## Code Review Enforcement

PushCI should not invent code review state on its own. It should ingest provider truth from GitHub or GitLab:

- PR approval count
- protected branch status
- merge status
- actor identity
- commit SHA tied to the reviewed PR

That metadata should populate the deployment `PolicyContext` before a deploy is accepted.

## Credentials and Connections

This is where `pipewarden` is useful as a reference:

- store provider and deploy credentials per project, not globally
- record scopes on save and re-test connections before use
- encrypt credentials at rest
- issue service-to-service tokens for internal callers
- audit every privileged action

Recommended credential split:

- user JWT: browser to PushCI edge/API
- service token: PushCI edge/core to `agent-platform`
- service token: `agent-platform` to PushCI internal APIs
- runner token: one runner identity, one org/project scope, short TTL

Never let the browser call deploy providers directly.

## Shared Agent Runtime Controls

`agent-platform` should never have implicit authority to deploy.

Safe model:

- browser talks to PushCI
- PushCI authenticates the user and checks project role bindings
- PushCI calls `agent-platform` with a service token and a scoped session context
- tool calls that mutate state require PushCI to authorize them again before execution

For example:

- `pushci.get_run_logs` can be allowed for developers
- `pushci.retry_run` can require maintainer or release manager
- `pushci.create_fix_pr` can require write access to the project
- `pushci.deploy` must require release-manager permission plus policy pass

## Immediate Implementation Priorities

1. protect `/api/nlp`, `/api/ai`, `/api/cloud`, `/api/autofix`, and `/api/pipeline` behind JWT auth
2. enforce service-token auth on `agent-platform`
3. move from flat roles to project role bindings
4. make production deploy policy require approvals plus separation of duties
5. add an audit log table for deploy requests, approvals, and executions
