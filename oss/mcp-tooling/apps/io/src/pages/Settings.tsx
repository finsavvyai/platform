import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 font-mono">
                {user?.id}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-900">
                {user?.email}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Created</label>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-900">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }) : 'Unknown'}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h2>
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" />
            {loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
