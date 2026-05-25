import type { ProjectMembership, ProjectRole } from "./types";

export type ProjectPermission =
  | "view_runs"
  | "trigger_run"
  | "cancel_run"
  | "deploy"
  | "approve_gate"
  | "manage_project_users"
  | "manage_policies";

const rolePermissions: Record<ProjectRole, ProjectPermission[]> = {
  admin: ["view_runs", "trigger_run", "cancel_run", "deploy", "approve_gate", "manage_project_users", "manage_policies"],
  maintainer: ["view_runs", "trigger_run", "cancel_run", "deploy", "approve_gate", "manage_project_users", "manage_policies"],
  release_manager: ["view_runs", "trigger_run", "cancel_run", "deploy"],
  deploy_approver: ["view_runs", "trigger_run", "approve_gate"],
  developer: ["view_runs", "trigger_run", "cancel_run"],
  viewer: ["view_runs"],
  auditor: ["view_runs"],
};

const roleValues = new Set<ProjectRole>([
  "admin",
  "maintainer",
  "release_manager",
  "deploy_approver",
  "developer",
  "viewer",
  "auditor",
]);

export function isProjectRole(value: string): value is ProjectRole {
  return roleValues.has(value as ProjectRole);
}

export function normalizeEnvironments(environments: unknown): string[] {
  if (!Array.isArray(environments)) return [];
  const values = environments
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return [...new Set(values)];
}

export function environmentAllowed(membership: ProjectMembership, environment: string): boolean {
  const normalized = environment.trim().toLowerCase();
  if (!normalized || membership.environments.length === 0) {
    return true;
  }
  return membership.environments.includes(normalized);
}

export function hasProjectPermission(
  membership: ProjectMembership | null,
  environment: string,
  permission: ProjectPermission
): boolean {
  if (!membership) return false;
  if (!environmentAllowed(membership, environment)) return false;
  return rolePermissions[membership.role].includes(permission);
}

export function canViewProject(membership: ProjectMembership | null): boolean {
  return hasProjectPermission(membership, "", "view_runs");
}

export function canDeploy(membership: ProjectMembership | null, environment: string): boolean {
  return hasProjectPermission(membership, environment, "deploy");
}

export function canApproveGate(membership: ProjectMembership | null, environment: string): boolean {
  return hasProjectPermission(membership, environment, "approve_gate");
}

export function canManageMemberships(membership: ProjectMembership | null): boolean {
  return hasProjectPermission(membership, "", "manage_project_users");
}

export function canManagePolicies(membership: ProjectMembership | null): boolean {
  return hasProjectPermission(membership, "", "manage_policies");
}

export function canTriggerRun(membership: ProjectMembership | null): boolean {
  return hasProjectPermission(membership, "", "trigger_run");
}

export function canCancelRun(membership: ProjectMembership | null): boolean {
  return hasProjectPermission(membership, "", "cancel_run");
}
