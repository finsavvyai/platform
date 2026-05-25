import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ROLE_HIERARCHY,
  ROLE_LABELS,
  ASSIGNABLE_ROLES,
  isHigherRole,
} from './roles.js';
import type { Role } from './roles.js';

describe('ROLES', () => {
  it('defines exactly 5 roles', () => {
    expect(Object.keys(ROLES)).toHaveLength(5);
  });

  it('includes all expected roles', () => {
    expect(ROLES).toEqual({
      owner: 'owner',
      admin: 'admin',
      security: 'security',
      developer: 'developer',
      viewer: 'viewer',
    });
  });
});

describe('ROLE_HIERARCHY', () => {
  it('owner has the highest privilege', () => {
    const roles = Object.keys(ROLE_HIERARCHY) as Role[];
    for (const role of roles) {
      expect(ROLE_HIERARCHY.owner).toBeGreaterThanOrEqual(
        ROLE_HIERARCHY[role],
      );
    }
  });

  it('viewer has the lowest privilege', () => {
    const roles = Object.keys(ROLE_HIERARCHY) as Role[];
    for (const role of roles) {
      expect(ROLE_HIERARCHY.viewer).toBeLessThanOrEqual(
        ROLE_HIERARCHY[role],
      );
    }
  });

  it('follows strict ordering: owner > admin > security > developer > viewer', () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.security);
    expect(ROLE_HIERARCHY.security).toBeGreaterThan(ROLE_HIERARCHY.developer);
    expect(ROLE_HIERARCHY.developer).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });
});

describe('ROLE_LABELS', () => {
  it('provides a label for every role', () => {
    const roles = Object.values(ROLES) as Role[];
    for (const role of roles) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(typeof ROLE_LABELS[role]).toBe('string');
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });
});

describe('ASSIGNABLE_ROLES', () => {
  it('does not include owner', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('owner');
  });

  it('includes admin, security, developer, viewer', () => {
    expect(ASSIGNABLE_ROLES).toContain('admin');
    expect(ASSIGNABLE_ROLES).toContain('security');
    expect(ASSIGNABLE_ROLES).toContain('developer');
    expect(ASSIGNABLE_ROLES).toContain('viewer');
  });

  it('has exactly 4 roles', () => {
    expect(ASSIGNABLE_ROLES).toHaveLength(4);
  });
});

describe('isHigherRole', () => {
  it('owner is higher than all other roles', () => {
    expect(isHigherRole('owner', 'admin')).toBe(true);
    expect(isHigherRole('owner', 'security')).toBe(true);
    expect(isHigherRole('owner', 'developer')).toBe(true);
    expect(isHigherRole('owner', 'viewer')).toBe(true);
  });

  it('viewer is not higher than any role', () => {
    expect(isHigherRole('viewer', 'owner')).toBe(false);
    expect(isHigherRole('viewer', 'admin')).toBe(false);
    expect(isHigherRole('viewer', 'security')).toBe(false);
    expect(isHigherRole('viewer', 'developer')).toBe(false);
  });

  it('same role is not higher than itself', () => {
    const roles = Object.values(ROLES) as Role[];
    for (const role of roles) {
      expect(isHigherRole(role, role)).toBe(false);
    }
  });

  it('admin is higher than security but not owner', () => {
    expect(isHigherRole('admin', 'security')).toBe(true);
    expect(isHigherRole('admin', 'owner')).toBe(false);
  });
});
