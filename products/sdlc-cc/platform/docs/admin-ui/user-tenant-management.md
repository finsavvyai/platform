# Admin UI — User & Tenant Management

## Overview

The Admin UI now ships with dedicated workspaces for day-to-day user lifecycle operations and tenant provisioning. This page outlines the primary flows that have been implemented inside `services/admin-ui`.

## User Management (`/dashboard/users`)

- **Insight cards** summarise adoption metrics, active users, suspended accounts, and pending invites using live data from `useUserManagementStore`.
- **Advanced filters** allow operators to slice users by status, role, tenant, and free‑text search. Filters update the underlying store and re-fetch from the gateway.
- **Bulk actions** support activation, deactivation, deletion, and role reassignment. The panel issues a `BulkUserOperation` via the gateway and surfaces queue status to operators.
- **Onboarding wizard** provides a guided three-step workflow for inviting or pre-provisioning users, including tenant selection, role assignment, and invitation preferences.
- **Detail pages** (`/dashboard/users/[id]`) expose profile metadata, permissions, recent activity, and tenant usage context.

## Tenant Management (`/dashboard/tenants`)

- **Tenant insights** highlight adoption trends, active vs trial tenants, and growth rates derived from the fetched list.
- **Filter and search** streamline discovery across thousands of customers and align directly with the gateway’s query parameters.
- **Provisioning form** enables administrators to create new tenants, map initial admins, and pick a subscription plan with security defaults baked in.
- **Detail pages** (`/dashboard/tenants/[id]`) surface plan metadata, security configuration, billing contacts, and consumption snapshots for quota monitoring.

## Implementation Notes

- Shared state is consolidated in `useUserManagementStore`, which now encapsulates both user and tenant data, loading state, and API orchestration.
- API helpers live in `src/lib/user-management-api.ts` and wrap the gateway endpoints with query param normalisation.
- UI primitives (badge, checkbox, dropdown, select, pagination) were added under `src/components/ui` to support the new experiences.
- Components specific to users live under `src/components/users`, while tenant components reside in `src/components/tenants`.
- Integration tests cover the onboarding wizard validation (`src/components/users/__tests__/user-onboarding-wizard.test.tsx`); extend this suite as workflows evolve.

## Next Steps

1. Wire gateway endpoints to the new UI (mock data is currently expected to be replaced by live responses).
2. Expand activity telemetry to include audit log filters and export capabilities.
3. Layer in policy visualisations per tenant and expose drift detection from the policy engine.
4. Automate smoke tests for tenant provisioning and bulk operations once backend hooks are ready.
