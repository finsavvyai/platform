import { describe, it, expect, beforeEach } from 'vitest';
import { AuthUser } from '../src/types';
import {
  hasPermission,
  buildPermissionString,
  parsePermissionString,
  filterResourcesByPermission,
  getEffectivePermissions,
} from '../src/rbac/permissions';
import {
  getRoleConfig,
  getInheritedRoles,
  getAllRolePermissions,
  isRoleHigherThan,
  getPermissionsForRole,
} from '../src/rbac/roles';

describe('RBAC Permissions', () => {
  let adminUser: AuthUser;
  let regularUser: AuthUser;
  let guestUser: AuthUser;

  beforeEach(() => {
    adminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      permissions: [],
    };

    regularUser = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      permissions: [],
    };

    guestUser = {
      id: 'guest-1',
      email: 'guest@example.com',
      role: 'guest',
      permissions: [],
    };
  });

  describe('hasPermission', () => {
    it('should grant admin all permissions', () => {
      expect(hasPermission(adminUser, 'users', 'delete')).toBe(true);
      expect(hasPermission(adminUser, 'system', 'admin')).toBe(true);
      expect(hasPermission(adminUser, 'any', 'any')).toBe(true);
    });

    it('should grant user read and write permissions', () => {
      expect(hasPermission(regularUser, 'documents', 'read')).toBe(true);
      expect(hasPermission(regularUser, 'documents', 'write')).toBe(true);
      expect(hasPermission(regularUser, 'documents', 'create')).toBe(true);
    });

    it('should deny user delete permission', () => {
      expect(hasPermission(regularUser, 'users', 'delete')).toBe(false);
    });

    it('should grant guest read-only permission', () => {
      expect(hasPermission(guestUser, 'documents', 'read')).toBe(true);
    });

    it('should deny guest write permission', () => {
      expect(hasPermission(guestUser, 'documents', 'write')).toBe(false);
    });

    it('should check explicit permissions', () => {
      const userWithPermission = {
        ...regularUser,
        permissions: ['articles:publish'],
      };
      expect(hasPermission(userWithPermission, 'articles', 'publish')).toBe(
        true
      );
    });

    it('should support wildcard permissions', () => {
      const userWithWildcard = { ...regularUser, permissions: ['*:*'] };
      expect(hasPermission(userWithWildcard, 'anything', 'anything')).toBe(true);
    });

    it('should return false for undefined user', () => {
      expect(hasPermission(undefined as unknown as AuthUser, 'test', 'read')).toBe(
        false
      );
    });
  });

  describe('Permission helpers', () => {
    it('should build permission strings', () => {
      const perm = buildPermissionString('documents', 'read');
      expect(perm).toBe('documents:read');
    });

    it('should parse permission strings', () => {
      const parsed = parsePermissionString('documents:read');
      expect(parsed.resource).toBe('documents');
      expect(parsed.action).toBe('read');
    });

    it('should filter resources by permission', () => {
      const resources = ['documents', 'users', 'settings'];
      const filtered = filterResourcesByPermission(regularUser, resources, 'read');
      expect(filtered).toContain('documents');
      expect(filtered).toContain('settings');
    });

    it('should get effective permissions for user', () => {
      const perms = getEffectivePermissions(regularUser);
      expect(perms.has('documents:read')).toBe(true);
      expect(perms.has('users:delete')).toBe(false);
    });

    it('should include explicit permissions in effective set', () => {
      const userWithPerm = {
        ...regularUser,
        permissions: ['custom:action'],
      };
      const perms = getEffectivePermissions(userWithPerm);
      expect(perms.has('custom:action')).toBe(true);
    });
  });

  describe('Role hierarchy', () => {
    it('should get role config', () => {
      const config = getRoleConfig('admin');
      expect(config.name).toBe('admin');
      expect(config.permissions.size).toBeGreaterThan(0);
    });

    it('should throw error for unknown role', () => {
      expect(() => getRoleConfig('unknown' as any)).toThrow();
    });

    it('should get inherited roles', () => {
      const inherited = getInheritedRoles('user');
      expect(inherited).toContain('guest');
    });

    it('should return empty array for admin inherited roles', () => {
      const inherited = getInheritedRoles('admin');
      expect(inherited).toEqual([]);
    });

    it('should get all role permissions including inherited', () => {
      const perms = getAllRolePermissions('user');
      expect(perms.has('documents:read')).toBe(true);
      expect(perms.has('public:read')).toBe(true);
    });

    it('should compare role hierarchy', () => {
      expect(isRoleHigherThan('admin', 'user')).toBe(true);
      expect(isRoleHigherThan('user', 'guest')).toBe(true);
      expect(isRoleHigherThan('guest', 'user')).toBe(false);
      expect(isRoleHigherThan('admin', 'admin')).toBe(false);
    });

    it('should get permissions for role as array', () => {
      const perms = getPermissionsForRole('admin');
      expect(Array.isArray(perms)).toBe(true);
      expect(perms.length).toBeGreaterThan(0);
    });
  });

  describe('Complex permission scenarios', () => {
    it('should handle resource-specific permissions', () => {
      const user = { ...regularUser, permissions: ['articles:publish'] };
      expect(hasPermission(user, 'articles', 'publish')).toBe(true);
      expect(hasPermission(user, 'articles', 'delete')).toBe(false);
    });

    it('should support resource-level wildcards', () => {
      const user = { ...regularUser, permissions: ['reports:*'] };
      expect(hasPermission(user, 'reports', 'read')).toBe(true);
      expect(hasPermission(user, 'reports', 'create')).toBe(true);
    });

    it('should prioritize explicit permissions over role defaults', () => {
      const user = {
        ...guestUser,
        permissions: ['documents:write'],
      };
      expect(hasPermission(user, 'documents', 'write')).toBe(true);
    });
  });
});
