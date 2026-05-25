import React, { useState } from 'react';

interface User {
  name?: string;
  email?: string;
  avatar?: string;
}

interface SettingsPageProps {
  user: User;
  onUpdate: (data: Record<string, unknown>) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');

  const containerStyle: React.CSSProperties = {
    padding: '24px',
    maxWidth: '800px',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    borderBottom: '1px solid #E5E5EA',
    marginBottom: '24px',
  };

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    color: active ? '#007AFF' : '#8E8E93',
    borderBottom: active ? '2px solid #007AFF' : 'none',
    transition: 'color 0.2s',
  });

  const tabContentStyle: React.CSSProperties = {
    padding: '20px 0',
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#000000',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #E5E5EA',
    borderRadius: '8px',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  return (
    <div style={containerStyle} data-testid="settings-page">
      <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>Settings</h1>

      <div style={tabsStyle} data-testid="tabs">
        <button
          style={tabButtonStyle(activeTab === 'profile')}
          onClick={() => setActiveTab('profile')}
          data-testid="tab-profile"
        >
          Profile
        </button>
        <button
          style={tabButtonStyle(activeTab === 'security')}
          onClick={() => setActiveTab('security')}
          data-testid="tab-security"
        >
          Security
        </button>
        <button
          style={tabButtonStyle(activeTab === 'notifications')}
          onClick={() => setActiveTab('notifications')}
          data-testid="tab-notifications"
        >
          Notifications
        </button>
      </div>

      <div style={tabContentStyle} data-testid={`content-${activeTab}`}>
        {activeTab === 'profile' && (
          <div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                defaultValue={user.name || ''}
                style={inputStyle}
                data-testid="input-name"
              />
            </div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                defaultValue={user.email || ''}
                style={inputStyle}
                data-testid="input-email"
              />
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Current Password</label>
              <input
                type="password"
                style={inputStyle}
                data-testid="input-current-pwd"
              />
            </div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                style={inputStyle}
                data-testid="input-new-pwd"
              />
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <div style={formGroupStyle}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" data-testid="notify-email" />
                Email Notifications
              </label>
            </div>
            <div style={formGroupStyle}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" data-testid="notify-sms" />
                SMS Notifications
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

SettingsPage.displayName = 'SettingsPage';
