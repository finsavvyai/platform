import { useState, useEffect } from 'react';
import { X, User, Bell, Shield, Trash2, Save, Database, Key } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const { theme } = useTheme();
  const [userEmail, setUserEmail] = useState('');
  const [preferences, setPreferences] = useState({
    audio_enabled: true,
    default_query_limit: 1000,
    auto_save_enabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUserData();
      loadPreferences();
    }
  }, [isOpen]);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || '');
    }
  };

  const loadPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPreferences({
        audio_enabled: data.audio_enabled,
        default_query_limit: data.default_query_limit,
        auto_save_enabled: data.auto_save_enabled,
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...preferences,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all query history? This cannot be undone.')) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('query_executions')
      .delete()
      .eq('user_id', user.id);

    alert('Query history cleared successfully');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-2xl glass-card rounded-3xl shadow-2xl" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                Settings
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Manage your account and preferences
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

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: theme.colors.text }}>
              <User className="w-4 h-4" />
              Account
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: theme.colors.textSecondary }}>
                  Email
                </label>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="w-full px-3 py-2 rounded-lg glass-card border outline-none opacity-60"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: theme.colors.text }}>
              <Bell className="w-4 h-4" />
              Preferences
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg glass-card cursor-pointer">
                <div>
                  <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                    Audio Feedback
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                    Play sounds on query execution
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.audio_enabled}
                  onChange={(e) => setPreferences({ ...preferences, audio_enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg glass-card cursor-pointer">
                <div>
                  <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                    Auto-Save Queries
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                    Automatically save query tabs
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.auto_save_enabled}
                  onChange={(e) => setPreferences({ ...preferences, auto_save_enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
              </label>

              <div>
                <label className="block text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                  Default Query Limit
                </label>
                <input
                  type="number"
                  value={preferences.default_query_limit}
                  onChange={(e) => setPreferences({ ...preferences, default_query_limit: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  min="1"
                  max="10000"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: theme.colors.text }}>
              <Database className="w-4 h-4" />
              Data Management
            </h3>
            <button
              onClick={handleClearHistory}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              <Trash2 className="w-4 h-4" />
              Clear Query History
            </button>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-medium transition-all"
              style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-3 rounded-lg font-medium transition-all"
              style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
