import { ShieldAlert } from 'lucide-react';
import { AitmTelemetryPanel } from './AitmTelemetryPanel';

export const metadata = {
  title: 'AitM Telemetry — TokenForge',
  description: 'Adversary-in-the-middle anomaly telemetry for a bound device.',
};

export default function AitmThreatsPage(): React.ReactElement {
  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-5 w-5 text-alert" />
            <h1 className="text-2xl font-bold">AitM Telemetry</h1>
          </div>
          <p className="text-sm text-text-secondary max-w-2xl">
            Inspect what the AitM heuristic engine has seen for a bound device:
            origin/SNI mismatch, latency floor, UA drift, channel-binding state.
            A high trust score with zero anomalies is the happy path. Repeated
            high-confidence anomalies on a single device are a signal to revoke.
          </p>
        </div>
      </div>

      <AitmTelemetryPanel />
    </div>
  );
}
