'use client';

import { type ExposureEvent, SEVERITY_COLORS } from './types';

interface Props {
  events: ExposureEvent[];
  onFix: (id: string) => void;
  onIgnore: (id: string) => void;
  onCreateIncident: (id: string) => void;
}

export function ExposureEventsTable({
  events,
  onFix,
  onIgnore,
  onCreateIncident,
}: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold">Recent Exposure Events</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-900/50 border-b border-neutral-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Data Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Exposure</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Detected</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No exposure events detected.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-800/30 transition">
                  <td className="px-4 py-3 font-medium">{e.dataType}</td>
                  <td className="px-4 py-3 text-neutral-400 text-xs font-mono truncate max-w-[200px]">
                    {e.location}
                  </td>
                  <td className="px-4 py-3 text-neutral-400 text-xs">
                    {e.exposureType}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${SEVERITY_COLORS[e.severity]}`}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {new Date(e.detected).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onFix(e.id)}
                        className="rounded px-2 py-1 text-xs text-green-400 hover:bg-green-500/10 transition"
                      >
                        Fix
                      </button>
                      <button
                        onClick={() => onIgnore(e.id)}
                        className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-700/50 transition"
                      >
                        Ignore
                      </button>
                      <button
                        onClick={() => onCreateIncident(e.id)}
                        className="rounded px-2 py-1 text-xs text-info hover:bg-info/10 transition"
                      >
                        Incident
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
