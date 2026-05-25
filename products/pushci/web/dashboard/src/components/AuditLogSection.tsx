import { usePlan } from '../hooks/usePlan';
import LockedFeature from './LockedFeature';

const SAMPLE_EVENTS = [
  { time: '2 min ago', user: 'shahar', action: 'User logged in', details: 'GitHub OAuth' },
  { time: '15 min ago', user: 'shahar', action: 'Secret updated', details: 'DEPLOY_KEY rotated' },
  { time: '1 hr ago', user: 'maya', action: 'Skill installed', details: 'lint-fix v2.1' },
  { time: '3 hr ago', user: 'shahar', action: 'Plan changed', details: 'Pro -> Team' },
  { time: '1 day ago', user: 'dan', action: 'Member invited', details: 'dan@example.com' },
];

export default function AuditLogSection() {
  const { hasFeature } = usePlan();

  if (!hasFeature('team')) {
    return (
      <LockedFeature
        title="Audit Logs"
        requiredPlan="team"
        description="Audit logs are available on the Team plan."
      />
    );
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs text-zinc-500 uppercase tracking-wider">
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Action</th>
            <th className="px-4 py-3 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_EVENTS.map((e, i) => (
            <tr key={i} className="border-b border-surface-border/50 last:border-0">
              <td className="px-4 py-2.5 text-xs text-zinc-500">{e.time}</td>
              <td className="px-4 py-2.5 text-xs text-zinc-300">{e.user}</td>
              <td className="px-4 py-2.5 text-xs text-zinc-200">{e.action}</td>
              <td className="px-4 py-2.5 text-xs text-zinc-500">{e.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2.5 border-t border-surface-border">
        <button className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
          View All
        </button>
      </div>
    </div>
  );
}
