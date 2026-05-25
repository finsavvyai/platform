import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { REGION_LABELS, PLAN_CONFIGS, type PlanConfig } from '@opensyber/shared';
import { DeleteInstanceButton } from '@/components/dashboard/DeleteInstanceButton';
import { ReferralSection } from '@/components/dashboard/ReferralSection';
import { BadgeEmbed } from '@/components/dashboard/BadgeEmbed';
import { ScorecardShareCard } from '@/components/dashboard/ScorecardShareCard';
import { SecretsList } from '@/components/dashboard/security/SecretsList';
import { AddSecretForm } from '@/components/dashboard/security/AddSecretForm';
import type { UserData, InstanceData, SecretData } from './settings-types';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  let user: UserData | null = null;
  let instance: InstanceData | null = null;
  let secrets: SecretData[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const [userRes, instanceRes] = await Promise.allSettled([
        apiClient<{ user: UserData }>('/api/user', { token }),
        apiClient<{ instances: InstanceData[] }>('/api/instances', { token }),
      ]);
      if (userRes.status === 'fulfilled') user = userRes.value.user;
      else console.error('[Settings] /api/user failed:', userRes.reason);
      if (instanceRes.status === 'fulfilled') instance = instanceRes.value.instances[0] ?? null;
      else console.error('[Settings] /api/instances failed:', instanceRes.reason);
      if (instance) {
        const vaultData = await apiClient<{ secrets: SecretData[] }>(`/api/instances/${instance.id}/secrets`, { token });
        secrets = vaultData.secrets;
      }
    }
  } catch (err) {
    console.error('[Settings] Failed to load data:', err instanceof Error ? err.message : err);
  }

  const planConfig = user ? PLAN_CONFIGS[user.plan] : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your subscription and instance configuration</p>
      </div>
      <SubscriptionCard user={user} planConfig={planConfig} />
      <InstanceCard instance={instance} />
      {instance && <GrowthKit instance={instance} />}
      {instance && <VaultCard instance={instance} secrets={secrets} />}
      <div className="mb-8"><ReferralSection /></div>
      {instance && <DangerZone instanceId={instance.id} />}
    </div>
  );
}

function SubscriptionCard({ user, planConfig }: { user: UserData | null; planConfig: PlanConfig | null }) {
  return (
    <div className="mb-8 rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Subscription</h3>
      {user && planConfig ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Current Plan</p>
              <p className="text-lg font-medium capitalize">{planConfig.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-text-secondary">Monthly</p>
              <p className="text-lg font-medium">${(planConfig.price / 100).toFixed(0)}/mo</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-text-secondary">Instance Limit</p><p className="font-medium">{planConfig.instanceLimit}</p></div>
            <div><p className="text-text-secondary">Audit Retention</p><p className="font-medium">{planConfig.auditLogRetentionDays} days</p></div>
            <div><p className="text-text-secondary">Unverified Skills</p><p className="font-medium">{planConfig.allowUnverifiedSkills ? 'Allowed' : 'Not allowed'}</p></div>
            <div><p className="text-text-secondary">Support</p><p className="font-medium capitalize">{planConfig.supportLevel}</p></div>
          </div>
          {user.plan !== 'team' && (
            <div className="pt-2"><Link href="/pricing" className="text-sm text-signal hover:text-signal-hover">Upgrade plan &rarr;</Link></div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Current Plan</p>
              <p className="text-lg font-medium">Free</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-text-secondary">Monthly</p>
              <p className="text-lg font-medium">$0/mo</p>
            </div>
          </div>
          <p className="text-xs text-text-dim">Unable to load subscription details. Your plan features are active.</p>
          <div className="pt-1"><Link href="/pricing" className="text-sm text-signal hover:text-signal-hover">View plans &rarr;</Link></div>
        </div>
      )}
    </div>
  );
}

function InstanceCard({ instance }: { instance: InstanceData | null }) {
  return (
    <div className="mb-8 rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Instance</h3>
      {instance ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between"><span className="text-text-secondary">Name</span><span className="font-medium">{instance.name}</span></div>
          <div className="flex items-center justify-between"><span className="text-text-secondary">Region</span><span className="font-medium">{REGION_LABELS[instance.region] ?? instance.region}</span></div>
          <div className="flex items-center justify-between"><span className="text-text-secondary">Hostname</span><span className="font-mono text-xs">{instance.hostname ?? 'Provisioning...'}</span></div>
          <div className="flex items-center justify-between"><span className="text-text-secondary">Gateway Token</span><span className="font-mono text-xs">{instance.hasGatewayToken ? 'Configured' : '\u2014'}</span></div>
          <div className="flex items-center justify-between"><span className="text-text-secondary">Instance ID</span><span className="font-mono text-xs text-text-dim">{instance.id}</span></div>
        </div>
      ) : (
        <p className="text-sm text-text-dim">No instance deployed.{' '}<Link href="/pricing" className="text-signal hover:text-signal-hover">Deploy one &rarr;</Link></p>
      )}
    </div>
  );
}

function GrowthKit({ instance }: { instance: InstanceData }) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Growth Kit</h3>
        <p className="text-sm text-text-secondary">Give customers proof, make launches more shareable, and create lightweight product-led loops.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ScorecardShareCard instanceId={instance.id} instanceName={instance.name} />
        <BadgeEmbed instanceId={instance.id} />
      </div>
    </div>
  );
}

function VaultCard({ instance, secrets }: { instance: InstanceData; secrets: SecretData[] }) {
  return (
    <div className="mb-8 rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Credential Vault</h3>
      <p className="text-sm text-text-secondary mb-4">Store secrets that are encrypted at rest and injected into your agent as environment variables.</p>
      <div className="space-y-4">
        <SecretsList instanceId={instance.id} initialSecrets={secrets} />
        <AddSecretForm instanceId={instance.id} />
      </div>
    </div>
  );
}

function DangerZone({ instanceId }: { instanceId: string }) {
  return (
    <div className="rounded border border-red-500/20 bg-red-500/5 p-6">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-red-400">
        <AlertTriangle className="h-5 w-5" />Danger Zone
      </h3>
      <p className="text-sm text-text-secondary mb-4">Deleting your instance will permanently destroy all data, credentials, and installed skills. This action cannot be undone.</p>
      <DeleteInstanceButton instanceId={instanceId} />
    </div>
  );
}
