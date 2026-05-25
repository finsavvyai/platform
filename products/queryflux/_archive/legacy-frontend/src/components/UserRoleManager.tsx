import React, { useState } from 'react';
import { Users, Shield, Key, Plus, Trash2, CreditCard as Edit2, Lock, Unlock, CheckCircle, XCircle } from 'lucide-react';

interface DatabaseUser {
  id: string;
  username: string;
  roles: string[];
  canLogin: boolean;
  connectionLimit: number;
  validUntil?: Date;
  superuser: boolean;
  createDB: boolean;
  createRole: boolean;
  replication: boolean;
  bypassRLS: boolean;
}

interface DatabaseRole {
  id: string;
  name: string;
  privileges: Privilege[];
  members: string[];
  inherits: boolean;
  canLogin: boolean;
  description?: string;
}

interface Privilege {
  database?: string;
  schema?: string;
  table?: string;
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER' | 'ALL';
  grantable: boolean;
}

interface UserRoleManagerProps {
  users: DatabaseUser[];
  roles: DatabaseRole[];
  databases: string[];
  onCreateUser?: (user: Partial<DatabaseUser>) => Promise<void>;
  onUpdateUser?: (userId: string, updates: Partial<DatabaseUser>) => Promise<void>;
  onDeleteUser?: (userId: string) => Promise<void>;
  onCreateRole?: (role: Partial<DatabaseRole>) => Promise<void>;
  onGrantPrivilege?: (roleId: string, privilege: Privilege) => Promise<void>;
  onRevokePrivilege?: (roleId: string, privilege: Privilege) => Promise<void>;
}

export function UserRoleManager({
  users,
  roles,
  databases,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onCreateRole,
  onGrantPrivilege,
  onRevokePrivilege,
}: UserRoleManagerProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newUser, setNewUser] = useState<Partial<DatabaseUser>>({
    username: '',
    canLogin: true,
    connectionLimit: -1,
    superuser: false,
    createDB: false,
    createRole: false,
    replication: false,
    bypassRLS: false,
    roles: [],
  });
  const [newRole, setNewRole] = useState<Partial<DatabaseRole>>({
    name: '',
    privileges: [],
    members: [],
    inherits: true,
    canLogin: false,
  });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const handleCreateUser = async () => {
    if (!onCreateUser || !newUser.username) return;

    try {
      await onCreateUser(newUser);
      setIsCreatingUser(false);
      setNewUser({
        username: '',
        canLogin: true,
        connectionLimit: -1,
        superuser: false,
        createDB: false,
        createRole: false,
        replication: false,
        bypassRLS: false,
        roles: [],
      });
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleCreateRole = async () => {
    if (!onCreateRole || !newRole.name) return;

    try {
      await onCreateRole(newRole);
      setIsCreatingRole(false);
      setNewRole({
        name: '',
        privileges: [],
        members: [],
        inherits: true,
        canLogin: false,
      });
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!onDeleteUser) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete user "${username}"? This action cannot be undone.`
    );

    if (confirmed) {
      try {
        await onDeleteUser(userId);
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  const handleToggleUserStatus = async (user: DatabaseUser) => {
    if (!onUpdateUser) return;

    try {
      await onUpdateUser(user.id, { canLogin: !user.canLogin });
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">User & Role Manager</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage database users, roles, and permissions
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'roles'
              ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Roles ({roles.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Database Users</h3>
              {onCreateUser && (
                <button
                  onClick={() => setIsCreatingUser(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create User
                </button>
              )}
            </div>

            {isCreatingUser && (
              <div className="mb-6 p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Create New User</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      placeholder="john_doe"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Connection Limit
                    </label>
                    <input
                      type="number"
                      value={newUser.connectionLimit}
                      onChange={(e) =>
                        setNewUser({ ...newUser, connectionLimit: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">-1 for unlimited</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Valid Until
                    </label>
                    <input
                      type="datetime-local"
                      onChange={(e) =>
                        setNewUser({ ...newUser, validUntil: new Date(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newUser.canLogin}
                        onChange={(e) => setNewUser({ ...newUser, canLogin: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Can Login
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newUser.superuser}
                        onChange={(e) => setNewUser({ ...newUser, superuser: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Superuser
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newUser.createDB}
                        onChange={(e) => setNewUser({ ...newUser, createDB: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Create Database
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newUser.createRole}
                        onChange={(e) => setNewUser({ ...newUser, createRole: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Create Role
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newUser.replication}
                        onChange={(e) => setNewUser({ ...newUser, replication: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Replication
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newUser.bypassRLS}
                        onChange={(e) => setNewUser({ ...newUser, bypassRLS: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Bypass RLS
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleCreateUser}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    Create User
                  </button>
                  <button
                    onClick={() => setIsCreatingUser(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {user.username}
                        </h4>
                        {user.superuser && (
                          <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
                            SUPERUSER
                          </span>
                        )}
                        {user.canLogin ? (
                          <CheckCircle className="w-4 h-4 text-green-500" title="Can login" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" title="Cannot login" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <strong>Roles:</strong> {user.roles.join(', ') || 'None'}
                        </div>
                        <div>
                          <strong>Connection Limit:</strong>{' '}
                          {user.connectionLimit === -1 ? 'Unlimited' : user.connectionLimit}
                        </div>
                        {user.validUntil && (
                          <div>
                            <strong>Valid Until:</strong> {user.validUntil.toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {user.createDB && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                            CREATE DB
                          </span>
                        )}
                        {user.createRole && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                            CREATE ROLE
                          </span>
                        )}
                        {user.replication && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded">
                            REPLICATION
                          </span>
                        )}
                        {user.bypassRLS && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                            BYPASS RLS
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onUpdateUser && (
                        <button
                          onClick={() => handleToggleUserStatus(user)}
                          className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={user.canLogin ? 'Disable login' : 'Enable login'}
                        >
                          {user.canLogin ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      )}
                      {onDeleteUser && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Database Roles</h3>
              {onCreateRole && (
                <button
                  onClick={() => setIsCreatingRole(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Role
                </button>
              )}
            </div>

            {isCreatingRole && (
              <div className="mb-6 p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Create New Role</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Role Name *
                    </label>
                    <input
                      type="text"
                      value={newRole.name}
                      onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                      placeholder="app_readonly"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newRole.description}
                      onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                      placeholder="Read-only access to application tables"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newRole.inherits}
                        onChange={(e) => setNewRole({ ...newRole, inherits: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Inherits privileges from member roles
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newRole.canLogin}
                        onChange={(e) => setNewRole({ ...newRole, canLogin: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Can Login
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleCreateRole}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    Create Role
                  </button>
                  <button
                    onClick={() => setIsCreatingRole(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {role.name}
                        </h4>
                      </div>

                      {role.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {role.description}
                        </p>
                      )}

                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <strong>Members:</strong> {role.members.join(', ') || 'None'}
                        </div>
                        <div>
                          <strong>Privileges:</strong> {role.privileges.length} granted
                        </div>
                      </div>
                    </div>
                  </div>

                  {role.privileges.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Granted Privileges:
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {role.privileges.map((priv, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded"
                          >
                            {priv.type} on {priv.table || priv.schema || priv.database || 'ALL'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
