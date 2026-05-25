import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import DeployTargetSelect from '../components/DeployTargetSelect';
import EnvVarsEditor from '../components/EnvVarsEditor';
import WebhookDisplay from '../components/WebhookDisplay';
import ConnectedPlatform from '../components/ConnectedPlatform';

export default function SettingsPage() {
  const [target, setTarget] = useState('docker-local');

  return (
    <div>
      <PageHeader title="Settings" description="Project configuration" />
      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Deploy Target</h2>
          <DeployTargetSelect value={target} onChange={setTarget} />
        </section>

        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Environment Variables</h2>
          <EnvVarsEditor />
        </section>

        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Webhook URL</h2>
          <WebhookDisplay />
        </section>

        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Connected Platform</h2>
          <ConnectedPlatform />
        </section>
      </div>
    </div>
  );
}
