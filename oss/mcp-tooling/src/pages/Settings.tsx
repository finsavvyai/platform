import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  User,
  Mail,
  LogOut,
  Save,
  Settings as SettingsIcon,
  Bell,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { UserPreferences, ActivityItem } from '../types/database'

export function Settings() {
  const {
    user,
    signOut,
    updateProfile,
    updatePassword,
    updatePreferences,
    deleteAccount,
    getUserActivity,
  } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'activity'>(
    'profile'
  )
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Profile state
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '')

  // Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'light',
    language: 'en',
    notifications: {
      email_notifications: true,
      job_completion: true,
      deployment_status: true,
      usage_alerts: false,
    },
    default_auth_mode: 'none',
    default_runtime: 'worker-ts',
  })

  // Activity state
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)

  const loadActivityData = useCallback(async () => {
    setLoadingActivities(true)
    try {
      const userActivities = await getUserActivity()
      setActivities(userActivities)
    } catch (error) {
      console.error('Failed to load activity:', error)
    } finally {
      setLoadingActivities(false)
    }
  }, [getUserActivity])

  useEffect(() => {
    // Load saved preferences from user metadata
    if (user?.user_metadata?.preferences) {
      setPreferences(prev => ({ ...prev, ...user.user_metadata.preferences }))
    }

    // Load activity data
    loadActivityData()
  }, [user, getUserActivity])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await updateProfile({
        display_name: displayName,
        avatar_url: avatarUrl,
      })

      if (result.success) {
        showMessage('success', result.message)
      } else {
        showMessage('error', result.message)
      }
    } catch {
      showMessage('error', 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      showMessage('error', 'Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      const result = await updatePassword(newPassword)

      if (result.success) {
        showMessage('success', result.message)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        showMessage('error', result.message)
      }
    } catch {
      showMessage('error', 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const handlePreferencesUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await updatePreferences(preferences)

      if (result.success) {
        showMessage('success', result.message)
      } else {
        showMessage('error', result.message)
      }
    } catch {
      showMessage('error', 'Failed to update preferences')
    } finally {
      setLoading(false)
    }
  }

  const handleAccountDeletion = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showMessage('error', 'Please type DELETE to confirm account deletion')
      return
    }

    setLoading(true)

    try {
      const result = await deleteAccount()

      if (result.success) {
        showMessage('success', result.message)
        setTimeout(() => navigate('/'), 2000)
      } else {
        showMessage('error', result.message)
      }
    } catch {
      showMessage('error', 'Failed to delete account')
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
      setDeleteConfirmText('')
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'connector_created':
      case 'connector_updated':
        return <User className="h-4 w-4" />
      case 'job_completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      {message && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-lg p-4 ${
            message.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'security', label: 'Security', icon: Shield },
              { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
              { id: 'activity', label: 'Activity', icon: Activity },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as 'profile' | 'security' | 'preferences' | 'activity')
                }
                className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile Information</h2>

              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your display name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Avatar URL</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>

              <div className="border-t pt-6">
                <h3 className="text-md mb-4 font-semibold text-gray-900">Account Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </label>
                    <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-900">
                      {user?.email}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">User ID</label>
                    <div className="rounded-lg bg-gray-50 px-4 py-2 font-mono text-sm text-gray-900">
                      {user?.id}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Clock className="h-4 w-4" />
                      Account Created
                    </label>
                    <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-900">
                      {user?.created_at ? formatDate(user.created_at) : 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Security Settings</h2>

              <div>
                <h3 className="text-md mb-4 font-medium text-gray-900">Change Password</h3>
                <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !newPassword || !confirmPassword}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-md mb-4 font-semibold text-red-600">Danger Zone</h3>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>

                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </button>
                  ) : (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <h4 className="mb-2 font-semibold text-red-800">Confirm Account Deletion</h4>
                      <p className="mb-4 text-sm text-red-700">
                        This action cannot be undone. This will permanently delete your account and
                        all associated data.
                      </p>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={e => setDeleteConfirmText(e.target.value)}
                          className="w-full rounded-lg border border-red-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-red-500"
                          placeholder='Type "DELETE" to confirm'
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={handleAccountDeletion}
                            disabled={loading || deleteConfirmText !== 'DELETE'}
                            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            {loading ? 'Deleting...' : 'Delete Account'}
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteConfirm(false)
                              setDeleteConfirmText('')
                            }}
                            className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 transition-colors hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSignOut}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {loading ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">User Preferences</h2>

              <form onSubmit={handlePreferencesUpdate} className="space-y-6">
                <div>
                  <h3 className="text-md mb-4 font-medium text-gray-900">Appearance</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Theme</label>
                      <select
                        value={preferences.theme}
                        onChange={e =>
                          setPreferences(prev => ({
                            ...prev,
                            theme: e.target.value as 'light' | 'dark' | 'system',
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Language
                      </label>
                      <select
                        value={preferences.language}
                        onChange={e =>
                          setPreferences(prev => ({ ...prev, language: e.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md mb-4 flex items-center gap-2 font-medium text-gray-900">
                    <Bell className="h-4 w-4" />
                    Notifications
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(preferences.notifications).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={e =>
                            setPreferences(prev => ({
                              ...prev,
                              notifications: {
                                ...prev.notifications,
                                [key]: e.target.checked,
                              },
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm capitalize text-gray-700">
                          {key.replace(/_/g, ' ')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-md mb-4 font-medium text-gray-900">Default Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Default Authentication Mode
                      </label>
                      <select
                        value={preferences.default_auth_mode}
                        onChange={e =>
                          setPreferences(prev => ({
                            ...prev,
                            default_auth_mode: e.target.value as
                              | 'api_key'
                              | 'oauth_client'
                              | 'oauth_code'
                              | 'jwt'
                              | 'none',
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">None</option>
                        <option value="api_key">API Key</option>
                        <option value="oauth_client">OAuth Client</option>
                        <option value="oauth_code">OAuth Code</option>
                        <option value="jwt">JWT</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Default Runtime
                      </label>
                      <select
                        value={preferences.default_runtime}
                        onChange={e =>
                          setPreferences(prev => ({
                            ...prev,
                            default_runtime: e.target.value as
                              | 'worker-ts'
                              | 'worker-go'
                              | 'download-only',
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="worker-ts">TypeScript Worker</option>
                        <option value="worker-go">Go Worker</option>
                        <option value="download-only">Download Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </form>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Activity className="h-5 w-5" />
                Recent Activity
              </h2>

              {loadingActivities ? (
                <div className="py-8 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading activity...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="py-8 text-center">
                  <Activity className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <p className="text-gray-600">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map(activity => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 rounded-lg bg-gray-50 p-4"
                    >
                      <div className="mt-0.5 flex-shrink-0">{getActivityIcon(activity.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
