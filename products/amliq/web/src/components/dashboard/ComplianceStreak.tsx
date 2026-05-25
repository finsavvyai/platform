import React from 'react';

interface ComplianceStreakProps {
  streakDays: number;
}

const GOLD = '#C9A96E';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCaption(days: number): string {
  if (days >= 30) return 'Outstanding';
  if (days >= 7) return 'Great momentum';
  return 'Keep going';
}

export function ComplianceStreak({ streakDays }: ComplianceStreakProps) {
  const caption = getCaption(streakDays);

  return (
    <div className="boutique-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p
          className="text-xs font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--dash-text-tertiary)' }}
        >
          Zero Critical Alerts
        </p>
        <span
          className="text-sm font-bold"
          style={{ color: GOLD }}
          aria-label={`${streakDays} day streak`}
        >
          🔥 {streakDays} day streak
        </span>
      </div>

      <div className="flex items-center gap-2">
        {DAYS.map((day, i) => {
          // dot index 0 = 6 days ago, index 6 = today
          const daysAgo = 6 - i;
          const filled = daysAgo < streakDays;
          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <div
                className="w-4 h-4 rounded-full transition-colors duration-300"
                style={{ background: filled ? GOLD : 'rgba(255,255,255,0.12)' }}
                title={`${day}: ${filled ? 'no critical alerts' : 'data unavailable'}`}
              />
              <span
                className="text-[10px]"
                style={{ color: 'var(--dash-text-tertiary)' }}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: 'var(--dash-text-secondary)' }}>
        {caption} — no critical alerts for {streakDays} consecutive days
      </p>
    </div>
  );
}
