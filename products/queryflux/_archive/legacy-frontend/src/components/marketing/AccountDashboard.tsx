import { useState } from 'react';
import { User, CreditCard, Settings, Download, LogOut, Shield, Bell, RefreshCw, ChevronRight, Check, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function AccountDashboard() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');

  // Mock user data - in real app, this would come from API
  const user = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    plan: 'Professional',
    status: 'active',
    memberSince: '2024-01-15',
    nextBilling: '2025-02-15',
    usage: {
      queries: 245,
      databases: 8,
      teamMembers: 3,
      aiSuggestions: 89
    },
    limits: {
      queries: 500,
      databases: 20,
      teamMembers: 5,
      aiSuggestions: 500
    }
  };

  const subscriptionPlans = [
    {
      name: 'Starter',
      price: '$0',
      features: ['3 databases', '100 queries/month', 'Basic support'],
      current: false
    },
    {
      name: 'Professional',
      price: '$19/month',
      features: ['20 databases', '500 queries/month', 'AI suggestions', 'Priority support'],
      current: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      features: ['Unlimited everything', 'Advanced security', 'Dedicated support'],
      current: false
    }
  ];

  const recentActivity = [
    { action: 'Query executed', database: 'PostgreSQL - Production', time: '2 hours ago' },
    { action: 'Database connected', database: 'MySQL - Staging', time: '1 day ago' },
    { action: 'Query saved', database: 'PostgreSQL - Production', time: '3 days ago' },
    { action: 'Team member invited', database: '-', time: '1 week ago' }
  ];

  const renderOverview = () => (
    <div className="space-y-8">
      {/* User Info Card */}
      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-xl font-bold"
            style={{ color: theme.colors.text }}
          >
            Account Overview
          </h3>
          <button
            onClick={() => setActiveTab('settings')}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: theme.colors.background + '50', color: theme.colors.text }}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mr-4 text-white text-xl font-bold"
                style={{ backgroundColor: theme.colors.accent }}
              >
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h4
                  className="text-lg font-semibold"
                  style={{ color: theme.colors.text }}
                >
                  {user.name}
                </h4>
                <p
                  className="text-sm"
                  style={{ color: theme.colors.textSecondary }}
                >
                  {user.email}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: theme.colors.textSecondary }}>Plan:</span>
                <span
                  className="font-semibold"
                  style={{ color: theme.colors.accent }}
                >
                  {user.plan}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: theme.colors.textSecondary }}>Status:</span>
                <span className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span
                    className="font-semibold"
                    style={{ color: theme.colors.text }}
                  >
                    Active
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: theme.colors.textSecondary }}>Member since:</span>
                <span style={{ color: theme.colors.text }}>{user.memberSince}</span>
              </div>
            </div>
          </div>

          <div>
            <h4
              className="font-semibold mb-4"
              style={{ color: theme.colors.text }}
            >
              Usage Overview
            </h4>
            <div className="space-y-3">
              {Object.entries(user.usage).map(([key, value]) => {
                const limit = user.limits[key as keyof typeof user.limits];
                const percentage = (value / limit) * 100;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span
                        className="capitalize"
                        style={{ color: theme.colors.textSecondary }}
                      >
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span style={{ color: theme.colors.text }}>
                        {value} / {limit}
                      </span>
                    </div>
                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: theme.colors.background + '50' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: percentage > 80 ? '#EF4444' : theme.colors.accent
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
      >
        <h3
          className="text-xl font-bold mb-6"
          style={{ color: theme.colors.text }}
        >
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.location.href = '/download'}
            className="p-4 rounded-lg border text-left transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.background + '50',
              borderColor: theme.colors.border,
              color: theme.colors.text
            }}
          >
            <Download className="w-6 h-6 mb-2" style={{ color: theme.colors.accent }} />
            <h4 className="font-semibold mb-1">Download Apps</h4>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              Get desktop and VS Code versions
            </p>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className="p-4 rounded-lg border text-left transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.background + '50',
              borderColor: theme.colors.border,
              color: theme.colors.text
            }}
          >
            <CreditCard className="w-6 h-6 mb-2" style={{ color: theme.colors.accent }} />
            <h4 className="font-semibold mb-1">Manage Billing</h4>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              Update payment method or plan
            </p>
          </button>

          <button
            className="p-4 rounded-lg border text-left transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.background + '50',
              borderColor: theme.colors.border,
              color: theme.colors.text
            }}
          >
            <Shield className="w-6 h-6 mb-2" style={{ color: theme.colors.accent }} />
            <h4 className="font-semibold mb-1">Security Settings</h4>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              Manage password and 2FA
            </p>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
      >
        <h3
          className="text-xl font-bold mb-6"
          style={{ color: theme.colors.text }}
        >
          Recent Activity
        </h3>
        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg"
                 style={{ backgroundColor: theme.colors.background + '50' }}>
              <div>
                <h4
                  className="font-semibold"
                  style={{ color: theme.colors.text }}
                >
                  {activity.action}
                </h4>
                <p
                  className="text-sm"
                  style={{ color: theme.colors.textSecondary }}
                >
                  {activity.database}
                </p>
              </div>
              <span
                className="text-sm"
                style={{ color: theme.colors.textSecondary }}
              >
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-8">
      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
      >
        <h3
          className="text-xl font-bold mb-6"
          style={{ color: theme.colors.text }}
        >
          Subscription Plans
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionPlans.map((plan, index) => (
            <div
              key={index}
              className={`p-6 rounded-xl border-2 ${
                plan.current ? 'border-purple-500' : 'border-gray-200 dark:border-gray-700'
              }`}
              style={{ backgroundColor: theme.colors.background }}
            >
              {plan.current && (
                <div
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
                  style={{ backgroundColor: theme.colors.accent, color: 'white' }}
                >
                  Current Plan
                </div>
              )}
              <h4
                className="text-lg font-bold mb-2"
                style={{ color: theme.colors.text }}
              >
                {plan.name}
              </h4>
              <p
                className="text-2xl font-bold mb-4"
                style={{ color: theme.colors.accent }}
              >
                {plan.price}
              </p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center text-sm">
                    <Check className="w-4 h-4 mr-2 text-green-500" />
                    <span style={{ color: theme.colors.text }}>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={plan.current}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                  plan.current
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'text-white hover:scale-105'
                }`}
                style={{
                  backgroundColor: plan.current ? undefined : theme.colors.accent
                }}
              >
                {plan.current ? 'Current Plan' : 'Upgrade'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
      >
        <h3
          className="text-xl font-bold mb-6"
          style={{ color: theme.colors.text }}
        >
          Billing History
        </h3>
        <div className="space-y-4">
          {[
            { date: '2025-01-15', amount: '$19.00', status: 'Paid', plan: 'Professional' },
            { date: '2024-12-15', amount: '$19.00', status: 'Paid', plan: 'Professional' },
            { date: '2024-11-15', amount: '$19.00', status: 'Paid', plan: 'Professional' }
          ].map((payment, index) => (
            <div key={index} className="flex items-center justify-between p-4 rounded-lg"
                 style={{ backgroundColor: theme.colors.background + '50' }}>
              <div>
                <h4
                  className="font-semibold"
                  style={{ color: theme.colors.text }}
                >
                  {payment.plan} Plan
                </h4>
                <p
                  className="text-sm"
                  style={{ color: theme.colors.textSecondary }}
                >
                  {payment.date}
                </p>
              </div>
              <div className="text-right">
                <h4
                  className="font-semibold"
                  style={{ color: theme.colors.text }}
                >
                  {payment.amount}
                </h4>
                <p
                  className="text-sm flex items-center"
                  style={{ color: '#10B981' }}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  {payment.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-8">
      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
      >
        <h3
          className="text-xl font-bold mb-6"
          style={{ color: theme.colors.text }}
        >
          Account Settings
        </h3>
        <div className="space-y-6">
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: theme.colors.text }}
            >
              Name
            </label>
            <input
              type="text"
              defaultValue={user.name}
              className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{
                backgroundColor: theme.colors.background + '50',
                borderColor: theme.colors.border,
                color: theme.colors.text
              }}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: theme.colors.text }}
            >
              Email
            </label>
            <input
              type="email"
              defaultValue={user.email}
              className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{
                backgroundColor: theme.colors.background + '50',
                borderColor: theme.colors.border,
                color: theme.colors.text
              }}
            />
          </div>
        </div>
      </div>

      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
      >
        <h3
          className="text-xl font-bold mb-6"
          style={{ color: theme.colors.text }}
        >
          Notifications
        </h3>
        <div className="space-y-4">
          {[
            { label: 'Email notifications for billing', enabled: true },
            { label: 'Product updates and features', enabled: true },
            { label: 'Security alerts', enabled: true },
            { label: 'Weekly usage reports', enabled: false }
          ].map((setting, index) => (
            <div key={index} className="flex items-center justify-between">
              <span
                className="text-sm"
                style={{ color: theme.colors.text }}
              >
                {setting.label}
              </span>
              <button
                className={`w-12 h-6 rounded-full transition-colors ${
                  setting.enabled ? 'bg-purple-500' : 'bg-gray-300'
                }`}
                style={{ backgroundColor: setting.enabled ? theme.colors.accent : theme.colors.border }}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    setting.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: theme.colors.text }}
        >
          Account Dashboard
        </h1>
        <p
          className="text-lg"
          style={{ color: theme.colors.textSecondary }}
        >
          Manage your subscription, billing, and account settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-8 border-b mb-8" style={{ borderColor: theme.colors.border }}>
        {[
          { key: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
          { key: 'billing', label: 'Billing', icon: <CreditCard className="w-4 h-4" /> },
          { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center space-x-2 pb-4 border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-purple-500'
                : 'border-transparent hover:border-gray-300'
            }`}
            style={{
              borderBottomColor: activeTab === tab.key ? theme.colors.accent : 'transparent',
              color: activeTab === tab.key ? theme.colors.accent : theme.colors.textSecondary
            }}
          >
            {tab.icon}
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'billing' && renderBilling()}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </div>
  );
}
