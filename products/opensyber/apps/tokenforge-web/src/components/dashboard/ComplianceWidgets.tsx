/** Stat card used on the compliance report page. */
export function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-neutral-400">{label}</p>
    </div>
  );
}

/** Threat breakdown table for compliance report. */
export function ThreatBreakdown({
  byType,
}: {
  byType: Record<string, number>;
}): React.ReactElement {
  const labels: Record<string, string> = {
    hijack_attempt: 'Hijack Attempts',
    trust_drop: 'Trust Score Drops',
    ip_change: 'IP Changes',
    geo_anomaly: 'Geo Anomalies',
    session_revoked: 'Sessions Revoked',
  };

  const entries = Object.entries(byType);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No threats detected this period.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([type, count]) => (
        <div key={type} className="flex items-center justify-between text-sm">
          <span className="text-neutral-300">{labels[type] ?? type}</span>
          <span className="font-mono text-neutral-400">{count}</span>
        </div>
      ))}
    </div>
  );
}

/** Status row for compliance checklist. */
export function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-300">{label}</span>
      <span className={ok ? 'text-green-400' : 'text-amber-400'}>
        {value}
      </span>
    </div>
  );
}
