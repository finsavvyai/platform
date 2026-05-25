import { useState, useEffect } from 'react';
import { Shield, Users, Check, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface ConnectionPermissionsProps {
  connectionId: string;
  connectionName: string;
  onClose: () => void;
}

interface Permission {
  id: string;
  user_id: string;
  email?: string;
  environment_access: {
    development?: string;
    uat?: string;
    production?: string;
  };
  can_execute_queries: boolean;
  can_modify_schema: boolean;
  can_delete_data: boolean;
}

const ENVIRONMENTS = ['development', 'uat', 'production'];
const ACCESS_TYPES = ['none', 'read', 'write'];

export function ConnectionPermissions({ connectionId, connectionName, onClose }: ConnectionPermissionsProps) {
  const { theme } = useTheme();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    loadPermissions();
  }, [connectionId]);

  const loadPermissions = async () => {
    const { data } = await supabase
      .from('connection_permissions')
      .select('*')
      .eq('connection_id', connectionId);

    if (data) {
      setPermissions(data);
    }
  };

  const handleAddUser = async () => {
    if (!userEmail.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('connection_permissions')
      .insert({
        connection_id: connectionId,
        user_id: userEmail,
        environment_access: {
          development: 'write',
          uat: 'write',
          production: 'read',
        },
        can_execute_queries: true,
        can_modify_schema: false,
        can_delete_data: false,
        granted_by: user.id,
      });

    if (!error) {
      setShowAddUser(false);
      setUserEmail('');
      loadPermissions();
    }
  };

  const handleUpdatePermission = async (permissionId: string, field: string, value: any) => {
    await supabase
      .from('connection_permissions')
      .update({ [field]: value })
      .eq('id', permissionId);

    loadPermissions();
  };

  const handleUpdateEnvironmentAccess = async (permissionId: string, env: string, access: string) => {
    const permission = permissions.find(p => p.id === permissionId);
    if (!permission) return;

    const newAccess = {
      ...permission.environment_access,
      [env]: access,
    };

    await supabase
      .from('connection_permissions')
      .update({ environment_access: newAccess })
      .eq('id', permissionId);

    loadPermissions();
  };

  const handleRemovePermission = async (permissionId: string) => {
    if (!confirm('Remove access for this user?')) return;

    await supabase
      .from('connection_permissions')
      .delete()
      .eq('id', permissionId);

    loadPermissions();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-5xl h-[85vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                Connection Permissions
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {connectionName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full glass-morphism hover-3d transition-all"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <button
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 px-4 py-2 mb-6 text-white rounded-lg font-medium"
            style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
          >
            <Users className="w-4 h-4" />
            Add User
          </button>

          <div className="space-y-4">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className="p-6 rounded-xl glass-card border"
                style={{ borderColor: theme.colors.border }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                      {permission.email || permission.user_id.substring(0, 8)}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleRemovePermission(permission.id)}
                    className="p-2 rounded-lg glass-morphism hover:opacity-80"
                  >
                    <X className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
                      Environment Access
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {ENVIRONMENTS.map((env) => (
                        <div key={env} className="p-3 rounded-lg glass-card">
                          <label className="block text-xs font-medium mb-2 capitalize" style={{ color: theme.colors.text }}>
                            {env}
                            {env === 'production' && (
                              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: '#dc262620', color: '#dc2626' }}>
                                PROD
                              </span>
                            )}
                          </label>
                          <select
                            value={permission.environment_access[env as keyof typeof permission.environment_access] || 'none'}
                            onChange={(e) => handleUpdateEnvironmentAccess(permission.id, env, e.target.value)}
                            className="w-full px-2 py-1 rounded text-xs glass-card border outline-none"
                            style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                          >
                            <option value="none">No Access</option>
                            <option value="read">Read Only</option>
                            <option value="write">Read & Write</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
                      Permissions
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 p-3 rounded-lg glass-card cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permission.can_execute_queries}
                          onChange={(e) => handleUpdatePermission(permission.id, 'can_execute_queries', e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-xs" style={{ color: theme.colors.text }}>
                          Execute Queries
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-3 rounded-lg glass-card cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permission.can_modify_schema}
                          onChange={(e) => handleUpdatePermission(permission.id, 'can_modify_schema', e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-xs" style={{ color: theme.colors.text }}>
                          Modify Schema
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-3 rounded-lg glass-card cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permission.can_delete_data}
                          onChange={(e) => handleUpdatePermission(permission.id, 'can_delete_data', e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-xs" style={{ color: theme.colors.text }}>
                          Delete Data
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {permissions.length === 0 && (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 mx-auto mb-3 opacity-50" style={{ color: theme.colors.textSecondary }} />
                <p style={{ color: theme.colors.textSecondary }}>
                  No permissions configured yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
          <div className="relative w-full max-w-md glass-card rounded-2xl shadow-2xl p-6" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: theme.colors.text }}>
              Add User Access
            </h3>

            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="User email or ID"
              className="w-full px-3 py-2 rounded-lg glass-card border outline-none mb-4"
              style={{ borderColor: theme.colors.border, color: theme.colors.text }}
            />

            <div className="p-3 rounded-lg glass-card mb-4">
              <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                Default permissions:
              </p>
              <ul className="text-xs space-y-1" style={{ color: theme.colors.text }}>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3" style={{ color: '#10b981' }} />
                  Development & UAT: Read & Write
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3" style={{ color: '#10b981' }} />
                  Production: Read Only
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3" style={{ color: '#10b981' }} />
                  Can execute queries
                </li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddUser(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={!userEmail.trim()}
                className="flex-1 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
