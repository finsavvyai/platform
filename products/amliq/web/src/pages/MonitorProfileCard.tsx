import { MonitorProfile } from '../api/monitoring';

interface Props { profile: MonitorProfile; onUpdate?: () => void }

export default function MonitorProfileCard({ profile }: Props) {
  const riskColors: Record<string, string> = {
    low: 'text-green-400', medium: 'text-yellow-400',
    high: 'text-orange-400', critical: 'text-red-400',
  };
  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--dash-surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--dash-border)' }}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium" style={{ color: 'var(--dash-text)' }}>{profile.entity_name}</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-text-secondary)' }}>{profile.frequency} | {profile.entity_type}</p>
        </div>
        <span className={`text-xs font-medium uppercase ${riskColors[profile.risk_level] || ''}`}
          style={riskColors[profile.risk_level] ? undefined : { color: 'var(--dash-text-tertiary)' }}>
          {profile.risk_level}
        </span>
      </div>
      <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--dash-text-secondary)' }}>
        <span>Last: {profile.last_screened_at || 'Never'}</span>
        <span>Matches: {profile.match_count}</span>
      </div>
    </div>
  );
}
