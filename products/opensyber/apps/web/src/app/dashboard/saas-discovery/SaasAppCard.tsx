'use client';

import { Clock, Users } from 'lucide-react';
import { type SaasApp, RISK_COLORS, CATEGORY_COLORS } from './types';

interface Props {
  app: SaasApp;
  onRevoke: (id: string) => void;
}

export function SaasAppCard({ app, onRevoke }: Props): React.ReactElement {
  const isRisky =
    app.riskLevel === 'Critical' || app.riskLevel === 'High';

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 hover:bg-neutral-800/30 transition">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white ${app.color}`}
        >
          {app.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-medium">{app.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs border ${RISK_COLORS[app.riskLevel]}`}
            >
              {app.riskLevel}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_COLORS[app.category]}`}
            >
              {app.category}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            {app.oauthPermissions}
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {app.users} users
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(app.lastSeen).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      {isRisky && (
        <button
          onClick={() => onRevoke(app.id)}
          className="mt-4 w-full rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
        >
          Revoke Access
        </button>
      )}
    </div>
  );
}
