import { MonitorPlay } from 'lucide-react';
import SessionRecordingsClient from './SessionRecordingsClient';

export const metadata = { title: 'Session Recordings' };

export default function SessionRecordingsPage(): React.ReactElement {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <MonitorPlay className="h-7 w-7 text-info" />
          <h1 className="text-4xl font-bold">Session Recordings</h1>
        </div>
        <p className="text-sm text-neutral-400">
          Record, review, and audit all privileged sessions across your infrastructure
        </p>
      </div>
      <SessionRecordingsClient />
    </div>
  );
}
