import type { Permission, RbacEvaluator, RoleDefinition, Subject } from "./types.js";

export class StaticRbac implements RbacEvaluator {
  private readonly roleMap: ReadonlyMap<string, ReadonlySet<Permission>>;

  constructor(roles: readonly RoleDefinition[]) {
    const map = new Map<string, ReadonlySet<Permission>>();
    for (const role of roles) {
      map.set(role.name, new Set(role.permissions));
    }
    this.roleMap = map;
  }

  can(subject: Subject, permission: Permission): boolean {
    for (const role of subject.roles) {
      const perms = this.roleMap.get(role);
      if (perms?.has(permission)) return true;
    }
    return false;
  }

  rolesWithPermission(permission: Permission): readonly string[] {
    const out: string[] = [];
    for (const [role, perms] of this.roleMap.entries()) {
      if (perms.has(permission)) out.push(role);
    }
    return out;
  }
}
