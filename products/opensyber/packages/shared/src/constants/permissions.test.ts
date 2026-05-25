import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
} from './permissions.js';
import { ROLES } from './roles.js';
import type { Role } from './roles.js';
import type { Permission } from './permissions.js';

const ALL_ROLES = Object.values(ROLES) as Role[];
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

/** View-only permissions that every role should have. */
const VIEW_PERMISSIONS: Permission[] = [
  'instance.view',
  'skill.view',
  'policy.view',
  'incident.view',
  'alert.view',
  'compliance.view',
  'member.view',
  'billing.view',
  'audit.view',
  'cloud.read',
  'agent.policy.read',
  'marketplace.browse',
  'sla.view',
  'saas.read',
];

describe('PERMISSIONS', () => {
  it('defines 52 permissions', () => {
    expect(Object.keys(PERMISSIONS)).toHaveLength(52);
  });

  it('key equals value for every permission', () => {
    for (const [key, value] of Object.entries(PERMISSIONS)) {
      expect(key).toBe(value);
    }
  });
});

describe('owner permissions', () => {
  it('has ALL permissions', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(hasPermission('owner', perm)).toBe(true);
    }
  });
});

describe('viewer permissions', () => {
  it('has all view permissions', () => {
    for (const perm of VIEW_PERMISSIONS) {
      expect(hasPermission('viewer', perm)).toBe(true);
    }
  });

  it('is denied all write permissions', () => {
    const writePerms = ALL_PERMISSIONS.filter(
      (p) => !VIEW_PERMISSIONS.includes(p),
    );
    for (const perm of writePerms) {
      expect(hasPermission('viewer', perm)).toBe(false);
    }
  });
});

describe('all roles have view permissions', () => {
  for (const role of ALL_ROLES) {
    it(`${role} has all view permissions`, () => {
      for (const perm of VIEW_PERMISSIONS) {
        expect(hasPermission(role, perm)).toBe(true);
      }
    });
  }
});

describe('owner-only permissions', () => {
  it('billing.manage is owner-only', () => {
    expect(hasPermission('owner', 'billing.manage')).toBe(true);
    expect(hasPermission('admin', 'billing.manage')).toBe(false);
    expect(hasPermission('security', 'billing.manage')).toBe(false);
    expect(hasPermission('developer', 'billing.manage')).toBe(false);
    expect(hasPermission('viewer', 'billing.manage')).toBe(false);
  });

  it('org.delete is owner-only', () => {
    expect(hasPermission('owner', 'org.delete')).toBe(true);
    expect(hasPermission('admin', 'org.delete')).toBe(false);
    expect(hasPermission('security', 'org.delete')).toBe(false);
    expect(hasPermission('developer', 'org.delete')).toBe(false);
    expect(hasPermission('viewer', 'org.delete')).toBe(false);
  });
});

describe('developer permissions', () => {
  it('can create and restart instances', () => {
    expect(hasPermission('developer', 'instance.create')).toBe(true);
    expect(hasPermission('developer', 'instance.restart')).toBe(true);
    expect(hasPermission('developer', 'instance.update')).toBe(true);
  });

  it('cannot delete instances', () => {
    expect(hasPermission('developer', 'instance.delete')).toBe(false);
  });

  it('can install and uninstall skills', () => {
    expect(hasPermission('developer', 'skill.install')).toBe(true);
    expect(hasPermission('developer', 'skill.uninstall')).toBe(true);
  });

  it('cannot manage policies or incidents', () => {
    expect(hasPermission('developer', 'policy.create')).toBe(false);
    expect(hasPermission('developer', 'policy.update')).toBe(false);
    expect(hasPermission('developer', 'incident.create')).toBe(false);
    expect(hasPermission('developer', 'incident.update')).toBe(false);
  });

  it('cannot manage members', () => {
    expect(hasPermission('developer', 'member.invite')).toBe(false);
    expect(hasPermission('developer', 'member.remove')).toBe(false);
    expect(hasPermission('developer', 'member.changeRole')).toBe(false);
  });
});

describe('security permissions', () => {
  it('can manage policies and incidents', () => {
    expect(hasPermission('security', 'policy.create')).toBe(true);
    expect(hasPermission('security', 'policy.update')).toBe(true);
    expect(hasPermission('security', 'policy.delete')).toBe(true);
    expect(hasPermission('security', 'incident.create')).toBe(true);
    expect(hasPermission('security', 'incident.update')).toBe(true);
    expect(hasPermission('security', 'incident.assign')).toBe(true);
  });

  it('can manage alerts', () => {
    expect(hasPermission('security', 'alert.create')).toBe(true);
    expect(hasPermission('security', 'alert.update')).toBe(true);
    expect(hasPermission('security', 'alert.delete')).toBe(true);
  });

  it('can export audit logs', () => {
    expect(hasPermission('security', 'audit.export')).toBe(true);
  });

  it('cannot create or manage instances', () => {
    expect(hasPermission('security', 'instance.create')).toBe(false);
    expect(hasPermission('security', 'instance.delete')).toBe(false);
    expect(hasPermission('security', 'instance.restart')).toBe(false);
  });

  it('cannot manage members', () => {
    expect(hasPermission('security', 'member.invite')).toBe(false);
    expect(hasPermission('security', 'member.remove')).toBe(false);
  });
});

describe('admin permissions', () => {
  it('can manage instances', () => {
    expect(hasPermission('admin', 'instance.create')).toBe(true);
    expect(hasPermission('admin', 'instance.delete')).toBe(true);
    expect(hasPermission('admin', 'instance.restart')).toBe(true);
  });

  it('can manage members', () => {
    expect(hasPermission('admin', 'member.invite')).toBe(true);
    expect(hasPermission('admin', 'member.remove')).toBe(true);
    expect(hasPermission('admin', 'member.changeRole')).toBe(true);
  });

  it('can update org settings', () => {
    expect(hasPermission('admin', 'org.update')).toBe(true);
  });

  it('cannot delete org or manage billing', () => {
    expect(hasPermission('admin', 'org.delete')).toBe(false);
    expect(hasPermission('admin', 'billing.manage')).toBe(false);
  });
});

describe('ROLE_PERMISSIONS sets', () => {
  it('every role has a defined permission set', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_PERMISSIONS[role]).toBeInstanceOf(Set);
    }
  });

  it('permission sets are subsets (viewer < developer < admin < owner)', () => {
    const viewerPerms = ROLE_PERMISSIONS.viewer;
    const devPerms = ROLE_PERMISSIONS.developer;
    const adminPerms = ROLE_PERMISSIONS.admin;

    for (const p of viewerPerms) {
      expect(devPerms.has(p)).toBe(true);
    }
    for (const p of devPerms) {
      expect(adminPerms.has(p)).toBe(true);
    }
  });
});
