# Extraction Plan

## Goal

Create a clean, shared agent runtime that multiple products can consume without coupling product control planes together.

Primary source of ideas:
- local research repo `claw-code-main`

Primary first consumer:
- PushCI

## Extract

- conversation/session runtime
- tool definitions and registry
- internal server API for sessions and streaming
- provider abstraction
- product-specific toolpacks

## Do Not Extract

- brand-specific CLI compatibility
- editor integration compatibility layers
- product-specific auth flows
- product-specific database schemas
- product-specific webhook logic

## PushCI Boundary

PushCI keeps ownership of:
- users, orgs, projects, runs, jobs, artifacts
- webhook verification
- runner scheduling and execution
- billing and product entitlements

Agent Platform owns:
- model orchestration
- tool loop
- session state
- streaming events
- tenant and toolpack routing

## OpenSyber Boundary

OpenSyber keeps ownership of:
- security controls
- compliance policy
- vaulting
- behavioral telemetry
- audit model

Agent Platform can power:
- shared agent execution runtime
- shared model/provider abstraction
- shared session lifecycle

## Provenance Rules

- treat `claw-code-main` as an internal research input
- rewrite public/shared code into product-neutral modules
- avoid dragging product branding and compatibility surfaces into this workspace
- perform legal/provenance review before publishing any extracted repo

## Rollout

1. Scaffold neutral runtime repo
2. Integrate PushCI as first tenant
3. Deploy privately on Render
4. Route PushCI Worker AI endpoints to the private service
5. Add OpenSyber as second tenant after contracts stabilize

