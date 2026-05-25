import React from 'react';
import { useAuth } from '../../context/AuthContext';

export function DashboardGreeting() {
  const { user } = useAuth();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const name = user?.email?.split('@')[0];

  return (
    <div className="mb-xxl">
      <h1 className="text-3xl font-bold tracking-tight mb-xs" style={{ color: 'var(--dash-text)' }}>
        {name ? `${greeting}, ${name}` : 'Welcome back'}
      </h1>
      <p className="sf-caption">{dateStr} &middot; {timeStr}</p>
    </div>
  );
}
