import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import PlanInfoCard from '../components/PlanInfoCard';
import DeployTargetSelect from '../components/DeployTargetSelect';
import EnvVarsEditor from '../components/EnvVarsEditor';
import WebhookDisplay from '../components/WebhookDisplay';
import ConnectedPlatform from '../components/ConnectedPlatform';
import AccountLinking from '../components/AccountLinking';
import SSOSettings from '../components/SSOSettings';
import AuditLogSection from '../components/AuditLogSection';

export default function SettingsPage() {
  const [target, setTarget] = useState('docker-local');

  return (
    <div>
      <PageHeader title="Settings" description="Project configuration" />
      <div className="space-y-8">
        <PlanInfoCard />

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

        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Linked SCM Accounts</h2>
          <AccountLinking />
        </section>

        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Single Sign-On (SSO)</h2>
          <SSOSettings />
        </section>

        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Audit Log</h2>
          <AuditLogSection />
        </section>
      </div>
    </div>
  );
}
